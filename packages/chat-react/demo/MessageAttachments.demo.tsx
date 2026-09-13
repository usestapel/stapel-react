/**
 * WHAT A BUBBLE'S ATTACHMENTS LOOK LIKE — the four media, and the fifth case
 * every attachment renderer forgets.
 *
 * Each variant is seeded with a DESCRIPTOR rather than a reference, and that is
 * not a shortcut — it is the shape a thread actually holds. stapel-chat resolves
 * every key through one `cdn.describe_many` inside the query that fetched the
 * page, so a bubble is HANDED its geometry, its 16px preview and its variant
 * ladder. A renderer that asked the CDN per bubble would undo that batch and
 * turn a page of thirty messages into thirty requests.
 *
 * The variant to look hardest at is `still-generating`: the preview has not
 * been produced yet and the box is reserved anyway, because `preview_kind` is
 * known from `type` alone. That is the whole no-layout-jump claim, photographed
 * in the one state where it is possible to get it wrong.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MessageAttachments } from "../src/default/index.js";
import type { Attachment, ChatMessage } from "../src/api/types.js";
import { ChatDemoHarness, DEMO_PHOTO } from "./_harness.js";

const HASH = "a".repeat(64);

/** A wide strip, the shape stapel-cdn's `showwavespic` renders. */
const DEMO_WAVEFORM: string =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60">' +
      '<rect width="240" height="60" fill="#eef2f7"/>' +
      '<g fill="#7f9ec4">' +
      [...Array(40).keys()]
        .map((i) => {
          const h = 8 + ((i * 7) % 40);
          return `<rect x="${String(i * 6)}" y="${String(30 - h / 2)}" width="3" height="${String(h)}"/>`;
        })
        .join("") +
      "</g></svg>"
  );

function descriptor(overrides: Partial<Attachment>): Attachment {
  return {
    key: `product/${HASH}`,
    type: "image",
    mime: "image/jpeg",
    bytes: 1_800_000,
    name: null,
    ext: ".jpg",
    width: 1600,
    height: 1200,
    aspect: 4 / 3,
    square: false,
    animated: false,
    duration_ms: null,
    preview_b64: DEMO_PHOTO,
    preview_kind: "blur",
    poster_url: null,
    meta_status: "ok",
    meta_reason: null,
    variants: [
      {
        tier: "original",
        branch: null,
        url: DEMO_PHOTO,
        width: 1600,
        height: 1200,
      },
    ],
    ...overrides,
  } as Attachment;
}

function bubble(...items: Attachment[]): ChatMessage {
  return {
    id: "m-1",
    conversation_id: "c-1",
    seq: 1,
    rev_seq: 1,
    kind: "text",
    body: "",
    created_at: "2026-09-14T10:00:00Z",
    sender_id: "u-seller",
    reply_to: null,
    attachments: items,
    client_msg_id: null,
    edited: false,
    edited_at: null,
    deleted: false,
    deleted_at: null,
  } as ChatMessage;
}

function Bubble(props: { message: ChatMessage }): ReactElement {
  return (
    <ChatDemoHarness>
      <MessageAttachments message={props.message} />
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.attachments",
  title: "Message attachments",
  description:
    "One message's attachments, each drawn by its registry TYPE — which is the CDN's own kind name, never a sniff of the mime. A photo picks its tier from this element over the 16px preview; a clip shows the poster the CDN made and loads nothing until somebody presses play; a voice message is the rendered waveform, its length and one control, because there is no still to fall back to; a document has no pixels at all and none are invented. Every box is reserved before anything loads, from the measured aspect when there is one and from what preview_kind implies when there is not.",
  component: MessageAttachments,
  tokens: ["surface-sunken", "text-muted"],
  variants: {
    photo: {
      description:
        "The ladder, over the blur placeholder. Tapping it opens the picture whole — contain, not cover, because cropping the thing somebody tapped to look at is the one thing a lightbox must not do.",
      viewport: "phone",
      step: "image",
      render: () => <Bubble message={bubble(descriptor({}))} />,
    },
    clip: {
      description:
        "Poster plus a native player at preload=\"none\": a thread with six clips must not pull six videos over a phone connection to draw six still frames.",
      viewport: "phone",
      step: "video",
      render: () => (
        <Bubble
          message={bubble(
            descriptor({
              key: `video/${HASH}`,
              type: "video",
              mime: "video/mp4",
              ext: ".mp4",
              aspect: 16 / 9,
              duration_ms: 12_500,
              preview_kind: "poster",
              poster_url: DEMO_PHOTO,
              variants: [],
            } as Partial<Attachment>)
          )}
        />
      ),
    },
    voice: {
      description:
        "The waveform IS the render. stapel-cdn draws it once with showwavespic in the same pass that measured the length, so the client paints one <img> instead of looping a canvas over a float array.",
      viewport: "phone",
      step: "audio",
      render: () => (
        <Bubble
          message={bubble(
            descriptor({
              key: `audio/${HASH}`,
              type: "audio",
              mime: "audio/webm",
              ext: ".webm",
              bytes: 84_000,
              width: null,
              height: null,
              aspect: null,
              duration_ms: 9_000,
              preview_b64: DEMO_WAVEFORM,
              preview_kind: "waveform",
              variants: [],
            } as Partial<Attachment>)
          )}
        />
      ),
    },
    document: {
      description:
        "No pixels for a PDF exist, so none are invented: the extension, the name, the size. And no link here — a describe snapshot carries no canonical URL for a file, and building one out of the opaque key is the single thing this seam refuses to do, so the absence is STATED.",
      viewport: "phone",
      step: "file",
      render: () => (
        <Bubble
          message={bubble(
            descriptor({
              key: `file/${HASH}`,
              type: "file",
              mime: "application/pdf",
              ext: ".pdf",
              name: "warranty-card.pdf",
              bytes: 250_000,
              width: null,
              height: null,
              aspect: null,
              preview_b64: null,
              preview_kind: null,
              variants: [],
            } as Partial<Attachment>)
          )}
        />
      ),
    },
    "still-generating": {
      description:
        "THE STATE THE NO-LAYOUT-JUMP CLAIM IS ABOUT. The preview has not been produced yet and meta_status says why — but preview_kind follows from the type, so the box is already the right shape and nothing moves when the bytes land.",
      viewport: "phone",
      step: "partial",
      render: () => (
        <Bubble
          message={bubble(
            descriptor({
              key: `audio/${HASH}b`,
              type: "audio",
              mime: "audio/webm",
              ext: ".webm",
              width: null,
              height: null,
              aspect: null,
              duration_ms: null,
              preview_b64: null,
              preview_kind: "waveform",
              meta_status: "partial",
              meta_reason: "not_generated",
              variants: [],
            } as Partial<Attachment>)
          )}
        />
      ),
    },
  },
});
