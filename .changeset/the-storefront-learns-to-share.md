---
"@stapel/listings-react": minor
---

A listing can be sent to somebody, and the heart is where a thumb already is.

The owner's finding on the live storefront (2026-09-06): **no «Поделиться»
anywhere in the product.** Not a badly placed share control, not one behind a
menu — none. The only way to send somebody an offer was the address bar, which
on a phone is the hardest thing on the screen to reach and which carries the
SERP query the visitor arrived from, the page anchor and whatever tracking
parameters came with them. Beside that, the reference measurement (§23): our
listing page drew a 152px "Save to favourites" button with a word in it at
every width, where the reference classified draws a 44×44 glyph and puts a
share glyph next to it.

**`<ShareAction>` and `useShare`.** Two arms, and the DEVICE picks. Where
`navigator.share` exists — every phone, almost no desktop — a press opens the
platform's own sheet with `{title, text, url}`: the person's apps, in their
order, including the ones we have never heard of. Where it does not, it opens a
menu: copy the link, Telegram, WhatsApp, VK. The menu is a `Popover` and that
is a documented exception to `stapel/no-tooltip-in-skin` rather than a hole —
click-only trigger (a thumb and a cursor use one gesture), a live enabled
anchor, and four CONTROLS in the overlay rather than a sentence somebody has to
hover to read. Every outbound link is `target="_blank"` with **both** halves of
`rel="noopener noreferrer"`, and every field is percent-encoded: a seller's
title contains `&` and `#` in the wild, and a raw one silently truncates the
URL the recipient receives at the first `&`.

**The URL is the host's, never the address bar.** `shareUrl` is used verbatim
(a path resolved against the document base); `window.location.href` is the
fallback for a host that supplied nothing, which is honest for a bare mount and
wrong for an app that has a canonical route.

**`<ListingActions>` — the reader's two verbs as one cluster.** Icon-only, 44px
each, at the trailing edge of the title row (`actionsPlacement="gallery"` pins
them over the photographs instead; `"buy-box"` is the escape hatch for a host
laid out around the old position). The owner of a listing keeps the share
button and loses the heart: you do not favourite your own listing, and sending
somebody your own listing is the first thing a seller does. `actions` now takes
either the node it always took OR `{ share: false }` / `{ favorite: false }` —
a plain object was never a legal `ReactNode`, so the two arms cannot be
confused.

**The card heart moved onto the photograph.** `<ListingCard>` and
`<ListingSerpCard>` join `<ListingFeedCard>`, which has drawn it there since it
existed: trailing top corner — the one corner of the strip that is free, since
the dots own the bottom centre and the "3 of 16" counter the bottom trailing —
outside every anchor, and stopping a press from reaching the card behind it.
Only the blocked visitor's REASON stayed in its row under the card, because a
sentence has nowhere to live on top of a picture, and that row is now drawn
only when there is something to put in it rather than as an empty strip of
padding under every card on a page. The SERP card's action rail keeps whatever
the container put in it and nothing else.

**Two hit-target tiers, stated once as a class contract.** 44px for the page's
controls at every width; 36px for a card's with a cursor and 44px with a thumb
— the reference's own desktop measurement, and the glyph does not change size
in either tier. `actionRow.ts` holds both, so "how big is this control" has one
answer in this package instead of one per surface (the SERP heart was 32px, the
feed heart 40).

**Confirmations are said twice, and briefly.** "Link copied" stands inside the
open menu AND goes out as a two-second toast; the heart's fill is the state and
"Added to favourites" / "Removed from favourites" is the acknowledgement a
glyph in the corner of a photograph cannot carry. The message seam is antd's
own — `App.useApp().message` where the host mounted `<App>`, antd's static
`message` otherwise — so there is no new dependency, no host wiring, and no
confirmation that exists only in a toast a person may not have been looking at.

Ten i18n keys in en/ru/es. Measured with dependencies held constant: `index`
15.27 → 15.99 KB (ceiling 16 → 17; the old one was hit EXACTLY, and a budget
passed by rounding is a budget the next sentence fails), `default` 25.34 →
27.56 KB (ceiling 26 → 29).
