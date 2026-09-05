/**
 * The busiest values of one facet, printed as words above the results.
 *
 * A dictionary in the rail answers "narrow this list"; it does not answer
 * "what is IN this category". On a feed page the second question is the one a
 * visitor arrives with, and the answer is already in the envelope: a bucket
 * and its count. Printed as a multi-column block it is a table of contents for
 * the category — each line a filter.
 *
 * The variants are the two decisions the PAGE makes, because this component
 * makes neither of them: how many values there is room for, and whether there
 * is a link into the whole control at all.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { PopularValues } from "../src/default/PopularValues.js";
import type { FacetGroup } from "../src/index.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

/** A vocabulary level as the counter returns one: a caption and a count per
 * make, count-descending only by accident — the block sorts them itself. */
const MAKES: readonly (readonly [string, string, number])[] = [
  ["timberland", "demo.make.timberland", 120],
  ["toyota", "demo.make.toyota", 802],
  ["bmw", "demo.make.bmw", 611],
  ["honda", "demo.make.honda", 540],
  ["kia", "demo.make.kia", 480],
  ["mazda", "demo.make.mazda", 430],
  ["nissan", "demo.make.nissan", 390],
  ["audi", "demo.make.audi", 350],
  ["ford", "demo.make.ford", 300],
  ["land-rover", "demo.make.land_rover", 90],
  ["mercedes", "demo.make.mercedes", 60],
  ["skoda", "demo.make.skoda", 40],
];

function makesGroup(t: (key: string) => string): FacetGroup {
  return {
    slug: "vendor",
    label: t("demo.feature.vendor"),
    labelSource: "server",
    feature: undefined,
    counted: true,
    selected: [],
    options: MAKES.map(([value, key, count]) => ({
      value,
      count,
      label: t(key),
      labelSource: "server" as const,
      selected: false,
    })),
  };
}

function Block(props: {
  readonly columns?: number | "responsive";
  readonly limit?: number;
  readonly showAll?: boolean;
}): ReactElement {
  const t = useT();
  return (
    <PopularValues
      group={makesGroup(t)}
      onApply={() => undefined}
      {...(props.columns !== undefined ? { columns: props.columns } : {})}
      {...(props.limit !== undefined ? { limit: props.limit } : {})}
      {...(props.showAll === true ? { onShowAll: () => undefined } : {})}
    />
  );
}

export default defineDemo({
  id: "search.popular-values",
  title: "Popular values",
  description:
    "The head of one facet as a multi-column list of value + count, each line applying that filter. The numbers are the answer's own drill-down counts — the same ones the checkbox rows carry — so a value cannot read 802 here and 93 in the panel. Values with no evidence behind them are dropped rather than printed with a blank where the number belongs: the block IS the numbers. Whether a phone has room for it is the page's decision and arrives as the `hidden` prop, never as a media query inside.",
  component: PopularValues,
  tokens: ["text-muted"],
  variants: {
    desktop: {
      description:
        "Twelve makes in three columns with a link into the full control — the shape a desktop feed page draws under its heading.",
      viewport: "desktop",
      step: "popular-desktop",
      render: () => (
        <SearchSkinHarness search={`type=${DEMO_TYPE}`}>
          <Block showAll />
        </SearchSkinHarness>
      ),
    },
    responsive: {
      description:
        "`columns=\"responsive\"` lets the BLOCK decide: a CSS container query climbs 1 → 2 → 3 → 4 columns by the width of this block rather than of the window, which is the only question with an answer here — the block sits in the results column, i.e. the window minus a 280px filter rail.",
      viewport: "desktop",
      step: "popular-responsive",
      render: () => (
        <SearchSkinHarness search={`type=${DEMO_TYPE}`}>
          <Block columns="responsive" showAll />
        </SearchSkinHarness>
      ),
    },
    "narrow-column": {
      description:
        "A page with less room says so: six values in two columns and no link, because a link that goes nowhere is worse than a block that stops.",
      viewport: "phone",
      step: "popular-narrow",
      render: () => (
        <SearchSkinHarness search={`type=${DEMO_TYPE}`} phone>
          <Block columns={2} limit={6} />
        </SearchSkinHarness>
      ),
    },
  },
});
