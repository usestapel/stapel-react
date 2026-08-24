/**
 * `<PublicProfilePage/>` — "view somebody's profile", the screen this pair
 * never had.
 *
 * `GET /{user_id}` had a typed client, a query hook, and no component: there
 * was no way in the whole library to look at another person. This is that
 * page — identity block, the two counts, location and rating when the
 * deployment fills them, and the follow / block controls
 * ({@link Relationship}) underneath.
 *
 * ── THE EMPTY-BUT-RENDERABLE PROFILE IS A DESIGNED STATE ────────────────────
 *
 * stapel-profiles 0.15.0 changed what this endpoint means. Registration now
 * provisions the row, and a read for a registered person who has never typed
 * anything answers **200 with an empty profile** instead of
 * `404 profile_not_found`; `404` now says one thing only — this id names
 * nobody. So the empty answer is not an error to report, it is a person to
 * draw: monogram, "Unnamed", and one line saying the profile has not been set
 * up. The alternative — an error card for somebody who simply signed up
 * yesterday — is the failure the backend release exists to remove, restated
 * in the frontend.
 *
 * A genuine `404` still falls to `LoadBoundary`'s failed arm, where the
 * backend's own sentence (`error.404.profile_not_found`) is rendered with a
 * retry, not invented here.
 *
 * `userId` is a required prop, not a route read: this pair carries no router
 * (the scaffold wires `/u/:userId` to it), the same contract
 * `categories-react`'s `<CategoryPage slug=…>` uses.
 */
import type { ReactElement } from "react";
import { Card, Flex, Typography } from "antd";
import { LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { loadStateFromQuery, useT, useTPlural } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useProfile } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { PersonRow } from "./PersonRow.js";
import { Relationship } from "./Relationship.js";
import type { PublicProfile } from "../api/types.js";

/** The page's comfortable measure — a `rem` length, not a pinned pixel box. */
export const PUBLIC_PROFILE_MAX_WIDTH = "42rem";

export interface PublicProfilePageProps {
  /** Whose profile. The `:userId` segment of the host's `/u/:userId` route. */
  readonly userId: string;
  /** Pin a side; omitted, the skin follows the document's LIVE `data-theme`. */
  readonly mode?: ThemeMode;
  /** The signed-in caller's own id — when it equals `userId` the screen says
   * "This is you" instead of offering follow controls. (The backend says so
   * too, via `relationship_status: "self"`; this makes the answer available
   * before the relationship read lands.) */
  readonly selfUserId?: string;
  /** A host with a router passes navigation to its own connections route. */
  onOpenConnections?(userId: string): void;
}

/** One "12 followers" style statistic. */
function Stat(props: { value: string }): ReactElement {
  return <Typography.Text type="secondary">{props.value}</Typography.Text>;
}

function PublicProfileBody(props: {
  profile: PublicProfile;
  skin: PublicProfilePageProps;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { profile } = props;
  const isSelf =
    props.skin.selfUserId === profile.user_id ||
    profile.relationship_status === "self";

  const name = profile.display_name?.trim() ?? "";
  // The 0.15.0 empty-but-renderable answer: no name, nothing followed, nobody
  // following. Said in words, once, under the identity block.
  const unwritten =
    name.length === 0 &&
    profile.followers_count === 0 &&
    profile.following_count === 0;

  const location = profile.location_display_name_broad?.trim() ?? "";

  return (
    <Card data-testid="public-profile" style={{ width: "100%" }}>
      <Flex vertical gap={spacing[5]}>
        <PersonRow
          size="header"
          userId={profile.user_id}
          entry={{ status: "found", profile }}
          isSelf={isSelf}
          secondary={
            <Flex gap={spacing[3]} wrap="wrap">
              <Stat
                value={tPlural(PROFILES_I18N_KEYS.countFollowers, {
                  count: profile.followers_count,
                })}
              />
              <Stat
                value={tPlural(PROFILES_I18N_KEYS.countFollowing, {
                  count: profile.following_count,
                })}
              />
            </Flex>
          }
          testId="public-profile-identity"
        />

        {unwritten && (
          <Typography.Text type="secondary" data-testid="public-profile-unwritten">
            {t(PROFILES_I18N_KEYS.publicUnwritten)}
          </Typography.Text>
        )}

        {location.length > 0 && (
          <Flex vertical>
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.publicLocation)}
            </Typography.Text>
            <Typography.Text data-testid="public-profile-location">
              {location}
            </Typography.Text>
          </Flex>
        )}

        {profile.rating > 0 && (
          <Flex vertical>
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.publicRating)}
            </Typography.Text>
            <Typography.Text data-testid="public-profile-rating">
              {profile.rating.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </Typography.Text>
          </Flex>
        )}

        {/* `self` is drawn by the control itself (the sentence, no buttons) —
            the card must never assert "This is you" AND offer Follow. */}
        <Relationship
          userId={profile.user_id}
          {...(name.length > 0 ? { displayName: name } : {})}
          testId="public-profile-relationship"
        />
      </Flex>
    </Card>
  );
}

export function PublicProfilePage(props: PublicProfilePageProps): ReactElement {
  const query = useProfile(props.userId);
  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid="public-profile-page"
    >
      <div style={{ width: "100%", maxWidth: PUBLIC_PROFILE_MAX_WIDTH }}>
        <LoadBoundary
          state={loadStateFromQuery(query)}
          onRetry={() => {
            void query.refetch();
          }}
          testId="public-profile-load"
        >
          {(profile) => <PublicProfileBody profile={profile} skin={props} />}
        </LoadBoundary>
      </div>
    </SkinTheme>
  );
}
