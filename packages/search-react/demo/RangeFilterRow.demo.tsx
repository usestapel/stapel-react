/**
 * One numeric range row — "Power: from ___ to ___", and the control whose
 * absence meant a marketplace shipped without a price filter.
 *
 * The row is built by the pair's own model (`buildRangeGroups` over the
 * category schema plus whatever the URL already constrains) and applied
 * through `setRange`, so the demo drives the real seam rather than a hand-made
 * prop: in the viewer the numbers actually reach the query string.
 *
 * Applied by a button, not by typing — a range is TWO fields, and committing
 * each keystroke would run a search for 1, 10 and 100 on the way to 1000.
 * Which is also what makes "from greater than to" refusable, with the reason
 * beside the button, instead of merely empty.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { Flex } from "antd";
import { spacing } from "@stapel/tokens";
import { RangeFilterRow } from "../src/default/RangeFilterRow.js";
import { buildRangeGroups, useSearchState } from "../src/index.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_FEATURES, DEMO_TYPE } from "./fixtures.js";

const UNTOUCHED = `type=${DEMO_TYPE}&q=bosch`;
const APPLIED = `type=${DEMO_TYPE}&q=bosch&r.power_w=500..1200`;

/** The rows the current search has, exactly as the filter panel builds them. */
function Rows(): ReactElement {
  const t = useT();
  const { state, setRange } = useSearchState();
  const groups = buildRangeGroups({ state, categoryFeatures: DEMO_FEATURES, t });
  return (
    <Flex vertical gap={spacing[3]}>
      {groups.map((group) => (
        <RangeFilterRow key={group.slug} group={group} onApply={setRange} />
      ))}
    </Flex>
  );
}

function Row(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <Rows />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.range-filter-row",
  title: "Numeric range filter",
  description:
    "A range row per numeric feature of the category schema, plus any slug the URL already constrains — because a constraint that is active must always have a control that removes it, even when the schema no longer explains it. Bounds and step come from the schema; the unit is shown in the field's accessible name.",
  component: RangeFilterRow,
  tokens: ["surface-raised"],
  variants: {
    untouched: {
      description:
        "An empty row from the category schema: Apply is the primary action, and there is nothing to clear yet.",
      viewport: "desktop",
      step: "untouched",
      render: () => <Row search={UNTOUCHED} />,
    },
    applied: {
      description:
        "The bounds a shared link carries, at 390px: the row reads them from the URL, Apply steps back to the secondary style and a Clear control appears beside it.",
      viewport: "phone",
      step: "applied",
      render: () => <Row phone search={APPLIED} />,
    },
  },
});
