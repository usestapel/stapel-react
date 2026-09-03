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
 *    `data ?? []`: a number that looks like an answer and is not one. The
 *    facet itself is still DRAWN, from the category schema, because the server
 *    filters on a slug it never counted; the engine's own list of skipped
 *    slugs is a developer's note and lives behind `skippedNotice`.
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
 *
 * ── The panel opens what the answer argues for, and closes the rest ────────
 *
 * Measured on a live classified deployment's cars leaf at 1440×900: this
 * panel, in a 280px rail, was 5717px tall — 40 groups, 118 checkboxes, 66
 * fields, one flat column whose tail no scroll a person actually performs
 * ever reaches. The phone sheet drew the same column six screens deep.
 *
 * So the groups are disclosures now, and WHICH open is decided here, from
 * evidence the panel already holds: a group with any chosen value is always
 * open (a constraint must keep its control in sight), and otherwise the top
 * {@link FACET_OPEN_GROUPS} counted groups by {@link facetCoverage} — the sum
 * of an axis's counts is the answer's own statement of how many documents
 * carry it, the same reasoning the chip row sorts its band by. Everything
 * else starts as a header, one click from whole. A group the server never
 * counted sums to zero and therefore never opens uninvited, which is what
 * removes the wall of "not counted" rows from the default view without
 * deleting one of them.
 *
 * From {@link FACET_SEARCH_THRESHOLD} groups up the panel also takes a search
 * of ITSELF — a person who cannot scan forty headers should not have to open
 * them one by one to find the axle count. It narrows by group or option
 * label, opens what it matches, and touches presentation only: the URL is
 * state and a panel query is not.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Divider,
  Flex,
  Input,
  InputNumber,
  Typography,
  theme,
} from "antd";
import { SlotPlaceholder, isDevBuild, useT, useTPlural } from "@stapel/core";
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
import { useAppliedCount } from "../headless/useAppliedCount.js";
import { facetCoverage, orderFacetGroups } from "../state/facets.js";
import type { FacetGroup } from "../state/facets.js";
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

/**
 * How many counted groups open by default — beyond the ones with chosen
 * values, which always do. Five open groups at the default type step fill
 * roughly one 900px window of the rail: the panel's first screen is the five
 * axes this corpus is most narrowed by, and everything after is a header.
 */
export const FACET_OPEN_GROUPS = 5;

/**
 * From how many groups the panel offers a search of itself. Under six the
 * headers fit a glance and a box would be chrome over nothing; the measured
 * leaf had forty.
 */
export const FACET_SEARCH_THRESHOLD = 6;

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
  /**
   * Print the engine's own note about which slugs it did not COUNT
   * (`facet_meta.skipped`). Default `false` — off, and off for a shopper.
   *
   * ── Why this is opt-in and was not ────────────────────────────────────────
   *
   * The sentence is true and it is not a shopper's sentence. On a live cars
   * leaf it rendered as a yellow warning naming forty-two of the category's
   * own fields — climate-control sub-options, a video-file URL, nine dealer
   * promotions — stacked above the filters. The same class of engine plumbing
   * as the synonym-expansion notice this pair removed earlier, and the owner
   * read it exactly that way: as the page saying something was broken.
   *
   * It was also, until this release, a WARNING ABOUT A CONSEQUENCE THE PANEL
   * IMPOSED: an uncounted facet drew no options, so the note named filters
   * the person could not then use. `buildFacetGroups` now builds those
   * options from the category schema, so the filters are there, counted or
   * not, and the only thing missing is the number beside each option — which
   * every option already says for itself.
   *
   * `true` puts it back, for a developer looking at a deployment's facet plan
   * on a staging surface. Nothing else changes with it.
   */
  readonly skippedNotice?: boolean;
  /**
   * Draw the sticky footer inside the panel: the live result count as the
   * bar's strong text, and the clear-all control (which then moves out of the
   * heading row — one control, not two) beside it. Default `false`.
   *
   * `<SearchPage>` turns it on for the desktop RAIL only. Desktop filters
   * apply instantly, so the bar is FEEDBACK plus the way out, not an apply
   * button — which is exactly why the phone sheet must not get it: the sheet
   * already closes through its own "Show N results" footer, and a second
   * count-bearing bar above that one would be the same sentence twice.
   */
  readonly footerBar?: boolean;
}

