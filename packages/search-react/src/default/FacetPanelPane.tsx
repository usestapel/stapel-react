/**
 * `<FacetPanelPane>` — the antd FILTER panel: everything that narrows a
 * search, in the order a person narrows it.
 *
 * Category → language → location → numeric ranges → facet checkboxes. The last
 * of those was, for three releases, the only one that existed: six of the nine
 * state setters had no control at all, so a price range or a location could
 * only be applied by editing the address bar (audit S-2, S-7).
 *
 * Three things it is obliged to render, all of which a naive panel drops:
 *
 *  - the count NEXT TO EVERY OPTION, including the ones you have not chosen.
 *    Facets are counted with their own filter removed, so those numbers are
 *    "what you would get by switching to this instead" — a sibling that shows
 *    a stale or zeroed count has converted a drill-down facet into a naive one.
 *  - `approximate` — said in words, from the first day, because the counts
 *    genuinely are a sample above the backend's candidate cap.
 *  - `skipped` — the slugs the server did not count at all. Their options show
 *    "not counted", never `0`. A silent zero there is the same defect class as
 *    `data ?? []`: a number that looks like an answer and is not one.
 *
 * ── Two slots, and why they are slots ─────────────────────────────────────
 *
 * `renderCategoryFilter` and `renderGeoFilter` are filled by OTHER pairs:
 * choosing a category means walking the catalogue tree (`categories-react`),
 * and turning an address into a coordinate needs a geocoder and a map
 * (`geo-react`). Neither belongs in a search package, and importing either
 * would tie a storefront's search to a catalogue it might not have.
 *
 * What this panel does NOT do is pretend the slot is optional. An unfilled
 * slot renders `SlotPlaceholder` in development — a named, visible hole rather
 * than a silent absence — and, in every build, any constraint the URL already
 * carries gets a control that REMOVES it. A shared link that narrows to a
 * category or a point must never leave a person with no way to widen it again.
 */
import type { ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  InputNumber,
  Typography,
} from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchGeo } from "../api/types.js";
import { FacetPanel } from "../headless/FacetPanel.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import type { FacetGroup, FacetOption } from "../state/facets.js";
import { buildRangeGroups } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { LanguageSelect } from "./LanguageSelect.js";
import { RangeFilterRow } from "./RangeFilterRow.js";
import type { ThemeModeProp } from "./types.js";

/** What a host's category control is handed. */
export interface CategoryFilterSlotProps {
  /** The `root/leaf` path the search is narrowed to, if any. */
  readonly value: string | undefined;
  /** `null` widens the search back to the whole catalogue. */
  readonly onChange: (path: string | null) => void;
}

/** What a host's location control is handed. */
export interface GeoFilterSlotProps {
  readonly value: SearchGeo | undefined;
  /** `null` clears the location constraint. */
  readonly onChange: (geo: SearchGeo | null) => void;
}

export interface FacetPanelPaneProps extends ThemeModeProp {
  /** The category's feature schema — the source of option LABELS and of which
   * slugs get a numeric range row. */
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly enabled?: boolean;
  /** The catalogue picker (`categories-react`'s `CategoryPickerField`, bound
   * to a path). Unfilled, an active category still gets a "clear" control. */
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  /** The location control (`geo-react`). Unfilled, a location that arrived in
   * the URL still gets its radius and a "clear" control. */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  /** BCP-47 tags this deployment indexes — see {@link LanguageSelect}. */
  readonly languages?: readonly string[];
}

function OptionRow(props: {
  group: FacetGroup;
  option: FacetOption;
  onToggle: (slug: string, value: string) => void;
}): ReactElement {
  const t = useT();
  const { option, group } = props;
  return (
    <Flex justify="space-between" align="center" gap={spacing[2]}>
      <Checkbox
        checked={option.selected}
        data-testid={`facet-option-${group.slug}-${option.value}`}
        data-analytics="none"
        data-analytics-reason="a filter is a read, not a flow step"
        onChange={() => {
          props.onToggle(group.slug, option.value);
        }}
      >
        {option.label}
      </Checkbox>
      {option.count === null ? (
        <Typography.Text
          type="secondary"
          data-testid={`facet-count-${group.slug}-${option.value}`}
        >
          {t(SEARCH_I18N_KEYS.facetsNotCounted)}
        </Typography.Text>
      ) : (
        <Typography.Text
          type="secondary"
          data-testid={`facet-count-${group.slug}-${option.value}`}
        >
          {option.count}
        </Typography.Text>
      )}
    </Flex>
  );
}

