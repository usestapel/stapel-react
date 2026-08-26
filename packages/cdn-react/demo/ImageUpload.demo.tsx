/** One slot: pick, phase, and the two outcomes worth naming. */
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { CDN_I18N_KEYS, ImageUpload } from "../src/index.js";
import type { UploadImageBag } from "../src/index.js";
import { CdnDemoHarness, DEMO_HIT, DEMO_MISS, demoImage, DemoCard } from "./_harness.js";

const PHASE_LABEL: Record<string, string> = {
  idle: CDN_I18N_KEYS.phaseQueued,
  hashing: CDN_I18N_KEYS.phaseHashing,
  checking: CDN_I18N_KEYS.phaseChecking,
  uploading: CDN_I18N_KEYS.phaseUploading,
  processing: CDN_I18N_KEYS.phaseProcessing,
  done: CDN_I18N_KEYS.phaseDone,
  canceled: CDN_I18N_KEYS.phaseCanceled,
  failed: CDN_I18N_KEYS.phaseFailed,
};

/**
 * The bytes the demo uploads to itself.
 *
 * A demo that waits for a click photographs the state BEFORE the click, which
 * is how `already-stored` came to render pixel-identically to `default`: the
 * one thing this pair exists for — recognising bytes the CDN already holds,
 * before sending any — was invisible in every shot of it. So the flow is run on
 * mount against the harness's canned server, and each variant is photographed
 * at the step it declares.
 */
const SEED_FILE = (): File =>
  new File(["seeded-demo-bytes"], "photo.jpg", { type: "image/jpeg" });

function SlotBody(props: { bag: UploadImageBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const started = useRef(false);
  const upload = bag.upload;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void upload(SEED_FILE());
  }, [upload]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <span>{t(PHASE_LABEL[bag.phase] ?? CDN_I18N_KEYS.phaseQueued)}</span>
      <span style={{ color: cssVar("text-muted") }}>{t(CDN_I18N_KEYS.pickHint, {
        formats: ".jpg .png .webp",
        maxMb: 20,
      })}</span>
      {bag.deduped ? (
        <span style={{ color: cssVar("text-muted") }}>{t(CDN_I18N_KEYS.deduped)}</span>
      ) : null}
    </div>
  );
}

function ImageUploadDemo(props: { deduped: boolean }): ReactElement {
  return (
    <CdnDemoHarness
      handlers={{
        "/file/exists/": props.deduped ? DEMO_HIT : DEMO_MISS,
        "/upload/avatar/": { image: demoImage(), message: "ok" },
      }}
    >
      <DemoCard heading="ImageUpload">
        <ImageUpload target={{ kind: "avatar" }}>
          {(bag) => <SlotBody bag={bag} />}
        </ImageUpload>
      </DemoCard>
    </CdnDemoHarness>
  );
}

/**
 * Two variants, and the second is the one this pair exists for: bytes the CDN
 * already holds are recognised BEFORE anything is sent, and the control says
 * so instead of pretending to upload.
 */
export default defineDemo({
  id: "cdn.single",
  title: "Single image slot",
  description:
    "The headless ImageUpload runs the dedup-first flow for one slot: validate against the deployment's own ceilings, hash, ask file/exists/, and only then POST. The bag reports the PHASE, never a fabricated percentage — fetch cannot observe request-body progress.",
  component: ImageUpload,
  tokens: ["card-bg", "card-border"],
  // ONE variant, and that is the fix rather than a shortcut. This demo used to
  // declare two — a pre-check MISS and a pre-check HIT — whose static renders
  // were byte-identical, because both were photographed before the click that
  // would have told them apart. Two names on one frame is worse than one name,
  // and the frame worth having is the hit: the property this whole package
  // exists to guarantee. The visual states of the SKIN are photographed by
  // `cdn.image-field`, where they are reachable without a click.
  variants: {
    "already-stored": {
      description:
        "A pre-check HIT, run on mount against the harness's canned server: the reference came back having sent NOTHING, and the control says so instead of pretending to upload.",
      viewport: "phone",
      step: "deduped",
      render: () => <ImageUploadDemo deduped />,
    },
  },
});
