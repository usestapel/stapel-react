/** Connections — the DEFAULT SKIN for the caller's own social graph. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ConnectionsPage, ConnectionList, PersonRow } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import {
  ALAN_ID,
  BLOCKED_EMPTY,
  FOLLOWERS_BATCH,
  FOLLOWERS_PAGE,
  MY_PROFILE,
  SELF_ID,
} from "./_fixtures.js";

/** Order matters: `mockFetch` takes the FIRST key the url contains, and
 * `/me` is a substring of every `/me/*` path. */
const FOLLOWERS = {
  "/me/followers": FOLLOWERS_PAGE,
  "/batch": FOLLOWERS_BATCH,
  "/relationship": { user_id: ALAN_ID, status: "neutral" },
  "/me": MY_PROFILE,
} as const;

const NOBODY_BLOCKED = {
  "/me/blocked": BLOCKED_EMPTY,
  "/me": MY_PROFILE,
} as const;

function Followers(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={FOLLOWERS}>
      <ConnectionsPage selfUserId={SELF_ID} />
    </ProfilesDemoHarness>
  );
}

/** The list on its own (a profile tab, a sidebar) plus the identity primitive
 * every roster in this pair draws through. */
function ListAndRow(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={FOLLOWERS}>
      <ConnectionList kind="followers" rowActions={false} selfUserId={SELF_ID} />
      <PersonRow
        userId={ALAN_ID}
        entry={{ status: "missing", profile: null }}
        testId="person-row-missing"
      />
    </ProfilesDemoHarness>
  );
}

function BlockedEmpty(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={NOBODY_BLOCKED}>
      <ConnectionsPage initialKind="blocked" selfUserId={SELF_ID} />
    </ProfilesDemoHarness>
  );
}

/**
 * The screen nine backend operations were waiting for. `GET /me/followers`
 * answers ids; `POST /batch` answers the people; `PersonRow` draws them. An id
 * never reaches the glass — including the one the batch reports `missing`,
 * which is a placeholder ("Profile not set up"), not a failure.
 */
export default defineDemo({
  id: "profiles.connections-skin",
  title: "Connections (skin)",
  description:
    "Followers / following / blocked behind one control, mounted at profiles.connections. Rows are people: avatar or monogram, display name, location, and a relationship control whose status the batch already answered. The empty state is per list, because 'nobody follows you yet' and 'you have blocked nobody' are different sentences with different feelings.",
  component: ConnectionsPage,
  covers: ["ConnectionList", "PersonRow"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    followers: {
      description:
        "Three followers: two resolved by the batch, one whose profile row does not exist yet.",
      viewport: "phone",
      step: "followers",
      render: () => <Followers />,
    },
    "list-and-row": {
      description:
        "<ConnectionList> embedded on its own, and <PersonRow> in its `missing` state — the answer for an id whose profile row does not exist. A placeholder, never an error.",
      viewport: "desktop",
      step: "embedded",
      render: () => <ListAndRow />,
    },
    "blocked-empty": {
      description:
        "The blocked list with nobody in it — a designed empty state with its own two lines, not a blank panel.",
      viewport: "desktop",
      step: "empty",
      render: () => <BlockedEmpty />,
    },
  },
});