/** The category constraint: the host's control, or the door out of it. */
function CategoryFilter(props: {
  render?: (slot: CategoryFilterSlotProps) => ReactNode;
}): ReactElement | null {
  const t = useT();
  const { state, setCategory } = useSearchState();
  const value = state.category;

  if (props.render !== undefined) {
    return (
      <Flex vertical gap={spacing[1]} data-testid="search-category">
        <Typography.Text strong>{t(SEARCH_I18N_KEYS.categoryTitle)}</Typography.Text>
        {props.render({
          value,
          onChange: (path) => {
            setCategory(path);
          },
        })}
      </Flex>
    );
  }

  if (value === undefined) {
    return <SlotPlaceholder name="renderCategoryFilter" data-testid="search-category-slot" />;
  }

  return (
    <Flex vertical gap={spacing[1]} data-testid="search-category">
      <Typography.Text strong>{t(SEARCH_I18N_KEYS.categoryTitle)}</Typography.Text>
      <Typography.Text type="secondary">
        {t(SEARCH_I18N_KEYS.categoryCurrent, { path: value })}
      </Typography.Text>
      <Button
        size="small"
        style={{ alignSelf: "flex-start" }}
        data-testid="search-category-clear"
        data-analytics="none"
        data-analytics-reason="a filter is a read, not a flow step"
        onClick={() => {
          setCategory(null);
        }}
      >
        {t(SEARCH_I18N_KEYS.categoryClear)}
      </Button>
    </Flex>
  );
}

/**
 * The location constraint.
 *
 * SETTING a centre needs a geocoder, which is the deployment's and
 * `geo-react`'s. ADJUSTING one that already exists does not: the radius is a
 * number in the URL, and a link shared with `lat/lon/radius_km` is a link this
 * panel can widen, tighten and clear without knowing what a map is. That is the
 * difference between a slot and a hole.
 */
