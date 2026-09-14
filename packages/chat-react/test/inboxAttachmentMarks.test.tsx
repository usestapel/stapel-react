/**
 * AN INBOX ROW SAYS WHICH KIND OF ATTACHMENT, NOT JUST "SOME".
 *
 * The defect these tests pin: `preview_reason: "attachment"` said the last
 * line was a file rather than words and never WHICH, so the row drew one
 * paperclip for a photo, a voice note and a PDF alike. `model/previews.ts`
 * said so in its own doc comment and named the missing upstream field as the
 * thing that would make five marks possible.
 *
 * stapel-chat 0.10.0 ships it: `attachment_types` (the DISTINCT types, in
 * order of appearance) and `attachment_count` (the total), computed from the
 * message's own stored descriptors inside the query the list already runs. So
 * these tests drive rows through the real transport — the bodies a 0.10.0
 * server actually sends — and assert the marks the row paints.
 *
 * The arm that matters most is the LAST one: a deployment lags its pair every
 * day of a rollout, and a row that drew nothing for a server that cannot name
 * the types would be this pair reporting "no attachment" about a message it
 * simply cannot see inside.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationListPanel } from "../src/default/index.js";
import { inboxPreviewGlyph, inboxPreviewMarks } from "../src/index.js";
import type { Conversation, LastMessage } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import {
  BUYER,
  conversation,
  conversationPage,
  lastMessage,
  legacyLastMessage,
  wordlessLastMessage,
} from "./fixtures.js";

const PICTURE = "\u{1F5BC}\u{FE0F}";
const FILM = "\u{1F3AC}";
const MIC = "\u{1F3A4}";
const CLIP = "\u{1F4CE}";
const BLOCKED = "\u{1F6AB}";

/** One row, through the real transport, with the last line under test. */
async function rowFor(last: LastMessage): Promise<HTMLElement> {
  const rows: readonly Conversation[] = [
    conversation({ id: "c-1", last_message: last }),
  ];
  const server = mockServer({
    "GET /conversations": { body: conversationPage(rows) },
  });
  render(
    <TestHarness server={server} realtime={{ socketUrl: null }}>
      <ConversationListPanel viewerId={BUYER} />
    </TestHarness>
  );
  await waitFor(() => expect(screen.getByTestId("chat-row-preview")).toBeTruthy());
  return screen.getByTestId("chat-row-preview");
}

