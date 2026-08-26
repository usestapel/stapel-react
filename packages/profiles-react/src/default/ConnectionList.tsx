/**
 * `<ConnectionList/>` — default skin for the headless
 * {@link ConnectionList as HeadlessConnectionList} (§54). The followers /
 * following / blocked list, drawn as PEOPLE.
 *
 * ── WHY THIS COMPONENT IS TWO READS AND NOT ONE ─────────────────────────────
 *
 * `GET /me/followers` answers ids and a count; it does not answer names. The
 * pair already had the other half — `POST /batch` (`useProfilesBatch`), whose
 * whole reason for existing is a roster resolving many ids in one request —
 * and nothing joined them, which is why the showcase photographed the same
 * truncated UUID three times. This skin performs the join: ids from the
 * headless bag, identities from the batch, rendered through the pair's one
 * identity primitive ({@link PersonRow}). An id never reaches the glass.
 *
 * The batch's four-state answer is passed through, not flattened: a person
 * whose profile row does not exist reads "Profile not set up" (a placeholder),
 * a person not yet resolved reads as a skeleton, and neither is an error.
 *
 * The join is one seam on purpose: `useProfilesBatch` → `profileBatchEntry` →
 * `PersonRow`. When stapel-profiles lands its `profiles.public_cards` batch
 * (display name, avatar ref with CDN describe metadata, member-since, seller
 * type), swapping it in is a change to the read behind that seam, not to this
 * component or to `PersonRow`'s contract.
 *
 * ── BLOCKING NEVER DELETES HISTORY ──────────────────────────────────────────
 *
 * Blocking somebody gates future interaction; it does not retract the past.
 * So nothing here removes a row locally when a block succeeds — no filter, no
 * optimistic splice. The mutation invalidates the caller's own lists and the
 * server decides what the lists contain. A person who followed you before you
 * blocked them stays in `followers` until the server says otherwise, which is
 * the honest answer and the one the backend intends.
 *
 * (The other half of that rule — that the blocked party must never be able to
 * tell they were blocked — is enforced in `./Relationship.tsx`, where the only
 * "blocked" copy in this pair lives. Read its header before adding any state
 * to these rows.)
 *
 * ── STATES ──────────────────────────────────────────────────────────────────
 *
 * The three answers of the ID read stay three, through the shared substrate's
 * `LoadList`: a skeleton while it is in flight, `ErrorAlert` + retry when it
 * failed, and a DESIGNED empty state per list — "no followers yet" and "you
 * have blocked nobody" are different sentences with different feelings, so
 * they are different strings.
 *
 * ── GEOMETRY ────────────────────────────────────────────────────────────────
 *
 * The rows sit in a `repeat(auto-fill, minmax(…))` grid, so the column count
 * follows THE ELEMENT's width, not the viewport's — one column in a phone
 * sheet or a narrow sidebar, several across a wide page. That is the house
 * element-width rule expressed in the one place CSS can already do it
 * intrinsically, without a breakpoint hook.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { EmptyState, LoadList } from "@stapel/tokens-antd/skin";
import { isLoadReady, useT, useTPlural } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { ConnectionList as HeadlessConnectionList } from "../headless/ConnectionList.js";
import type {
  ConnectionKind,
  ConnectionListBag,
} from "../headless/ConnectionList.js";
import { useProfilesBatch } from "../model/queries.js";
import { profileBatchEntry } from "../model/profileBatch.js";
import type { ProfileBatchEntry } from "../model/profileBatch.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { PersonRow } from "./PersonRow.js";
import { Relationship } from "./Relationship.js";

/** The narrowest a person row may get before the grid drops a column. A
 * length, not a spacing step — named so a redesign changes it once. */
export const CONNECTION_ROW_MIN_WIDTH = "18rem";

/** Stable empty list — a new `[]` per render would re-key the batch query. */
const NO_IDS: readonly string[] = [];

/** Per-list copy: heading, count family, and the two lines of its own empty
 * state. Keyed by `kind` so a fourth list is one entry, not a new branch. */
const LIST_COPY: Readonly<
  Record<
    ConnectionKind,
    { heading: string; count: string; emptyTitle: string; emptyHint: string }
  >
> = {
  followers: {
    heading: PROFILES_I18N_KEYS.listFollowers,
    count: PROFILES_I18N_KEYS.countFollowers,
    emptyTitle: PROFILES_I18N_KEYS.emptyFollowers,
    emptyHint: PROFILES_I18N_KEYS.emptyFollowersHint,
  },
  following: {
    heading: PROFILES_I18N_KEYS.listFollowing,
    count: PROFILES_I18N_KEYS.countFollowing,
    emptyTitle: PROFILES_I18N_KEYS.emptyFollowing,
    emptyHint: PROFILES_I18N_KEYS.emptyFollowingHint,
  },
  blocked: {
    heading: PROFILES_I18N_KEYS.listBlocked,
    count: PROFILES_I18N_KEYS.countBlocked,
    emptyTitle: PROFILES_I18N_KEYS.emptyBlocked,
    emptyHint: PROFILES_I18N_KEYS.emptyBlockedHint,
  },
};

