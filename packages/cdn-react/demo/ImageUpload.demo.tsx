/** One slot: pick, phase, and the two outcomes worth naming. */
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

function SlotBody(props: { bag: UploadImageBag }): ReactElement {
  const t = useT();
  const { bag } = props;
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
  variants: {
    default: { render: () => <ImageUploadDemo deduped={false} /> },
    "already-stored": { render: () => <ImageUploadDemo deduped /> },
  },
});
