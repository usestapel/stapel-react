/** The in-place viewers: a photo with siblings to swipe, a video, a voice note. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MediaLightboxPanel } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_PHOTO } from "./fixtures.js";
import type { DocDocument } from "@stapel/docs-react";

/** A self-contained photo the catalogue can actually render — no network. */
const PHOTO_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">' +
      '<rect width="640" height="420" fill="#7d9c81"/>' +
      '<circle cx="500" cy="90" r="48" fill="#f4e9c9"/>' +
      '<path d="M0 420 L200 220 L340 340 L470 210 L640 380 L640 420 Z" fill="#4c6b52"/>' +
      "</svg>"
  );

const DOC_SECOND: DocDocument = {
  ...DOC_PHOTO,
  id: "d-photo-2",
  title: "Loading dock.png",
  mime_type: "image/png",
};

const DOC_CLIP: DocDocument = {
  ...DOC_PHOTO,
  id: "d-clip",
  title: "Warehouse walkthrough.mp4",
  mime_type: "video/mp4",
};

const DOC_VOICE: DocDocument = {
  ...DOC_PHOTO,
  id: "d-voice",
  title: "Site visit notes.m4a",
  mime_type: "audio/mp4",
};

function handlersFor(doc: DocDocument): DemoHandlers {
  return {
    [`/documents/${doc.id}`]: doc,
    [`/documents/${doc.id}/download`]: { url: PHOTO_URI },
  };
}

function Lightbox(props: {
  readonly doc: DocDocument;
  readonly siblings?: readonly DocDocument[];
}): ReactElement {
  return (
    <DriveDemoHarness handlers={handlersFor(props.doc)}>
      <MediaLightboxPanel
        document={props.doc}
        siblings={props.siblings ?? []}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.mediaLightbox",
  title: "Media lightbox",
  description:
    "The in-place viewer a viewable file opens in (viewing wave, stapel-docs 0.8.0): a photo full-size with tap-to-zoom and its listing-mates one swipe away, audio as an inline player, video as a player that can SEEK — the bytes ride the presigned download URL where the store signs one (MinIO/S3 honour Range on it), and the authorized content stream where it cannot (the 503 fallback, dev profile). Editable documents are untouched: they still route to the host's document surface.",
  component: MediaLightboxPanel,
  variants: {
    default: {
      viewport: "phone",
      step: "photo",
      description:
        "A photo, full-size, with a second photo in the folder: the arrows (and a horizontal swipe) step through the images the listing already had — no refetch, and Zoom is one tap.",
      render: () => (
        <Lightbox doc={DOC_PHOTO} siblings={[DOC_PHOTO, DOC_SECOND]} />
      ),
    },
    video: {
      viewport: "phone",
      step: "video",
      description:
        "A video file as a player. `playsInline` keeps a phone from hijacking into fullscreen on play; seeking works because the byte source answers single-range 206s on either transport.",
      render: () => <Lightbox doc={DOC_CLIP} />,
    },
    audio: {
      viewport: "phone",
      step: "audio",
      description: "An audio file as an inline player — a voice note is a file a drive actually holds, and 0.2.0 could only offer it as a download.",
      render: () => <Lightbox doc={DOC_VOICE} />,
    },
  },
});
