/**
 * `<FilterChips>` — the phone's filter row: one horizontally scrolling line of
 * chips, each of which opens its OWN picker.
 *
 * ## What it replaces, and why the replacement is not cosmetic
 *
 * The phone filter path was a single full-width "Filters (3)" button that
 * opened the whole panel. Everything about a search — the category, the price,
 * the brand, where — was behind one tap onto a sheet you then had to scroll,
 * and NOTHING about what was already applied was visible on the results page
 * itself except a number in brackets. The chips row states the filters ON the
 * page: the ones you have set read as set, the ones you have not are one tap
 * from their own small picker, and the whole panel is still there behind the
 * leading chip for the person who wants all of it at once.
 *
 * ## The row scrolls; the PAGE does not
 *
 * A row of chips wider than a 390px phone is the point — it is how the row
 * holds eight filters. What must not happen is the page's own body growing a
 * horizontal scrollbar, which is what a `flex-wrap: nowrap` row without an
 * `overflow-x` owner does: the chips push the document wider, every other
 * element on the page slides, and the visitor is left rubber-banding the whole
 * screen sideways to read a price. So the row owns its overflow
 * (`overflow-x: auto`), contains its overscroll so a flick past the last chip
 * does not start scrolling the page behind it, and hides the scrollbar itself
 * (a 15px grey trough under a 32px chip is chrome nobody asked for) — through
 * a hoisted stylesheet, because `::-webkit-scrollbar` and `scrollbar-width`
 * cannot be written as inline style.
 *
 * Hiding a scrollbar is only safe because nothing here is reachable ONLY by
 * dragging it: every chip is a real `<button>`, so Tab walks the row and the
 * browser scrolls the focused chip into view on its own.
 *
 * ## Every picker is a `SkinDialog`
 *
 * Which means every picker is a BOTTOM SHEET on a phone and a modal above it
 * (owner ruling 2026-08-24, enforced by `stapel/no-bare-dialog`). The chips
 * row is a phone surface, so in practice it is always the sheet — but the
 * component does not decide that, the substrate does, and a tablet rendering
 * the row gets the tablet answer without this file knowing.
 *
 * ## The library is not inventing a classified's filters
 *
 * A chip exists for each facet group the SERVER returned AND the category
 * schema types as choosable (`isFacetableFeature` — an `imei` is counted and
 * is not a filter), each numeric range the CATEGORY SCHEMA declares, the
 * location, and the host's category control — plus the leading "all filters"
 * chip. Nothing here knows what a "brand" or a "mileage" is; a deployment with
 * three facets gets three chips and a deployment with none gets the leading
 * chip alone.
 *
 * ## The ORDER of the row is the whole product
 *
 * At 390px a person sees roughly four chips before the fold, and everything
 * past them costs a horizontal flick most people never make. On a live phone
 * category the first seven were battery health, four parcel dimensions and two
 * wholesale counts — every one of them a numeric ATTRIBUTE the category
 * happens to declare, drawn before the condition, the vendor and the model
 * anybody actually narrows by, and before the price.
 *
 * That is an ORDERING defect, not a facetability one, and it is fixed as one:
 * nothing is deleted, because this package cannot tell a battery-health axis
 * from a parcel-width axis and must not pretend to. Two categories declare
 * `int` attributes and one of them is `mileage`. So the row states its order
 * instead, out of evidence it actually has:
 *
 *   1. **the category chip** — narrowing the category decides which chips
 *      exist at all, the facet plan being derived from the leaf;
 *   2. **the location chip** — the other host-slot filter;
 *   3. **everything APPLIED**, in band order below. A constraint a person has
 *      set has to be reachable without a flick, or the row states filters that
 *      are on screen only if you go looking;
 *   4. then everything unapplied, in band order:
 *      **core range axes** (`facet_meta.core_ranges` — the SERVER declaring an
 *      axis that exists for every document in every category: `price`), then
 *      **counted facet groups** (the server counted them for this search and
 *      each carries its remaining counts — the strongest evidence the row has
 *      that these are the axes this corpus is narrowed by), then
 *      **the category's numeric attributes**, which are form fields the
 *      composer collects and which no flag in the schema distinguishes from an
 *      axis a buyer uses.
 *
 * Band 3's attributes keep their controls, whole, in the panel behind the
 * leading circle and at the tail of this row. `buildRangeGroups` is untouched:
 * a rule that DELETED them would have to answer "on what evidence", and
 * `facet_meta.skipped` — the one server signal that names a slug — means the
 * counter ran out of plan slots at `MAX_FACET_FIELDS`, not that a person
 * cannot filter by it. `r.<slug>` still answers for a skipped slug.
 *
 * ## The one case where band 3 IS deleted: a barren result
 *
 * There is exactly one piece of evidence strong enough, and the server sends
 * it: the plan was counted (`facet_meta.counted`) over a candidate set of
 * ZERO (`facet_meta.candidates`). Then every counted group is empty and drops
 * out on its own, and the only chips left standing are the ones that never
 * needed a count — the category's numeric attributes, drawn from the schema
 * alone. Measured live on a cars leaf inside a 25 km radius that held no
 * cars, that row read "Price / Colour / Availability / Steering side / Year / VIN or body
 * number / Dealer offer "…" x9": the make and the model gone
 * because they had nothing to count, a body number and nine dealer
 * promotions in their place. An unapplied numeric axis over an empty set
 * narrows nothing that is not already nothing; it states nothing and takes
 * the room the empty state's exits need. APPLIED ones stay, always — a
 * constraint keeps the control that removes it.
 *
 * ## Why the CATEGORY leads the row
 *
 * The owner's navigation model puts levels 1-2 of the catalogue on tiles and
 * every level below them behind a cascading child selector, chosen "as a
 * characteristic" — on the result list and in the composer alike. On the SERP
 * that selector is a chip like any other, and it is the FIRST one, because
 * narrowing the category is what changes which other chips exist at all: the
 * facet plan is derived from the leaf category, so every chip to its right is
 * downstream of it.
 *
 * The pair does not draw that selector. Walking the tree belongs to
 * `categories-react`, so the chip is the host's `renderCategoryFilter` in the
 * same sheet the other chips open, and a row whose host filled no such slot
 * renders exactly as it did before. There is no synthesized category FACET
 * anywhere here and there must not be one: the server counts no category
 * buckets and the index has no read path for them, so any count this row drew
 * beside a child category would be a number nobody could check.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button } from "antd";
import { SkinDialog, useDialogSurface } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import { useFacetPanel } from "../headless/FacetPanel.js";
import type { FacetLabelResolver } from "../headless/useFacetLabels.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { buildRangeGroups } from "../state/ranges.js";
import type { RangeGroup } from "../state/ranges.js";
import {
  compareFacetsByEvidence,
  facetGroupIsDrawable,
} from "../state/facets.js";
import type { FacetGroup } from "../state/facets.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { FacetGroupControl } from "./FacetGroupControl.js";
import { RangeFilterRow } from "./RangeFilterRow.js";
import type { CategoryFilterSlotProps } from "./FacetPanelPane.js";
import { useApplyLabel } from "./geoSheet.js";

/** The class the scroller carries, for {@link chipRowCss}. */
export const CHIP_ROW_CLASS = "stapel-filter-chips";

