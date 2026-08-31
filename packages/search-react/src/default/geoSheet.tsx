/**
 * The LOCATION sheet — one implementation, two doors.
 *
 * `<FilterChips>`'s geo chip opened it and `<LocationSummaryLine>` opens it
 * too: on the ref's SERP both controls say where the search is centred, one
 * on the summary row and one in the chip strip, and a person tapping either
 * must land in the same place. Two copies of a bottom sheet is two places for
 * "clear the location" to behave differently, so the sheet is a component and
 * the two surfaces are two `open` flags on it.
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
import { Button, Flex, Typography } from "antd";
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
  clear: "search-chip-geo-clear",
};

/** The summary line's door — a different set, so a page holding both rows
 * never hands a test two elements under one name. */
export const SUMMARY_GEO_TEST_IDS: GeoSheetTestIds = {
  sheet: "search-location-sheet",
  apply: "search-location-apply",
  slot: "search-location-slot",
  summary: "search-location-sheet-summary",
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
