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
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Divider,
  Flex,
  InputNumber,
  Typography,
} from "antd";
import { SlotPlaceholder, isDevBuild, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { featureName } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchGeo } from "../api/types.js";
import { FacetPanel } from "../headless/FacetPanel.js";
import type { FacetLabelResolver } from "../headless/useFacetLabels.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { FacetGroupControl } from "./FacetGroupControl.js";
import { buildRangeGroups } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { LanguageSelect } from "./LanguageSelect.js";
import { RangeFilterRow } from "./RangeFilterRow.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The heading row, in a 280px rail (defect C14).
 *
 * Measured on the live desktop SERP: the box holding the word "Filters" was
 * **43px wide and 78px tall — three lines** — reading "Fil / ter / s" down the
 * left edge of the results. It is the first thing a shopper sees beside their
 * results, and it looked like a rendering fault.
 *
 * Two causes, one row:
 *
 * 1. **The row's other half is a long sentence.** "Clear all filters (2)" is
 *    twenty-one characters in English and twenty-four in the Russian
 *    catalogue. Both halves were ordinary flex items in a `space-between` row,
 *    so in a rail the button took the width it wanted and the heading got what
 *    was left — 43px of a 280px column.
 * 2. **antd's `.ant-typography` ships `word-break: break-word`,** which is why
 *    the remains were not a truncated word but a word broken between its
 *    letters onto three lines. Breaking inside a word is for prose that has to
 *    fit a narrow measure; a one-word section heading is not that.
 *
 * So: the row WRAPS — the button drops to its own line rather than squeezing
 * the word — the heading never shrinks below its own content and never breaks
 * inside a word, and the button is the half that gives, wrapping its sentence
 * over two lines when the rail is narrow.
 *
 * ── Why these are inline styles and not a hoisted sheet ───────────────────
 *
 * Because they contradict antd, and both elements are OURS. A class of ours
 * against `.ant-typography` or `.ant-btn` is decided by whichever stylesheet
 * was injected last, which is not a decision — it is a coin toss that happens
 * to land right until a dependency reorders its emit. An inline style wins
 * against every stylesheet by rule. `<LocationSummaryLine>` hoists a sheet
 * because its rules have to reach a `<span>` antd generates and React never
 * sees; nothing here does.
 */
const FACET_HEADING: CSSProperties = {
  margin: 0,
  // Never squeezed: 43px of a 280px column was a heading allowed to give its
  // width to a twenty-five-character button.
  flex: "0 0 auto",
  minInlineSize: "max-content",
  // Never hyphenated, never broken between the letters of one word.
  wordBreak: "normal",
  overflowWrap: "normal",
  hyphens: "none",
};

/** The half that gives. A two-line button is a button; a three-line heading of
 * one word is a defect. */
