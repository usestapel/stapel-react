/**
 * What a listing's FEATURES look like once they leave the composer: a badge
 * row on a card, a spec line above a title, and the full sheet on a detail
 * page.
 *
 * These four are drawn on their own because they are the round-4 answer to
 * two measured defects, and both are invisible inside a screenshot of a whole
 * card:
 *
 *  - a live badge line read "Brick · 3 · 9" — three true facts about a flat,
 *    two of them unreadable. The card badge contract (stapel-listings 0.21.3)
 *    gives each element its `name`, its `unit` and the SERVER's decision about
 *    which of them to print, and the `contract` variant is that decision
 *    rendered. The `legacy` variant is the same row from a server that
 *    predates the contract, drawn exactly as it is drawn today — the
 *    compatibility arm, and the reason a badge line never depends on this
 *    release to exist at all;
 *  - a detail page's specs were a two-column TABLE that became a horizontal
 *    scroller at 390px. They are a definition list now, one column on a phone
 *    and two on anything wider, so a row is a sentence rather than a cell.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import type { FeatureDef, FeatureValueDto } from "@stapel/attributes-react";
import { defineDemo } from "@stapel/showcase";
import { CardBadges, CardSpecLine } from "../src/default/CardBadges.js";
import {
  ListingSpecColumns,
  ListingSpecList,
} from "../src/default/ListingSpecList.js";
import type { ListingFeatureDao } from "../src/index.js";
import { ListingsDemoHarness } from "./_harness.js";

/**
 * A row that speaks the contract. Each element already carries what a reader
 * needs, so the badge text comes off the element and nothing here reaches for
 * a category, a formatter or an option table.
 */
const CONTRACT_BADGES: readonly ListingFeatureDao[] = [
  {
    slug: "walls",
    type: "select",
    value: ["demo.walls.brick"],
    name: "Walls",
    label: "Brick",
    presentation: "value",
    badge: true,
    order: 1,
  },
  {
    slug: "rooms",
    type: "int",
    value: 3,
    name: "Rooms",
    presentation: "name_value",
    badge: true,
    order: 2,
  },
  {
    slug: "floor",
    type: "int",
    value: 9,
    name: "Floor",
    presentation: "name_value",
    badge: true,
    order: 3,
  },
  {
    slug: "mileage",
    type: "int",
    value: 20000,
    name: "Mileage",
    unit: "km",
    presentation: "value_unit",
    badge: true,
    order: 4,
  },
] as readonly ListingFeatureDao[];

/** The same facts from a server with no `presentation` key: the fallback arm,
 * off the stored row's own config. */
const LEGACY_BADGES: readonly ListingFeatureDao[] = [
  {
    slug: "walls",
    type: "select",
    value: ["demo.walls.brick"],
    name: "Walls",
    badge: true,
    order: 1,
  },
  { slug: "rooms", type: "int", value: 3, name: "Rooms", badge: true, order: 2 },
  { slug: "floor", type: "int", value: 9, name: "Floor", badge: true, order: 3 },
] as readonly ListingFeatureDao[];

/** The one row a card prints ABOVE the title — the spec that identifies the
 * thing rather than describing it. */
const TITLE_ROW: readonly ListingFeatureDao[] = [
  {
    slug: "condition",
    type: "select",
    value: ["demo.condition.used"],
    name: "Condition",
    label: "Used",
    presentation: "value",
    title: true,
    order: 0,
  },
] as readonly ListingFeatureDao[];

const SPEC_FEATURES: readonly FeatureDef[] = [
  {
    slug: "walls",
    name: "Walls",
    config: {
      type: "select",
      options: [
        { value: "demo.walls.brick", label: "demo.walls.brick" },
        { value: "demo.walls.panel", label: "demo.walls.panel" },
      ],
      maxSelected: 1,
    },
  },
  { slug: "rooms", name: "Rooms", config: { type: "int", min: 1, max: 9 } },
  { slug: "floor", name: "Floor", config: { type: "int", min: 1, max: 40 } },
  {
    slug: "area",
    name: "Total area",
    config: { type: "float", min: 1, max: 500, precision: 1, postfix: "m²" },
  },
  {
    slug: "ceiling",
    name: "Ceiling height",
    config: { type: "float", min: 2, max: 6, precision: 2, postfix: "m" },
  },
  {
    slug: "seller_phone",
    name: "Seller phone",
    config: { type: "string", maxLength: 32 },
  },
];

/**
 * The DISPLAY envelope, redacted stub and all: `seller_phone` is withheld, and
 * a withheld row keeps its place instead of leaving a hole a reader has to
 * interpret.
 */
const SPEC_VALUES: Readonly<Record<string, FeatureValueDto>> = {
  walls: { type: "select", value: ["demo.walls.brick"] },
  rooms: { type: "int", value: 3 },
  floor: { type: "int", value: 9 },
  area: { type: "float", value: 74.5 },
  ceiling: { type: "float", value: 2.7 },
  seller_phone: { type: "string", value: null, redacted: true },
};

function Badges(props: {
  readonly rows: readonly ListingFeatureDao[];
}): ReactElement {
  return (
    <ListingsDemoHarness>
      <Flex vertical gap={8}>
        <CardSpecLine rows={TITLE_ROW} copy={{}} testId="demo-card-specs" />
        <CardBadges rows={props.rows} copy={{}} variant="badges" />
      </Flex>
    </ListingsDemoHarness>
  );
}

function Specs(props: { readonly split: boolean }): ReactElement {
  return (
    <ListingsDemoHarness>
      {props.split ? (
        <ListingSpecColumns features={SPEC_FEATURES} values={SPEC_VALUES} />
      ) : (
        <ListingSpecList features={SPEC_FEATURES} values={SPEC_VALUES} />
      )}
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.spec-parts",
  title: "Badges and specs",
  description:
    "A badge says which question it answers, and a spec sheet is a definition list rather than a table. Both are drawn by the SERVER's decision about presentation, not by a client-side heuristic: the right badge for a value depends on the category — '3 rooms' wants its name, 'Brick' is a boolean whose name IS the badge, and '20 000 km' wants its unit and no name at all.",
  component: CardBadges,
  covers: ["CardSpecLine", "ListingSpecColumns", "ListingSpecList"],
  tokens: ["text-subtle"],
  variants: {
    contract: {
      viewport: "phone",
      step: "badges_contract",
      description:
        "The four presentations in one row: a bare option label, two named numbers, and a number with its unit. This is the line that used to read 'Brick · 3 · 9'.",
      render: () => <Badges rows={CONTRACT_BADGES} />,
    },
    legacy: {
      viewport: "phone",
      step: "badges_fallback",
      description:
        "A server older than stapel-listings 0.21.3 declares no presentation, so the row goes through the stored config exactly as it did before the contract existed. Nothing about the new module is required for a card to draw.",
      render: () => <Badges rows={LEGACY_BADGES} />,
    },
    specs: {
      viewport: "phone",
      step: "specs_one_column",
      description:
        "The detail sheet at 390px: one column, a row per fact, and the withheld row keeping its place rather than vanishing.",
      render: () => <Specs split={false} />,
    },
    "specs-split": {
      viewport: "desktop",
      step: "specs_two_columns",
      description:
        "The same sheet where there is room for two columns — split by count, not by a breakpoint each row has to survive.",
      render: () => <Specs split />,
    },
  },
});
