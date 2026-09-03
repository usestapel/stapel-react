/**
 * `<LocationSummaryLine>` — the row above a phone SERP's chips: WHERE this
 * search is looking on the left, and how much has been narrowed on the right.
 *
 * ## Why the location gets a line of its own, above the chips
 *
 * It is already a chip (`<FilterChips>` draws one), and on the refs it is a
 * ROW as well, and that is not redundancy. A chip row scrolls: the geo chip is
 * one of eight and it is off screen the moment somebody has scrolled to
 * "Year". Location is the one constraint on a classified that changes what a
 * result MEANS rather than narrowing a set — "1 200 €" is a different offer in
 * the next city — so it is the one that must be readable without scrolling
 * anything. The two controls open the same sheet (`geoSheet.tsx`), so tapping
 * either lands in the same place.
 *
 * ## Never a coordinate
 *
 * This pair holds a `lat` and a `lon` and has no way on earth to turn them
 * into "Berlin Mitte" — that is a geocoder, and a search package that grew one
 * to say a nicer sentence would have taken on the whole of `geo-react`. So the
 * line says the name it was HANDED (`geoLabel`), or that a place is chosen,
 * and adds the radius, which is a number this pair does own. With nothing
 * applied it says the search is looking everywhere, which is the truth and is
 * also the invitation to narrow it.
 *
 * ## The offer, and why it is a BUTTON on this row
 *
 * A visitor whose browser has already granted geolocation is one the host can
 * place precisely — and for a long time this pair took that as licence to
 * place them, through a `defaultGeo` that wrote a 25 km radius into the URL
 * before anybody had said anything (see {@link SearchStateProviderProps.geoOffer}
 * for what that cost: whole category leaves reading "nothing found" while
 * their stock sat 30 km away). The position is still worth having. It is just
 * not the pair's to apply.
 *
 * So the offer lands HERE, on the one row that is on screen at every width
 * without opening a sheet, beside the sentence it would change ("searching
 * everywhere" → "within 25 km of you"). It states its own radius, because a
 * button that says only "near me" is asking a person to accept a number they
 * cannot see; and the moment it is pressed the radius becomes the ordinary
 * adjustable one in the panel, and the location becomes an ordinary chip with
 * an ordinary way off.
 *
 * ## The right-hand affordance carries a COUNT, and the chip row carries a dot
 *
 * `<FilterChips>`'s leading chip is a 32px circle: a number inside it is a
 * number nobody reads, so it shows a dot. This is a full-width row with a word
 * on it, so it has room to say HOW MANY constraints are applied — which is the
 * difference between "something is filtered" and "four things are, and that is
 * why there are three results". Both read the same `activeFilters` off the URL
 * state; neither invents a second counter.
 *
 * ## The row overlapped itself on a phone, and why (defect C12)
 *
 * Measured on a live 390px SERP, in both themes, on every result page:
 *
 * ```
 * {"kind":"clipped-left","t":"A chosen place on the map","x":-4}
 * {"kind":"overlap","a":"· Within 25 km","b":"Filters","px":43}
 * ```
 *
 * Three separate causes, and none of them was the flex row itself:
 *
 * 1. **An antd `<Button>` CENTRES its content.** `minWidth: 0` let the left
 *    item shrink, and nothing clipped what was inside it, so the label
 *    overflowed its box symmetrically — off the left edge of the screen at
 *    `x = -4` and 43px across the word "Filters" at the other end. A shrunk
 *    box with no `overflow` is not a truncation, it is an overlap.
 * 2. **Nothing declared which end may shrink.** Both ends were `1 1 auto`, so
 *    a long place name took width from a word that must never lose any.
 * 3. **The count was an antd `<Badge count>`,** which is an absolutely
 *    positioned `sup` hung off the top-right CORNER of what it wraps. At the
 *    trailing edge of a full-width row that lands it outside the row entirely
 *    — a red plaque floating in the corner of the page, attached to nothing
 *    (measured at `y = 72` for a row whose own line is at `y = 93`).
 *
 * So: one compact line, `place · radius` on the left and `Filters` right; the
 * left is the only half that shrinks and it truncates with an ellipsis; the
 * count rides IN the flow beside the word it counts for. The first two rules
 * are what an inline style cannot reach (they belong on the wrapper antd puts
 * around a button's children), which is why this file hoists a stylesheet the
 * way `<ListingCard>` and `<SkinCarousel>` do.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex } from "antd";
import { useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { geoSummaryFallback } from "./FacetPanelPane.js";
import type { GeoFilterSlotProps } from "./FacetPanelPane.js";
import { GeoSheet, SUMMARY_GEO_TEST_IDS } from "./geoSheet.js";

/** The class the row carries, for {@link locationLineCss}. */
export const LOCATION_LINE_CLASS = "stapel-search-location-line";
/** The class the shrinking half carries. */
export const LOCATION_LINE_WHERE_CLASS = "stapel-search-location-line-where";
/** The class the truncating label carries. */
export const LOCATION_LINE_LABEL_CLASS = "stapel-search-location-line-label";
/** The class the fixed half carries. */
export const LOCATION_LINE_END_CLASS = "stapel-search-location-line-end";

