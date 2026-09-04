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
 * ── One slot, and why it is a slot ────────────────────────────────────────
 *
 * `renderCategoryFilter` is filled by ANOTHER pair: choosing a category means
 * walking the catalogue tree (`categories-react`), which does not belong in a
 * search package, and importing it would tie a storefront's search to a
 * catalogue it might not have.
 *
 * There used to be a second one, `renderGeoFilter`, and a "Location" group
 * around it with the radius under it. Both are gone from this panel. A place
 * is not a filter — a coordinate pair is the machine form of somewhere, and
 * putting it in the filter list is what let a landing announce "clear all
 * filters (2)" over an empty page with two constraints that had no name.
 * The place and its radius are ONE control of their own
 * (`<LocationSummaryLine>`), the way a search box is, and `<SearchPage>`
 * still takes `renderGeoFilter` — it hands it there.
 *
 * What this panel does NOT do is pretend the slot is optional. An unfilled
 * slot renders `SlotPlaceholder` in development — a named, visible hole rather
 * than a silent absence — and, in every build, any constraint the URL already
 * carries gets a control that REMOVES it. A shared link that narrows to a
 * category must never leave a person with no way to widen it again.
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
  Typography,
  theme,
} from "antd";
import { SlotPlaceholder, useT, useTPlural } from "@stapel/core";
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
import type { FacetPanelBag } from "../headless/FacetPanel.js";
import type { FacetLabelResolver } from "../headless/useFacetLabels.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { useAppliedCount } from "../headless/useAppliedCount.js";
import {
  facetCoverage,
  facetGroupIsDrawable,
  orderFacetGroupsBySchema,
} from "../state/facets.js";
import type { FacetGroup } from "../state/facets.js";
import { FacetGroupControl } from "./FacetGroupControl.js";
import { buildRangeGroups } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { LanguageSelect } from "./LanguageSelect.js";
import { RANGE_ROW_MIN_HEIGHT, RangeFilterRow, RangeRowSkeleton } from "./RangeFilterRow.js";
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

/**
 * How many groups the rail draws before the rest go behind one control. This
 * is `<FacetPanelPane>`'s own default, for the desktop COLUMN — `<SearchPage>`
 * passes 8 for the phone sheet instead (a surface reached through a modal
 * already costs a tap; folding its tail behind a second one is not the same
 * saving as folding a column that sits on screen the whole time).
 *
 * The reference classified inlines roughly two dozen groups in the desktop
 * rail before anything folds — eight, this pair's number for three releases,
 * turned a make, a price and a year into the whole visible rail with a
 * "all filters" button under them. Sixteen is not a copy of the reference's
 * count; it is the point past which the tail is genuinely a scan rather than
 * a read, on the rail widths this pair is measured against. The tail is
 * never hidden: `facetsAllFilters` names how many are in it.
 */
