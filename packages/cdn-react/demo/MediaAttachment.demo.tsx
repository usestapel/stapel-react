/**
 * The READ side: what a `<type>/<hash>` looks like to somebody who did not
 * upload it.
 *
 * Every variant is seeded with a SNAPSHOT rather than a bare reference, which
 * is not a shortcut — it is the shape a list consumer actually uses. A chat
 * thread resolves thirty refs with one `useDescribe` and hands each bubble the
 * answer, so the component that re-asked per bubble would defeat the batch the
 * endpoint exists for.
 *
 * The four arms are the four media kinds, and the fifth variant is the one
 * every attachment renderer forgets: a reference that resolves to nothing.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MediaAttachment } from "../src/default/index.js";
import type { CdnRenderMeta } from "../src/index.js";
import { CdnDemoHarness } from "./_harness.js";

const HASH = "a".repeat(64);

/** A tiny `data:` picture, so a shot needs no network and no CDN. */
const swatch = (fill: string, w: number, h: number): string =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(w)}" height="${String(h)}">` +
      `<rect width="${String(w)}" height="${String(h)}" fill="${fill}"/></svg>`
  );

function meta(overrides: Partial<CdnRenderMeta>): CdnRenderMeta {
  return {
    ref: `product/${HASH}`,
    kind: "image",
    mime: "image/jpeg",
    ext: ".jpg",
    bytes: 1_800_000,
    width: 1600,
    height: 1200,
    aspect: 1.333333,
    square: false,
    animated: false,
    duration_ms: null,
    preview_b64: swatch("#8aa1c1", 16, 12),
    preview_kind: "blur",
    poster_url: null,
    meta_status: "ok",
    meta_reason: null,
    variants: [
      {
        tier: "original",
        branch: null,
        url: swatch("#6f8bb0", 480, 360),
        width: 1600,
        height: 1200,
      },
    ],
    ...overrides,
  } as CdnRenderMeta;
}

function Attachment(props: {
  meta: CdnRenderMeta | null;
  href?: string;
}): ReactElement {
  return (
    <CdnDemoHarness handlers={{}}>
      <MediaAttachment
        mediaRef={`product/${HASH}`}
        meta={props.meta}
        {...(props.href === undefined ? {} : { href: props.href })}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.attachment",
  title: "Media attachment",
  description:
    "One reference, drawn by its KIND: a photo picks its tier from this element, a video shows the poster still with the clip's length (an <img> cannot load an mp4), an audio row shows the waveform that IS its render, and a document shows facts because no pixels for it exist. A reference that resolves to nothing says so — data, with a 200 behind it, not a failure.",
  component: MediaAttachment,
  tokens: ["surface-sunken"],
  variants: {
    photo: {
      description: "The ladder, and the server's own micro-preview under it.",
      viewport: "phone",
      step: "image",
      render: () => <Attachment meta={meta({})} />,
    },
    video: {
      description:
        "The poster, with a measured length. `duration_ms` null would read 'not measured' — which is a different fact from an empty clip.",
      viewport: "desktop",
      step: "video",
      render: () => (
        <Attachment
          meta={meta({
            ref: `video/${HASH}`,
            kind: "video",
            mime: "video/mp4",
            ext: ".mp4",
            duration_ms: 92_000,
            preview_kind: "poster",
            poster_url: swatch("#3c4a5e", 480, 270),
            aspect: 1.777778,
            variants: [],
          })}
        />
      ),
    },
    audio: {
      description:
        "No still exists for an audio row, ever. The waveform is drawn whole — cropping an amplitude strip removes the amplitudes.",
      viewport: "desktop",
      step: "audio",
      render: () => (
        <Attachment
          meta={meta({
            ref: `audio/${HASH}`,
            kind: "audio",
            mime: "audio/mpeg",
            ext: ".mp3",
            bytes: 420_000,
            width: null,
            height: null,
            aspect: null,
            duration_ms: 7_400,
            preview_kind: "waveform",
            preview_b64: null,
            variants: [],
          })}
        />
      ),
    },
    document: {
      description: "The extension, the size, and a link the HOST supplied — a snapshot carries none.",
      viewport: "desktop",
      step: "file",
      render: () => (
        <Attachment
          href="https://example.invalid/invoice.pdf"
          meta={meta({
            ref: `file/${HASH}`,
            kind: "file",
            mime: "application/pdf",
            ext: ".pdf",
            bytes: 250_000,
            width: null,
            height: null,
            aspect: null,
            preview_b64: null,
            preview_kind: null,
            variants: [],
          })}
        />
      ),
    },
    gone: {
      description:
        "Deleted, never stored, or malformed. One dead attachment must not cost a thread its other thirty-nine.",
      viewport: "phone",
      step: "missing",
      render: () => <Attachment meta={null} />,
    },
  },
});