/** The `href` the hoisted stylesheet is deduplicated by. */
export const LOCATION_LINE_STYLE_HREF = "stapel-search-location-line";

/**
 * The rules that keep the line ONE line — and that an inline style cannot
 * reach, because they belong on the `<span>` antd wraps a button's children
 * in. See the file header (defect C12) for what each of them stops.
 *
 * Static: nothing here varies per instance, so one hoisted copy serves a page
 * in either theme.
 */
export function locationLineCss(): string {
  const row = `.${LOCATION_LINE_CLASS}`;
  const where = `.${LOCATION_LINE_WHERE_CLASS}`;
  const label = `.${LOCATION_LINE_LABEL_CLASS}`;
  const end = `.${LOCATION_LINE_END_CLASS}`;
  return [
    // `min-width:0` on the row too: a flex item's default `min-width:auto`
    // is what makes a nested flex row refuse to shrink at all.
    `${row}{min-inline-size:0}`,
    // The ONLY half that shrinks, and it CLIPS what it cannot show. An antd
    // Button is already a flex row and it CENTRES its children, so without
    // these two the box shrank and its content overflowed both edges at once
    // — the whole defect: `x:-4` on the left, 43px over "Filters" on the
    // right.
    `${where}{flex:1 1 auto;min-inline-size:0;overflow:hidden;` +
      `justify-content:flex-start}`,
    // Whatever the button puts its children in has to be allowed to shrink;
    // a flex item's `min-width:auto` refuses to go below its content.
    `${where}>span{min-inline-size:0}`,
    // `display:block` is load-bearing: `text-overflow` applies to a BLOCK
    // container and does nothing on a flex one, so a label that had been
    // turned into a flex box truncated with a hard cut mid-glyph instead of
    // an ellipsis.
    `${label}{display:block;min-inline-size:0;overflow:hidden;` +
      `text-overflow:ellipsis;white-space:nowrap}`,
    // The word a person is looking for never loses a pixel to a place name.
    `${end}{flex:0 0 auto}`,
  ].join("");
}

/** The row. Both ends are text buttons, so the row reads as a line of type
 * rather than as two controls bolted onto a results page. */
const ROW: CSSProperties = { width: "100%" };

/** The shrinking half. The flex rules it needs live in the hoisted sheet
 * (they have to reach antd's own wrapper span); this is the chrome. */
const LOCATION: CSSProperties = {
  paddingInline: 0,
  textAlign: "start",
};

/** The pin, which is not allowed to shrink either — a squashed glyph is
 * noise, and it costs 16px. */
const PIN: CSSProperties = { flex: "0 0 auto", display: "inline-flex" };

/** The offer. It never shrinks: it is three words and a number, and half of
 * "Near me" is not an offer. */
const OFFER: CSSProperties = { flex: "0 0 auto", paddingInline: 0 };

/**
 * The count, IN the flow.
 *
 * An antd `<Badge count>` is an absolutely positioned `sup` on the corner of
 * whatever it wraps, and at the trailing edge of a full-width row that puts it
 * outside the row: a red plaque in the corner of the page attached to nothing.
 * A pill beside the word is the same fact, in the line it belongs to, and it
 * takes part in the layout instead of floating over it.
 */
const COUNT: CSSProperties = {
  display: "inline-block",
  minInlineSize: `${String(spacing[4])}px`,
  paddingInline: spacing[1],
  borderRadius: radii.full,
  background: cssVar("brand"),
  color: cssVar("text-on-accent"),
  fontSize: fontSize.xs.fontSize,
  lineHeight: `${String(spacing[4])}px`,
  textAlign: "center",
};

export interface LocationSummaryLineProps {
  /**
   * The location control the sheet opens onto — the same slot the panel and
   * the chip row take. Without it the sheet still opens (a location the URL
   * already carries can be widened and cleared with no geocoder), and the
   * absence is NAMED in development rather than left as a blank sheet.
   */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  /**
   * What the current place is CALLED. See the file header: this pair prints
   * the name it is handed or admits it does not know one, never the numbers.
   */
  readonly geoLabel?: ReactNode;
  /**
   * Open the whole filter panel — the same contract `<FilterChips.onOpenAll>`
   * states, and conventionally the same callback: the SURFACE owns that sheet
   * because the surface is what it covers.
   */
  readonly onOpenAll: () => void;
  /**
   * Draw the trailing "Filters (N)" door. Default `true`.
   *
   * `false` where the panel is ALREADY on screen — a desktop column layout —
   * because a door beside the room it opens is not a door, and the count it
   * carries is printed again on the panel's own "clear all" a few hundred
   * pixels to the left.
   */
  readonly filtersDoor?: boolean;
}

