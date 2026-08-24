/**
 * `<PersonRow/>` — the pair's ONE identity primitive, and the reason it
 * exists: **a user id must never reach the glass.**
 *
 * The visual pass on this pair's showcase (2026-08-24) found the followers
 * list rendering the same truncated UUID three times, because the connection
 * endpoints answer *ids* and nothing in the pair turned an id into a person.
 * `GET /me/followers` → `["b3f1c0de-…", …]`; the identities live one call
 * away, behind `POST /batch` (`useProfilesBatch`). This component is the
 * other half of that pair: hand it the batch's four-state answer for one id
 * ({@link ProfileBatchEntry}) and it draws a person — avatar or monogram,
 * display name, a quiet second line — or says, in words, which of the three
 * non-answers it got.
 *
 * THE FOUR STATES STAY FOUR (model/profileBatch.ts). `found` is a person;
 * `missing` is "this account exists and has no profile row yet" — a NORMAL
 * state since stapel-profiles 0.15.0 provisions on registration, and a
 * placeholder rather than a failure; `not_requested` and `unknown` are "we
 * have not been told", which is a skeleton, not a blank. Collapsing them into
 * a nullable profile is the exact defect `POST /batch` was built to remove.
 *
 * It is deliberately NOT a link. Routing is the host's (this pair carries no
 * router); `onOpen` makes the row activatable when a host wires one, and
 * without it the row is inert text, not a dead-looking button.
 */
import type { ReactElement, ReactNode } from "react";
import { Avatar, Flex, Skeleton, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { Image } from "@stapel/image";
import type { StapelImage } from "@stapel/image";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import type { ProfileBatchEntry } from "../model/profileBatch.js";
import type { PublicProfile } from "../api/types.js";

/**
 * Avatar sides. Not spacing steps — an avatar is a fixed piece of geometry,
 * so it is a NAMED constant a host can read and a redesign changes once,
 * rather than a literal buried in a style object (`stapel/no-raw-dimensions`
 * asks for exactly this shape when a value is genuinely off-scale).
 */
export const PERSON_ROW_AVATAR = 40;
/** The header variant's avatar (`<PublicProfilePage/>`'s identity block). */
export const PERSON_HEADER_AVATAR = 72;

/** Up to two initials, uppercased — the monogram behind a missing avatar. */
export function personMonogram(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const initials =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : `${(words[0] ?? "").slice(0, 1)}${(words[1] ?? "").slice(0, 1)}`;
  return initials.toUpperCase();
}

export interface PersonRowProps {
  /**
   * What the batch answered for this id. `found` draws the person; the other
   * three draw what they actually are (see the module doc).
   */
  readonly entry: ProfileBatchEntry;
  /** The id itself — used ONLY as a React key hint and for `onOpen`; it is
   * never rendered. */
  readonly userId: string;
  /** Mark this row as the caller ("You" beside the name). */
  readonly isSelf?: boolean;
  /** The relationship control (or any per-row action) shown on the right. */
  readonly action?: ReactNode;
  /** Replace the default second line (location, else nothing). */
  readonly secondary?: ReactNode;
  /** Make the row activatable — a host with a router passes navigation. */
  onOpen?(userId: string): void;
  /** Draw the larger header variant (the public-profile identity block). */
  readonly size?: "row" | "header";
  readonly testId?: string;
}

/** The avatar side for a variant. */
function avatarSide(size: PersonRowProps["size"]): number {
  return size === "header" ? PERSON_HEADER_AVATAR : PERSON_ROW_AVATAR;
}

/** The person's avatar: the backend's source-agnostic descriptor when there
 * is one (so `<Image>` picks the right ladder rung and blurs up), else a
 * monogram. Never a broken `<img>`. */
function PersonAvatar(props: {
  profile: PublicProfile | null;
  fallbackName: string;
  side: number;
}): ReactElement {
  const image = props.profile?.avatar_image as StapelImage | null | undefined;
  if (image) {
    return (
      <Image
        meta={image}
        fit="cover"
        alt=""
        style={{
          width: props.side,
          height: props.side,
          borderRadius: "50%",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <Avatar size={props.side} style={{ flexShrink: 0 }}>
      {personMonogram(props.fallbackName)}
    </Avatar>
  );
}

export function PersonRow(props: PersonRowProps): ReactElement {
  const t = useT();
  const side = avatarSide(props.size);
  const { entry } = props;

  // Not asked / not answered yet: a skeleton of the row's own shape. A blank
  // row and a person with no name would otherwise look identical.
  if (entry.status === "unknown" || entry.status === "not_requested") {
    return (
      <Flex
        align="center"
        gap={spacing[3]}
        data-stapel-person="pending"
        {...(props.testId ? { "data-testid": props.testId } : {})}
      >
        <Skeleton.Avatar active size={side} />
        <Skeleton active paragraph={false} title={{ width: "60%" }} />
      </Flex>
    );
  }

  const profile = entry.status === "found" ? entry.profile : null;
  const rawName = profile?.display_name?.trim() ?? "";
  // stapel-profiles 0.15.0 answers an empty-but-renderable profile for a
  // registered person who never typed anything. An empty name is that state,
  // not a bug, and it gets a word rather than blank space.
  const name = rawName.length > 0 ? rawName : t(PROFILES_I18N_KEYS.personUnnamed);
  const location = profile?.location_display_name_narrow?.trim() ?? "";

  const secondary: ReactNode =
    props.secondary ??
    (entry.status === "missing"
      ? t(PROFILES_I18N_KEYS.personMissing)
      : location.length > 0
        ? location
        : null);

  const body = (
    <Flex align="center" gap={spacing[3]} style={{ width: "100%", minWidth: 0 }}>
      <PersonAvatar profile={profile} fallbackName={name} side={side} />
      <Flex vertical style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap={spacing[2]} style={{ minWidth: 0 }}>
          <Typography.Text
            strong={props.size === "header"}
            ellipsis
            data-stapel-person-name
          >
            {name}
          </Typography.Text>
          {props.isSelf === true && (
            <Typography.Text type="secondary">
              {t(PROFILES_I18N_KEYS.personYou)}
            </Typography.Text>
          )}
        </Flex>
        {secondary !== null && secondary !== undefined && (
          <Typography.Text type="secondary" ellipsis>
            {secondary}
          </Typography.Text>
        )}
      </Flex>
      {props.action !== undefined && props.action !== null && (
        <div style={{ flexShrink: 0 }}>{props.action}</div>
      )}
    </Flex>
  );

  const open = props.onOpen;
  if (open === undefined) {
    return (
      <div
        data-stapel-person={entry.status}
        {...(props.testId ? { "data-testid": props.testId } : {})}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(props.userId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(props.userId);
        }
      }}
      style={{ cursor: "pointer" }}
      aria-label={name}
      data-stapel-person={entry.status}
      data-analytics="none"
      data-analytics-reason="navigation to a host-owned route; the host instruments its own router"
      {...(props.testId ? { "data-testid": props.testId } : {})}
    >
      {body}
    </div>
  );
}