/** The `href` the hoisted chip-row stylesheet is deduplicated by. */
export const CHIP_ROW_STYLE_HREF = "stapel-search-filter-chips";

/**
 * The two rules an inline style cannot express: Firefox's `scrollbar-width`
 * and WebKit's `::-webkit-scrollbar`. Static (no theme values), so one hoisted
 * copy serves the document.
 */
export function chipRowCss(): string {
  return [
    `.${CHIP_ROW_CLASS}{scrollbar-width:none;-ms-overflow-style:none}`,
    `.${CHIP_ROW_CLASS}::-webkit-scrollbar{display:none}`,
  ].join("");
}

/** The scroller: one line, its own overflow, nobody else's. */
const ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  flexWrap: "nowrap",
  overflowX: "auto",
  // A flick past the last chip must not hand the gesture to the page.
  overscrollBehaviorInline: "contain",
  // Room for the focus ring of the first and last chip, which a flush edge
  // clips into invisibility.
  paddingBlock: spacing[1],
};

const CHIP: CSSProperties = { flex: "0 0 auto", borderRadius: radii.full };


/** Which picker is open, if any. `null` closes everything. */
type OpenChip = string | null;

/**
 * The three bands the row's non-slot chips fall into, most-evidenced first.
 *
 * `core_range` is the SERVER's own declaration (`facet_meta.core_ranges`) that
 * an axis exists for every document in every category. `facet` is a group the
 * server COUNTED for this search, which arrives with the remaining counts that
 * make it a drill-down. `attribute_range` is a numeric field the category
 * declares and nothing ranks — see this module's ordering note.
 */