const FACET_CLEAR: CSSProperties = {
  flex: "0 1 auto",
  minInlineSize: 0,
  whiteSpace: "normal",
  height: "auto",
  textAlign: "start",
};

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
  /** The category's feature schema — the source of option LABELS, of which
   * slugs get a numeric range row, and of which slugs are a filter at all
   * (`isFacetableFeature`: an `imei` is counted and is not one). */
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly enabled?: boolean;
  /**
   * Name the values neither the answer nor the schema names — see
   * {@link FacetLabelResolver}. A `ref_select` facet carries only a pointer to
   * a vocabulary in its config, and the vocabulary is the host's to read.
   *
   * The same prop reaches `<FilterChips>` from `<SearchPage>`, so the panel
   * and the chip row cannot print two different words for one value.
   */
  readonly resolveFacetLabels?: FacetLabelResolver;
  /** The catalogue picker (`categories-react`'s `CategoryPickerField`, bound
   * to a path). Unfilled, an active category still gets a "clear" control. */
  readonly renderCategoryFilter?: (slot: CategoryFilterSlotProps) => ReactNode;
  /** The location control (`geo-react`). Unfilled, a location that arrived in
   * the URL still gets its radius and a "clear" control. */
  readonly renderGeoFilter?: (slot: GeoFilterSlotProps) => ReactNode;
  /**
   * What the current location constraint is CALLED, in words — the address or
   * the city the host resolved.
   *
   * The panel owns `lat`/`lon`/`radius_km` as URL state and must never render
   * them: a coordinate is what gets STORED, and storage is not a display
   * concern. `55.756, 37.617` is unreadable to the one person who could have
   * caught the mistake, so a wrong point looks as authoritative as a right one
   * and a right one looks like machinery.
   *
   * Whoever turned an address into that point still has the address — the
   * geocoder's own answer, the city an IP guess named, the label on the map
   * pin — and hands it back here. Absent, the panel says a location is applied
   * without pretending to name it (`search.geo.chosen_place`).
   */
  readonly geoLabel?: ReactNode;
  /** BCP-47 tags this deployment indexes — see {@link LanguageSelect}. */
  readonly languages?: readonly string[];
  /**
   * What the panel calls itself. `null` draws no title at all — for a surface
   * that has ALREADY named it, which the phone sheet has: its dialog title and
   * the panel's own heading both said "Filters", one under the other, in every
   * shot of the open sheet. The row itself stays either way, because the
   * "Clear all" control lives in it.
   */
  readonly heading?: ReactNode;
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
 * What a location constraint is called when the host handed down no name.
 *
 * Two sentences, and neither of them is a number. A box is describable without
 * one — it is the area on the screen — and a point is not, so the point's
 * sentence says a place was chosen and stops there. The alternative that was
 * shipped for four releases printed `Around 55.756, 37.617`, which is the
 * defect class this pair is otherwise careful about everywhere else: a value
 * the reader cannot check, rendered as if it were an answer.
 *
 * Shared with `<FilterChips>` so the phone row and the desktop panel cannot
 * drift into saying two different things about the same URL.
 */
export function geoSummaryFallback(
  geo: SearchGeo,
  t: (key: string) => string
): string {
  return geo.kind === "bbox"
    ? t(SEARCH_I18N_KEYS.geoBox)
    : t(SEARCH_I18N_KEYS.geoChosenPlace);
}

/**
 * The location constraint.
 *
 * SETTING a centre needs a geocoder, which is the deployment's and
 * `geo-react`'s. ADJUSTING one that already exists does not: the radius is a
 * number in the URL, and a link shared with `lat/lon/radius_km` is a link this
 * panel can widen, tighten and clear without knowing what a map is. That is the
 * difference between a slot and a hole.
 *
 * NAMING the centre is a third thing again, and it is the host's: this panel
 * has two numbers and no way to turn them into a place. So it either says the
 * name it was handed (`label`) or says that a place is chosen — never the
 * numbers themselves. See {@link FacetPanelPaneProps.geoLabel}.
 */
