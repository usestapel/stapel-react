---
"@stapel/chat-react": minor
---

The default skin becomes visible, and the pair is regenerated against
stapel-chat 0.6.0.

**Four skin demos, 4/4 under the strict default-skin gate.** `ConversationListPanel`,
`ConversationThreadPanel`, `StartChatButton` and `SignInLink` each get a demo
that imports the component from `src/default`, carries a `viewport: "phone"`
variant and declares a distinct `step`. Every variant is SEEDED through the
harness's new `seedInbox`/`seedThread`, so its first paint is the state it is
named for — a shot runner keeps the first frame, and four spinners under four
names is worse than one honest demo.

`test/demos.test.tsx` now runs `assertVariantsRenderDistinctly`, the runtime
half of the C-SAMESHOT guard this package was missing. It immediately caught a
demo that declared `step: "sign_in"` and rendered the signed-in button:
"signed out" is not derived from `viewerId`, it is read off core's mandate axis,
so the demo now names its principal through `<MandateProvider>`.

**Two accessibility/mobile defects fixed, both found by drawing the phone.**

- The unread badge carried its sentence in `title=` — a browser hover, which
  does not exist on touch, cannot be reached by keyboard, and is announced
  inconsistently (some readers say it INSTEAD of the label). It is now the
  badge's accessible name: `role="img"` + `aria-label`, because an `aria-label`
  on a bare `<span>` names nothing.
- The thread header was a nowrap row holding a title and the transport tag. The
  degradation copy is a full sentence, so at 390px the flex line could not
  shrink below its content and the one thing on the screen a person can act on
  went off the edge. The header wraps and the tag's text wraps inside it.

**Regenerated against stapel-chat 0.6.0** (the released tag; 0.6.1 is in flight
and not on PyPI). The typed surface gains `MessageResponse.rev_seq` — the
journal cursor, required — plus `client_msg_id`, `edited`/`deleted` and their
timestamps, `ConversationResponse.subject`/`stream_key`/`socket_path`, and the
subject endpoints: 10 paths, 13 operations, 65 error keys (was 54).

The 11 new stapel-chat-owned error codes are authored in `ru` and `es` — the
module ships no `translations/` of its own, so a key the pair does not write is
a key a Russian or Spanish host reads in English. `error.403.chat_send_refused`
and `error.503.chat_blocks_unavailable` deliberately do not name the block:
upstream refuses a send and a new direct thread with one and the same code so
that a block cannot be detected from outside, and a translation that named it
would leak what the contract is built to withhold.

**Declares `@stapel/tokens-antd`.** `src/default/` imports it; the package
never listed it, so the pair did not typecheck.

**Not fixed here, and now stated at the top of MODULE.md**: `src/realtime/`
speaks stapel-chat's pre-0.3.0 wire and cannot read a single frame a released
backend sends — including `ping`, so the heartbeat is never answered. Tracked
as CHAT-RT-CUTOVER against `@stapel/realtime`.
