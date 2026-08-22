---
"@stapel/chat-react": minor
---

New pair: `@stapel/chat-react` — the React half of `stapel-chat`, wiring both
of its transports behind one seam.

The storefront spec ruled polling-only for chat v1, and it was right about the
fleet it surveyed: the resumable consumer existed but `stapel_chat.routing`
exported nothing, so no host could mount it. stapel-chat 0.2.2 ships that mount
(`ws/chat/<uuid:conversation_id>`). So this pair carries **two transports and
one seam** — `useChatFreshness(streamKey, mapToQueryKeys, { fallbackRefetchInterval })`,
deliberately the signature the realtime substrate reserves for
`useSignalInvalidate`:

- a typed client for the module's own protocol — `hello{last_seq}` → `welcome`
  → replay → `replay_done` → live frames, seq-deduped on both ends, resume from
  the cursor the STORE holds (not the one the socket opened with), `error{resync}`
  forwarded verbatim, close codes 4401/4403 treated as answers rather than
  faults (no reconnect), everything else reconnected with jittered backoff;
- polling by `seq`, visibility-aware, with exponential backoff on consecutive
  failures — used whenever the socket is not carrying the stream, and for the
  inbox, which has no socket at all (the module fans out per thread).

Both ends do the same thing with what they learn: refetch the thread query,
whose query function advances the window BY SEQ
(`?direction=prev&anchor=<tip>`). The screens are written once and the tests
run against both transports. Writes never go over the socket: the `send` frame
is typed (a mirror must be complete) and never emitted, because its refusals
carry socket-local codes with no i18n key and no remediation, while
`POST …/messages` answers with the persisted row and a real error envelope.

Surface: `<ConversationList>` (server-computed unread counts, as a LoadState so
a badge cannot read "0" during an outage), `<ConversationThread>` (a contiguous
seq-ordered window — a hole is re-read, never stitched — with backfill and an
automatic, monotonic read marker), `<MessageComposer>` (code-point length
counting, so an emoji is one character on both sides of the wire), and
`<StartDirectChat>` — "message the seller", get-or-create over the module's own
participant-pair idempotency. An opt-in antd skin at `@stapel/chat-react/default`
and a member-surface nav entry.

Two contract facts recorded rather than papered over:
`CreateConversationRequest.scope_key` is ignored by the server, so a direct
thread cannot be scoped to a listing and the pair exposes no argument that
pretends otherwise; and stapel-chat ships no `translations/` directory, so the
pair authors ru/es for the twelve error keys the module owns (the
stapel-forms/stapel_attributes precedent) while the cross-cutting keys come from
stapel-core's catalogue.
