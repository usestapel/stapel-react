/**
 * The control this pair shipped a search page without.
 *
 * `setText` existed from the first release and had ZERO callers: the codec
 * could carry `q`, the state machine could set it, the request sent it, and
 * nothing on any screen could type one. This is that box — exported from
 * `/default` so a container can mount it in the header, which is where the nav
 * manifest says `/s` is reached from.
 *
 * The typeahead is live in the viewer (the mocked `/suggest` answers title
 * prefixes out of the index, never a query log) and deliberately absent from
 * the static shot: the menu opens on typing, and a demo that forced it open
 * would photograph a state the control does not reach on its own.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchBox } from "../src/default/SearchBox.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_SUGGEST, DEMO_TYPE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/suggest": DEMO_SUGGEST };

const EMPTY_SEARCH = `type=${DEMO_TYPE}`;
const TYPED_SEARCH = `type=${DEMO_TYPE}&q=bosch drill`;

function Box(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      handlers={HANDLERS}
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <SearchBox />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.box",
  title: "Search box",
  description:
    "Types into a draft and searches after a pause, so the address bar does not chase the keyboard; the URL still wins whenever it moves on its own, so the box can never show a word the results are not about. Capped at the server's own MAX_QUERY_CHARS, which makes 'query too long' a refusal this control cannot cause.",
  component: SearchBox,
  tokens: ["surface-raised"],
  variants: {
    empty: {
      description:
        "Nothing searched for yet: the placeholder, the visible Search button (a phone keyboard does not always offer one), and the labelled field.",
      viewport: "desktop",
      step: "empty",
      render: () => <Box search={EMPTY_SEARCH} />,
    },
    typed: {
      description:
        "Opened on a link that already carries a query, at 390px: the box shows what the results are about, not an empty field over somebody else's search.",
      viewport: "phone",
      step: "typed",
      render: () => <Box phone search={TYPED_SEARCH} />,
    },
  },
});
