---
"@stapel/profiles-react": minor
---

The seller page is a person with sections, not one filtered list.

`<SellerPage>` (`/default`) plus the router's half of it — `SELLER_TAB`,
`SELLER_TABS`, `SELLER_DEFAULT_TAB`, `resolveSellerTab`, `sellerTabPath` — in
the main entry.

The closing-wave comparison inventory read `/u/<id>` as "functionally a
pre-filtered search results page scoped to one seller": the inventory, and
nothing else. No way to read what other buyers said, and nowhere for a seller
to say anything about themselves. The reference classified's seller page is
three sections. `<PublicProfilePage>` closed the identity half of that gap a
wave ago; this is the frame the three sections hang in.

**What the component owns, and what it refuses to.** The identity above, the
section bar, the section bodies. Every body is a `ReactNode` the host hands
in, because the three sections belong to three different pairs — the inventory
is `@stapel/search-react` or `@stapel/listings-react`, the reviews are
`@stapel/reviews-react`'s `<ReviewsPanel>`, the introduction is whatever the
deployment has to say. A tab strip is not a reason for this pair to depend on
three others. `identity` is a node for the same reason: a real storefront's
seller header is a composite of this pair's profile read, reviews-react's
owner roll-up and the host's own listing count.

**The URL is the host's.** `activeTab` / `onTabChange`, the same contract
`<PublicProfilePage userId>` uses — this pair carries no router. Uncontrolled
is a real mode rather than a fallback: a host with no router passes no
`activeTab` and the component keeps the section itself, while a host with one
sees a tab that does not move if it forgets to write the address, instead of a
page whose URL lies about what is on screen.

**`resolveSellerTab` is why an address cannot produce an empty page.** Every
value a router can hand in — `undefined` for the bare `/u/<id>`, `null`, `""`,
a stale segment, a typo — resolves onto a section the page actually has, and
onto the page's own first section when it does not have the fleet default. An
unguarded `activeKey` draws three tabs over nothing, which is the failure this
exists to make unreachable.

**`sellerTabPath` keeps one address per document.** The default section is the
inventory (somebody who arrives from a listing came to see the rest of what
this person sells) and it gets NO segment: `/u/<id>` stays the canonical seller
page, `/u/<id>/reviews` and `/u/<id>/overview` are the other two. A tab bar
that rewrote the bare address to `/u/<id>/listings` on first click would split
the page's history, its analytics and its share links in half; a host that
still wants to accept `/u/<id>/listings` from an old link routes it and
`resolveSellerTab` reads it as the same section.

Three section names in en/ru/es, the Russian ones the reference's own. antd's
`Tabs` carries the ARIA tab pattern; `test/sellerPage.test.tsx` asserts the
arrow-key walk and `Home`+`Enter` rather than trusting the library, and 7 of
its 17 assertions go red with the resolver and the default-section rule
removed. `/default` 13 of 16 KB, main entry 7.1 of 12 — no budget change.
