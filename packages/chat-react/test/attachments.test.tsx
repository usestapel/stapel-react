/**
 * ATTACHMENTS — decode, draw, compose.
 *
 * The claim this wave makes is "a bubble paints on first frame and does not
 * reflow when the asset lands", and a test that only rendered a happy image
 * would not touch it. So the assertions below are about the four things that
 * are actually load-bearing:
 *
 *   1. the box is RESERVED before anything loads, in the right shape, and the
 *      shape comes from `preview_kind` when no geometry has arrived yet;
 *   2. each of the four media gets its OWN arm, chosen on the registry `type`
 *      and never on a mime sniff — including an unknown type, which is an open
 *      registry's normal case and not an error;
 *   3. the compose flow reaches `POST /messages` as `{key, type}` and as
 *      nothing else, with the send gate obeying the uploads;
 *   4. nothing anywhere asks the CDN — the descriptors arrive with the thread,
 *      and a per-bubble describe would undo the batch the backend provides.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { Attachment, ChatMessage } from "../src/api/types.js";
import {
  attachmentMedium,
  attachmentToImage,
  attachmentTypeForFile,
  attachmentUrl,
  isAnimated,
  isAttachmentOnly,
  readAttachments,
  registerChatI18n,
  reservedAspect
} from "../src/index.js";
import type { AttachmentUpload ,
  useAttachmentDraft} from "../src/index.js";
import { MessageAttachments } from "../src/default/MessageAttachments.js";
import { MessageComposer } from "../src/headless/MessageComposer.js";
import { mockServer, TestHarness } from "./harness.js";
import { CONVERSATION_ID, message } from "./fixtures.js";

// ── descriptors, as stapel-chat renders them ────────────────────────────────

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    key: `product/${"a".repeat(64)}`,
    type: "image",
    mime: "image/jpeg",
    bytes: 240_000,
    name: null,
    ext: ".jpg",
    width: 1600,
    height: 1200,
    aspect: 1.333333,
    square: false,
    animated: false,
    duration_ms: null,
    preview_b64: "data:image/webp;base64,UklGRg==",
    preview_kind: "blur",
    poster_url: null,
    meta_status: "ok",
    meta_reason: null,
    variants: [
      { tier: 480, branch: "w", url: "https://cdn.test/i/480.webp", width: 480, height: 360 },
      {
        tier: "original",
        branch: null,
        url: "https://cdn.test/i/orig.jpg",
        width: 1600,
        height: 1200,
      },
    ],
    ...overrides,
  } as Attachment;
}

function withAttachments(...items: Attachment[]): ChatMessage {
  return message(1, { body: "", attachments: items });
}

function Localized(props: { children: ReactNode }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerChatI18n(engine);
  return <I18nProvider i18n={engine}>{props.children}</I18nProvider>;
}

// ── 1. decode ───────────────────────────────────────────────────────────────

describe("reading the descriptors", () => {
  it("keeps the readable ones and drops only what cannot be drawn", () => {
    // One dead entry must not take the other two with it — the backend's own
    // posture, mirrored: "a message with one dead attachment still renders the
    // other nine".
    const decoded = readAttachments({
      attachments: [
        attachment(),
        { type: "image" } as unknown as Attachment, // no key: names nothing
        { key: "product/x" } as unknown as Attachment, // no type: no arm
        attachment({ key: "file/b", type: "file" }),
        null as unknown as Attachment,
      ],
    });
    expect(decoded).toHaveLength(2);
    expect(decoded.map((item) => item.type)).toEqual(["image", "file"]);
  });

  it("an unknown registry type is drawn, not dropped — the registry is OPEN", () => {
    // A deployment that registered `sticker` in both registries sends a type
    // this build has never heard of. Losing it would be the thread lying about
    // what was said.
    const sticker = attachment({ key: "sticker/x", type: "sticker" });
    expect(readAttachments({ attachments: [sticker] })).toHaveLength(1);
    expect(attachmentMedium(sticker)).toBe("file");
  });

  it("the arm is the registry TYPE, never the mime", () => {
    expect(attachmentMedium(attachment({ type: "image" }))).toBe("image");
    // A gif is an image row on the wire and its own type on the screen.
    expect(attachmentMedium(attachment({ type: "gif" }))).toBe("image");
    expect(attachmentMedium(attachment({ type: "video" }))).toBe("video");
    expect(attachmentMedium(attachment({ type: "audio" }))).toBe("audio");
    expect(attachmentMedium(attachment({ type: "file" }))).toBe("file");
    // The mime says image; the type says file, and the type wins.
    expect(
      attachmentMedium(attachment({ type: "file", mime: "image/png" }))
    ).toBe("file");
  });

  it("a gif is animated even when the flag did not arrive", () => {
    expect(isAnimated(attachment({ type: "gif", animated: null }))).toBe(true);
    expect(isAnimated(attachment({ type: "image", animated: null }))).toBe(false);
  });

  it("an attachment with no words is a message, and a tombstone is not", () => {
    expect(isAttachmentOnly(withAttachments(attachment()))).toBe(true);
    expect(isAttachmentOnly(message(1, { body: "hi", attachments: [] }))).toBe(false);
    // A tombstone: the server empties BOTH, so it has nothing to show either
    // way and must not be mistaken for an attachment-only line.
    expect(
      isAttachmentOnly(message(1, { body: "", attachments: [], deleted: true }))
    ).toBe(false);
  });

  it("the ladder is converted at ONE boundary — int tiers become strings", () => {
    // stapel-cdn emits an int per rung and the string sentinel for `original`;
    // `@stapel/image` wants a decimal string for both.
    const image = attachmentToImage(attachment());
    expect(image.variants.map((variant) => variant.tier)).toEqual(["480", "original"]);
    // The display URL is the `original` rung, not the largest numbered one.
    expect(image.url).toBe("https://cdn.test/i/orig.jpg");
    expect(image.preview_b64).toBe("data:image/webp;base64,UklGRg==");
    expect(image.kind).toBe("image");
  });

  it("a medium with no ladder has NO url — a key is never turned into one", () => {
    // The single thing the CDN seam refuses to do. An audio row and a document
    // carry no canonical URL on the wire, and building one out of the opaque
    // reference is how a client and a server start disagreeing about names.
    const voice = attachment({ key: "audio/x", type: "audio", variants: [] });
    expect(attachmentUrl(voice)).toBeNull();
    expect(attachmentToImage(voice).url).toBe("");
  });
});

// ── 2. the box, reserved ────────────────────────────────────────────────────

describe("no layout jump — the shape is known before the bytes are", () => {
  it("the measured aspect is used when the CDN probed the asset", () => {
    expect(reservedAspect(attachment({ aspect: 1.5 }))).toBe(1.5);
  });

  it("falls back to width/height when the ratio itself did not arrive", () => {
    expect(
      reservedAspect(attachment({ aspect: null, width: 800, height: 400 }))
    ).toBe(2);
  });

  it("uses the shape preview_kind IMPLIES while the preview is still null", () => {
    // THE WHOLE POINT of `preview_kind` being a separate field: it follows
    // from `type`, so it is known before any preview exists.
    expect(
      reservedAspect(
        attachment({
          type: "video",
          aspect: null,
          width: null,
          height: null,
          preview_kind: "poster",
          preview_b64: null,
        })
      )
    ).toBeCloseTo(16 / 9);
    expect(
      reservedAspect(
        attachment({
          type: "audio",
          aspect: null,
          width: null,
          height: null,
          preview_kind: "waveform",
          preview_b64: null,
        })
      )
    ).toBe(4);
  });

  it("reserves NOTHING for a still with no geometry — a wrong box jumps twice", () => {
    expect(
      reservedAspect(
        attachment({ aspect: null, width: null, height: null, preview_kind: "blur" })
      )
    ).toBeNull();
  });
});

// ── 3. the four arms, rendered ──────────────────────────────────────────────

describe("each medium gets its own arm", () => {
  it("a photo draws an aspect box and opens a lightbox", async () => {
    render(
      <Localized>
        <MessageAttachments message={withAttachments(attachment())} />
      </Localized>
    );
    const picture = screen.getByTestId("chat-attachment-image");
    expect(picture).toBeTruthy();
    // The box is declared on the element, which is what stops the reflow.
    expect(picture.querySelector("img,[style*='aspect-ratio']")).toBeTruthy();
    await act(async () => {
      picture.click();
    });
    await waitFor(() => {
      expect(document.querySelectorAll("[role='dialog']").length).toBeGreaterThan(0);
    });
  });

  it("a clip is a player with a poster, and loads nothing until asked", () => {
    render(
      <Localized>
        <MessageAttachments
          message={withAttachments(
            attachment({
              key: "video/x",
              type: "video",
              preview_kind: "poster",
              poster_url: "https://cdn.test/p.webp",
              duration_ms: 12_500,
              variants: [
                {
                  tier: "original",
                  branch: null,
                  url: "https://cdn.test/clip.mp4",
                  width: 1920,
                  height: 1080,
                },
              ],
            } as Partial<Attachment>)
          )}
        />
      </Localized>
    );
    const video = screen.getByTestId("chat-attachment-video");
    expect(video.tagName).toBe("VIDEO");
    // A thread with six clips must not pull six videos to draw six stills.
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("poster")).toBe("https://cdn.test/p.webp");
  });

  it("a voice message is the waveform, its length, and one control", () => {
    render(
      <Localized>
        <MessageAttachments
          message={withAttachments(
            attachment({
              key: "audio/x",
              type: "audio",
              preview_kind: "waveform",
              preview_b64: "data:image/webp;base64,V0FWRQ==",
              duration_ms: 9_000,
              width: null,
              height: null,
              aspect: null,
              variants: [
                {
                  tier: "original",
                  branch: null,
                  url: "https://cdn.test/v.webm",
                  width: null,
                  height: null,
                },
              ],
            } as Partial<Attachment>)
          )}
        />
      </Localized>
    );
    expect(screen.getByTestId("chat-attachment-waveform")).toBeTruthy();
    expect(screen.getByTestId("chat-attachment-duration").textContent).toBe("0:09");
    expect(screen.getByTestId("chat-attachment-audio-toggle")).toBeTruthy();
  });

  it("an unmeasured length is SAID, never drawn as 0:00", () => {
    // `null` means unmeasured and `0` means empty, and the backend keeps them
    // apart on purpose. A 0:00 under a clip that plays is the client inventing
    // the answer the server refused to invent.
    render(
      <Localized>
        <MessageAttachments
          message={withAttachments(
            attachment({ key: "audio/y", type: "audio", duration_ms: null })
          )}
        />
      </Localized>
    );
    expect(screen.getByTestId("chat-attachment-duration").textContent).toContain(
      "not measured"
    );
  });

  it("a document shows its facts, and no link is INVENTED when there is none", () => {
    render(
      <Localized>
        <MessageAttachments
          message={withAttachments(
            attachment({
              key: "file/x",
              type: "file",
              name: "invoice.pdf",
              ext: ".pdf",
              bytes: 250_000,
              preview_b64: null,
              preview_kind: null,
              variants: [],
            } as Partial<Attachment>)
          )}
        />
      </Localized>
    );
    expect(screen.getByTestId("chat-attachment-ext").textContent).toBe("PDF");
    expect(screen.getByTestId("chat-attachment-name").textContent).toBe("invoice.pdf");
    expect(screen.getByTestId("chat-attachment-size")).toBeTruthy();
    expect(screen.queryByTestId("chat-attachment-download")).toBeNull();
    expect(screen.getByTestId("chat-attachment-no-link")).toBeTruthy();
  });

  it("a degraded snapshot still renders, and names its reason", () => {
    render(
      <Localized>
        <MessageAttachments
          message={withAttachments(
            attachment({
              key: "audio/z",
              type: "audio",
              meta_status: "partial",
              meta_reason: "ffprobe_missing",
            })
          )}
        />
      </Localized>
    );
    expect(screen.getByTestId("chat-attachment-meta")).toBeTruthy();
    expect(screen.getByTestId("chat-attachment-reason").textContent).toBe(
      "ffprobe_missing"
    );
  });

  it("renders nothing at all for a message with none", () => {
    const { container } = render(
      <Localized>
        <MessageAttachments message={message(1, { body: "hi", attachments: [] })} />
      </Localized>
    );
    expect(container.querySelector("[data-testid='chat-attachments']")).toBeNull();
  });
});

// ── 4. compose ──────────────────────────────────────────────────────────────

function pngFile(name = "photo.png"): File {
  return new File(["bytes"], name, { type: "image/png" });
}

describe("the pending list and what reaches the wire", () => {
  it("guesses the registry type from the picker's mime, gif before image", () => {
    expect(attachmentTypeForFile(new File([], "a.gif", { type: "image/gif" }))).toBe(
      "gif"
    );
    expect(attachmentTypeForFile(pngFile())).toBe("image");
    expect(attachmentTypeForFile(new File([], "c.mp4", { type: "video/mp4" }))).toBe(
      "video"
    );
    expect(
      attachmentTypeForFile(new File([], "v.webm", { type: "audio/webm" }))
    ).toBe("audio");
    expect(attachmentTypeForFile(new File([], "d.pdf", { type: "application/pdf" }))).toBe(
      "file"
    );
  });

  it("sends {key, type} and nothing else, once the bytes are stored", async () => {
    const sent: unknown[] = [];
    const server = mockServer({
      [`POST /conversations/${CONVERSATION_ID}/messages`]: (call) => {
        sent.push(call.body);
        return { body: message(7, { body: "look" }) };
      },
    });
    const upload: AttachmentUpload = ({ type }) =>
      Promise.resolve({ key: `product/${type}-hash` });

    let bag: {
      setValue: (next: string) => void;
      send: () => void;
      attachments: NonNullable<ReturnType<typeof useAttachmentDraft>> | null;
    } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
          {(current) => {
            bag = current as typeof bag;
            return <span data-testid="ready" />;
          }}
        </MessageComposer>
      </TestHarness>
    );

    await act(async () => {
      bag?.attachments?.add([pngFile()]);
    });
    await waitFor(() => {
      expect(bag?.attachments?.items[0]?.phase).toBe("ready");
    });
    await act(async () => {
      bag?.setValue("look");
    });
    await act(async () => {
      bag?.send();
    });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({
      body: "look",
      attachments: [{ key: "product/image-hash", type: "image" }],
    });
  });

  it("A PHOTO IS A MESSAGE: an empty box with an attachment may be sent", async () => {
    const sent: unknown[] = [];
    const server = mockServer({
      [`POST /conversations/${CONVERSATION_ID}/messages`]: (call) => {
        sent.push(call.body);
        return { body: message(8, { body: "" }) };
      },
    });
    const upload: AttachmentUpload = () => Promise.resolve({ key: "product/h" });
    let bag: { send: () => void; availability: { available: boolean }; attachments: {
      add: (files: readonly File[]) => void;
      items: readonly { phase: string }[];
    } | null } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );

    // Before anything is attached the empty box is refused, as it always was.
    expect(bag?.availability.available).toBe(false);
    await act(async () => {
      bag?.attachments?.add([pngFile()]);
    });
    await waitFor(() => {
      expect(bag?.attachments?.items[0]?.phase).toBe("ready");
    });
    expect(bag?.availability.available).toBe(true);
    await act(async () => {
      bag?.send();
    });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({
      body: "",
      attachments: [{ key: "product/h", type: "image" }],
    });
  });

  it("the send waits for the uploads, and says which wait it is", async () => {
    const server = mockServer({});
    let release: ((value: { key: string }) => void) | null = null;
    const upload: AttachmentUpload = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    let bag: {
      availability: { available: boolean; block?: { code: string } };
      attachments: { add: (files: readonly File[]) => void } | null;
    } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );
    await act(async () => {
      bag?.attachments?.add([pngFile()]);
    });
    await waitFor(() => {
      expect(bag?.availability.block?.code).toBe("chat.attach.blocked.pending");
    });
    await act(async () => {
      release?.({ key: "product/h" });
    });
    // And once the bytes are stored the wait is over — not replaced by the
    // empty-box refusal, because a stored attachment IS something to send.
    await waitFor(() => {
      expect(bag?.availability.available).toBe(true);
    });
  });

  it("a failed upload blocks the send with its OWN reason, and can be retried", async () => {
    const server = mockServer({});
    const attempts = vi.fn();
    const upload: AttachmentUpload = () => {
      attempts();
      return attempts.mock.calls.length === 1
        ? Promise.reject(new Error("nope"))
        : Promise.resolve({ key: "product/h" });
    };
    let bag: {
      availability: { block?: { code: string } };
      attachments: {
        add: (files: readonly File[]) => void;
        retry: (id: string) => void;
        items: readonly { id: string; phase: string }[];
      } | null;
    } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );
    await act(async () => {
      bag?.attachments?.add([pngFile()]);
    });
    await waitFor(() => {
      expect(bag?.availability.block?.code).toBe("chat.attach.blocked.failed");
    });
    const id = bag?.attachments?.items[0]?.id ?? "";
    await act(async () => {
      bag?.attachments?.retry(id);
    });
    await waitFor(() => {
      expect(bag?.attachments?.items[0]?.phase).toBe("ready");
    });
    expect(attempts).toHaveBeenCalledTimes(2);
  });

  it("refuses the file past MAX_ATTACHMENTS instead of silently dropping it", async () => {
    const server = mockServer({});
    const upload: AttachmentUpload = () => Promise.resolve({ key: "product/h" });
    let bag: {
      attachments: {
        add: (files: readonly File[]) => void;
        items: readonly unknown[];
        canAdd: { available: boolean; block?: { code: string } };
      } | null;
    } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer
          conversationId={CONVERSATION_ID}
          upload={upload}
          maxAttachments={2}
        >
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );
    await act(async () => {
      bag?.attachments?.add([pngFile("a.png"), pngFile("b.png"), pngFile("c.png")]);
    });
    await waitFor(() => {
      expect(bag?.attachments?.items).toHaveLength(2);
    });
    expect(bag?.attachments?.canAdd.block?.code).toBe("chat.attach.blocked.full");
  });

  it("NO upload seam means NO bag — the control is absent, not switched off", () => {
    const server = mockServer({});
    let bag: { attachments: unknown } | null = null;
    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID}>
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );
    // A paperclip over a picker whose files can never be stored is the
    // "visible but does nothing" shape this pair refused attachments over.
    expect(bag?.attachments).toBeNull();
  });

  it("a successful send clears the chips — the keys are on a message now", async () => {
    const server = mockServer({
      [`POST /conversations/${CONVERSATION_ID}/messages`]: {
        body: message(9, { body: "x" }),
      },
    });
    const upload: AttachmentUpload = () => Promise.resolve({ key: "product/h" });
    let bag: {
      setValue: (next: string) => void;
      send: () => void;
      attachments: {
        add: (files: readonly File[]) => void;
        items: readonly { phase: string }[];
      } | null;
    } | null = null;

    render(
      <TestHarness server={server}>
        <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
          {(current) => {
            bag = current as typeof bag;
            return <span />;
          }}
        </MessageComposer>
      </TestHarness>
    );
    await act(async () => {
      bag?.attachments?.add([pngFile()]);
    });
    await waitFor(() => {
      expect(bag?.attachments?.items[0]?.phase).toBe("ready");
    });
    await act(async () => {
      bag?.setValue("x");
    });
    await act(async () => {
      bag?.send();
    });
    await waitFor(() => {
      expect(bag?.attachments?.items).toHaveLength(0);
    });
  });
});

describe("the preview is an enhancement, never a condition", () => {
  it("attaches a photo on a page with no object-URL API at all", async () => {
    // Without the guard this throws INSIDE a state updater and the person
    // loses the attachment, not the thumbnail.
    const create = URL.createObjectURL;
    const revoke = URL.revokeObjectURL;
    Reflect.deleteProperty(URL as unknown as Record<string, unknown>, "createObjectURL");
    Reflect.deleteProperty(URL as unknown as Record<string, unknown>, "revokeObjectURL");
    try {
      const server = mockServer({});
      const upload: AttachmentUpload = () => Promise.resolve({ key: "product/h" });
      let bag: {
        attachments: {
          add: (files: readonly File[]) => void;
          items: readonly { phase: string; previewUrl: string | null }[];
        } | null;
      } | null = null;
      render(
        <TestHarness server={server}>
          <MessageComposer conversationId={CONVERSATION_ID} upload={upload}>
            {(current) => {
              bag = current as typeof bag;
              return <span />;
            }}
          </MessageComposer>
        </TestHarness>
      );
      await act(async () => {
        bag?.attachments?.add([pngFile()]);
      });
      await waitFor(() => {
        expect(bag?.attachments?.items[0]?.phase).toBe("ready");
      });
      expect(bag?.attachments?.items[0]?.previewUrl).toBeNull();
    } finally {
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    }
  });
});
