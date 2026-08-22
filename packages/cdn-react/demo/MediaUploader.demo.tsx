/** The gallery bag: ten slots, an order, and a reason for every dead button. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, spacing } from "@stapel/tokens";
import { useActionGate, useT } from "@stapel/core";
import { CDN_I18N_KEYS, MediaUploader } from "../src/index.js";
import type { UploadQueueBag } from "../src/index.js";
import { CdnDemoHarness, DEMO_HIT, DEMO_MISS, demoImage, DemoCard } from "./_harness.js";

const HASH_B = "b".repeat(64);

function QueueBody(props: { bag: UploadQueueBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const addGate = useActionGate(bag.canAdd);
  const settledGate = useActionGate(bag.settled);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <span>
        {t(CDN_I18N_KEYS.galleryCount, {
          used: bag.capacity.used,
          max: bag.capacity.max,
        })}
      </span>
      {bag.items.length === 0 ? (
        <span style={{ color: cssVar("text-muted") }}>
          {t(CDN_I18N_KEYS.galleryEmpty)}
        </span>
      ) : (
        bag.items.map((item) => (
          <span key={item.id} style={{ color: cssVar("text-muted") }}>
            {t(item.deduped ? CDN_I18N_KEYS.deduped : CDN_I18N_KEYS.phaseDone)}
          </span>
        ))
      )}
      {addGate.reason === undefined ? null : (
        <span style={{ color: cssVar("text-muted") }}>{addGate.reason}</span>
      )}
      {settledGate.reason === undefined ? null : (
        <span style={{ color: cssVar("text-muted") }}>{settledGate.reason}</span>
      )}
    </div>
  );
}

function MediaUploaderDemo(props: {
  max: number;
  deduped: boolean;
  initialRefs?: readonly string[];
}): ReactElement {
  return (
    <CdnDemoHarness
      handlers={{
        "/file/exists/": props.deduped ? DEMO_HIT : DEMO_MISS,
        "/upload/image/": { image: demoImage({ hash: HASH_B }), message: "ok" },
      }}
    >
      <DemoCard heading="MediaUploader">
        <MediaUploader
          max={props.max}
          {...(props.initialRefs !== undefined
            ? { initialRefs: props.initialRefs }
            : {})}
        >
          {(bag) => <QueueBody bag={bag} />}
        </MediaUploader>
      </DemoCard>
    </CdnDemoHarness>
  );
}

/**
 * Three variants, because the interesting states of a gallery are the ones a
 * screenshot of a happy upload never shows: nothing picked yet, a reopened
 * draft, and a full gallery whose Add button has to say why it is off.
 */
export default defineDemo({
  id: "cdn.gallery",
  title: "Photo gallery queue",
  description:
    "The headless MediaUploader bounds a gallery at max references and hands a composer the ordered <type>/<hash> list to store. canAdd and settled are ActionAvailability, so a full gallery and an unfinished upload are two different sentences rather than one grey button.",
  component: MediaUploader,
  covers: ["CdnProvider"],
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <MediaUploaderDemo max={10} deduped={false} /> },
    "reopened-draft": {
      render: () => (
        <MediaUploaderDemo
          max={10}
          deduped={false}
          initialRefs={[`product/${"a".repeat(64)}`]}
        />
      ),
    },
    full: {
      render: () => (
        <MediaUploaderDemo
          max={1}
          deduped
          initialRefs={[`product/${"a".repeat(64)}`]}
        />
      ),
    },
  },
});
