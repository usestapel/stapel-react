# @stapel/chat-react

## 0.3.1

### Patch Changes

- The floor states what the imports already require: `@stapel/core >=0.16.0`

  `SignInCta` and `SignInCtaProp` first shipped in `@stapel/core@0.16.0`, and
  this package has imported them since. The declared peer floor still said
  `>=0.15.0`, which npm would have honoured — installing a core with no such
  exports, and failing the host's typecheck on symbols this package's own
  `.d.ts` references.

## 0.3.0

### Minor Changes

- 3e2e2a3: A blocked control now carries the door, not just the reason: `signIn`

  `actionBlocked` ended the grey-rectangle incident by making every switched-off
  control state its reason. It did not end the next one. "Sign in to save this",
  "sign in to leave a review", "sign in to message the seller" are reasons whose
  next action is a LINK, and no pair took one — so the storefront had to put its
  own notice a screen away from each of the three controls it was about, and
  named it a gap rather than shipping it (Wave D, G-3).

  All three now take the same prop, core's `SignInCta`:

  ```tsx
  <ListingCard listing={row} signIn={{ href: `/login?next=${here}` }} />
  <ReviewsPanel target={target} signIn={{ href: `/login?next=${here}` }} />
  <StartChatButton sellerId={sellerId} signIn={{ onSignIn: () => openModal() }} />
  ```

  `{href}` **or** `{onSignIn}`, never both. Omit it and the reason renders alone,
  with no trailing whitespace where the link is not — a host with no sign-in
  route is a supported host.

  Two more things each pair had to fix to make the door reachable:

  - **listings**: the favourite's reason lived only in a `title` on a DISABLED
    button, which receives no pointer events in any browser — core's own
    `actionGate.ts` calls that "a reason nobody can read". It is now text beside
    the heart (`listings-card-favorite-blocked`), with the link inside it. The
    heart is still never hidden from a visitor.
  - **chat**: `StartDirectChat` had no mandate gate at all, so a visitor could
    press "message the seller" and collect a 401 — a refusal delivered at the one
    moment it is useless. The axis is now the first arm of its `firstBlock`, read
    through core's `MandateSource` seam. `member` may write; `guest`/`anonymous`
    are told to sign in; `asking` says we are still asking. `unavailable` stays
    AVAILABLE on purpose: that is what core answers outside a `<MandateProvider>`
    too, and a host that never wired the axis must not lose its button — "we
    could not ask" is not "you may not". This raises chat-react's `@stapel/core`
    floor to `>=0.15.0`, where `useMandate`/`matchMandate` shipped.

  The link's LABEL is each pair's own (`listings.card.sign_in`,
  `reviews.form.sign_in`, `chat.start.sign_in`), in all three locales — core
  floors `en` and `ru`, and these pairs also ship `es`.

## 0.2.0

### Minor Changes

- ca35e19: New pair: `@stapel/chat-react` — the React half of `stapel-chat`, wiring both
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