/** A map pin in `currentColor` — the house convention: an inline monochrome
 * SVG, no icon-font dependency, and it inherits the theme rather than carrying
 * a colour. `aria-hidden` because the text beside it is the name. */
function PinGlyph(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
    >
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function LocationSummaryLine(
  props: LocationSummaryLineProps
): ReactElement {
  const t = useT();
  const { state, activeFilters, geoOffer, acceptGeoOffer } = useSearchState();
  const [open, setOpen] = useState(false);
  const geo = state.geo;

  // The radius is a NUMBER this pair owns (`radius_km` in the URL), so unlike
  // the place's name it can be stated without asking anyone. A bbox has no
  // radius to state; a centre without one is "around here" and says nothing
  // rather than inventing a default the server never applied.
  const radius =
    geo !== undefined && geo.kind === "center" && geo.radiusKm !== undefined
      ? t(SEARCH_I18N_KEYS.geoRadiusKm, { km: geo.radiusKm })
      : undefined;

  // The offer's own radius, said out loud on the button. `geoOffer` is
  // already `undefined` whenever a location is applied (the provider closes
  // the question), so this row never shows an offer beside a place.
  const offerRadius =
    geoOffer !== undefined && geoOffer.kind === "center" && geoOffer.radiusKm !== undefined
      ? t(SEARCH_I18N_KEYS.geoRadiusKm, { km: geoOffer.radiusKm })
      : undefined;

  const where: ReactNode =
    geo === undefined
      ? t(SEARCH_I18N_KEYS.geoEverywhere)
      : (props.geoLabel ?? geoSummaryFallback(geo, t));

  return (
    <>
      <style href={LOCATION_LINE_STYLE_HREF} precedence="default">
        {locationLineCss()}
      </style>
      <Flex
        align="center"
        justify="space-between"
        gap={spacing[2]}
        style={ROW}
        className={LOCATION_LINE_CLASS}
        data-testid="search-location-summary"
        data-geo={geo === undefined ? "off" : "on"}
      >
        {/* The glyph is rendered as a CHILD rather than through antd's `icon`
            prop: the icon slot sits outside the wrapper span, so the label
            beside it could not be given a min-width of its own — and a label
            that cannot shrink is a label that overflows. */}
        <Button
          type="link"
          style={LOCATION}
          className={LOCATION_LINE_WHERE_CLASS}
          data-testid="search-location-open"
          data-analytics="none"
          data-analytics-reason="opening the location sheet is a read, not a flow step"
          onClick={() => {
            setOpen(true);
          }}
        >
          <span style={PIN}>
            <PinGlyph />
          </span>
          <span
            className={LOCATION_LINE_LABEL_CLASS}
            data-testid="search-location-label"
          >
            {where}
            {radius !== undefined && (
              <span data-testid="search-location-radius">
                {" · "}
                {radius}
              </span>
            )}
          </span>
        </Button>

        {/* The offer, and nothing is applied until it is pressed. Drawn only
            when the host has a position to offer AND the search carries no
            location of its own — the provider enforces the second half, so
            this is one condition, not two that could disagree. */}
        {geoOffer !== undefined && (
          <Button
            type="link"
            style={OFFER}
            data-testid="search-location-offer"
            data-analytics="none"
            data-analytics-reason="applying a filter the person pressed is search state, and search state is the URL"
            onClick={acceptGeoOffer}
          >
            {t(SEARCH_I18N_KEYS.geoNearMe)}
            {offerRadius !== undefined && (
              <span data-testid="search-location-offer-radius">
                {" · "}
                {offerRadius}
              </span>
            )}
          </Button>
        )}

        {/* "Filters", not "All filters": this end of the row shares 390px
            with a place name that can run to fifteen characters, and the word
            the person is looking for is the noun. The panel's own heading
            still says "All filters" — there it is naming a sheet, not a
            door. */}
        {/* The count, not a dot: this row has the width to say how many — and
            it rides IN the line rather than floating off its corner. */}
        {props.filtersDoor === false ? null : (
        <Flex
          align="center"
          gap={spacing[1]}
          className={LOCATION_LINE_END_CLASS}
          data-testid="search-location-filters-badge"
        >
          <Button
            type="link"
            style={{ paddingInline: 0 }}
            data-testid="search-location-filters"
            data-active={activeFilters > 0 ? "true" : "false"}
            data-analytics="none"
            data-analytics-reason="opening the filter sheet is a read, not a flow step"
            onClick={props.onOpenAll}
          >
            {t(SEARCH_I18N_KEYS.filtersShort)}
          </Button>
          {activeFilters > 0 && (
            <span style={COUNT} data-testid="search-location-filters-count">
              {activeFilters}
            </span>
          )}
        </Flex>
        )}
      </Flex>

      <GeoSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        testIds={SUMMARY_GEO_TEST_IDS}
        {...(props.renderGeoFilter !== undefined
          ? { renderGeoFilter: props.renderGeoFilter }
          : {})}
        {...(props.geoLabel !== undefined ? { geoLabel: props.geoLabel } : {})}
      />
    </>
  );
}
