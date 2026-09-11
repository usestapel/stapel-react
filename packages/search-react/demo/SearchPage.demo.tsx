/**
 * The screen `/s` actually renders — the one the nav manifest names and the
 * one that, until 0.6.0, had no story at all: every demo in this package drew
 * the headless bag's state chips, so nobody had ever LOOKED at the product.
 *
 * Three variants because the page has three shapes worth photographing: the
 * filters are a column on a desktop and a bottom sheet behind a "Filters (N)"
 * button on a phone, and a link whose parameters could not be read says so
 * instead of silently widening the search. The shape is pinned per variant
 * (`filtersLayout`) rather than left to the viewport, so each one photographs
 * what it is named for.
 *
 * Every variant is SEEDED (`_harness`'s `DemoSeed`): the answer is in the
 * query cache before the first render, so the static shot is the results page
 * rather than the skeleton every variant would otherwise share.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { SearchPage } from "../src/default/SearchPage.js";
import { PartitionChips } from "../src/default/PartitionChips.js";
import type { PartitionChild } from "../src/default/PartitionChips.js";
import { SearchDemoHarness, DemoFrame, useMemoryParams } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_FEATURES,
  DEMO_RANKING,
  DEMO_SEARCH_RESPONSE,
  DEMO_SUGGEST,
  DEMO_TYPE,
} from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/query": DEMO_SEARCH_RESPONSE,
  "/suggest": DEMO_SUGGEST,
  "/ranking": DEMO_RANKING,
};

/**
 * The ranking answer is seeded beside the page's own, and it is not decoration:
 * `degraded[]` reports a scorer the engine skipped as the slug `geo_decay`, and
 * the disclosure is the only thing that knows that slug's NAME. Seed it and the
 * banner says "Distance"; leave it out and the shot photographs a registry
 * identifier in a shopper's sentence, which is what the visual pass found.
 */
const SEED: DemoSeed = {
  page: DEMO_SEARCH_RESPONSE,
  ranking: DEMO_RANKING,
  rankingType: DEMO_TYPE,
};

const RESULTS_SEARCH = `type=${DEMO_TYPE}&q=bosch`;
const UNREADABLE_SEARCH = `type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6&r.price=cheap`;

/** The height a storefront's own pinned header takes — `<PublicShell>`
 * publishes exactly this as `--stapel-header-height`. Stated here because the
 * demo frame draws no shell of its own. */
const DEMO_HEADER_HEIGHT = 64;

