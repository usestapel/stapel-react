/**
 * The classified filter surfaces: the phone's chip row, the three shapes a
 * facet group takes, and the switch that arranges the results.
 *
 * All three are drawn from the SAME schema a category ships, which is the
 * point of photographing them together: `condition` is single-choice because
 * its config says `maxSelected: 1`, `body` is indented because its config
 * carries a tree, and `brand` folds because it is long. Nothing here is a
 * per-screen decision, so nothing here can drift from the composer that
 * produced the values.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import type { FeatureDef } from "@stapel/attributes-react";
import { Flex } from "antd";
import { spacing } from "@stapel/tokens";
import { FacetGroupControl } from "../src/default/FacetGroupControl.js";
import { FilterChips } from "../src/default/FilterChips.js";
import { ViewSwitch, SEARCH_BUILTIN_VIEWS } from "../src/default/ViewSwitch.js";
import { buildFacetGroups, parseSearchState } from "../src/index.js";
import type { FacetGroup } from "../src/index.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import { DEMO_SEARCH_RESPONSE, DEMO_TYPE } from "./fixtures.js";

const SEED: DemoSeed = { page: DEMO_SEARCH_RESPONSE };
const SEARCH = `type=${DEMO_TYPE}&q=bosch`;
const NARROWED = `type=${DEMO_TYPE}&q=bosch&f.brand=bosch&f.condition=used`;

/**
 * A classified category's schema — the three config shapes side by side.
 * `maxSelected: 1` is what makes a facet single-choice; a `children` tree is
 * what makes one nested. Neither is a flag this package invented.
 */
const SHAPE_FEATURES: readonly FeatureDef[] = [
  {
    slug: "condition",
    name: "demo.feature.condition",
    config: {
      type: "select",
      maxSelected: 1,
      options: [
        { value: "new", label: "demo.condition.new" },
        { value: "used", label: "demo.condition.used" },
      ],
    },
  },
  {
    slug: "body",
    name: "demo.feature.body",
    config: {
      type: "hierarchical_select",
      options: [
        {
          value: "cars",
          label: "demo.body.cars",
          children: [
            { value: "sedan", label: "demo.body.sedan" },
            { value: "hatchback", label: "demo.body.hatchback" },
          ],
        },
        { value: "vans", label: "demo.body.vans" },
      ],
    },
  },
];

const SHAPE_FACETS = {
  condition: { new: 24, used: 118 },
  body: { cars: 96, sedan: 41, hatchback: 33, vans: 12 },
  city: Object.fromEntries(
    ["Lisbon", "Porto", "Braga", "Faro", "Aveiro", "Coimbra", "Évora", "Sintra", "Setúbal", "Viseu", "Leiria", "Guarda"].map(
      (name, i) => [name, 120 - i * 7]
    )
  ),
};

function shapeGroups(): readonly FacetGroup[] {
  return buildFacetGroups({
    facets: SHAPE_FACETS,
    meta: {
      approximate: false,
      candidates: 142,
      counted: Object.keys(SHAPE_FACETS),
      skipped: [],
    },
    state: parseSearchState(new URLSearchParams(`type=${DEMO_TYPE}&f.condition=used&f.body=sedan`), {
      defaultType: DEMO_TYPE,
    }).state,
    categoryFeatures: SHAPE_FEATURES,
  });
}

function Chips(props: { readonly search: string }): ReactElement {
  return (
    <SearchSkinHarness search={props.search} seed={SEED} phone>
      <FilterChips
        categoryFeatures={SHAPE_FEATURES}
        onOpenAll={() => undefined}
      />
    </SearchSkinHarness>
  );
}

function Shapes(): ReactElement {
  return (
    <SearchSkinHarness search={SEARCH} seed={SEED} phone>
      <Flex vertical gap={spacing[5]}>
        {shapeGroups().map((group) => (
          <FacetGroupControl
            key={group.slug}
            group={group}
            onToggle={() => undefined}
          />
        ))}
      </Flex>
    </SearchSkinHarness>
  );
}

function Views(): ReactElement {
  return (
    <SearchSkinHarness search={SEARCH} seed={SEED}>
      <ViewSwitch
        views={SEARCH_BUILTIN_VIEWS}
        value="grid"
        onChange={() => undefined}
      />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.classified-filters",
  title: "Filter chips and group shapes",
  description:
    "The phone's filter row — one scrolling line of chips, each opening its own bottom sheet, with the whole panel behind the leading icon-only chip and a dot on it when something is applied. Beside it, the three shapes a facet group takes, all three DERIVED from the category schema rather than chosen per screen: pills for a single-choice facet, indented rows for a hierarchical one, and a fold for a long one that says how many are behind it.",
  component: FilterChips,
  covers: ["FacetGroupControl", "ViewSwitch"],
  tokens: ["surface-raised", "brand"],
  variants: {
    chips: {
      description:
        "390px, nothing applied yet: a chip per facet, a chip per numeric range, and the leading chip that opens the whole panel.",
      viewport: "phone",
      step: "chips",
      render: () => <Chips search={SEARCH} />,
    },
    applied: {
      description:
        "The same row on a link that already narrows by brand and condition: the chips carry the CHOICE rather than the group's name, and the leading chip carries the dot.",
      viewport: "phone",
      step: "chips-applied",
      render: () => <Chips search={NARROWED} />,
    },
    shapes: {
      description:
        "One group per shape: single-choice pills with their drill-down counts inside them, a hierarchical group with its children indented under their parent, and a twelve-option group folded behind “Show all (12)”.",
      viewport: "phone",
      step: "group-shapes",
      render: () => <Shapes />,
    },
    views: {
      description:
        "How the results are arranged. List and grid ship; a deployment's own view — a map — is declared the same way and treated the same.",
      viewport: "desktop",
      step: "views",
      render: () => <Views />,
    },
  },
});