function GeoFilter(props: {
  render?: (slot: GeoFilterSlotProps) => ReactNode;
}): ReactElement | null {
  const t = useT();
  const { state, setGeo } = useSearchState();
  const geo = state.geo;

  const slot =
    props.render !== undefined
      ? props.render({
          value: geo,
          onChange: (next) => {
            setGeo(next);
          },
        })
      : geo === undefined
        ? <SlotPlaceholder name="renderGeoFilter" data-testid="search-geo-slot" />
        : null;

  if (geo === undefined) {
    return slot === null ? null : (
      <Flex vertical gap={spacing[1]} data-testid="search-geo">
        <Typography.Text strong>{t(SEARCH_I18N_KEYS.geoTitle)}</Typography.Text>
        {slot}
      </Flex>
    );
  }

  return (
    <Flex vertical gap={spacing[1]} data-testid="search-geo">
      <Typography.Text strong>{t(SEARCH_I18N_KEYS.geoTitle)}</Typography.Text>
      {slot}
      <Typography.Text type="secondary" data-testid="search-geo-summary">
        {geo.kind === "bbox"
          ? t(SEARCH_I18N_KEYS.geoBox)
          : t(SEARCH_I18N_KEYS.geoCenter, {
              lat: geo.lat.toFixed(3),
              lon: geo.lon.toFixed(3),
            })}
      </Typography.Text>
      {geo.kind === "center" && (
        <Flex gap={spacing[2]} align="center" wrap>
          <Typography.Text type="secondary" aria-hidden="true">
            {t(SEARCH_I18N_KEYS.geoRadiusLabel)}
          </Typography.Text>
          <InputNumber
            min={1}
            value={geo.radiusKm ?? null}
            aria-label={t(SEARCH_I18N_KEYS.geoRadiusLabel)}
            data-testid="search-geo-radius"
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
      <Button
        size="small"
        style={{ alignSelf: "flex-start" }}
        data-testid="search-geo-clear"
        data-analytics="none"
        data-analytics-reason="a filter is a read, not a flow step"
        onClick={() => {
          setGeo(null);
        }}
      >
        {t(SEARCH_I18N_KEYS.geoClear)}
      </Button>
    </Flex>
  );
}

export function FacetPanelPane(props: FacetPanelPaneProps): ReactElement {
  const t = useT();
  const { state } = useSearchState();
  const ranges = buildRangeGroups({
    state,
    ...(props.categoryFeatures !== undefined
      ? { categoryFeatures: props.categoryFeatures }
      : {}),
    t,
  });

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <FacetPanel
        {...(props.categoryFeatures !== undefined
          ? { categoryFeatures: props.categoryFeatures }
          : {})}
        {...(props.locale !== undefined ? { locale: props.locale } : {})}
        {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[3]} data-testid="search-facets">
            <Flex justify="space-between" align="center" gap={spacing[2]}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t(SEARCH_I18N_KEYS.facetsTitle)}
              </Typography.Title>
              {bag.activeFilters > 0 && (
                <Button
                  size="small"
                  onClick={bag.clearAll}
                  data-analytics="none"
                  data-analytics-reason="a filter is a read, not a flow step"
                  data-testid="facets-clear-all"
                >
                  {t(SEARCH_I18N_KEYS.facetsClearAll, { count: bag.activeFilters })}
                </Button>
              )}
            </Flex>

            <CategoryFilter
              {...(props.renderCategoryFilter !== undefined
                ? { render: props.renderCategoryFilter }
                : {})}
            />
            <LanguageSelect
              {...(props.languages !== undefined ? { languages: props.languages } : {})}
            />
            <GeoFilter
              {...(props.renderGeoFilter !== undefined
                ? { render: props.renderGeoFilter }
                : {})}
            />

            {/* Honesty flags, not failures: the counts ARE approximate and
                those slugs WERE skipped, and a red box would teach a person
                the page is broken. `ErrorAlert` is for a read that did not
                happen; this is a read that happened with a caveat. */}
            {bag.approximate && (
              <Alert
                type="info"
                showIcon
                data-testid="facets-approximate"
                title={t(SEARCH_I18N_KEYS.facetsApproximate)}
              />
            )}
            {bag.skipped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                data-testid="facets-skipped"
                title={t(SEARCH_I18N_KEYS.facetsSkipped, {
                  slugs: bag.skipped.join(", "),
                })}
              />
            )}

            {ranges.length > 0 && (
              <Flex vertical gap={spacing[3]} data-testid="search-ranges">
                {ranges.map((group) => (
                  <RangeFilterRow
                    key={group.slug}
                    group={group}
                    onApply={bag.setRange}
                  />
                ))}
              </Flex>
            )}

            {ranges.length > 0 && <Divider style={{ margin: 0 }} />}

            <LoadList
              state={bag.state}
              testId="facets"
              skeletonRows={4}
              empty={<EmptyState compact title={t(SEARCH_I18N_KEYS.facetsEmpty)} testId="facets-empty" />}
              failed={(error) => (
                <ErrorAlert
                  testId="facets-failed"
                  thrown={error}
                  message={t(SEARCH_I18N_KEYS.facetsLoadFailed)}
                />
              )}
            >
              {(groups) => (
                <Flex vertical gap={spacing[4]}>
                  {groups.map((group) => (
                    <Flex
                      vertical
                      gap={spacing[1]}
                      key={group.slug}
                      data-testid={`facet-group-${group.slug}`}
                      data-counted={group.counted ? "true" : "false"}
                    >
                      <Typography.Text strong>{group.label}</Typography.Text>
                      {group.options.map((option) => (
                        <OptionRow
                          key={option.value}
                          group={group}
                          option={option}
                          onToggle={bag.toggle}
                        />
                      ))}
                    </Flex>
                  ))}
                  <Typography.Text type="secondary">
                    {t(SEARCH_I18N_KEYS.facetsDrillDownHint)}
                  </Typography.Text>
                </Flex>
              )}
            </LoadList>
          </Flex>
        )}
      </FacetPanel>
    </SkinTheme>
  );
}
