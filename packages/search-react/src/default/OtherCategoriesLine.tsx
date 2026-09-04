/**
 * `<OtherCategoriesLine>` — "Search in other categories: Cars 12 · Buses 3 ·
 * Motorhomes 1 · …", on ONE line, drawn from the answer that drew the cards.
 *
 * ## What it replaces
 *
 * A full-width block under the results with one row per category, fetched
 * separately and arriving after the page had settled. Two defects in one
 * control:
 *
 *  - **it was tall.** Fourteen sections became fourteen rows — a screen and a
 *    half of navigation under a list of listings, for information that fits
 *    in a sentence.
 *  - **it was late.** A second request meant the block appeared a beat after
 *    the cards and PUSHED them, on the one screen where a person has already
 *    started reading. The information was not even new: `/query` had already
 *    answered with `facet_meta.categories`, and the type-ahead had shown the
 *    same sections a keystroke earlier.
 *
 * This line renders in the SAME frame as the results, out of the same
 * response ({@link useOtherCategories}), so there is nothing to arrive late.
 * The single case that still needs a request — an empty result set, whose
 * candidate list is empty by definition — draws into a slot whose height is
 * reserved from the first frame, so the answer lands without moving anything.
 *
 * ## Pressing an entry narrows the search; it does not leave it
 *
 * The count beside a name is the count for THIS QUERY in that section — the
 * server's `facet_meta.categories`. A link to the bare category feed would
 * show a different, larger number, so the caption would be a lie one click
 * later. Each entry therefore writes the `category` parameter of the search
 * already on screen, keeping the query: press "Cars 12" and twelve results
 * follow.
 *
 * Without {@link OtherCategoriesLineProps.categoryHref} that state change is
 * ALL an entry does, so it is a plain `<button>` with no `href` — no address
 * to hover, no "open in a new tab", nothing a crawler can follow. `categoryHref`
 * turns the entry into a real `<a href>` without giving up the in-app
 * narrowing: a plain click still rewrites the query in place (a full
 * navigation would answer a different question than the one the count was
 * counted for), while a modified click — the browser's own "open in a new
 * tab/window" — is left alone and follows the address like any other link.
 *

 * ## Two rows on a phone, at most
 *
 * The cap is halved on the sheet surface ({@link OTHER_CATEGORIES_PHONE_LIMIT}),
 * and the collapsed line is clamped to two rows besides — a cap counts
 * entries, and it is name LENGTH that turns a line into a paragraph. Expanding
 * is the person's own press, and an expanded line is allowed to be as tall as
 * what they asked for.
 */
import { Fragment, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Typography } from "antd";
import { useDialogSurface } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { cssVar } from "@stapel/tokens";
import { useSearchState } from "../headless/SearchStateProvider.js";
import {
  OTHER_CATEGORIES_LIMIT,
  OTHER_CATEGORIES_PHONE_LIMIT,
  otherCategoryLeaf,
  useOtherCategories,
} from "../headless/useOtherCategories.js";
import type { OtherCategoryRow } from "../headless/useOtherCategories.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * The height the empty-result slot holds before its answer arrives.
 *
 * One text line. Reserving it is the whole difference between "the sections
 * appeared" and "the sections pushed the page", and it is reserved whether the
 * request ends with rows or with none.
 */
export const OTHER_CATEGORIES_SLOT_MIN_HEIGHT = 24;

/** Names an id path the pair cannot name on its own. Returning `undefined`
 * drops the row rather than printing a number at a person. */
export type OtherCategoryNamer = (category: string) => string | undefined;

/** Resolves an id path to a real, navigable address. Returning `undefined`
 * leaves the row's in-app narrowing as the only way to press it. */
export type OtherCategoryHrefResolver = (category: string) => string | undefined;

export interface OtherCategoriesLineProps {
  /** How many entries before the fold (default {@link OTHER_CATEGORIES_LIMIT}). */
  readonly limit?: number;
  /** The same, on the phone surface (default
   * {@link OTHER_CATEGORIES_PHONE_LIMIT}). */
  readonly phoneLimit?: number;
  /**
   * What a category id path is CALLED.
   *
   * The pair holds `"140/145"` and has no catalogue: naming it is the host's,
   * exactly as `categoryLabel` is for the chip. Without this the line still
   * draws every row the server named (a `/suggest` answer already in the
   * cache, or the empty-result path) and every path whose last segment is a
   * slug — and drops the rest, because "163 · 149" is not a sentence.
   */
  readonly categoryName?: OtherCategoryNamer;
  /**
   * A real address for a category id path, when the host has one — a
   * category page's own URL, most usefully.
   *
   * Without it every entry is a `<button>` with no `href`: it narrows the
   * search on click, and nothing else — no "open in a new tab", no address
   * to hover, nothing a crawler can follow. With it the entry becomes a real
   * `<a href>` (a middle-click, a ctrl/cmd-click, "open in new tab" all work
   * as they do for any link), while a plain click still narrows THIS search
   * in place rather than leaving it — the whole reason the count beside a
   * name is trustworthy is that it is a count for the query on screen, and a
   * full navigation to the host's address would be answering a different
   * question than the one the click asked.
   *
   * A row this returns nothing for keeps the in-app-only behaviour; the row
   * is dropped only when it has no NAME, exactly as without this prop.
   */
  readonly categoryHref?: OtherCategoryHrefResolver;
  /** Skip the read entirely — mirrors `<SearchResultsPane enabled>`. */
  readonly enabled?: boolean;
}