export type ChipBand = "core_range" | "facet" | "attribute_range";

/** Band order, stated once. */
export const CHIP_BAND_ORDER: readonly ChipBand[] = [
  "core_range",
  "facet",
  "attribute_range",
];

/** One non-slot chip, resolved to the band and the applied state it sorts by. */
export type ChipSpec =
  | { readonly band: "core_range" | "attribute_range"; readonly range: RangeGroup }
  | { readonly band: "facet"; readonly facet: FacetGroup };

/** Has the person set this filter? */
function specApplied(spec: ChipSpec): boolean {
  return spec.band === "facet" ? spec.facet.selected.length > 0 : spec.range.active;
}

/**
 * The row's order: applied first, then band, then the order each source
 * already came in.
 *
 * Exported because the order IS the fix — the defect it closes is invisible to
 * a test that only asks whether a chip exists, and a rule stated in prose next
 * to an unexercised implementation is a rule that drifts.
 *
 * `Array.prototype.sort` is stable in every runtime this pair supports, so
 * equal-ranked chips keep the order `buildRangeGroups` and `buildFacetGroups`
 * gave them — a closed set's authored order survives all the way to the row.
 */
export function orderChipFilters(
  ranges: readonly RangeGroup[],
  facets: readonly FacetGroup[],
  options: { readonly barren?: boolean } = {}
): readonly ChipSpec[] {
  const specs: ChipSpec[] = [
    ...ranges.map(
      (range): ChipSpec =>
        range.core
          ? { band: "core_range", range }
          : { band: "attribute_range", range }
    ),
    ...facets.map((facet): ChipSpec => ({ band: "facet", facet })),
  ].filter(
    (spec) =>
      !(options.barren === true && spec.band === "attribute_range") ||
      specApplied(spec)
  );
  return [...specs].sort((a, b) => {
    const applied = Number(specApplied(b)) - Number(specApplied(a));
    if (applied !== 0) return applied;
    const band = CHIP_BAND_ORDER.indexOf(a.band) - CHIP_BAND_ORDER.indexOf(b.band);
    if (band !== 0) return band;
    // WITHIN the counted-facet band: coverage — the answer's own evidence of
    // which axes this corpus actually fills (D16 reopen: an imported
    // catalogue gave the phones leaf option tables for its wholesale
    // plumbing, and schema order put them ahead of the brand). A group the
    // server did not count sums to zero and trails every counted one; ties
    // keep the authored order because the sort is stable.
    //
    // The comparator lives in `state/facets.ts` because the RAIL needs the
    // same one and did not have it: this row ranked by evidence and the panel
    // rendered schema order, so the two surfaces disagreed about which axes
    // matter on the same search (D120/D121).
    if (a.band === "facet" && b.band === "facet") {
      return compareFacetsByEvidence(a.facet, b.facet);
    }
    return 0;
  });
}

/**
 * How many banded chips the row draws before the "more" door — enough for the
 * axes with real evidence behind them, small enough that the tail of a
 * 44-axis cars leaf lives in the panel instead of in four flicks. A host
 * passes `maxRowChips` to move it, or `null` to disable the door.
 */
export const CHIP_ROW_CAP = 8;

/**
 * The visible row and what the door owes: the first `max` specs — and EVERY
 * applied one, however many, because a constraint on screen must keep the
 * control that removes it (the same rule the barren filter follows). The
 * overflow count is what the door chip prints; the chips behind it are not
 * deleted, they are the panel's — one tap behind the door itself.
 */
export function capChipRow(
  specs: readonly ChipSpec[],
  max: number | null
): { readonly visible: readonly ChipSpec[]; readonly overflow: number } {
  if (max === null || specs.length <= max) {
    return { visible: specs, overflow: 0 };
  }
  const applied = specs.filter(specApplied).length;
  const cut = Math.max(max, applied);
  return { visible: specs.slice(0, cut), overflow: specs.length - cut };
}

