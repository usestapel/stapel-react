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
 * ── A person's name can be a real link ────────────────────────────────────
 *
 * For three releases the only activation here was `onOpen`, a click handler on
 * a `role="button"` div. That is navigation a browser cannot see: no middle
 * click, no "open in new tab", no "copy link address", no status bar, and
 * nothing for a crawler — and a seller's name on a listing page is exactly
 * where a reader reaches for all four (measured on a live storefront, which
 * wrapped the row in its own anchor and inherited a button inside a link).
 *
 * So `href` makes the NAME an anchor, and `linkComponent` swaps that anchor
 * for the host router's `<Link>` (core's shared seam — this pair still ships
 * no router, and a library that picked one would pick it for every host).
 * With `href` the row does not also become a `role="button"`: one activation,
 * one element, and no button wrapped around a link. `onOpen` still fires on
 * the click, additively, so a host that instruments the gesture keeps it.
 * Neither prop given, the row is exactly what it was.
 *
 * ── One PHRASE, not a row ─────────────────────────────────────────────────
 *
 * `size="compact"` is the same identity in the space of a caption: a 20px
 * avatar, the name (a link when `href` says so) and an optional trailing node,
 * all on ONE line, with the second line inline after the name rather than
 * under it. It exists because a card's seller line is not a list row — a
 * storefront that wanted the person under a listing card had to write its own
 * anchor and its own avatar rather than use this pair, which is how a user id
 * gets back onto the glass. The four states stay four here too: the compact
 * arm skeletons and speaks exactly like the other two.
 *
 * ── The name can be the page's heading ────────────────────────────────────
 *
 * On a seller page the person's name IS the heading of the document, and this
 * component drew it as a `<span>`: a screen-reader's heading list skipped
 * straight past the subject of the page, and a storefront that wanted the
 * outline right had to rebuild the row. `headingLevel` makes the name an
 * `h1`–`h4` — the ELEMENT changes, nothing else does. It inherits the row's
 * own font and carries no margin, so a heading row and a plain row are the
 * same picture; only the document outline differs, which is the whole request.
 * Omitted, the row is byte-for-byte what it was.
 *
 * (`<ProfileNameHeading/>` remains the other answer: a name as the sole,
 * type-scaled heading of a page, with its height reserved while the read is in
 * flight. This one is a heading INSIDE a row.)
 */
import type { ReactElement, ReactNode } from "react";
import { Avatar, Flex, Skeleton, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { Image } from "@stapel/image";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { profileAvatarImage } from "../api/extensions.js";
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
/** The compact arm's avatar — a caption-sized person, for a card's seller
 * line. Small enough that the line is text with a face in it rather than a
 * list row squeezed into a card. */
export const PERSON_COMPACT_AVATAR = 20;

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

/**
 * Which heading the name is, when it is one. Stops at `4` deliberately: `h5`
 * and `h6` under a row of this size describe a document nobody has, and a
 * component that offered them would be inviting an outline built out of the
 * deepest levels because they happened to be available.
 */
export type PersonNameHeadingLevel = 1 | 2 | 3 | 4;

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
  /** Replace the default second line (location, else nothing). In
   * `size="compact"` it renders INLINE after the name — the arm is one line. */
  readonly secondary?: ReactNode;
  /**
   * A node directly after the name — a rating, a "member since", a verified
   * mark. `size="compact"` is what it is for: {@link action} is a right-hand
   * RAIL (a follow button at the far edge of a list row), and a phrase has no
   * rail. Rendered in every arm, right after the name and any `secondary`.
   */
  readonly trailing?: ReactNode;
  /**
   * The person's own page, as a URL. Given, the display NAME becomes a real
   * link — see the module doc for the four browser affordances a click
   * handler cannot give back. The pair never builds this route: which path a
   * profile lives at is the host's, and only the host knows it.
   */
  readonly href?: string;
  /**
   * The host router's `<Link>` (core's {@link LinkComponent} seam), used for
   * {@link href}. Absent, `href` renders a plain anchor — correct, and a full
   * page reload inside a SPA.
   */
  readonly linkComponent?: LinkComponent;
  /** Make the row activatable — a host with a router passes navigation.
   * Alongside {@link href} it stays a NOTIFICATION (the anchor navigates and
   * this fires beside it), never a second way to navigate. */
  onOpen?(userId: string): void;
  /**
   * Which of the three shapes: the list `"row"` (default), the larger
   * `"header"` (the public-profile identity block), or `"compact"` — one
   * caption-sized line, for a card's seller line (see the module doc).
   */
  readonly size?: "row" | "header" | "compact";
  /**
   * Draw the NAME as a real document heading (`h1`–`h4`) instead of a span.
   * Only the element changes: the heading inherits the row's font and carries
   * no margin, so the picture is identical and the outline is not. Omitted,
   * the row is exactly what it was — a page with several people on it must not
   * accidentally grow several headings.
   *
   * Which level is the HOST's to know: the same row is the `h1` of a seller
   * page and an `h3` in a list on somebody else's.
   */
  readonly headingLevel?: PersonNameHeadingLevel;
  readonly testId?: string;
}

/** The avatar side for a variant. */
function avatarSide(size: PersonRowProps["size"]): number {
  if (size === "header") return PERSON_HEADER_AVATAR;
  if (size === "compact") return PERSON_COMPACT_AVATAR;
  return PERSON_ROW_AVATAR;
}

export interface PersonAvatarProps {
  /** Whose face. `null` — nobody was found, so the monogram is all there is. */
  readonly profile: PublicProfile | null;
  /** The name the monogram is built from when there is no avatar. */
  readonly fallbackName: string;
  /** The side, in CSS pixels — one of the `PERSON_*_AVATAR` constants, or a
   * host's own number. */
  readonly side: number;
}

