/**
 * Channel discovery + zone-splitting for the default auth skin
 * (domain-guidelines-auth ПРАВИЛА 1-4). PURE — no React, no antd — so the
 * mechanics (which channels render, and how the priority-sorted list is cut
 * into zones B/C/overflow) are unit-testable in isolation from the markup.
 */
import type { LoginCapabilities } from "../api/types.js";

/** Every sign-in channel the skin knows how to render. */
export type ChannelId =
  | "email"
  | "phone"
  | "passkey"
  | "oauth"
  | "sso"
  | "qr"
  | "magic_link"
  | "password";

/**
 * Ratified default priority (domain-guidelines-auth ПРАВИЛО 2 + architect
 * decision 1): email-code first (most universal), password last (its axis is
 * off by default). A host overrides via `AuthPanel`'s `channelPriority` prop.
 */
export const DEFAULT_CHANNEL_PRIORITY: readonly ChannelId[] = [
  "email",
  "phone",
  "passkey",
  "oauth",
  "sso",
  "qr",
  "magic_link",
  "password",
];

/** Is a given channel switched on in the backend's login capabilities? */
function isEnabled(id: ChannelId, caps: LoginCapabilities): boolean {
  switch (id) {
    case "email":
      return caps.email;
    case "phone":
      return caps.phone;
    case "password":
      return caps.password;
    case "passkey":
      return caps.passkey;
    case "sso":
      return caps.sso;
    case "qr":
      return caps.qr;
    case "magic_link":
      return caps.magic_link;
    case "oauth":
      // OAuth is one channel "social"; enabled iff ≥1 provider is configured.
      return caps.oauth.length > 0;
  }
}

/**
 * The enabled channels, in priority order (ПРАВИЛО 1: a disabled axis yields
 * ZERO DOM — it simply never appears in this list).
 */
export function enabledChannels(
  caps: LoginCapabilities,
  priority: readonly ChannelId[] = DEFAULT_CHANNEL_PRIORITY
): ChannelId[] {
  return priority.filter((id) => isEnabled(id, caps));
}

/** The three render zones a channel list is cut into (ПРАВИЛО 4). */
export interface ZoneSplit {
  /** Zone B — up to 3 primary channels shown as tabs (or a lone form). */
  readonly primary: ChannelId[];
  /** Zone C — up to 2 secondary channels shown as buttons. */
  readonly secondary: ChannelId[];
  /** Zone C "More" — everything else, behind the overflow dropdown. */
  readonly overflow: ChannelId[];
}

/**
 * Cut the priority-sorted list into zones (ПРАВИЛО 4 decision table):
 *   1     → primary=[x]
 *   2-3   → primary=all
 *   4-5   → primary=first 3, secondary=rest (≤2)
 *   6+    → primary=first 3, secondary=next 2, overflow=rest
 * Mechanical, not a taste call.
 */
export function splitZones(channels: readonly ChannelId[]): ZoneSplit {
  if (channels.length <= 3) {
    return { primary: [...channels], secondary: [], overflow: [] };
  }
  const primary = channels.slice(0, 3);
  const rest = channels.slice(3);
  if (rest.length <= 2) {
    return { primary, secondary: rest, overflow: [] };
  }
  return { primary, secondary: rest.slice(0, 2), overflow: rest.slice(2) };
}