function GeoFilter(props: {
  render?: (slot: GeoFilterSlotProps) => ReactNode;
  label?: ReactNode;
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
    // An unfilled slot is a NAMED hole in development and nothing at all in a
    // production build — so the heading has to follow the placeholder rather
    // than outlive it. It did not, and the live desktop panel printed
    // "Location" over empty space with no location control under it
    // (class NC-ORPHANFIELD): a label is a promise that a control follows.
    if (props.render === undefined && !isDevBuild()) return null;
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
        {props.label ?? geoSummaryFallback(geo, t)}
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

/**
 * The slugs the server skipped, named the way the panel names everything else.
 *
 * `facet_meta.skipped` is a list of index slugs (`power_w`); the sentence that
 * reports them was printing exactly that, so a shopper read "These filters
 * were not counted for this search: power_w". The category schema is already
 * in this component for the option labels — it names these too. A slug the
 * schema does not know stays as it is, because a made-up name would be worse
 * than an honest identifier.
 */
function skippedNames(
  slugs: readonly string[],
  features: readonly FeatureDef[] | undefined,
  t: (key: string) => string
): string {
  return slugs
    .map((slug) => {
      const feature = features?.find((candidate) => candidate.slug === slug);
      if (feature === undefined) return slug;
      const name = t(featureName(feature));
      return name.length > 0 ? name : slug;
    })
    .join(", ");
}

export function FacetPanelPane(props: FacetPanelPaneProps): ReactElement {
  const t = useT();
  const { state } = useSearchState();

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <FacetPanel
        {...(props.categoryFeatures !== undefined
          ? { categoryFeatures: props.categoryFeatures }
          : {})}
        {...(props.locale !== undefined ? { locale: props.locale } : {})}
        {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}
        {...(props.resolveFacetLabels !== undefined
          ? { resolveFacetLabels: props.resolveFacetLabels }
          : {})}
      >
        {(bag) => {
          // Built INSIDE the bag, because which axes exist is a property of
          // the ANSWER now: `facet_meta.core_ranges` names the core columns
          // this server can actually filter on (`r.price`), and the corpus
          // currency is read off the cards it just returned. Computed
          // outside, the panel would have had to keep its own list of core
          // slugs — which is how a board ends up offering a price filter
          // against a server that answers zero for one.
          const ranges = buildRangeGroups({
            state,
            ...(props.categoryFeatures !== undefined
              ? { categoryFeatures: props.categoryFeatures }
              : {}),
            coreRanges: bag.coreRanges,
            ...(bag.currency !== undefined ? { currency: bag.currency } : {}),
            t,
          });
          return (
          <Flex vertical gap={spacing[3]} data-testid="search-facets">
            {/* In a 280px rail this row laid the word "Filters" out in a
                43x78 box, three lines, one syllable each — see FACET_HEADING.
                `wrap` is the row's half of the fix: the long sentence drops to
                its own line instead of taking the heading's width. */}
            <Flex
              justify="space-between"
              align="center"
              wrap
              gap={spacing[2]}
              data-testid="search-facets-head"
            >
              {props.heading === null ? (
                <span />
              ) : (
                <Typography.Title
                  level={5}
                  style={FACET_HEADING}
                  data-testid="search-facets-heading"
                >
                  {props.heading ?? t(SEARCH_I18N_KEYS.facetsTitle)}
                </Typography.Title>
              )}
              {bag.activeFilters > 0 && (
                <Button
                  style={FACET_CLEAR}
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
              {...(props.geoLabel !== undefined ? { label: props.geoLabel } : {})}
            />

            {/* Price first. Every numeric row below it is an ATTRIBUTE the
                category happens to declare — on the phone board this was
                measured against, all seven of them were parcel dimensions
                and wholesale packing. The one number a buyer narrows by is
                the price, and `buildRangeGroups` puts the core axes first. */}
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
                  slugs: skippedNames(bag.skipped, props.categoryFeatures, t),
                })}
              />
            )}

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
                  {/* A group with no options is a heading with nothing under
                      it. `power_w` arrives in `skipped` and in no facet map,
                      so it produced exactly that — "Power" printed twice on
                      the desktop panel, once as the range row and once as a
                      label over air. The skipped Alert above already names it;
                      a heading with no control under it names nothing. */}
                  {/* Each group draws itself the way its own schema says:
                      pills for a single-choice facet, indented children for a
                      hierarchical one, a fold for a long one. The panel does
                      not decide — `facetGroupShape` reads the same config keys
                      the attributes editor reads, so a facet cannot look one
                      way here and another way in the composer. */}
                  {groups
                    .filter((group) => group.options.length > 0)
                    .map((group) => (
                      <FacetGroupControl
                        key={group.slug}
                        group={group}
                        onToggle={bag.toggle}
                      />
                    ))}
                  <Typography.Text type="secondary">
                    {t(SEARCH_I18N_KEYS.facetsDrillDownHint)}
                  </Typography.Text>
                </Flex>
              )}
            </LoadList>
          </Flex>
          );
        }}
      </FacetPanel>
    </SkinTheme>
  );
}
