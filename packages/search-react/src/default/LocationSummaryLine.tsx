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
 * ## The right-hand affordance carries a COUNT, and the chip row carries a dot
 *
 * `<FilterChips>`'s leading chip is a 32px circle: a number inside it is a
 * number nobody reads, so it shows a dot. This is a full-width row with a word
 * on it, so the badge has room to say HOW MANY constraints are applied — which
 * is the difference between "something is filtered" and "four things are, and
 * that is why there are three results". Both read the same
 * `activeFilters` off the URL state; neither invents a second counter.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Badge, Button, Flex } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { geoSummaryFallback } from "./FacetPanelPane.js";
import type { GeoFilterSlotProps } from "./FacetPanelPane.js";
import { GeoSheet, SUMMARY_GEO_TEST_IDS } from "./geoSheet.js";

/** The row. Both ends are text buttons, so the row reads as a line of type
 * rather than as two controls bolted onto a results page. */
const ROW: CSSProperties = { width: "100%" };

/** Each end shrinks before it wraps; the location is the half that may
 * ellipsis, because a long place name must not push "Filters" off screen. */
const LOCATION: CSSProperties = {
  minWidth: 0,
  paddingInline: 0,
  textAlign: "start",
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
  const { state, activeFilters } = useSearchState();
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

  const where: ReactNode =
    geo === undefined
      ? t(SEARCH_I18N_KEYS.geoEverywhere)
      : (props.geoLabel ?? geoSummaryFallback(geo, t));

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        gap={spacing[2]}
        style={ROW}
        data-testid="search-location-summary"
        data-geo={geo === undefined ? "off" : "on"}
      >
        <Button
          type="link"
          style={LOCATION}
          icon={<PinGlyph />}
          data-testid="search-location-open"
          data-analytics="none"
          data-analytics-reason="opening the location sheet is a read, not a flow step"
          onClick={() => {
            setOpen(true);
          }}
        >
          {where}
          {radius !== undefined && (
            <span data-testid="search-location-radius">
              {" · "}
              {radius}
            </span>
          )}
        </Button>

        {/* "Filters", not "All filters": this end of the row shares 390px
            with a place name that can run to fifteen characters, and the word
            the person is looking for is the noun. The panel's own heading
            still says "All filters" — there it is naming a sheet, not a
            door. */}
        {/* The count, not a dot: this row has the width to say how many. */}
        <Badge
          count={activeFilters}
          size="small"
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
        </Badge>
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
