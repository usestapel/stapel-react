/**
 * The LOCATION sheet — one implementation, two doors.
 *
 * ONE control, and this is the inside of it. `<LocationSummaryLine>` is the
 * door: a place on the left, its radius beside it, and this sheet behind
 * both.
 *
 * It used to be three doors — the chip row's geo chip, the facet panel's
 * "Location" group, and the row — over one pair of numbers, with the radius
 * living in the panel and the place in the sheet. That arrangement made a
 * latitude look like a filter, which is what it is not: a coordinate pair is
 * the machine form of a place, and a place with a radius is its own thing in
 * the chrome, like the search box. The chip and the panel group are gone; the
 * radius moved in here, beside the place it is a radius OF.
 *
 * ── What the sheet can do without a geocoder, and what it cannot ───────────
 *
 * SETTING a centre needs a map and a place-name lookup, which belong to
 * `geo-react` and to the deployment: that is `renderGeoFilter`, and when it is
 * unfilled the gap is NAMED (`SlotPlaceholder`) rather than left as a blank
 * area under the sheet's title. ADJUSTING or CLEARING a location the URL
 * already carries needs neither — `lat`/`lon`/`radius_km` are numbers this
 * pair owns — which is why the sheet still opens usefully on a shared link
 * with no slot wired.
 *
 * NAMING the place is a third thing and it is the host's: this package holds
 * two coordinates and has no way to turn them into "Berlin Mitte", so it
 * prints the name it was handed (`geoLabel`) or says that a place is chosen —
 * never the numbers. `test/geo.test.tsx` asserts no digit of the point reaches
 * the DOM, on either surface.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, InputNumber, Typography } from "antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { SlotPlaceholder, useT, useTPlural } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useAppliedCount } from "../headless/useAppliedCount.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { geoSummaryFallback } from "./FacetPanelPane.js";
import type { GeoFilterSlotProps } from "./FacetPanelPane.js";

/** The test ids a surface gives its own copy of the sheet — the chip row and
 * the summary line each keep the names their tests already know. */
export interface GeoSheetTestIds {
  readonly sheet: string;
  readonly apply: string;
  readonly slot: string;
  readonly summary: string;
  readonly radius: string;
  readonly clear: string;
}

/** The chip row's door. These names predate the split and are what
 * `test/geo.test.tsx` already asks for, so they travel with the sheet rather
 * than being renamed by a refactor nobody asked to observe. */
export const CHIP_GEO_TEST_IDS: GeoSheetTestIds = {
  sheet: "filter-chip-sheet-geo",
  apply: "filter-chip-apply-geo",
  slot: "search-chip-geo-slot",
  summary: "search-chip-geo-summary",
  radius: "search-chip-geo-radius",
  clear: "search-chip-geo-clear",
};

/** The summary line's door — a different set, so a page holding both rows
 * never hands a test two elements under one name. */
export const SUMMARY_GEO_TEST_IDS: GeoSheetTestIds = {
  sheet: "search-location-sheet",
  apply: "search-location-apply",
  slot: "search-location-slot",
  summary: "search-location-sheet-summary",
  // The one radius control in the pair. It was `search-geo-radius` in the
  // facet panel, which no longer draws a location group at all.
  radius: "search-geo-radius",
  clear: "search-location-clear",
};

export interface GeoSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  readonly geoLabel?: ReactNode;
  readonly testIds: GeoSheetTestIds;
}

/**
 * "Show 25 results", not "Show results".
 *
 * The results are BEHIND this sheet, so the button that closes it is the only
 * place a person learns what their choice did. When the engine cannot say how
 * many there are it says nothing rather than a number it made up.
 */
export function useApplyLabel(): string {
  const t = useT();
  const tPlural = useTPlural();
  const applied = useAppliedCount();
  return applied.count === null || applied.kind === "unknown"
    ? t(SEARCH_I18N_KEYS.filtersApply)
    : tPlural(
        applied.kind === "at_least"
          ? SEARCH_I18N_KEYS.filtersShowCountAtLeast
          : SEARCH_I18N_KEYS.filtersShowCount,
        { count: applied.count }
      );
}

export function GeoSheet(props: GeoSheetProps): ReactElement {
  const t = useT();
  const { state, setGeo } = useSearchState();
  const applyLabel = useApplyLabel();
  const geo = state.geo;
  const summary: ReactNode =
    geo === undefined
      ? null
      : (props.geoLabel ?? geoSummaryFallback(geo, t));

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(SEARCH_I18N_KEYS.geoTitle)}
      dismissLabel={t(SEARCH_I18N_KEYS.filtersDismiss)}
      data-testid={props.testIds.sheet}
      footer={
        <Button
          block
          type="primary"
          data-testid={props.testIds.apply}
          data-analytics="none"
          data-analytics-reason="the filter is already applied; this closes the sheet"
          onClick={props.onClose}
        >
          {applyLabel}
        </Button>
      }
    >
      <Flex vertical gap={spacing[3]}>
        {props.renderGeoFilter?.({
          value: geo,
          onChange: (next) => {
            setGeo(next);
          },
        }) ?? (
          <SlotPlaceholder
            name="renderGeoFilter"
            data-testid={props.testIds.slot}
          />
        )}
        {geo !== undefined && (
          <>
            <Typography.Text type="secondary" data-testid={props.testIds.summary}>
              {summary}
            </Typography.Text>
            {/* HOW WIDE, beside WHERE. A radius means nothing without a place,
                so this exists only once one is set and disappears with it —
                and it lives here rather than in the filter panel, where it was
                a number about a place the panel could not name. */}
            {geo.kind === "center" && (
              <Flex vertical gap={spacing[1]}>
                <Typography.Text type="secondary">
                  {t(SEARCH_I18N_KEYS.geoRadiusLabel)}
                </Typography.Text>
                <InputNumber
                  min={1}
                  style={{ alignSelf: "flex-start" }}
                  value={geo.radiusKm ?? null}
                  aria-label={t(SEARCH_I18N_KEYS.geoRadiusLabel)}
                  data-testid={props.testIds.radius}
                  onChange={(value) => {
                    setGeo({
                      kind: "center",
                      lat: geo.lat,
                      lon: geo.lon,
                      ...(typeof value === "number" ? { radiusKm: value } : {}),
                    });
                  }}
                />
              </Flex>
            )}
            {/* One control off. Clearing the place clears the radius with it —
                `setGeo(null)` drops both, because half a location is not a
                state this search can be in. */}
            <Button
              style={{ alignSelf: "flex-start" }}
              data-testid={props.testIds.clear}
              data-analytics="none"
              data-analytics-reason="a filter is a read, not a flow step"
              onClick={() => {
                setGeo(null);
              }}
            >
              {t(SEARCH_I18N_KEYS.geoClear)}
            </Button>
          </>
        )}
      </Flex>
    </SkinDialog>
  );
}