const ENTRY: CSSProperties = {
  padding: 0,
  height: "auto",
  // The line is text: an entry has to sit ON the baseline of the words around
  // it rather than in a button-shaped box of its own.
  verticalAlign: "baseline",
  fontSize: "inherit",
};

const COUNT: CSSProperties = { color: cssVar("text-subtle") };

/** How many rows the collapsed phone line may occupy. */
export const OTHER_CATEGORIES_PHONE_ROWS = 2;

/** The class the clamp is hung on. */
export const OTHER_CATEGORIES_CLASS = "stapel-search-other-categories";

/** The `href` the hoisted sheet is deduplicated by. */
export const OTHER_CATEGORIES_STYLE_HREF = "stapel-search-other-categories";

/**
 * The clamp — two rows, collapsed, on the phone.
 *
 * A SHEET rather than an inline style, for the same reason the rail's
 * scrollbar is one: `-webkit-line-clamp` needs `display:-webkit-box` and
 * `-webkit-box-orient` together, and a vendor property set through the DOM
 * style object is dropped by anything that does not already know it — which
 * is how a clamp silently stops clamping.
 */
export function otherCategoriesCss(): string {
  const clamped = `.${OTHER_CATEGORIES_CLASS}--clamped`;
  return [
    `${clamped}{display:-webkit-box;-webkit-box-orient:vertical;`,
    `-webkit-line-clamp:${String(OTHER_CATEGORIES_PHONE_ROWS)};overflow:hidden}`,
  ].join("");
}

interface Entry {
  readonly row: OtherCategoryRow;
  readonly name: string;
  readonly href?: string;
}

export function OtherCategoriesLine(
  props: OtherCategoriesLineProps
): ReactElement | null {
  const t = useT();
  const { setCategory } = useSearchState();
  const bag = useOtherCategories(
    props.enabled !== undefined ? { enabled: props.enabled } : {}
  );
  const surface = useDialogSurface();
  const phone = surface === "sheet";
  const [expanded, setExpanded] = useState(false);

  const limit = phone
    ? (props.phoneLimit ?? OTHER_CATEGORIES_PHONE_LIMIT)
    : (props.limit ?? OTHER_CATEGORIES_LIMIT);

  const entries: Entry[] = [];
  for (const row of bag.rows) {
    const name =
      props.categoryName?.(row.category) ?? row.name ?? otherCategoryLeaf(row.category);
    if (name === undefined) continue;
    const href = props.categoryHref?.(row.category);
    entries.push(href !== undefined ? { row, name, href } : { row, name });
  }

  const shown = expanded ? entries : entries.slice(0, limit);
  const hidden = entries.length - shown.length;

  if (entries.length === 0) {
    // Nothing to say, and nothing coming: say nothing. A reserved band under a
    // page that will never fill it is the same hole an empty filter column was.
    if (!bag.reserving) return null;
    return (
      <div
        data-testid="search-other-categories"
        data-reserved="on"
        data-source={bag.source}
        style={{ minBlockSize: OTHER_CATEGORIES_SLOT_MIN_HEIGHT }}
      />
    );
  }

  return (
    <Typography.Text
      type="secondary"
      data-testid="search-other-categories"
      data-source={bag.source}
      data-shown={shown.length}
      {...(bag.reserving ? { "data-reserved": "on" } : {})}
      className={
        phone && !expanded
          ? `${OTHER_CATEGORIES_CLASS} ${OTHER_CATEGORIES_CLASS}--clamped`
          : OTHER_CATEGORIES_CLASS
      }
      style={
        bag.reserving ? { minBlockSize: OTHER_CATEGORIES_SLOT_MIN_HEIGHT } : {}
      }
    >
      <style href={OTHER_CATEGORIES_STYLE_HREF} precedence="default">
        {otherCategoriesCss()}
      </style>
      {t(SEARCH_I18N_KEYS.otherCategoriesLabel)}{" "}
      {shown.map((entry, index) => (
        <Fragment key={entry.row.category}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <Button
            type="link"
            size="small"
            style={ENTRY}
            data-testid="search-other-category"
            data-category={entry.row.category}
            {...(entry.href !== undefined ? { href: entry.href } : {})}
            data-analytics="none"
            data-analytics-reason="narrowing a search is a read, not a flow step"
            aria-label={t(SEARCH_I18N_KEYS.otherCategoriesNarrow, {
              name: entry.name,
            })}
            onClick={(event) => {
              // A real `href` still narrows THIS search in place on a plain
              // click — a full navigation would answer a different query
              // than the one the count beside the name was counted for.
              // Anything asking for a new tab/window (a modified click) is
              // left to the browser, which is what makes the address real
              // rather than decorative.
              if (
                entry.href !== undefined &&
                (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              ) {
                return;
              }
              event.preventDefault();
              setCategory(entry.row.category);
            }}
          >
            {entry.name} <span style={COUNT}>{entry.row.count}</span>
          </Button>
        </Fragment>
      ))}
      {hidden > 0 && (
        <>
          <span aria-hidden="true"> · </span>
          <Button
            type="link"
            size="small"
            style={ENTRY}
            data-testid="search-other-categories-more"
            data-analytics="none"
            data-analytics-reason="unfolding a line is a read, not a flow step"
            aria-expanded={false}
            onClick={() => {
              setExpanded(true);
            }}
          >
            {t(SEARCH_I18N_KEYS.otherCategoriesMore, { count: hidden })}
          </Button>
        </>
      )}
    </Typography.Text>
  );
}
