---
"@stapel/chat-react": patch
---

chat: report and block wait for the person they are about

The thread's overflow menu opens on the FIRST paint — the trigger is in the
header before `GET /conversations/` has answered — and until now it drew the
host's `report` and `block` entries in that frame, with
`ChatThreadActionSlotProps.counterpartyId: null`. The header has no
counterparty yet at that moment (`ConversationThreadPanel.tsx` computes
`others` off a conversation that is still `undefined`, so it hands `null`
down), which means a person could open the menu and press "block" against a
target this package had not read yet. A slot that takes `counterpartyId` as
the subject of its call — which is what both peers' controls do — was being
handed nothing to act on; a slot that guards on `null` was being asked to
invent a disabled state this package never specified.

**The entry is not drawn until there is a target.**
`default/ThreadActionsMenu.tsx` builds the slot props once, or not at all: a
`null` counterparty yields no props and neither host entry renders. When the
conversation settles the entries appear. The same rule answers the GROUP and
support cases, where there is no single other person and never will be — a
"block them" among three people is the identical guess, one that no amount of
waiting resolves.

**The menu is still never empty.** Leaving is this pair's own verb (stapel-chat
0.8.5, `DELETE /conversations/{id}`) and needs no target, so it is offered in
every one of those states — on the first paint, in a group, and on a
deployment that wired neither slot. Nothing about the dialog surface moves: a
bottom sheet on a phone, a modal above it, `@stapel/tokens-antd/skin`.

**No API change.** `ChatThreadActionSlotProps.counterpartyId` stays
`string | null` — a host may mount `<ThreadActionsMenu>` itself, and an
existing slot's `null` arm keeps compiling — but the shipped menu no longer
reaches it, which the type and the README now say out loud.

**The test the defect was found by.** `test/threadActions.test.tsx` asserted
`seen[0]?.counterpartyId` on the slot's FIRST render and was RED on CI and
green here: whether the conversation had settled by the time the menu opened
was a race between one `waitFor` tick and one canned fetch. That is now
deterministic in both directions. The menu is opened with no `await` before
it — the pre-settle frame, on purpose — the settled props are read with
`waitFor` + `seen.at(-1)`, and a separate assertion pins that NO render of
either slot was ever handed a null target, which is the part sampling the
settled props alone cannot see. A fifth case drives a three-participant
thread: the host entries never arrive, the leave entry does, and the slots are
not called at all. Both new assertions fail against the previous behaviour.

Measured on this dist with dependencies held constant: `dist/default` 18.77 KB
against the 18.78 KB the same entry measured for 0.14.0 — one conditional
replacing two, inside the rounding. Every ceiling is unchanged.