function Page(props: {
  phone?: boolean;
  search?: string;
  /** The catalogue leaf shape — see the `catalogue-leaf` variant. */
  leaf?: boolean;
  /** Both columns told where the host's chrome ends — see `under-a-header`. */
  underHeader?: boolean;
  /** The platform's own scrollbar back on the rail — see `system-scrollbar`. */
  systemScrollbar?: boolean;
  /** The flat 16px gap this page used to write inline — see `legacy-rhythm`. */
  legacyRhythm?: boolean;
  /** The results toolbar left in flow — see `toolbar-not-pinned`. */
  toolbarStatic?: boolean;
  /** The filters back on their own raised ground — see `rail-on-a-panel`. */
  railPanel?: boolean;
}): ReactElement {
  const search = props.search ?? RESULTS_SEARCH;
  const adapter = useMemoryParams(search);
  return (
    <SearchDemoHarness handlers={HANDLERS} seed={SEED} seedSearch={search}>
      <DemoFrame {...(props.phone === true ? { phone: true } : {})}>
        <SearchPage
          adapter={adapter}
          defaultType={DEMO_TYPE}
          categoryFeatures={DEMO_FEATURES}
          filtersLayout={props.phone === true ? "sheet" : "column"}
          {...(props.leaf === true
            ? {
                categoryFilter: false,
                resultsLead: <LeafIntro />,
              }
            : {})}
          {...(props.underHeader === true
            ? {
                railTop: DEMO_HEADER_HEIGHT,
                stickyToolbar: { top: DEMO_HEADER_HEIGHT },
              }
            : {})}
          {...(props.systemScrollbar === true
            ? { railScrollbar: "system" as const }
            : {})}
          {...(props.legacyRhythm === true
            ? { blockRhythm: "legacy" as const }
            : {})}
          {...(props.toolbarStatic === true ? { toolbarSticky: false } : {})}
          {...(props.railPanel === true ? { railSurface: "panel" as const } : {})}
        />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

/** The children of a partitioned category, for the header that navigates. */
const PARTITION_PARENT = "141/151";
const PARTITION_CHILDREN: readonly (readonly [number, string, string])[] = [
  [152, `${PARTITION_PARENT}/152`, "demo.partition.new"],
  [153, `${PARTITION_PARENT}/153`, "demo.partition.used"],
  [154, `${PARTITION_PARENT}/154`, "demo.partition.parts"],
  [155, `${PARTITION_PARENT}/155`, "demo.partition.rent"],
];

/**
 * The `filtersHeader` whose own control ENDS this search — and therefore has
 * to take the sheet down with it.
 *
 * The page is controlled here (`filtersOpen` + `onFiltersOpenChange`) the way
 * a container that wants to know about the sheet holds it, and the row inside
 * the sheet closes through the slot's `closeFilters` rather than reaching for
 * that state. Both halves of the release are in one frame: without either, a
 * chip that changes the route leaves the drawer standing over the page it
 * opened.
 */
function PartitionRow(props: {
  readonly value: string | null;
  readonly onChange: (path: string | null) => void;
}): ReactElement {
  // `useT` inside the slot, not around the harness: the children's names come
  // from the demo bundle, and the provider that holds it is the harness this
  // row is rendered inside.
  const t = useT();
  const items: readonly PartitionChild[] = PARTITION_CHILDREN.map(
    ([id, path, key]) => ({ id, path, name: t(key) })
  );
  return (
    <PartitionChips items={items} value={props.value} onChange={props.onChange} />
  );
}

function NavigatingHeaderPage(): ReactElement {
  const adapter = useMemoryParams(RESULTS_SEARCH);
  // Shut on the first frame and opened by the variant's `play` step: the sheet
  // is a PORTAL, and a portal cannot be server-rendered, which is what the
  // distinctness guard renders with. The state is reached the way a person
  // reaches it — one tap on the all-filters chip.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [partition, setPartition] = useState<string | null>(null);
  return (
    <SearchDemoHarness
      handlers={HANDLERS}
      seed={SEED}
      seedSearch={RESULTS_SEARCH}
    >
      <DemoFrame phone>
        <SearchPage
          adapter={adapter}
          defaultType={DEMO_TYPE}
          categoryFeatures={DEMO_FEATURES}
          filtersLayout="sheet"
          filtersOpen={filtersOpen}
          onFiltersOpenChange={(open) => {
            setFiltersOpen(open);
          }}
          filtersHeader={({ closeFilters }) => (
            <PartitionRow
              value={partition}
              onChange={(next) => {
                // A storefront navigates on this line. The close is the same
                // press, not a second one the person never makes.
                setPartition(next);
                closeFilters();
              }}
            />
          )}
        />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

/** What a catalogue leaf puts over its own list — the `resultsLead` slot. */
function LeafIntro(): ReactElement {
  const t = useT();
  return (
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
      {t("demo.leaf.intro")}
    </Typography.Paragraph>
  );
}

export default defineDemo({
  id: "search.page",
  title: "Search page",
  description:
    "The composed /s screen: the query box bound to setText, the filter panel (category and location slots, numeric ranges, drill-down facets), the sort and page-size toolbar, and one keyset page of cards with the DSA promoted marking explained in words rather than in a tooltip.",
  component: SearchPage,
  covers: ["SearchStateProvider", "SearchProvider", "SearchResults", "FacetPanel"],
  tokens: ["surface-raised", "warning-bg"],
  variants: {
    desktop: {
      description: "Filters beside the results, the way a catalogue reads on a desktop.",
      viewport: "desktop",
      step: "results",
      render: () => <Page />,
    },
    phone: {
      description:
        "The same search at 390px: the filters move behind a Filters (N) button that opens a bottom sheet, so the first card is the first thing on screen.",
      viewport: "phone",
      step: "results-phone",
      render: () => <Page phone />,
    },
    "catalogue-leaf": {
      description:
        "A page reached by walking the catalogue: the category IS the page, so the «Category» pane goes entirely (`categoryFilter={false}`) rather than printing the id path with a Clear button under it, and the leaf's own words go in `resultsLead` — inside the results column, above the toolbar, and not over the filter rail the way a full-width header would be.",
      viewport: "desktop",
      step: "catalogue-leaf",
      render: () => <Page leaf />,
    },
    "under-a-header": {
      description:
        "The same page under a host's pinned header: `railTop` starts the filter rail below it (and moves the rail's own height cap with it, so the rail still ends at the foot of the window rather than that far past it), and `stickyToolbar` pins the results toolbar at the same offset. Both used to be a host's stylesheet problem — the rail's `top: 0` is written INLINE, so moving it took the one `!important` a deployment had aimed at a pair's own geometry, and the toolbar had no element to aim anything at.",
      viewport: "desktop",
      step: "under-a-header",
      render: () => <Page underHeader />,
    },
    "toolbar-not-pinned": {
      description:
        "`toolbarSticky={false}`: the results toolbar left in flow. Every other variant here draws the default — the count, the view switch, the sort and the page size pin to the top of the window (at `railTop`, the same edge the filter rail clears) once a reader has scrolled into the results, under `@media (pointer: fine)` so a phone's fold is not spent on a bar. The row reserves its own height in BOTH arms, so the page below it does not move when the rule engages. Turn it off for a surface that draws a bar of its own over the page.",
      viewport: "desktop",
      step: "toolbar-not-pinned",
      render: () => <Page toolbarStatic />,
    },
    "rail-on-a-panel": {
      description:
        "`railSurface=\"panel\"`: the filters back on the raised container ground this page painted until now, beside the `\"flat\"` default every other variant draws. The default changed on a measurement — on the stand's dark theme the rail read as a 270 x 1539 filled slab with no radius and no border, standing on the page ground for the whole height of the feed, which is a card shape with none of a card's edges. Flat draws the controls and the one colour a bare surface does not set (`var(--stapel-text)`); the panel arm is for a page whose own ground is an image, or a layout that genuinely wants the filters on their own sheet.",
      viewport: "desktop",
      step: "rail-on-a-panel",
      render: () => <Page railPanel />,
    },
    "system-scrollbar": {
      description:
        "The rail keeps its own scroll — filters that stay put while the results move under them are the point of it — and `railScrollbar` says whose BAR draws in the gutter. `\"styled\"` (the default, in every other variant here) is the skin's: a 6px track with no arrows and no track fill, and a thumb that is transparent at rest and arrives from the tokens on hover or focus-within, in both themes. `\"system\"`, shown here, hands the port back to the platform, for a host whose own stylesheet already dresses every scroller on the page.",
      viewport: "desktop",
      step: "system-scrollbar",
      render: () => <Page systemScrollbar />,
    },
    "legacy-rhythm": {
      description:
        "`blockRhythm=\"legacy\"`: the flat 16px this page used to write inline between every block, next to the default `\"token\"` arm every other variant draws — one gap read from `--stapel-block-gap` (32px) and `--stapel-block-gap-compact` (24px, on a coarse pointer or under the tablet edge), with each block's own outer margin reset so the distance is ONE number a host can retune with a single declaration.",
      viewport: "desktop",
      step: "legacy-rhythm",
      render: () => <Page legacyRhythm />,
    },
    "filters-header-navigates": {
      description:
        "A partition row in `filtersHeader`, inside the open sheet on a phone. Choosing a child changes the search AND closes the sheet on the same press — `filtersHeader` as a function is handed `closeFilters`, and the page's own open state is the host's through `filtersOpen` / `onFiltersOpenChange`, which reports `open`, `apply`, `dismiss` or `consumer` for every move. Until this release the page published only `defaultFiltersOpen`, so a header that navigated left the drawer standing over the page it had just opened.",
      viewport: "phone",
      step: "filters-header-navigates",
      render: () => <NavigatingHeaderPage />,
      play: async ({ click, find }) => {
        await click('[data-testid="search-filters-open"]');
        await find('[data-testid="search-filters-header"]', { portal: true });
      },
    },
    "unreadable-link": {
      description:
        "A shared link whose location and price range could not be read: the page says which parameters it dropped instead of silently widening the search.",
      viewport: "phone",
      step: "url-issues",
      render: () => <Page phone search={UNREADABLE_SEARCH} />,
    },
  },
});
