---
"@stapel/listings-react": minor
"@stapel/reviews-react": minor
"@stapel/chat-react": minor
---

A blocked control now carries the door, not just the reason: `signIn`

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