export const FACET_VISIBLE_GROUPS = 16;

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
   * Draw the footer inside the panel: the live result count as the bar's
   * strong text, and the clear-all control (which then moves out of the
   * heading row — one control, not two) beside it. Default: no bar.
   *
   * `<SearchPage>` turns it on for the desktop RAIL only. Desktop filters
   * apply instantly, so the bar is FEEDBACK plus the way out, not an apply
   * button — which is exactly why the phone sheet must not get it: the sheet
   * already closes through its own "Show N results" footer, and a second
   * count-bearing bar above that one would be the same sentence twice.
   *
   * ── Where it sits, and why that is a choice ───────────────────────────────
   *
   * `"sticky"` (and `true`, which is what it has always meant) pins the bar to
   * the bottom of the panel's own scroll port. That is right in a SHEET, whose
   * port is the sheet and whose bar is the way out of it. In the desktop
   * COLUMN the rail scrolls with the page, so an opaque bar pinned to the
   * bottom of the viewport parks itself over the last two facet groups and
   * they cannot be reached at all — a storefront was reaching for `!important`
   * to lift it off. `"static"` puts the bar after the groups, where it stops
   * covering anything, and the column layout of `<SearchPage>` passes it.
   */
  readonly footerBar?: boolean | "sticky" | "static";
  /**
   * The partition control, drawn at the TOP of the panel — above the price,
   * above every facet.
   *
   * A partition (`children_as: "chips"`) is not a filter among filters: it is
   * which of one template's halves the page is about, and the reference
   * classified puts it first for that reason (a car-type row: all, used,
   * new). It is a slot rather than a component because the
   * children come from the catalogue tree, which is `categories-react`'s;
   * `<PartitionChips variant="segmented">` is what a host usually puts here.
   */
  readonly partition?: ReactNode;
  /**
   * Slugs pinned above every other group, in the order given — the axis a
   * page has already decided is its subject. See
   * {@link orderFacetGroupsBySchema}.
   */
  readonly pinnedFacets?: readonly string[];
  /**
   * How many groups before the tail folds under "All filters (K)". Default
   * {@link FACET_VISIBLE_GROUPS}; `null` draws every group, which is what a
   * phone sheet devoted to filtering wants.
   */
  readonly visibleGroups?: number | null;
  /**
   * How a DICTIONARY group is drawn. `"field"` is the desktop shape — a
   * select-style field reading its chosen values or "Any", which opens the
   * searchable list under it; `"sheet"` is the phone's — the same trigger
   * row, opening a nested picker sheet with a search box, a recommended band
   * and the rest, which is the control the composer's vocabulary picker
   * already is; `"inline"` (the default) keeps the list open.
   */
  readonly dictionaryMode?: "field" | "inline" | "sheet";
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
  /** `"sticky"` pins it to the scroll port's floor; `"static"` lets it sit
   * after the last group. See {@link FacetPanelPaneProps.footerBar}. */
  readonly position: "sticky" | "static";
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
      data-position={props.position}
      style={{
        ...(props.position === "sticky" ? { position: "sticky", bottom: 0 } : {}),
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

/**
 * The empty arm of the panel — the ONE place "this search offers no filters"
 * may be said, and the three things that forbid it (D175, amended).
 *
 * A group list of zero is not "nothing on the rail". `withheld` names groups
 * the counter counted and then held back for describing too little of the
 * result set: they exist, so this is not the search's own claim to make.
 * `planUnavailable` means the server could not work a plan out at all — the
 * reader hears that from `<DegradationNotice>`, and this arm's only job is to
 * not contradict it. `hasOtherDrawable` means the rail is already drawing
 * something beside the facet groups — a price row, a location constraint, a
 * partition — and "no filters" would be false the moment any of those is on
 * screen.
 *
 * This USED to be two sentences: `facetsEmpty` for the last case and
 * `facetsWithheld` — "N filters apply to too few of these results" — for the
 * first. A reference catalogue checked against the same case says NEITHER:
 * it leaves the filters visible with low counts and explains nothing. So
 * `withheld` (and, the same way, `skipped`) now suppress this arm instead of
 * replacing its text — the arm says nothing, and `data-withheld` is a test
 * hook a shopper never reads.
 *
 * A COMPONENT rather than a ternary inline in `empty=`, because `LoadList`
 * reads a nullish `empty` as "no arm given" and draws its own default, which
 * is the sentence again. An element that renders `null` says nothing; a
 * `null` prop says it louder.
 */
function FacetsEmptyArm(props: {
  readonly bag: FacetPanelBag;
  /** Something else on the rail already makes "no filters" false. */
  readonly hasOtherDrawable: boolean;
}): ReactElement | null {
  const t = useT();
  const withheld = props.bag.withheld.length;
  if (withheld > 0 || props.bag.planUnavailable || props.hasOtherDrawable) {
    return withheld > 0 ? (
      <span hidden data-testid="facets-withheld" data-withheld={withheld} />
    ) : null;
  }
  return (
    <EmptyState compact title={t(SEARCH_I18N_KEYS.facetsEmpty)} testId="facets-empty" />
  );
}

export function FacetPanelPane(props: FacetPanelPaneProps): ReactElement {
  const t = useT();
  const { state } = useSearchState();
  // The panel-search's text. COMPONENT state on purpose: it narrows how the
  // panel is drawn, never what the search is, so it must not survive into a
  // shared link the way everything in `useSearchState` does.
  const [filterQuery, setFilterQuery] = useState("");
  // Whether the tail past `visibleGroups` is open. Presentation, like the
  // panel's own search box: the URL is the search, and how much of the rail a
  // person has unfolded is not part of it.
  const [tailOpen, setTailOpen] = useState(false);
  // `true` is the shape the prop shipped with and keeps meaning: pinned.
  const footerBar: "sticky" | "static" | "none" =
    props.footerBar === true
      ? "sticky"
      : props.footerBar === false || props.footerBar === undefined
        ? "none"
        : props.footerBar;

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
            // The measured ends, and the axes the schema types as choices —
            // a vocabulary-backed year is a from/to here because the answer
            // says it has numbers behind it (stapel-search 0.14.7).
            ...(bag.ranges !== undefined ? { ranges: bag.ranges } : {}),
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
          // How many rows the block reserves while the answer is in flight:
          // what this category was last MEASURED to have, else what the
          // schema declares. See the reservation comment below.
          const reservedAxes =
            bag.reservedRangeAxes?.length ?? attributeRanges.length;
          // Is there anything on this rail besides the facet groups? A price
          // row, an applied location, or the partition slot all make "this
          // search offers no filters" false even when the group list itself
          // is empty. `state.geo` rather than a rendered control: the place
          // and its radius are drawn by `<LocationSummaryLine>` beside this
          // panel, not inside it, but the constraint is still on the rail.
          const hasOtherDrawable =
            props.partition !== undefined ||
            coreRanges.length > 0 ||
            state.geo !== undefined;
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
              {bag.activeFilters > 0 && footerBar === "none" && (
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

            {/* The partition first: which half of one template this page is
                about is not a filter among filters. */}
            {props.partition !== undefined && (
              <div data-testid="search-partition">{props.partition}</div>
            )}

            <CategoryFilter
              {...(props.renderCategoryFilter !== undefined
                ? { render: props.renderCategoryFilter }
                : {})}
            />
            <LanguageSelect
              {...(props.languages !== undefined ? { languages: props.languages } : {})}
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
              empty={<FacetsEmptyArm bag={bag} hasOtherDrawable={hasOtherDrawable} />}
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
                // SCHEMA order, required first — see
                // `orderFacetGroupsBySchema`. The rail ranked by evidence for
                // two releases, which on a three-listing cars leaf put
                // condition and colour above make, model and year:
                // the busiest axis is the right question for a chip row with
                // room for four and the wrong one for the column a person
                // narrows a catalogue in. Groups the schema does not name
                // keep evidence order among themselves.
                const drawable = orderFacetGroupsBySchema({
                  groups: groups.filter(facetGroupIsDrawable),
                  ...(props.categoryFeatures !== undefined
                    ? { categoryFeatures: props.categoryFeatures }
                    : {}),
                  ...(props.pinnedFacets !== undefined
                    ? { pinned: props.pinnedFacets }
                    : {}),
                });
                // Which groups OPEN — see the module note. Chosen groups are
                // open unconditionally below; the rest are the first
                // FACET_OPEN_GROUPS of the order above, so the panel's first
                // screen is the axes the category itself calls required. A
                // group the server never counted starts as a header, which is
                // what keeps the wall of "not counted" rows folded.
                const openByOrder = new Set(
                  drawable
                    .filter((group) => group.counted || facetCoverage(group) > 0)
                    .slice(0, FACET_OPEN_GROUPS)
                    .map((group) => group.slug)
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
                // The tail. Only while nothing is typed: a query has already
                // narrowed the list, and folding its answer would hide the
                // thing that was looked for. One group over the limit is not
                // folded — a control that reveals exactly one heading costs
                // more than it saves.
                const groupLimit =
                  props.visibleGroups === null
                    ? null
                    : (props.visibleGroups ?? FACET_VISIBLE_GROUPS);
                const tailFolded =
                  groupLimit !== null &&
                  needle === "" &&
                  listed.length > groupLimit + 1;
                // A CONSTRAINT NEVER FOLDS. The fold hides axes a person has
                // not touched; a group they have chosen a value in stays in
                // the visible band wherever the schema put it, because the
                // control that removes a filter is the one they came back
                // for. (The rail used to rank answered axes to the top for
                // this; schema order is stable under a click, which a rail
                // that reshuffles as you tick is not.)
                const shownGroups =
                  tailFolded && !tailOpen && groupLimit !== null
                    ? listed.filter(
                        (group, index) =>
                          index < groupLimit || group.selected.length > 0
                      )
                    : listed;
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
                    {shownGroups.map((group) => (
                      <FacetGroupControl
                        key={needle === "" ? group.slug : `${group.slug}:match`}
                        group={group}
                        onToggle={bag.toggle}
                        onSetValues={bag.setValues}
                        collapsible
                        defaultOpen={
                          needle !== "" ||
                          group.selected.length > 0 ||
                          openByOrder.has(group.slug)
                        }
                        {...(props.dictionaryMode !== undefined
                          ? { dictionaryMode: props.dictionaryMode }
                          : {})}
                      />
                    ))}
                    {tailFolded && (
                      <Button
                        style={{ alignSelf: "flex-start" }}
                        data-testid="facets-all-filters"
                        data-analytics="none"
                        data-analytics-reason="opening the filter tail is a read, not a flow step"
                        onClick={() => {
                          setTailOpen((was) => !was);
                        }}
                      >
                        {tailOpen
                          ? t(SEARCH_I18N_KEYS.facetsShowLess)
                          : t(SEARCH_I18N_KEYS.facetsAllFilters, {
                              count: listed.length - (groupLimit ?? 0),
                            })}
                      </Button>
                    )}
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
            {/* The reservation, not just the rows (D361).
                On a live category feed at 1536px this block's arrival was a
                53px jump: `attributeRanges` draws from the CATEGORY SCHEMA
                (`props.categoryFeatures`), and a host that fetches the
                schema alongside the search answer had nothing here at all
                until both landed — no host slot reserved the box, so the
                rail grew under the reader's eye the instant it did.

                Two things can be unknown at first paint, and each gets its
                own reservation:
                 - the SCHEMA itself (`categoryFeatures` undefined) — the
                   axis count is unknown, so the fallback is one row's floor,
                   a guess rather than nothing;
                 - the ANSWER (`bag.state` not yet "ready") with a known
                   schema — the axis COUNT is already certain from the
                   schema, so the rail draws that many skeleton rows, each
                   `RANGE_ROW_MIN_HEIGHT` tall like the real one it will
                   become. Same count in both arms, so the swap from
                   skeleton to `<RangeFilterRow>` costs no further height.

                And the schema is only the FIRST guess at that count. Since
                stapel-search 0.14.7 the answer measures the axes that have
                numbers behind them — including the ones the catalogue types
                as choices, a vocabulary-backed year — so a leaf whose schema
                declares two can answer with four. `bag.reservedRangeAxes` is
                what an earlier answer FOR THIS CATEGORY reported, remembered
                in the state provider; when there is one it sizes the block,
                because it is the count the swap will actually land on. */}
            {props.categoryFeatures === undefined ? (
              <>
                <Divider style={{ margin: 0 }} />
                <div
                  aria-hidden="true"
                  data-testid="search-ranges-attributes-reserve"
                  style={{ minBlockSize: RANGE_ROW_MIN_HEIGHT }}
                />
              </>
            ) : (
              (attributeRanges.length > 0 || reservedAxes > 0) && (
                <>
                  <Divider style={{ margin: 0 }} />
                  <Flex
                    vertical
                    gap={spacing[3]}
                    data-testid="search-ranges-attributes"
                  >
                    {bag.state.status === "ready"
                      ? attributeRanges.map((group) => (
                          <RangeFilterRow
                            key={group.slug}
                            group={group}
                            onApply={bag.setRange}
                          />
                        ))
                      : Array.from({ length: reservedAxes }, (_, index) => (
                          <RangeRowSkeleton key={index} />
                        ))}
                  </Flex>
                </>
              )
            )}

            {footerBar !== "none" && (
              <RailFooterBar
                activeFilters={bag.activeFilters}
                clearAll={bag.clearAll}
                position={footerBar}
              />
            )}
          </Flex>
          );
        }}
      </FacetPanel>
    </SkinTheme>
  );
}
