/** Connections — the DEFAULT SKIN for the caller's own social graph. */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
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

/** A caption over a specimen, so two specimens on one canvas cannot be read
 * as one list. `demo.*` is the harness's own unmanaged namespace. */
function Caption(props: { textKey: string }): ReactElement {
  const t = useT();
  return (
    <Typography.Title level={5} style={{ marginBottom: spacing[2] }}>
      {t(props.textKey)}
    </Typography.Title>
  );
}

/**
 * The list on its own (a profile tab, a sidebar) plus the identity primitive
 * every roster in this pair draws through.
 *
 * The two are SEPARATED, and that is the story: mounted flush, the loose row
 * read as a fourth follower under a heading that said three, which is a
 * broken screen rather than two specimens (visual pass 2026-08-24).
 */
function ListAndRow(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={FOLLOWERS}>
      <Flex vertical gap={spacing[6]}>
        <section>
          <Caption textKey="demo.connections.list_caption" />
          <ConnectionList kind="followers" rowActions={false} selfUserId={SELF_ID} />
        </section>
        <section>
          <Caption textKey="demo.connections.row_caption" />
          <PersonRow
            userId={ALAN_ID}
            entry={{ status: "missing", profile: null }}
            testId="person-row-missing"
          />
        </section>
      </Flex>
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
