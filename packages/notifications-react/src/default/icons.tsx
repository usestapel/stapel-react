/**
 * One glyph per notification FAMILY, so a feed row can be read before it is
 * read.
 *
 * `FeedItemResponse.notification_type` was on the wire from the first release
 * and rendered by nothing — the audit's GAP-N11. It is the only structure the
 * list has: without it every row is a title and a body in the same weight, and
 * a security alert looks exactly like a listing that is about to expire.
 *
 * Families, not types. The backend registry carries 28 types and grows
 * (`STAPEL_NOTIFICATIONS["TYPES"]` merges a host's own over the built-ins), so
 * a lookup keyed on the full type would render nothing for every new one. The
 * prefixes below are the registry's own grouping, and an unrecognised type
 * falls back to the bell rather than to a hole.
 *
 * Plain `currentColor` SVG — no `@ant-design/icons` dependency, the same
 * decision `profiles-react/src/default/icons.tsx` took. Every glyph is
 * `aria-hidden`: the row's accessible name is its title, and a screen reader
 * announcing "shield graphic" before it is noise.
 */
import type { ReactElement } from "react";

/** The families a feed row can belong to. */
export type NotificationFamily =
  | "security"
  | "message"
  | "listing"
  | "moderation"
  | "workspace"
  | "privacy"
  | "other";

/**
 * Which family a `notification_type` belongs to.
 *
 * Exported because it is the part worth testing: the mapping is a claim about
 * the backend's registry, and a claim about somebody else's data belongs under
 * a test rather than inside a render.
 */
export function notificationFamily(type: string): NotificationFamily {
  if (type.startsWith("workspace.")) return "workspace";
  if (type.startsWith("moderation.") || type === "report_reviewed") {
    return "moderation";
  }
  if (type.startsWith("gdpr.")) return "privacy";
  if (type.startsWith("listing_")) return "listing";
  if (type === "new_message" || type.startsWith("chat.")) return "message";
  if (
    type === "otp_code" ||
    type === "magic_link_login" ||
    type === "new_device_login" ||
    type === "suspicious_login" ||
    type === "all_sessions_revoked" ||
    type.startsWith("auth_change_")
  ) {
    return "security";
  }
  return "other";
}

function Glyph(props: { children: ReactElement | readonly ReactElement[] }): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

/** The glyph for a notification type. */
export function NotificationTypeIcon(props: { type: string }): ReactElement {
  switch (notificationFamily(props.type)) {
    case "security":
      return (
        <Glyph>
          <path d="M12 3 4 6v6c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V6l-8-3z" />
        </Glyph>
      );
    case "message":
      return (
        <Glyph>
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-5.2A8 8 0 1 1 21 12z" />
        </Glyph>
      );
    case "listing":
      return (
        <Glyph>
          <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </Glyph>
      );
    case "moderation":
      return (
        <Glyph>
          <path d="M4 21V4h11l-1.5 3.5L15 11H4" />
        </Glyph>
      );
    case "workspace":
      return (
        <Glyph>
          <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 20v-2a4 4 0 0 0-3-3.9" />
        </Glyph>
      );
    case "privacy":
      return (
        <Glyph>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </Glyph>
      );
    default:
      return (
        <Glyph>
          <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
          <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
        </Glyph>
      );
  }
}

/**
 * The bell itself — the nav entry's glyph, at nav size.
 *
 * Same path as the `other` family above, drawn at 20px rather than 18px and
 * without the family icon's `aria-hidden` justification: this one is the only
 * content of a button, whose accessible name is the button's `aria-label`, so
 * the glyph stays decorative here too.
 */
export function BellIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
    </svg>
  );
}

/** A small chevron marking a row that opens something. */
export function OpenChevronIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