export interface ConnectionListProps {
  /** Which of the caller's own lists to draw. */
  readonly kind: ConnectionKind;
  /** Draw the "Followers · 12 followers" heading (default `true`). Turn it
   * off when the surrounding page already names the list — e.g. under
   * `<ConnectionsPage/>`'s own segmented control. */
  readonly showHeading?: boolean;
  /**
   * Draw a relationship control on every row (default `true`).
   *
   * It is on by default because the alternative is the gdpr lesson: a
   * `blocked` list whose one recovery action is unreachable. Each row's
   * control reads the caller↔target status, which the batch has ALREADY
   * answered (`relationship_status`) and `useProfilesBatch` seeds into the
   * relationship cache, so the rows paint from data the list already
   * fetched instead of firing one read per person.
   */
  readonly rowActions?: boolean;
  /** Replace the per-row action entirely (a roster with its own menu). */
  renderAction?(userId: string, entry: ProfileBatchEntry): ReactNode;
  /** Make rows activatable — a host with a router passes navigation to its
   * own public-profile route. */
  onOpenProfile?(userId: string): void;
  /** The caller's own user id, so their own row (if it appears) is marked
   * "You" instead of offering them a Follow button for themselves. */
  readonly selfUserId?: string;
  readonly testId?: string;
}

function ConnectionListBody(props: {
  bag: ConnectionListBag;
  skin: ConnectionListProps;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { bag, skin } = props;
  const copy = LIST_COPY[bag.kind];

  // Only a landed read has ids to resolve; a failed one asks for nothing.
  const ids = isLoadReady(bag.state) ? bag.state.data : NO_IDS;
  const batch = useProfilesBatch(ids);

  const rowActions = skin.rowActions ?? true;
  const testId = skin.testId ?? `connection-list-${bag.kind}`;

  function actionFor(userId: string, entry: ProfileBatchEntry): ReactNode {
    if (skin.renderAction) return skin.renderAction(userId, entry);
    if (!rowActions) return null;
    if (skin.selfUserId !== undefined && skin.selfUserId === userId) return null;
    const name = entry.status === "found" ? entry.profile.display_name : undefined;
    return (
      <Relationship
        userId={userId}
        size="small"
        layout="inline"
        // A roster line, not a profile: one quiet control per row instead of a
        // column of solid primaries (visual pass VC-A6). And on the FOLLOWERS
        // list the offer is "follow back" by construction — everybody in it
        // already follows the caller.
        emphasis="row"
        followsYou={bag.kind === "followers"}
        // A roster row is not the place to block someone: that decision
        // belongs on the person's own profile, where the consequence can be
        // spelled out. The blocked LIST is the exception — unblocking is the
        // only reason that list is a screen.
        showBlock={bag.kind === "blocked"}
        {...(name !== undefined ? { displayName: name } : {})}
        testId={`connection-action-${userId}`}
      />
    );
  }

  return (
    <Flex vertical gap={spacing[4]} data-testid={testId} style={{ width: "100%" }}>
      {/* The count is the state of the world and always renders once the read
          lands — a count beside a read that has NOT landed is the same lie in
          a smaller font, so the bag leaves it `undefined` until then. Only the
          TITLE is suppressible: a page that already names the list (the
          segmented control on `<ConnectionsPage/>`) would otherwise say it
          twice. */}
      <Flex align="baseline" gap={spacing[3]} wrap="wrap">
        {(skin.showHeading ?? true) && (
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(copy.heading)}
          </Typography.Title>
        )}
        {bag.count !== undefined && (
          <Typography.Text type="secondary" data-testid={`${testId}-count`}>
            {tPlural(copy.count, { count: bag.count })}
          </Typography.Text>
        )}
      </Flex>

      <LoadList
        state={bag.state}
        onRetry={bag.refetch}
        testId={`${testId}-load`}
        empty={
          <EmptyState
            title={t(copy.emptyTitle)}
            hint={t(copy.emptyHint)}
            testId={`${testId}-empty`}
          />
        }
      >
        {(items) => (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${CONNECTION_ROW_MIN_WIDTH}, 1fr))`,
              gap: spacing[4],
            }}
          >
            {items.map((userId) => {
              const entry = profileBatchEntry(batch.data, userId);
              return (
                <PersonRow
                  key={userId}
                  userId={userId}
                  entry={entry}
                  isSelf={skin.selfUserId === userId}
                  action={actionFor(userId, entry)}
                  {...(skin.onOpenProfile ? { onOpen: skin.onOpenProfile } : {})}
                  testId={`connection-row-${userId}`}
                />
              );
            })}
          </div>
        )}
      </LoadList>
    </Flex>
  );
}

export function ConnectionList(props: ConnectionListProps): ReactElement {
  return (
    <HeadlessConnectionList kind={props.kind}>
      {(bag) => <ConnectionListBody bag={bag} skin={props} />}
    </HeadlessConnectionList>
  );
}
