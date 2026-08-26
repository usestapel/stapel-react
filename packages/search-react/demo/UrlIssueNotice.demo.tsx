/**
 * "Part of this link could not be read."
 *
 * A shared search is a link somebody typed, edited or truncated in a chat app.
 * The silent version of an unreadable parameter WIDENS the search — a broken
 * `lat` removes the location filter — and the person is then looking at
 * something other than what was shared, with nothing on screen to say so.
 *
 * The notice reads the codec's `issues`, so the demo seeds it the only honest
 * way: by mounting the surface on a genuinely broken query string.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { UrlIssueNotice } from "../src/default/UrlIssueNotice.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

/** A truncated coordinate and a price range that is a word, not a number. */
const BROKEN_SEARCH = `type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6&r.price=cheap`;
/** Only the geo half is broken — one line, not three. */
const BROKEN_GEO = `type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6`;

function Notice(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <UrlIssueNotice />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.url-issue-notice",
  title: "Unreadable link notice",
  description:
    "The parameters a shared link carried that the codec could not read, named one by one. The alternative is not 'no notice' but a quietly WIDER search than the one that was shared, which is the difference between a page that is wrong and a page that says which part of the link it lost.",
  component: UrlIssueNotice,
  tokens: ["surface-raised"],
  variants: {
    "two-issues": {
      description:
        "A location and a price range, both unreadable: each parameter is named, because 'something in this link was broken' is not actionable.",
      viewport: "desktop",
      step: "two-issues",
      render: () => <Notice search={BROKEN_SEARCH} />,
    },
    "one-issue": {
      description: "Only the coordinate is broken — one line at 390px.",
      viewport: "phone",
      step: "one-issue",
      render: () => <Notice phone search={BROKEN_GEO} />,
    },
  },
});