describe("the marks a row draws for its last line", () => {
  it("draws a PICTURE for a photo, where it used to draw a paperclip", async () => {
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["image"],
        attachment_count: 1,
      })
    );
    expect(row.textContent).toBe(`${PICTURE} Attachment`);
    // The sentence is still behind it. A mark alone is not a label, and a
    // reader who gets no pixels needs the word.
    expect(row.textContent).toContain("Attachment");
  });

  it("draws a MICROPHONE for a voice note", async () => {
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["audio"],
        attachment_count: 1,
      })
    );
    expect(row.textContent).toBe(`${MIC} Attachment`);
  });

  it("draws a FILM for a clip", async () => {
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["video"],
        attachment_count: 1,
      })
    );
    expect(row.textContent).toBe(`${FILM} Attachment`);
  });

  it("draws ONE mark per distinct type, in the order the message carries them", async () => {
    // Six attachments, three kinds: three marks and a +N for the three the
    // marks do not already stand for. Order of appearance, not sorted — the
    // first mark is the attachment the bubble leads with.
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["video", "image", "file"],
        attachment_count: 6,
      })
    );
    expect(row.textContent).toBe(`${FILM}${PICTURE}${CLIP}+3 Attachment`);
  });

  it("counts the +N off the MARKS, not off the types", async () => {
    // Six photos are one kind of row: one mark, and five more behind it.
    // `+6` would be counting the one the mark is already showing twice.
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["image"],
        attachment_count: 6,
      })
    );
    expect(row.textContent).toBe(`${PICTURE}+5 Attachment`);
  });

  it("collapses image and gif into ONE picture mark", async () => {
    // Two registry types, one thing a reader sees: a GIF is an image on the
    // wire and gets its own type so a bubble can offer a play affordance —
    // which is a distinction a 16px inbox mark cannot draw and should not try
    // to. Two identical marks side by side would read as a count, and the
    // count is what `+N` is: a photo and one more thing.
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["image", "gif"],
        attachment_count: 2,
      })
    );
    expect(row.textContent).toBe(`${PICTURE}+1 Attachment`);
  });

  it("falls back to the clip for a type this build has never heard of", async () => {
    // The registry is OPEN (`stapel_chat.attachments`, merge-over-builtins), so
    // a deployment that registers `sticker` sends `sticker`. An unknown name
    // must still draw an attachment, never vanish off the row.
    const row = await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["sticker"],
        attachment_count: 1,
      })
    );
    expect(row.textContent).toBe(`${CLIP} Attachment`);
  });

  it("draws the caption AND the mark for a captioned photo, and SAYS the mark", async () => {
    // `preview_reason` is null here, because there ARE words — so the marks
    // cannot be read off the reason, and the sentence beside them does not say
    // "Attachment" any more. That is the one arm where the strip has to be in
    // the accessibility tree rather than hidden from it.
    const row = await rowFor(
      lastMessage({
        body_preview: "here it is",
        preview_reason: null,
        attachment_types: ["image"],
        attachment_count: 1,
      })
    );
    expect(row.textContent).toBe(`${PICTURE} here it is`);

    const strip = screen.getByTestId("chat-row-preview-glyph");
    expect(strip.getAttribute("aria-hidden")).toBe(null);
    expect(strip.getAttribute("role")).toBe("img");
    expect(strip.getAttribute("aria-label")).toBe("Attachment");
  });

  it("hides the marks from a reader when the sentence already says them", async () => {
    // "paperclip Attachment" is the same fact twice in one row.
    await rowFor(
      wordlessLastMessage("attachment", {
        attachment_types: ["image"],
        attachment_count: 1,
      })
    );
    const strip = screen.getByTestId("chat-row-preview-glyph");
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    expect(strip.getAttribute("role")).toBe(null);
  });

  it("a TOMBSTONE draws its own mark and never what it had", async () => {
    // The server empties both fields for a withdrawn message, and the rule
    // here checks the reason anyway: a row announcing "and it had three
    // photos" is the one failure this projection must not have, whichever half
    // of the wire is answering.
    const row = await rowFor(
      wordlessLastMessage("deleted", {
        attachment_types: ["image", "image", "audio"],
        attachment_count: 3,
      })
    );
    expect(row.textContent).toBe(`${BLOCKED} Message deleted`);
  });

  it("KEEPS THE GENERIC MARK on a server that does not name the types", async () => {
    // The manifest claims `>=0.10 <0.11`, and a deployment lags its pair every
    // day of a rollout. The fields are ABSENT on that wire — not empty — and
    // the row keeps the one clip it drew before, exactly where it drew it.
    const row = await rowFor(
      legacyLastMessage({ body_preview: null, preview_reason: "attachment" })
    );
    expect(row.textContent).toBe(`${CLIP} Attachment`);
  });

  it("draws NO mark for a line of words with nothing attached", async () => {
    const row = await rowFor(lastMessage({ body_preview: "Still available?" }));
    expect(row.textContent).toBe("Still available?");
    expect(screen.queryByTestId("chat-row-preview-glyph")).toBe(null);
  });
});

describe("the rule itself", () => {
  it("answers nothing for a thread nobody has written in", () => {
    expect(inboxPreviewMarks(null)).toEqual({ glyphs: [], overflow: 0 });
    expect(inboxPreviewMarks(undefined)).toEqual({ glyphs: [], overflow: 0 });
    expect(inboxPreviewGlyph(null)).toBe(null);
  });

  it("caps the strip at three marks and folds the rest into the +N", () => {
    // The registry is open and the strip shares a 300px row with a name, a
    // badge and a clock: a fourth mark would push the preview off the row to
    // say what the number says in two characters.
    expect(
      inboxPreviewMarks(
        wordlessLastMessage("attachment", {
          attachment_types: ["image", "video", "audio", "file"],
          attachment_count: 4,
        })
      )
    ).toEqual({ glyphs: [PICTURE, FILM, MIC], overflow: 1 });
  });

  it("reads the count from the types when the server sent none", () => {
    // A body with types and no count is not a shape 0.10.0 produces, and the
    // marks still have to be right: the types are the floor for the total.
    const { attachment_count: _dropped, ...withoutCount } = wordlessLastMessage(
      "attachment",
      { attachment_types: ["image", "video"], attachment_count: 2 }
    );
    expect(inboxPreviewMarks(withoutCount)).toEqual({
      glyphs: [PICTURE, FILM],
      overflow: 0,
    });
  });

  it("ignores a count that is smaller than the marks rather than going negative", () => {
    expect(
      inboxPreviewMarks(
        wordlessLastMessage("attachment", {
          attachment_types: ["image", "video"],
          attachment_count: 1,
        })
      ).overflow
    ).toBe(0);
  });

  it("answers the FIRST mark from inboxPreviewGlyph — a photo, not a clip", () => {
    // The published single-glyph reader is kept for hosts drawing their own
    // row, and it tells them what the server says rather than the generic
    // answer it had no choice about before.
    expect(
      inboxPreviewGlyph(
        wordlessLastMessage("attachment", {
          attachment_types: ["image"],
          attachment_count: 1,
        })
      )
    ).toBe(PICTURE);
    expect(inboxPreviewGlyph(wordlessLastMessage("deleted"))).toBe(BLOCKED);
    expect(inboxPreviewGlyph(wordlessLastMessage("system"))).toBe(null);
  });
});
