/**
 * THE COMPOSE SIDE — the pickers, and what is pending.
 *
 * Two controls and not one: the `accept` string each offers is built from the
 * stapel-cdn INTAKE its files land in — the same allowlist the refusal is built
 * from — so the picker and the gate cannot disagree. One picker offering the
 * union would let a person choose a file the intake it goes to will refuse.
 *
 * The chips are the state a person is actually waiting in, and what they show
 * is the STEP rather than a percentage: `fetch` cannot observe how much of a
 * request body has gone out, so a moving bar here would be animated rather than
 * measured. The two seeded variants photograph the two waits that block a send
 * — "still going" and "one of them failed" — because those are different
 * sentences with different next actions.
 *
 * ── Why the seeded variants carry a BAG and not an uploader ───────────────
 *
 * A static catalogue render never flushes a promise, so a demo that drove the
 * real hook with a canned uploader would photograph the empty list three times
 * under three names — which is worse than not declaring the variants at all.
 * The bag is the component's whole input and `test/attachments.test.tsx` proves
 * the REAL hook produces exactly these shapes (uploading, failed, the two
 * blocks, what reaches the wire); this file's job is the photograph of them.
 * The `empty` variant is the live hook, because that state needs no promise.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { CdnProvider, createCdnRuntime } from "@stapel/cdn-react";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  AttachButton,
  AttachmentChips,
  VoiceAttachButton,
} from "../src/default/ComposeAttachments.js";
import { CHAT_I18N_KEYS, useAttachmentDraft } from "../src/index.js";
import type {
  AttachmentDraftBag,
  AttachmentDraftItem,
  AttachmentUpload,
} from "../src/index.js";
import { ChatDemoHarness, DEMO_BASE, DEMO_PHOTO } from "./_harness.js";

/** A CDN nothing in this catalogue ever reaches: no demo uploads bytes. */
const demoCdnFetch: typeof globalThis.fetch = (() =>
  Promise.resolve(
    new Response(JSON.stringify({ exists: false, type: null, file: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  )) as typeof globalThis.fetch;

const idle: AttachmentUpload = () => new Promise(() => undefined);

function item(overrides: Partial<AttachmentDraftItem>): AttachmentDraftItem {
  return {
    id: "a1",
    name: "kitchen.png",
    bytes: 420_000,
    type: "image",
    medium: "image",
    phase: "uploading",
    step: null,
    key: null,
    descriptor: null,
    previewUrl: null,
    error: null,
    ...overrides,
  };
}

function bag(
  items: readonly AttachmentDraftItem[],
  settled: AttachmentDraftBag["settled"]
): AttachmentDraftBag {
  return {
    items,
    add: () => undefined,
    remove: () => undefined,
    retry: () => undefined,
    clear: () => undefined,
    canAdd: actionAvailable(),
    settled,
    hasAttachments: items.length > 0,
    payload: [],
  };
}

function Frame(props: { children: ReactElement }): ReactElement {
  const [runtime] = useState(() =>
    createCdnRuntime({ baseUrl: `${DEMO_BASE}/cdn`, fetch: demoCdnFetch })
  );
  return (
    <ChatDemoHarness>
      <CdnProvider runtime={runtime}>{props.children}</CdnProvider>
    </ChatDemoHarness>
  );
}

/** The live hook, for the one state a static render can actually reach. */
function LiveEmpty(props: { voice?: boolean }): ReactElement {
  const draft = useAttachmentDraft({ upload: idle });
  return (
    <Flex vertical gap={spacing[3]}>
      <AttachmentChips draft={draft} />
      <Flex gap={spacing[2]} wrap>
        <AttachButton draft={draft} kind="media" />
        <AttachButton draft={draft} kind="file" />
        {props.voice === true ? <VoiceAttachButton draft={draft} /> : null}
      </Flex>
    </Flex>
  );
}

function Seeded(props: { draft: AttachmentDraftBag }): ReactElement {
  return (
    <Flex vertical gap={spacing[3]}>
      <AttachmentChips draft={props.draft} />
      <Flex gap={spacing[2]} wrap>
        <AttachButton draft={props.draft} kind="media" />
        <AttachButton draft={props.draft} kind="file" />
      </Flex>
    </Flex>
  );
}

export default defineDemo({
  id: "chat.compose-attachments",
  title: "Attaching to a message",
  description:
    "The pickers, the microphone and the pending list. Each picker's accept string comes from the intake its files go to, so it can never offer what the gate will refuse; a voice note is recorded rather than picked and joins the same list as an audio chip, bound for POST /upload/audio/. A chip names the step the upload is on — there is no honest byte-percentage behind fetch, so nothing here draws a bar — and carries the two ways out: remove it, or try it again.",
  component: AttachmentChips,
  covers: ["AttachButton", "VoiceAttachButton"],
  tokens: ["surface-sunken", "text-muted"],
  variants: {
    empty: {
      description:
        "Nothing attached: the two controls, and no list at all. A strip that reserved space for chips nobody added would push the send button down for no reason.",
      viewport: "phone",
      step: "idle",
      render: () => (
        <Frame>
          <LiveEmpty />
        </Frame>
      ),
    },
    voice: {
      description:
        "The same row with the microphone a thread owner switched on (`<ConversationThreadPanel voice>`). It is cdn-react's own control, handing its take to the draft as an audio attachment — so the upload, the wait and the retry are the ones every other chip has.",
      viewport: "phone",
      step: "idle",
      render: () => (
        <Frame>
          <LiveEmpty voice />
        </Frame>
      ),
    },
    uploading: {
      description:
        "Three attachments in flight, each naming the STEP it is on. The picture shows itself from a local object URL the instant it was picked — long before any server has seen it — the voice note says what it is rather than the timestamped filename it is stored under, and the send control is blocked with «wait for the attachments».",
      viewport: "phone",
      step: "uploading",
      render: () => (
        <Frame>
          <Seeded
            draft={bag(
              [
                item({ step: "cdn.phase.hashing", previewUrl: DEMO_PHOTO }),
                item({
                  id: "a2",
                  name: "receipt.pdf",
                  type: "file",
                  medium: "file",
                  bytes: 250_000,
                  step: "cdn.phase.uploading",
                }),
                item({
                  id: "a4",
                  name: "voice-2026-09-14T10-00-00-000.webm",
                  type: "audio",
                  medium: "audio",
                  bytes: 84_000,
                  step: "cdn.phase.uploading",
                }),
              ],
              actionBlocked(CHAT_I18N_KEYS.attachBlockedPending)
            )}
          />
        </Frame>
      ),
    },
    failed: {
      description:
        "One did not go. «Remove or retry» is a different next action from «wait», which is why the draft carries two blocks and not one — and the retry sends the SAME bytes rather than asking for a re-pick.",
      viewport: "phone",
      step: "failed",
      render: () => (
        <Frame>
          <Seeded
            draft={bag(
              [
                item({
                  id: "a3",
                  name: "clip.mp4",
                  type: "video",
                  medium: "video",
                  bytes: 18_000_000,
                  phase: "failed",
                  error: new Error("the intake refused these bytes"),
                }),
              ],
              actionBlocked(CHAT_I18N_KEYS.attachBlockedFailed)
            )}
          />
        </Frame>
      ),
    },
  },
});
