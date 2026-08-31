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
 * A chip exists for each facet group the SERVER returned, each numeric range
 * the CATEGORY SCHEMA declares, and the location — plus the leading
 * "all filters" chip. Nothing here knows what a "brand" or a "mileage" is;
 * a deployment with three facets gets three chips and a deployment with none
 * gets the leading chip alone.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button } from "antd";
import { SkinDialog, useDialogSurface } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import { useFacetPanel } from "../headless/FacetPanel.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { buildRangeGroups } from "../state/ranges.js";
import type { FacetGroup } from "../state/facets.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { FacetGroupControl } from "./FacetGroupControl.js";
import { RangeFilterRow } from "./RangeFilterRow.js";
import { geoSummaryFallback } from "./FacetPanelPane.js";
import type { GeoFilterSlotProps } from "./FacetPanelPane.js";
import { CHIP_GEO_TEST_IDS, GeoSheet, useApplyLabel } from "./geoSheet.js";

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

export interface FilterChipsProps {
  /** The category's feature schema — the source of option labels, of which
   * slugs get a range chip, and of how each group is drawn. */
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  /** The location control (`geo-react`), same slot the panel takes. Without
   * it the location chip appears only when the URL already carries a point,
   * so a shared link can still be widened. */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  /**
   * What the current location constraint is CALLED — see
   * {@link FacetPanelPaneProps.geoLabel}. The chip carries it as its own text,
   * which is the whole point of a chip row: "Berlin Mitte" states the filter
   * on the results page, where `55.756, 37.617` stated only that a machine was
   * involved. Absent, the chip reads `search.geo.chosen_place`; never a
   * coordinate, on either surface.
   */
  readonly geoLabel?: ReactNode;
  /** Open the whole panel — the leading chip's action. The page owns that
   * sheet, because the page is the surface it covers. */
  readonly onOpenAll: () => void;
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

export function FilterChips(props: FilterChipsProps): ReactElement {
  const t = useT();
  const { state } = useSearchState();
  const bag = useFacetPanel({
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
    ...(props.locale !== undefined ? { locale: props.locale } : {}),
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
      ? bag.state.data.filter((group) => group.options.length > 0)
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

  const geo = state.geo;
  const showGeoChip = props.renderGeoFilter !== undefined || geo !== undefined;
  // Nothing applied: the chip is the FILTER's name ("Location"), because there
  // is no constraint to describe yet. Applied: the host's name for the place,
  // and failing that the sentence that admits the pair does not know it.
  const geoChipLabel: ReactNode =
    geo === undefined
      ? t(SEARCH_I18N_KEYS.geoTitle)
      : (props.geoLabel ?? geoSummaryFallback(geo, t));

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

        {showGeoChip && (
          <Button
            style={CHIP}
            shape="round"
            type={geo !== undefined ? "primary" : "default"}
            data-testid="search-chip-geo"
            data-analytics="none"
            data-analytics-reason="a filter is a read, not a flow step"
            onClick={() => {
              setOpen("geo");
            }}
          >
            {geoChipLabel}
          </Button>
        )}

        {ranges.map((group) => (
          <Button
            key={group.slug}
            style={CHIP}
            shape="round"
            type={group.active ? "primary" : "default"}
            data-testid={`search-chip-range-${group.slug}`}
            data-analytics="none"
            data-analytics-reason="a filter is a read, not a flow step"
            onClick={() => {
              setOpen(`range:${group.slug}`);
            }}
          >
            {group.label}
          </Button>
        ))}

        {groups.map((group) => (
          <Button
            key={group.slug}
            style={CHIP}
            shape="round"
            type={group.selected.length > 0 ? "primary" : "default"}
            data-testid={`search-chip-${group.slug}`}
            data-analytics="none"
            data-analytics-reason="a filter is a read, not a flow step"
            onClick={() => {
              setOpen(`facet:${group.slug}`);
            }}
          >
            {chipLabel(group, t)}
          </Button>
        ))}
      </div>

      {/* One sheet per chip, rendered only for the open one: a dozen mounted
          dialogs is a dozen focus traps waiting for a stray `open`. */}
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

      {/* The LOCATION sheet is shared with `<LocationSummaryLine>` — the ref
          puts a location control on both rows, and they must land in the same
          place. See `geoSheet.tsx`. */}
      <GeoSheet
        open={open === "geo"}
        onClose={close}
        testIds={CHIP_GEO_TEST_IDS}
        {...(props.renderGeoFilter !== undefined
          ? { renderGeoFilter: props.renderGeoFilter }
          : {})}
        {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
      />
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
