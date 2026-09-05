/**
 * `<PublicProfilePage/>` — "view somebody's profile", the screen this pair
 * never had.
 *
 * `GET /{user_id}` had a typed client, a query hook, and no component: there
 * was no way in the whole library to look at another person. This is that
 * page — identity block, the two counts, location and the seller's declared
 * trading capacity when the deployment fills them, and the follow / block
 * controls ({@link Relationship}) underneath.
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

/**
 * The word for a self-declared trading capacity (`seller_type`), or
 * `undefined` for a value this package ships no word for.
 *
 * `private`/`business` are the two stapel-profiles states, and neither is a
 * caption: "business" over a seller card in a Russian storefront is an English
 * word for a Russian shop. A deployment that registers a third capacity gets
 * `undefined` here and its own raw value on screen, which is the honest bottom
 * of every label ladder in this fleet — a made-up word would be worse than an
 * identifier.
 *
 * `null` — the wire's "no such field on this deployment's profile model" AND
 * its "nobody declared one", deliberately indistinguishable — answers
 * `undefined` too: there is nothing to say, so nothing is said.
 */
export function sellerTypeLabelKey(
  sellerType: string | null | undefined
): string | undefined {
  if (sellerType === "private") return PROFILES_I18N_KEYS.sellerTypePrivate;
  if (sellerType === "business") return PROFILES_I18N_KEYS.sellerTypeBusiness;
  return undefined;
}

/**
 * The trading capacity as a word, or `undefined` when there is nothing to say.
 *
 * The value falls through to itself for a capacity this package has no word
 * for — see {@link sellerTypeLabelKey}.
 */
export function sellerTypeLabel(
  t: (key: string) => string,
  sellerType: string | null | undefined
): string | undefined {
  if (sellerType === null || sellerType === undefined || sellerType === "") {
    return undefined;
  }
  const key = sellerTypeLabelKey(sellerType);
  return key === undefined ? sellerType : t(key);
}

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
  const sellerType = sellerTypeLabel(t, profile.seller_type);
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
              {/* THIRD person. `countFollowing` is the caller's own list copy
                  ("31 people you follow") and reading it on somebody else's
                  profile told the visitor a fact about themselves that was not
                  even true. Followers needs no such split — "128 followers" is
                  already about whoever the page is about. */}
              <Stat
                value={tPlural(PROFILES_I18N_KEYS.publicCountFollowing, {
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

        {/* AM I BUYING FROM A PERSON OR FROM A SHOP — a different question
            from who they are, and one a storefront otherwise answered with a
            second lookup. stapel-profiles 0.19.0 puts it on the same read.

            This block replaces a RATING one that could never render: the
            schema declared `rating: float` on both public responses and no
            version of the backend ever had the field (the migration that
            added it was reverted inside the first release), so `rating > 0`
            was `undefined > 0` on every profile this pair has ever drawn.
            0.19.0's schema drops it. */}
        {sellerType !== undefined && (
          <Flex vertical>
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.publicSellerType)}
            </Typography.Text>
            <Typography.Text data-testid="public-profile-seller-type">
              {sellerType}
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
      <div
        style={{
          width: "100%",
          maxWidth: PUBLIC_PROFILE_MAX_WIDTH,
          marginInline: "auto",
        }}
      >
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
