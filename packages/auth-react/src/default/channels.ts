/**
 * Channel discovery + zone-splitting for the default auth skin
 * (domain-guidelines-auth ПРАВИЛА 1-4, tuned per owner directive — see
 * AuthPanel.tsx's module doc). PURE — no React, no antd — so the mechanics
 * (which channels render, and how the priority-sorted list is cut into
 * main/bottom/overflow) are unit-testable in isolation from the markup.
 */
import type {
  ChannelInteraction,
  ChannelPlacement,
  ChannelPlanEntry,
  LoginCapabilities,
} from "../api/types.js";

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

/** The three render zones a channel list is cut into. */
export interface AuthZones {
  /** Inline tabs (or a lone form when there's exactly one). */
  readonly main: ChannelId[];
  /** A persistent icon-button row beneath the primary form (social + qr/passkey). */
  readonly bottom: ChannelId[];
  /** Behind the "More ways to sign in" three-dot menu. */
  readonly overflow: ChannelId[];
}

/** These two channels are NEVER a tab — a skin-level guarantee that holds
 * even if a backend plan explicitly claims `placement: "main"` for them
 * (owner directive: "SSO — тоже модалка из трёх точек, НЕ третий таб"; the
 * same reasoning applies to OAuth, which is a *group* of provider buttons,
 * not a single form). */
const NEVER_MAIN: ReadonlySet<ChannelId> = new Set(["oauth", "sso"]);

/** Channels that default to the bottom icon row (rather than overflow) when
 * a plan doesn't say otherwise — social buttons plus the two flows that read
 * well as a single icon (owner directive point 4). */
const DEFAULT_BOTTOM: ReadonlySet<ChannelId> = new Set([
  "oauth",
  "qr",
  "passkey",
]);

/** `NEVER_MAIN`'s fallback placement per channel. */
function clampNeverMain(id: ChannelId): ChannelPlacement {
  return id === "oauth" ? "bottom" : "overflow";
}

/**
 * Cut the priority-sorted list into zones when the backend sends NO plan at
 * all (pre-0.6.0 `LoginCapabilities`, or a plan-less capabilities response):
 *   - first 3 non-{oauth,sso} channels (by priority) → main tabs,
 *   - everything else that reads as an icon (oauth/qr/passkey) → bottom row,
 *   - the rest → overflow.
 * Mechanical, not a taste call — mirrors `computeZones`'s plan-driven path so
 * the two only differ in WHERE placement comes from.
 */
function legacyZones(channels: readonly ChannelId[]): AuthZones {
  const main: ChannelId[] = [];
  const rest: ChannelId[] = [];
  for (const id of channels) {
    if (main.length < 3 && !NEVER_MAIN.has(id)) {
      main.push(id);
    } else {
      rest.push(id);
    }
  }
  const bottom = rest.filter((id) => DEFAULT_BOTTOM.has(id));
  const overflow = rest.filter((id) => !DEFAULT_BOTTOM.has(id));
  return { main, bottom, overflow };
}

/** Resolve one channel's placement: explicit plan value (clamped for the
 * never-a-tab channels) → per-channel default (mirrors `legacyZones`'
 * heuristic) → `"main"`. */
function resolvePlacement(
  id: ChannelId,
  explicit: ChannelPlacement | undefined
): ChannelPlacement {
  if (explicit) {
    return NEVER_MAIN.has(id) && explicit === "main" ? clampNeverMain(id) : explicit;
  }
  if (NEVER_MAIN.has(id)) return clampNeverMain(id);
  return DEFAULT_BOTTOM.has(id) ? "bottom" : "main";
}

/**
 * Resolve one channel's click behaviour once it is NOT `"main"`: explicit
 * plan value → OAuth defaults to `"redirect"` (rendered as direct provider
 * buttons, no dialog — there is no form to show) → everything else opens a
 * dialog with that channel's panel.
 */
export function resolveInteraction(
  id: ChannelId,
  placement: ChannelPlacement,
  explicit?: ChannelInteraction
): ChannelInteraction {
  if (placement === "main") return "inline";
  if (explicit && explicit !== "inline") return explicit;
  return id === "oauth" ? "redirect" : "modal";
}

/**
 * Cut the enabled, priority-sorted channel list into zones (owner directive
 * §37/§54-tuning, points 1/3/4): when `plan` is present (stapel-auth ≥0.6.0),
 * each channel's placement comes from `plan[id].placement`; a channel the
 * plan is silent on falls back to the same per-channel default `legacyZones`
 * uses. When `plan` is entirely absent (older backend), the whole list runs
 * through `legacyZones`. Either way, `main` is capped at 3 (ПРАВИЛО 4) as a
 * skin-level guarantee — never a backend promise.
 */
export function computeZones(
  channels: readonly ChannelId[],
  plan?: Readonly<Record<string, ChannelPlanEntry>>
): AuthZones {
  if (!plan) return legacyZones(channels);

  const main: ChannelId[] = [];
  const bottom: ChannelId[] = [];
  const overflow: ChannelId[] = [];
  for (const id of channels) {
    const placement = resolvePlacement(id, plan[id]?.placement);
    const bucket = placement === "main" ? main : placement === "bottom" ? bottom : overflow;
    bucket.push(id);
  }
  if (main.length > 3) {
    overflow.unshift(...main.splice(3));
  }
  return { main, bottom, overflow };
}