/**
 * The person's avatar: the backend's source-agnostic descriptor when there is
 * one (so `<Image>` picks the right ladder rung and blurs up), else a
 * monogram. Never a broken `<img>`.
 *
 * Exported because a host draws avatars where a whole row does not fit — a
 * chat bubble's gutter, a table cell, an overlapping stack of facepiles — and
 * every one of those was otherwise a private reimplementation of the same
 * "descriptor or monogram" decision, which is how a broken `<img>` (or a
 * truncated user id) gets back onto the glass.
 */
export function PersonAvatar(props: PersonAvatarProps): ReactElement {
  const image = profileAvatarImage(props.profile);
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

/**
 * The name as an `h1`–`h4`, and NOTHING else different.
 *
 * `font: inherit` and a zeroed margin are the whole implementation: a browser's
 * default heading metrics inside a 40px row would resize the row and space it
 * apart, which is a redesign nobody asked for — the request was an outline, so
 * an outline is all that changes. `minWidth: 0` keeps the name's own ellipsis
 * working inside the flex line it now sits one element deeper in.
 */
function PersonNameHeading(props: {
  level: PersonNameHeadingLevel;
  children: ReactNode;
}): ReactElement {
  const Tag = `h${String(props.level)}` as "h1" | "h2" | "h3" | "h4";
  return (
    <Tag
      style={{ margin: 0, font: "inherit", minWidth: 0 }}
      data-stapel-person-heading={String(props.level)}
    >
      {props.children}
    </Tag>
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
        gap={props.size === "compact" ? spacing[2] : spacing[3]}
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

  const nameText = (
    <Typography.Text
      strong={props.size === "header"}
      ellipsis
      data-stapel-person-name
    >
      {name}
    </Typography.Text>
  );
  // The name as a REAL link when the host names the route — see the module
  // doc. `onOpen` rides along as a notification and never calls
  // `preventDefault`: the anchor is what navigates.
  const HostLink = props.linkComponent;
  const href = props.href;
  const notify = props.onOpen;
  const linkAttrs = {
    "data-stapel-person-link": "",
    "data-analytics": "none",
    "data-analytics-reason":
      "navigation to a host-owned route; the host instruments its own router",
    ...(notify === undefined
      ? {}
      : {
          onClick: () => {
            notify(props.userId);
          },
        }),
  } as const;
  const linkedName: ReactNode =
    href === undefined ? (
      nameText
    ) : HostLink !== undefined ? (
      <HostLink href={href} {...linkAttrs}>
        {nameText}
      </HostLink>
    ) : (
      <Typography.Link href={href} {...linkAttrs}>
        {nameText}
      </Typography.Link>
    );
  // The heading wraps the LINK, not the other way round: `<h2><a>…</a></h2>`
  // is a heading you can click, `<a><h2>…</h2></a>` is a link that happens to
  // contain one.
  const nameNode: ReactNode =
    props.headingLevel === undefined ? (
      linkedName
    ) : (
      <PersonNameHeading level={props.headingLevel}>{linkedName}</PersonNameHeading>
    );

  /**
   * The qualifier slot MAY SHRINK, and that is the whole rule.
   *
   * `flex-shrink: 0` here made the slot rigid, so whatever a host put in it
   * kept its widest measure and the ROW grew instead: a rating badge that
   * wraps its own stars/score/count (`reviews-react`'s `<RatingBadge>`) never
   * reached a width narrow enough to wrap, and a 258–334px block dragged
   * every feed card past a phone viewport.
   *
   * `flex: 0 1 auto` plus `min-inline-size: 0` says the opposite: the slot
   * asks for its content's width and gives it back under pressure, down to
   * zero if the line demands it. What happens inside is the trailing node's
   * own business — wrap, ellipsis or clip — and it can only choose once it is
   * told how much room there is. The lead beside it keeps its own
   * `min-inline-size: 0` (see the bodies below) so neither end is the rigid
   * one.
   */
  const trailingNode: ReactNode =
    props.trailing !== undefined && props.trailing !== null ? (
      <span
        style={{ flex: "0 1 auto", minInlineSize: 0 }}
        data-stapel-person-trailing
      >
        {props.trailing}
      </span>
    ) : null;

  const you = props.isSelf === true && (
    <Typography.Text type="secondary">
      {t(PROFILES_I18N_KEYS.personYou)}
    </Typography.Text>
  );

  // One line, in reading order: face, name, whatever qualifies it. No vertical
  // stack and no right-hand rail — a phrase has neither.
  const compactBody = (
    <Flex align="center" gap={spacing[2]} style={{ minWidth: 0 }}>
      <PersonAvatar profile={profile} fallbackName={name} side={side} />
      {nameNode}
      {you}
      {secondary !== null && secondary !== undefined && (
        <Typography.Text type="secondary" ellipsis>
          {secondary}
        </Typography.Text>
      )}
      {trailingNode}
      {props.action !== undefined && props.action !== null && (
        <div style={{ flexShrink: 0 }}>{props.action}</div>
      )}
    </Flex>
  );

  const stackedBody = (
    <Flex align="center" gap={spacing[3]} style={{ width: "100%", minWidth: 0 }}>
      <PersonAvatar profile={profile} fallbackName={name} side={side} />
      <Flex vertical style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap={spacing[2]} style={{ minWidth: 0 }}>
          {nameNode}
          {you}
          {trailingNode}
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

  const body = props.size === "compact" ? compactBody : stackedBody;

  // With a real link in the row, the row itself is NOT also a button: one
  // destination gets one activatable element, and a `role="button"` wrapped
  // around an anchor is two announcements and an unreachable inner target.
  const open = href !== undefined ? undefined : props.onOpen;
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
