/**
 * What an owner's row SAYS, when half its fields may still be a draft.
 *
 * A listing carries every user-editable value twice: the `*_draft` twin the
 * owner is writing, and the published field `publish` promotes it onto. The
 * public card reads the published half — correct for a shop window, and empty
 * for a listing that has never been published. A drafts tab built on it is a
 * column of blank rows.
 *
 * So the rule, in one place rather than at three call sites: **show the
 * published value when there is one, and the draft otherwise.** Not "always
 * the draft" — a live listing being edited must go on reading as what
 * strangers currently see, or the seller cannot tell what is on the shelf
 * from what they are about to put there.
 *
 * Pure, so `test/mine.test.tsx` asserts the table directly.
 */
import type { MyListingCard } from "../api/types.js";

/** Is this string field's published half absent? `""` counts: the model
 * declares `title = CharField(blank=True, default="")`, so an unpublished
 * listing carries the empty string, not `null`. */
function empty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * The row's heading: the published title, the draft title, or `undefined`.
 *
 * `undefined` and not the id: a caller that wants "Listing #41" as a last
 * resort can say so, and one that wants to render a placeholder can do that
 * instead. Inventing the fallback here would take the choice away.
 */
export function myListingTitle(row: MyListingCard): string | undefined {
  if (!empty(row.title)) return row.title as string;
  if (!empty(row.title_draft)) return row.title_draft as string;
  return undefined;
}

/**
 * The row's price, published half first. A decimal STRING on the wire
 * (`DecimalField` → `"200.00"`), passed through untouched — formatting it is
 * a skin's job and rounding it here would lose the trailing zero a currency
 * needs.
 */
export function myListingPrice(row: MyListingCard): string | undefined {
  if (!empty(row.price)) return row.price as string;
  if (!empty(row.price_draft)) return row.price_draft as string;
  return undefined;
}

/** The row's images, published half first — `[]` when neither has any. */
export function myListingImages(row: MyListingCard): readonly string[] {
  const published = row.images;
  if (published !== null && published !== undefined && published.length > 0) {
    return published;
  }
  return row.images_draft ?? [];
}

/**
 * Is what this row shows the DRAFT rather than what strangers see?
 *
 * The half of the rule a person is owed on screen: a row whose title came off
 * the draft twin is showing something nobody else can read yet, and a skin
 * that did not mark it would be quietly claiming otherwise.
 */
export function showsDraft(row: MyListingCard): boolean {
  return empty(row.title) && !empty(row.title_draft);
}

/**
 * Has this listing ever been in front of anybody?
 *
 * The server's own predicate, and it is the one that decides whether a row
 * has a page to link to: `moderation_status` defaults to `NOT_SUBMITTED`
 * (stapel-listings 0.20.0) and `publish_listing` sets `PENDING`
 * unconditionally, so DRAFT + NOT_SUBMITTED means "nobody has ever pressed
 * publish on this" and every other combination means somebody has.
 *
 * NOT {@link showsDraft}: that asks which HALF of the twin a row is showing,
 * which is a different question and answers `false` for an empty draft that
 * has no `title_draft` either — a row with no title at all would have been
 * given a link to a page that does not exist.
 *
 * A row from a server older than 0.20.0 has no `moderation_status` of
 * `not_submitted` to report, so it falls on the "has been submitted" side and
 * keeps its link: an extra link to a draft its owner can read is a smaller
 * harm than withholding one from a listing that is live.
 */
export function neverSubmitted(row: MyListingCard): boolean {
  return row.status === "draft" && row.moderation_status === "not_submitted";
}
