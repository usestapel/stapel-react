/**
 * The sort control, and the reason it is worth a demo of its own: one of its
 * options is CONDITIONAL, and how a skin says so is the whole difference
 * between a working control and a dead one.
 *
 * `sort=distance` needs a centre — without one the server answers
 * `error.400.search_sort_needs_center`. The option is disabled and the REASON
 * is rendered beside the control through `GatedControl`, not in a `title=` a
 * phone can never surface. The gate binds only `aria-describedby` onto the
 * select: the other four sorts work perfectly well without a location, so
 * disabling the whole control would be a lie about four of five options.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SortSelect } from "../src/default/SortSelect.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

const NO_CENTRE = `type=${DEMO_TYPE}&q=bosch`;
const WITH_CENTRE = `type=${DEMO_TYPE}&q=bosch&lat=55.75&lon=37.62&radius_km=25&sort=distance`;

function Sort(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <SortSelect />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.sort-select",
  title: "Sort control",
  description:
    "The five shipped sorts, plus whatever unknown sort a shared link already carries — offered rather than silently reset, because resetting it would rewrite the meaning of somebody's link on load and the server is the one entitled to refuse an unknown sort by name.",
  component: SortSelect,
  tokens: ["surface-raised"],
  variants: {
    "no-centre": {
      description:
        "No location in the search: 'Distance' is disabled and the reason stands beside the control as ordinary text, with the select's aria-describedby pointing at it.",
      viewport: "desktop",
      step: "blocked",
      render: () => <Sort search={NO_CENTRE} />,
    },
    "with-centre": {
      description:
        "A link carrying a centre and a radius, at 390px: the gate is open, the reason is gone, and the sort the person most wants on a phone is the one they can pick.",
      viewport: "phone",
      step: "available",
      render: () => <Sort phone search={WITH_CENTRE} />,
    },
  },
});
