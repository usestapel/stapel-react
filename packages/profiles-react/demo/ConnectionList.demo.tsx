/** Connection list — headless followers / following / blocked list. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { ConnectionList } from "../src/index.js";
import { ProfilesDemoHarness, DemoCard, StepBadge } from "./_harness.js";

/** Canned followers page the GET /me/followers handler returns. */
const FOLLOWERS = {
  followers: [
    "b3f1c0de-0000-4000-8000-000000000101",
    "b3f1c0de-0000-4000-8000-000000000102",
    "b3f1c0de-0000-4000-8000-000000000103",
  ],
  count: 3,
};

/** The list body — mounted INSIDE the harness (providers available). */
function ConnectionListBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="ConnectionList">
      <ConnectionList kind="followers">
        {({ ids, count, isLoading }) => (
          <>
            <StepBadge step={isLoading ? "loading" : String(count)} />
            <span style={{ color: cssVar("text-muted") }}>
              {t("profiles.list.followers")}
            </span>
            <ul>
              {ids.map((id) => (
                <li key={id}>
                  <code>{id.slice(0, 8)}</code>
                </li>
              ))}
              {ids.length === 0 && !isLoading ? (
                <li>{t("profiles.list.empty")}</li>
              ) : null}
            </ul>
          </>
        )}
      </ConnectionList>
    </DemoCard>
  );
}

function ConnectionListDemo(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={{ "/me/followers": FOLLOWERS }}>
      <ConnectionListBody />
    </ProfilesDemoHarness>
  );
}

/**
 * Demonstrates the headless connection list: the canned handler returns three
 * follower ids for GET /me/followers, so the bag renders the ids + count. Switch
 * `kind` to `following` / `blocked` for the other lists. Bring your own list UI —
 * the component is renderless.
 */
export default defineDemo({
  id: "profiles.connection_list",
  title: "Connection list",
  description:
    "The headless ConnectionList selects the followers / following / blocked read by `kind`, normalizes the three response shapes to { ids, count }, and exposes loading / error state. Bring your own list UI — the component is renderless.",
  component: ConnectionList,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <ConnectionListDemo /> },
  },
});