/**
 * The rail's sticky floor: what the filters DID (the live count), and the way
 * out of them (clear all). It sticks to the bottom of the rail's own scroll,
 * so however deep the panel goes the answer stays on screen.
 *
 * The count reuses `useAppliedCount` — the answer already in cache, never a
 * second request — and its honesty rules: an exact count gets the counted
 * noun ("N listings match"), a floor keeps the existing "N+" family, and an
 * engine that cannot say gets NO number, because a fabricated one on the
 * surface that reports what filtering did is worse than silence. With
 * nothing to say and nothing to clear, no bar.
 */
function RailFooterBar(props: {
  readonly activeFilters: number;
  readonly clearAll: () => void;
}): ReactElement | null {
  const t = useT();
  const tPlural = useTPlural();
  // The token bag of the nearest theme, so the bar's ground and hairline are
  // the panel's own in both modes — a hard-coded white floor would glow in
  // the dark theme.
  const { token } = theme.useToken();
  const applied = useAppliedCount();
  const countText =
    applied.count === null || applied.kind === "unknown"
      ? null
      : tPlural(
          applied.kind === "at_least"
            ? SEARCH_I18N_KEYS.resultsCountAtLeast
            : SEARCH_I18N_KEYS.facetsMatchCount,
          { count: applied.count }
        );
  if (countText === null && props.activeFilters === 0) return null;
  return (
    <div
      data-testid="facets-footer-bar"
      style={{
        position: "sticky",
        bottom: 0,
        // Opaque, or the options scrolling under the bar read THROUGH it.
        background: token.colorBgContainer,
        borderBlockStart: `1px solid ${token.colorSplit}`,
        paddingBlockStart: spacing[2],
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: spacing[2],
      }}
    >
      {countText !== null && (
        <Typography.Text strong data-testid="facets-footer-count">
          {countText}
        </Typography.Text>
      )}
      {props.activeFilters > 0 && (
        <Button
          style={FACET_CLEAR}
          onClick={props.clearAll}
          data-analytics="none"
          data-analytics-reason="a filter is a read, not a flow step"
          data-testid="facets-clear-all"
        >
          {t(SEARCH_I18N_KEYS.facetsClearAll, { count: props.activeFilters })}
        </Button>
      )}
    </div>
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
  // The panel-search's text. COMPONENT state on purpose: it narrows how the
  // panel is drawn, never what the search is, so it must not survive into a
  // shared link the way everything in `useSearchState` does.
  const [filterQuery, setFilterQuery] = useState("");

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
          // The band split, and it is the whole of D120/D121: `RangeGroup.core`
          // is the server's own declaration that an axis exists for every
          // document in every category (the price). Everything else is a
          // number this category happens to declare, which on an imported
          // classified catalogue means parcel weight and wholesale packing.
          const coreRanges = ranges.filter((group) => group.core);
          const attributeRanges = ranges.filter((group) => !group.core);
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
              {/* With the footer bar on, clear-all lives THERE — beside the
                  count it acts on — and drawing it here too would be two
                  identical exits one panel apart. */}
              {bag.activeFilters > 0 && props.footerBar !== true && (
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

            {/* Price, and only the CORE axes — the ones the server declares
                for every document in every category.

                Every other numeric row is an ATTRIBUTE the category happens
                to declare, and on the deployed phones leaf all seven were
                parcel dimensions and wholesale packing. They used to render
                here, immediately under the price, which put 908px of
                shipping-weight and packing-count rows between the buyer and
                the brand (D120/D121).
                They now render AFTER the facets, which is the band order the
                chip row has used since D16 — see `CHIP_BAND_ORDER`. */}
            {coreRanges.length > 0 && (
              <Flex vertical gap={spacing[3]} data-testid="search-ranges">
                {coreRanges.map((group) => (
                  <RangeFilterRow
                    key={group.slug}
                    group={group}
                    onApply={bag.setRange}
                  />
                ))}
              </Flex>
            )}

            {coreRanges.length > 0 && <Divider style={{ margin: 0 }} />}

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
            {props.skippedNotice === true && bag.skipped.length > 0 && (
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
              {(groups) => {
                // A group with no options is a heading with nothing under
                // it. What is left in that state after `buildFacetGroups`
                // learned to read the schema is the genuinely unanswerable
                // case: a `ref_select` whose config is a bare pointer into
                // a vocabulary this pair cannot read. A heading with no
                // control under it names nothing, so it is not drawn.
                // Evidence order, the chip row's rule applied to the rail:
                // answered axes first, then the ones this corpus actually
                // fills. Schema order is the catalogue importer's, and an
                // imported catalogue's is alphabetical-by-accident.
                const drawable = orderFacetGroups(
                  groups.filter((group) => group.options.length > 0)
                );
                // Which groups OPEN — see the module note. Chosen groups are
                // open unconditionally below; here the answer's evidence
                // picks the rest: the top counted groups by coverage, and a
                // group the server never counted sums to zero, so the wall
                // of "not counted" rows starts as headers.
                const openByEvidence = new Set(
                  drawable
                    .filter((group) => group.counted)
                    .map((group) => [group, facetCoverage(group)] as const)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, FACET_OPEN_GROUPS)
                    .map(([group]) => group.slug)
                );
                const searchable = drawable.length >= FACET_SEARCH_THRESHOLD;
                const needle = searchable
                  ? filterQuery.trim().toLowerCase()
                  : "";
                const matches = (group: FacetGroup): boolean =>
                  group.label.toLowerCase().includes(needle) ||
                  group.options.some((option) =>
                    option.label.toLowerCase().includes(needle)
                  );
                const listed =
                  needle === "" ? drawable : drawable.filter(matches);
                return (
                  <Flex vertical gap={spacing[4]}>
                    {searchable && (
                      <Input
                        allowClear
                        value={filterQuery}
                        placeholder={t(SEARCH_I18N_KEYS.facetsSearch)}
                        aria-label={t(SEARCH_I18N_KEYS.facetsSearch)}
                        data-testid="facets-search"
                        onChange={(event) => {
                          setFilterQuery(event.target.value);
                        }}
                      />
                    )}
                    {/* The query missed. The groups are still there — one
                        cleared box away — so this is the panel-search's empty
                        state, not the panel's. */}
                    {needle !== "" && listed.length === 0 && (
                      <EmptyState
                        compact
                        title={t(SEARCH_I18N_KEYS.facetsSearchEmpty)}
                        testId="facets-search-empty"
                      />
                    )}
                    {/* Each group draws itself the way its own schema says:
                        pills for a single-choice facet, indented children for a
                        hierarchical one, a fold for a long one. The panel does
                        not decide — `facetGroupShape` reads the same config keys
                        the attributes editor reads, so a facet cannot look one
                        way here and another way in the composer. */}
                    {/* The key changes with the query's presence ON PURPOSE:
                        `defaultOpen` is an initial value, and a group the
                        panel-search matched has to render OPEN — a hit behind
                        a closed header is not an answer. Remounting is the
                        honest way to re-ask the question; the person's own
                        opens and closes come back when the box clears. */}
                    {listed.map((group) => (
                      <FacetGroupControl
                        key={needle === "" ? group.slug : `${group.slug}:match`}
                        group={group}
                        onToggle={bag.toggle}
                        collapsible
                        defaultOpen={
                          needle !== "" ||
                          group.selected.length > 0 ||
                          openByEvidence.has(group.slug)
                        }
                      />
                    ))}
                    <Typography.Text type="secondary">
                      {t(SEARCH_I18N_KEYS.facetsDrillDownHint)}
                    </Typography.Text>
                  </Flex>
                );
              }}
            </LoadList>

            {/* The numeric tail, below the axes people actually narrow by.
                On the deployed mobile-phones leaf this block is 908px of
                battery health, four parcel dimensions and two wholesale
                packing counts — and while it
                rendered directly under the price it was the ONLY thing a
                buyer could see in a viewport-tall rail (D120/D121, D74 on the
                phone). It is a real filter for the person who wants it, so it
                is not deleted; it is ranked where the chip row already ranks
                it. */}
            {attributeRanges.length > 0 && (
              <>
                <Divider style={{ margin: 0 }} />
                <Flex
                  vertical
                  gap={spacing[3]}
                  data-testid="search-ranges-attributes"
                >
                  {attributeRanges.map((group) => (
                    <RangeFilterRow
                      key={group.slug}
                      group={group}
                      onApply={bag.setRange}
                    />
                  ))}
                </Flex>
              </>
            )}

            {props.footerBar === true && (
              <RailFooterBar
                activeFilters={bag.activeFilters}
                clearAll={bag.clearAll}
              />
            )}
          </Flex>
          );
        }}
      </FacetPanel>
    </SkinTheme>
  );
}