export interface FilterChipsProps {
  /** The category's feature schema — the source of option labels, of which
   * slugs get a range chip, of which slugs are choosable at all, and of how
   * each group is drawn. */
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  /**
   * Name the values neither the answer nor the schema names — see
   * {@link FacetLabelResolver}. The same prop reaches the filter panel, so a
   * value cannot read one way on a chip and another way inside the sheet.
   */
  readonly resolveFacetLabels?: FacetLabelResolver;
  /**
   * The catalogue picker (`categories-react`), same slot the panel takes.
   *
   * Filled, it becomes the row's LEADING chip and opens in the same sheet as
   * every other chip. Unfilled, the row draws no category chip at all — and
   * that is not a constraint left without a control: the whole panel is one
   * tap away behind the leading circle, and it carries the "search the whole
   * catalogue" button for a link that arrived narrowed.
   */
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  /**
   * What the current category is CALLED, in words.
   *
   * The pair holds a `root/leaf` PATH of slugs and nothing that turns one into
   * a catalogue name — the tree belongs to `categories-react`, and whoever
   * rendered the picker has the name already. Absent, the chip falls back to
   * the path's last segment, which is the honest half-answer: it is what the
   * search is actually narrowed to, it fits a 390px row where the whole path
   * does not, and it is never invented.
   */
  readonly categoryLabel?: ReactNode;
  /** Open the whole panel — the leading chip's action. The page owns that
   * sheet, because the page is the surface it covers. */
  readonly onOpenAll: () => void;
  /**
   * The row's chip budget before the "more" door — see {@link CHIP_ROW_CAP}
   * (the default). `null` draws every chip, door-less, as the row did before
   * it was capped. Applied filters never count against the budget's loss:
   * they are always drawn.
   */
  readonly maxRowChips?: number | null;
}

/**
 * The label a chip carries: the group's name alone when nothing is chosen,
 * and the CHOICE when something is — "Brand" becomes "Bosch", "Brand, +2".
 * A chip that reads "Brand" while filtering to Bosch is a lie the person can
 * only catch by opening it.
 */
function chipLabel(group: FacetGroup, t: (key: string, p?: Record<string, unknown>) => string): string {
  const chosen = group.options.filter((option) => option.selected);
  const first = chosen[0];
  if (first === undefined) return group.label;
  return chosen.length === 1
    ? first.label
    : `${first.label}${t(SEARCH_I18N_KEYS.filtersChipMore, { count: chosen.length - 1 })}`;
}

/**
 * The last segment of a `root/leaf` category path.
 *
 * A chip has room for one word, and the whole path is what the panel prints on
 * a surface with a column to spend. This is the pair's LAST resort — a host
 * that renders the picker knows the catalogue's own name for the node and
 * passes `categoryLabel` — but it is a real narrowing stated with a value the
 * URL genuinely carries, which is the line the geo chip draws too: never print
 * a coordinate, always print the name you actually have.
 */
export function categoryLeaf(path: string): string | undefined {
  const parts = path.split("/").filter((part) => part.length > 0);
  const leaf = parts[parts.length - 1];
  if (leaf === undefined) return undefined;
  // A path of database IDS has no readable last segment, and printing one
  // puts a green pill reading «165» on the SERP — which is what the live
  // board did, permanently, on every category page. An id is not a
  // half-answer the way a slug is: it names nothing a person could have
  // typed. When the leaf is a bare number the chip falls back to the
  // FILTER's own name, the same thing every other unset chip shows.
  return /^\d+$/.test(leaf) ? undefined : leaf;
}

