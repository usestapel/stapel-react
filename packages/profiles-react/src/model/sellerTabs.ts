/**
 * The seller page's SECTIONS, as data — the half of `<SellerPage>` a router
 * needs and a skin does not.
 *
 * A public seller page is three documents about one person: who they are,
 * what they are selling, and what buyers said. The composition walk
 * (`avito-vs-ours-2026-09-04` §30(a)) read ours as "functionally a
 * pre-filtered search scoped to one seller" — one flat list, with no way to
 * reach the other two. This module names the three sections once, so the
 * router and the skin cannot disagree about what `/u/<id>/reviews` means.
 *
 * ── Why it is not in `/default` ───────────────────────────────────────────
 *
 * A host resolves the URL segment in its route layer, which has no business
 * importing antd to find out whether `"reviews"` is a section. These are
 * plain strings and one pure function; `<SellerPage>` in the skin consumes
 * the same values.
 *
 * ── The default section is the inventory, not the introduction ────────────
 *
 * Somebody who opens a seller's page arrived from a listing and is deciding
 * whether to buy: the answer they came for is the rest of what this person
 * sells. {@link SELLER_DEFAULT_TAB} is therefore `listings`, and the bare
 * `/u/<id>` address is that section — see {@link sellerTabPath}, which
 * deliberately emits no segment for it so one page never has two addresses
 * competing for the same content.
 */

/** The three sections of a public seller page. */
export const SELLER_TAB = {
  /** The introduction: who this is, in their own words. */
  overview: "overview",
  /** What they are selling — the default ({@link SELLER_DEFAULT_TAB}). */
  listings: "listings",
  /** What buyers said. */
  reviews: "reviews",
} as const;

/** One of {@link SELLER_TAB}'s values. */
export type SellerTab = (typeof SELLER_TAB)[keyof typeof SELLER_TAB];

/** The sections in the order a seller page draws them. */
export const SELLER_TABS: readonly SellerTab[] = [
  SELLER_TAB.overview,
  SELLER_TAB.listings,
  SELLER_TAB.reviews,
];

/**
 * The section a bare `/u/<id>` shows — see this module's header for why it is
 * the inventory rather than the introduction.
 */
export const SELLER_DEFAULT_TAB: SellerTab = SELLER_TAB.listings;

/**
 * The section a URL names, narrowed to one this page actually has.
 *
 * Everything a router can hand in is an answer here: `undefined` (the bare
 * `/u/<id>`), `null`, `""`, a stale segment from a link written before a
 * section was removed, or somebody's typo. None of them may produce a page
 * with no section selected, which is what an unguarded `activeKey` does — an
 * empty frame under a name, with three tabs and nothing under any of them.
 *
 * `tabs` is the set this particular page HAS: a host that mounts two sections
 * passes two, and `/u/<id>/reviews` on that page resolves to the fallback
 * rather than to a section that is not there.
 *
 * The fallback is {@link SELLER_DEFAULT_TAB} when the page has it, and the
 * page's FIRST section otherwise — never a key outside `tabs`.
 */
export function resolveSellerTab(
  value: string | null | undefined,
  tabs: readonly string[] = SELLER_TABS
): string {
  const fallback = tabs.includes(SELLER_DEFAULT_TAB)
    ? SELLER_DEFAULT_TAB
    : (tabs[0] ?? SELLER_DEFAULT_TAB);
  if (value === null || value === undefined) return fallback;
  const trimmed = value.trim();
  return tabs.includes(trimmed) ? trimmed : fallback;
}

/**
 * The address of one section, under a seller's base path.
 *
 * `sellerTabPath("/u/42", "reviews")` → `"/u/42/reviews"`;
 * `sellerTabPath("/u/42", "listings")` → `"/u/42"`.
 *
 * The default section gets NO segment of its own. Two addresses for one
 * document is the defect this avoids — the canonical seller page is
 * `/u/<id>`, every link in the fleet already points at it, and a tab bar that
 * rewrote it to `/u/<id>/listings` on first click would split the page's
 * history, its analytics and its share links in half. A host that still wants
 * to ACCEPT `/u/<id>/listings` from an old link routes it: {@link
 * resolveSellerTab} reads it as the same section.
 */
export function sellerTabPath(base: string, tab: string): string {
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  return tab === SELLER_DEFAULT_TAB ? root : `${root}/${tab}`;
}
