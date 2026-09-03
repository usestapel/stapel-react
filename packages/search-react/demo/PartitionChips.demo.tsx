/**
 * The children of a partitioned category, as one row of single-select chips.
 *
 * A partition is a category whose children are not subcategories but one
 * template split by a value their names express — new/used, buy/sell/rent,
 * boys/girls. They keep their ids, paths and URLs; only the presentation
 * changes, and the parent draws a feed with this row above it instead of a
 * grid of tiles the visitor has to pass through.
 *
 * The row is CONTROLLED, so the demo owns the choice exactly as a storefront
 * does: the chosen child is a `category` in the URL, not state hidden inside a
 * chip row.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { PartitionChips } from "../src/default/PartitionChips.js";
import type { PartitionChild } from "../src/default/PartitionChips.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

const PARENT = "141/151";

const CHILDREN: readonly (readonly [number, string, string])[] = [
  [152, `${PARENT}/152`, "demo.partition.new"],
  [153, `${PARENT}/153`, "demo.partition.used"],
  [154, `${PARENT}/154`, "demo.partition.parts"],
  [155, `${PARENT}/155`, "demo.partition.rent"],
];

function Row(props: { readonly initial: string | null }): ReactElement {
  const t = useT();
  const [chosen, setChosen] = useState<string | null>(props.initial);
  const items: readonly PartitionChild[] = CHILDREN.map(([id, path, key]) => ({
    id,
    path,
    name: t(key),
  }));
  return <PartitionChips items={items} value={chosen} onChange={setChosen} />;
}

export default defineDemo({
  id: "search.partition-chips",
  title: "Partition chips",
  description:
    "A single-select row of the parent plus its children, where the first chip is the parent itself rather than a way of clearing the others — searching the parent IS the union of its children. It is a real radiogroup with roving tabindex: Tab reaches the row once and lands on the chosen chip, the arrow keys move along it and choose as they go. A row of aria-pressed toggles would announce the opposite — independent switches, with no reason why pressing one released another.",
  component: PartitionChips,
  variants: {
    parent: {
      description:
        "Nothing narrowed: the parent's own chip is the chosen one, and the feed below is the union of every child.",
      viewport: "desktop",
      step: "partition-all",
      render: () => (
        <SearchSkinHarness search={`type=${DEMO_TYPE}&category=${PARENT}`}>
          <Row initial={null} />
        </SearchSkinHarness>
      ),
    },
    child: {
      description:
        "A shared link into one child, at 390px: the row wraps rather than scrolls, and the chosen chip is the single Tab stop.",
      viewport: "phone",
      step: "partition-child",
      render: () => (
        <SearchSkinHarness
          search={`type=${DEMO_TYPE}&category=${PARENT}/153`}
          phone
        >
          <Row initial={`${PARENT}/153`} />
        </SearchSkinHarness>
      ),
    },
  },
});