export function FilterChips(props: FilterChipsProps): ReactElement | null {
  const t = useT();
  const { state, setCategory } = useSearchState();
  const bag = useFacetPanel({
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
    ...(props.locale !== undefined ? { locale: props.locale } : {}),
    ...(props.resolveFacetLabels !== undefined
      ? { resolveFacetLabels: props.resolveFacetLabels }
      : {}),
  });
  const applyLabel = useApplyLabel();
  const surface = useDialogSurface();
  const [open, setOpen] = useState<OpenChip>(null);

  // Same source as the panel's rows, so the phone chip row and the desktop
  // panel cannot disagree about which axes exist: the core columns come from
  // the ANSWER (`facet_meta.core_ranges`) and the currency off its cards.
  const ranges = buildRangeGroups({
    state,
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
    coreRanges: bag.coreRanges,
    ...(bag.currency !== undefined ? { currency: bag.currency } : {}),
    t,
  });
  const groups =
    bag.state.status === "ready"
      ? bag.state.data.filter(facetGroupIsDrawable)
      : [];

  const close = (): void => {
    setOpen(null);
  };

  const sheetFor = (
    id: string,
    title: string,
    body: ReactNode
  ): ReactElement => (
    <SkinDialog
      open={open === id}
      onClose={close}
      title={title}
      dismissLabel={t(SEARCH_I18N_KEYS.filtersDismiss)}
      data-testid={`filter-chip-sheet-${id}`}
      footer={
        <Button
          block
          type="primary"
          data-testid={`filter-chip-apply-${id}`}
          data-analytics="none"
          data-analytics-reason="the filter is already applied; this closes the sheet"
          onClick={close}
        >
          {applyLabel}
        </Button>
      }
    >
      {body}
    </SkinDialog>
  );

  // The category chip exists only where a host can actually draw the picker:
  // a chip that opened an empty sheet would be a filter affordance leading
  // nowhere, and the whole panel behind the leading circle already carries the
  // control that widens a narrowed link.
  const showCategoryChip = props.renderCategoryFilter !== undefined;
  const category = state.category;
  // Same rule as every other chip: the CHOICE when there is one, the filter's
  // own name when there is not.
  const categoryChipLabel: ReactNode =
    category === undefined
      ? t(SEARCH_I18N_KEYS.categoryTitle)
      : (props.categoryLabel ??
        categoryLeaf(category) ??
        t(SEARCH_I18N_KEYS.categoryTitle));

  // The server counted a plan over a candidate set of ZERO. Every counted
  // facet is therefore empty and drops out of `groups` above — and what is
  // left standing is the band that never needed a count: the numeric
  // attributes drawn from the category schema alone. On the live cars leaf
  // that row read "Price / Colour / Availability / Steering side / Year /
  // VIN / Dealer offer x9" — the make and the model gone, a body-number field
  // and nine dealer promotions in their place, on a page with no cars on it.
  // An unapplied attribute range on an empty result narrows nothing that is
  // not already nothing, so it states nothing and takes the room the exits
  // need. Applied ones stay: a constraint always keeps the control that
  // removes it.
  const barren = bag.counted.length > 0 && bag.candidates === 0;
  const orderedAll = orderChipFilters(ranges, groups, { barren });
  const { visible: ordered, overflow } = capChipRow(
    orderedAll,
    props.maxRowChips === undefined ? CHIP_ROW_CAP : props.maxRowChips
  );

  /*
   * A row of one button is not a chip row.
   *
   * The leading circle is the whole-panel door, and it is the only child this
   * row is guaranteed. On a deployment whose plan has no facets for the
   * current query — a free-text search with no category is exactly that: the
   * plan comes from the CATEGORY's feature defs, so `facets` comes back `{}` —
   * the row rendered as a lone circle floating between the location line and
   * the results, a third filter affordance next to two working ones. When
   * there is nothing to state, the row states nothing and the surface above
   * keeps its own door.
   */
  const hasChips = showCategoryChip || ordered.length > 0;
  if (!hasChips) return null;

  return (
    <>
      <style href={CHIP_ROW_STYLE_HREF} precedence="default">
        {chipRowCss()}
      </style>
      <div
        className={CHIP_ROW_CLASS}
        style={ROW}
        role="group"
        aria-label={t(SEARCH_I18N_KEYS.filtersChipsLabel)}
        data-testid="search-filter-chips"
        data-surface={surface}
      >
        {/* The leading chip: the whole panel, in one icon-sized target. It is
            icon-only because it is the one chip whose meaning does not change
            — and it carries a DOT, not a count, because the counts are already
            written on the chips beside it. */}
        <Button
          shape="circle"
          aria-label={t(SEARCH_I18N_KEYS.filtersAll)}
          icon={<SlidersGlyph />}
          style={CHIP}
          data-testid="search-filters-open"
          data-active={bag.activeFilters > 0 ? "true" : "false"}
          data-analytics="none"
          data-analytics-reason="opening the filter sheet is a read, not a flow step"
          onClick={props.onOpenAll}
        >
          {bag.activeFilters > 0 && <ActiveDot />}
        </Button>

        {/* FIRST, before every facet chip: narrowing the category is what
            decides which facet chips exist at all. */}
        {showCategoryChip && (
          <Button
            style={CHIP}
            shape="round"
            type={category !== undefined ? "primary" : "default"}
            data-testid="search-chip-category"
            data-analytics="none"
            data-analytics-reason="a filter is a read, not a flow step"
            onClick={() => {
              setOpen("category");
            }}
          >
            {categoryChipLabel}
          </Button>
        )}


        {/* One list, in the row's stated order — see this module's ordering
            note. Rendering ranges and facets as two separate `.map`s is what
            put seven parcel dimensions in front of the price. */}
        {ordered.map((spec) =>
          spec.band === "facet" ? (
            <Button
              key={`facet:${spec.facet.slug}`}
              style={CHIP}
              shape="round"
              type={spec.facet.selected.length > 0 ? "primary" : "default"}
              data-testid={`search-chip-${spec.facet.slug}`}
              data-band={spec.band}
              data-analytics="none"
              data-analytics-reason="a filter is a read, not a flow step"
              onClick={() => {
                setOpen(`facet:${spec.facet.slug}`);
              }}
            >
              {chipLabel(spec.facet, t)}
            </Button>
          ) : (
            <Button
              key={`range:${spec.range.slug}`}
              style={CHIP}
              shape="round"
              type={spec.range.active ? "primary" : "default"}
              data-testid={`search-chip-range-${spec.range.slug}`}
              data-band={spec.band}
              data-analytics="none"
              data-analytics-reason="a filter is a read, not a flow step"
              onClick={() => {
                setOpen(`range:${spec.range.slug}`);
              }}
            >
              {spec.range.label}
            </Button>
          )
        )}

        {/* The "more" door (D16): the capped tail is not deleted, it is one
            tap away — this opens the SAME full panel the leading circle
            does, where every cut control lives whole. The count keeps the
            door honest about how much it is standing in front of. */}
        {overflow > 0 && (
          <Button
            style={CHIP}
            shape="round"
            data-testid="search-chips-overflow"
            data-analytics="none"
            data-analytics-reason="opening the filter sheet is a read, not a flow step"
            onClick={props.onOpenAll}
          >
            {t(SEARCH_I18N_KEYS.filtersChipOverflow, { count: overflow })}
          </Button>
        )}
      </div>

      {/* One sheet per chip, rendered only for the open one: a dozen mounted
          dialogs is a dozen focus traps waiting for a stray `open`. */}
      {open === "category" &&
        props.renderCategoryFilter !== undefined &&
        sheetFor(
          "category",
          t(SEARCH_I18N_KEYS.categoryTitle),
          props.renderCategoryFilter({
            value: category,
            onChange: (path) => {
              setCategory(path);
            },
          })
        )}

      {open?.startsWith("facet:") === true &&
        (() => {
          const slug = open.slice("facet:".length);
          const group = groups.find((candidate) => candidate.slug === slug);
          return group === undefined
            ? null
            : sheetFor(
                open,
                group.label,
                <FacetGroupControl
                  group={group}
                  onToggle={bag.toggle}
                  heading={false}
                  // A sheet devoted to ONE group has the room for all of it;
                  // "Show all" inside it would be a fold inside a fold.
                  visibleOptions={null}
                />
              );
        })()}

      {open?.startsWith("range:") === true &&
        (() => {
          const slug = open.slice("range:".length);
          const group = ranges.find((candidate) => candidate.slug === slug);
          return group === undefined
            ? null
            : sheetFor(
                open,
                group.label,
                <RangeFilterRow group={group} onApply={bag.setRange} />
              );
        })()}
    </>
  );
}

/** The mark on the "all filters" chip: something is applied. Not a count —
 * the counts are on the chips beside it, and a number inside a 32px circle is
 * a number nobody reads. */

function ActiveDot(): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="search-filters-dot"
      style={{
        position: "absolute",
        insetInlineEnd: spacing[1],
        insetBlockStart: spacing[1],
        width: spacing[2],
        height: spacing[2],
        borderRadius: radii.full,
        background: "currentColor",
      }}
    />
  );
}

/** Sliders — the one glyph a filter control is universally drawn with. Inline
 * SVG, like every other glyph in the fleet's skins: no icon-font dependency. */
function SlidersGlyph(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      role="img"
      aria-hidden="true"
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </svg>
  );
}
