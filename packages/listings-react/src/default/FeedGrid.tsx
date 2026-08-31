/**
 * `<FeedGrid>` — the two-column wall a phone home feed is laid out on.
 *
 * ── Why this is not `<SearchResultsPane>`'s grid ──────────────────────────
 *
 * The results grid is `repeat(auto-fill, minmax(280px, 1fr))`: as many columns
 * as FIT, each at least a readable card. That is right for a catalogue and
 * wrong for a feed — 280px is wider than half of a 390px phone, so a feed laid
 * out that way collapses to one column exactly where the ref calls for two.
 * A feed's column count is a DESIGN decision ("two, side by side, small"), not
 * a consequence of a minimum card width, and the two rules cannot be spelled
 * with one declaration.
 *
 * ── No masonry ────────────────────────────────────────────────────────────
 *
 * The refs' feed looks staggered because the photos have different heights.
 * They do not here: `<ListingFeedCard>` draws every photo in the same 4:3 well
 * (`LISTING_PHOTO_ASPECT`), so the tiles line up in rows on their own and the
 * grid stays a grid. Nothing in this package will pull in a masonry polyfill
 * to reproduce a raggedness that is a property of unconstrained images —
 * `columns: 2` (the CSS multi-column route) was the other candidate and was
 * rejected because it breaks reading order: a screen reader and a keyboard
 * would walk the whole left column before reaching the top of the right one.
 *
 * ── Desktop is not this wave's consumer, and is not broken either ─────────
 *
 * `columns` defaults to 2 because a phone feed is the surface this exists for.
 * A wider surface passes its own number; the declaration is the same one, so
 * there is no second layout to keep in step and no breakpoint in this file.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { spacing } from "@stapel/tokens";

/** The ref's phone feed: two tiles across. */
export const FEED_GRID_COLUMNS = 2;

export interface FeedGridProps {
  /** How many tiles across. Default {@link FEED_GRID_COLUMNS}. */
  readonly columns?: number;
  /** The tiles — `<ListingFeedCard>`s, conventionally. */
  readonly children: ReactNode;
  readonly style?: CSSProperties;
}

export function FeedGrid(props: FeedGridProps): ReactElement {
  const columns = props.columns ?? FEED_GRID_COLUMNS;
  return (
    <div
      data-testid="listings-feed-grid"
      data-columns={String(columns)}
      style={{
        display: "grid",
        // `minmax(0, 1fr)` rather than `1fr`: a bare `1fr` is `minmax(auto,
        // 1fr)`, and `auto` refuses to shrink below its content — one long
        // unbroken word in a title then widens the whole column and pushes the
        // grid past the screen.
        gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
        columnGap: spacing[3],
        // Rows breathe more than columns do: the tiles carry no border, so the
        // gap between two rows is the only thing saying where one card's
        // location line ends and the next card's photo begins.
        rowGap: spacing[5],
        alignItems: "start",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}
