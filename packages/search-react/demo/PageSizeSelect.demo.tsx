/**
 * How many results a page carries — `limit`, one of the setters that shipped
 * with no control at all.
 *
 * The ladder is the pair's, not the schema's: the wire declares a bare
 * integer and the backend clamps it, so the select offers sizes around the
 * server's own default and never sends something that would have to be
 * clamped. A link carrying a size that is not on the ladder KEEPS it — moving
 * a person silently to 24 would change what their link shows.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PageSizeSelect } from "../src/default/PageSizeSelect.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

const DEFAULT_SIZE = `type=${DEMO_TYPE}&q=bosch`;
const OFF_LADDER = `type=${DEMO_TYPE}&q=bosch&limit=37`;

function PageSize(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <PageSizeSelect />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.page-size-select",
  title: "Page size control",
  description:
    "A short ladder around the server's DEFAULT_PAGE_SIZE. Choosing a size REPLACES the history entry rather than pushing one: a page size is a preference, not a step through the results, and Back should still undo the last filter.",
  component: PageSizeSelect,
  tokens: ["surface-raised"],
  variants: {
    ladder: {
      description: "The shipped ladder with the server's default selected.",
      viewport: "desktop",
      step: "default",
      render: () => <PageSize search={DEFAULT_SIZE} />,
    },
    "off-ladder": {
      description:
        "A link carrying limit=37 at 390px: the size is offered as its own option and kept, rather than the person being moved to 24 without being told.",
      viewport: "phone",
      step: "off-ladder",
      render: () => <PageSize phone search={OFF_LADDER} />,
    },
  },
});
