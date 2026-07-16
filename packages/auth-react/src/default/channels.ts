/**
 * Channel discovery + zone-splitting for the default auth skin
 * (domain-guidelines-auth ПРАВИЛА 1-4, tuned per owner directive — see
 * AuthPanel.tsx's module doc). PURE — no React, no antd — so the mechanics
 * (which channels render, and how the priority-sorted list is cut into
 * main/bottom/overflow) are unit-testable in isolation from the markup.
 */
import type { AuthMethodInfo, ChannelInteraction, ChannelPlacement, LoginCapabilities } from "../api/types.js";

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
 * Also the WITHIN-ZONE ordering when the backend doesn't send `methods[]`
 * (pre-0.6.0) — `AuthMethodInfo.order` takes over once it does.
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

/**
 * Default per-channel placement (stapel-auth's own backend defaults, per the
 * owner directive): email/phone are the only methods that default to a
 * `main` tab; social/QR/passkey/SSO default to the `bottom` icon row;
 * password/magic_link default to `overflow`. Used both as the ENTIRE
 * placement source when the backend sends no `methods[]` at all (pre-0.6.0),
 * and as the per-channel fallback for a method a partial `methods[]` is
 * silent on.
 */
const DEFAULT_PLACEMENT: Record<ChannelId, ChannelPlacement> = {
  email: "main",
  phone: "main",
  password: "overflow",
  magic_link: "overflow",
  sso: "bottom",
  oauth: "bottom",
  qr: "bottom",
  passkey: "bottom",
};

/** Clamp an explicit backend placement for the never-a-tab channels only —
 * every OTHER channel's explicit placement (including a legitimate
 * `password`/`magic_link` → `"main"` a deployment might configure) passes
 * through unchanged. */
function clampNeverMain(id: ChannelId, placement: ChannelPlacement): ChannelPlacement {
  return placement === "main" && NEVER_MAIN.has(id) ? DEFAULT_PLACEMENT[id] : placement;
}

/**
 * Cut the priority-sorted list into zones when the backend sends NO
 * `methods[]` at all (pre-0.6.0 `Capabilities`): each channel gets its
 * `DEFAULT_PLACEMENT`, ordered within a zone by priority. Mechanical, not a
 * taste call — mirrors `computeZones`'s plan-driven path so the two only
 * differ in WHERE placement comes from.
 */
function legacyZones(channels: readonly ChannelId[]): AuthZones {
  const main: ChannelId[] = [];
  const bottom: ChannelId[] = [];
  const overflow: ChannelId[] = [];
  for (const id of channels) {
    const placement = clampNeverMain(id, DEFAULT_PLACEMENT[id]);
    const bucket = placement === "main" ? main : placement === "bottom" ? bottom : overflow;
    bucket.push(id);
  }
  if (main.length > 3) overflow.unshift(...main.splice(3));
  return { main, bottom, overflow };
}

/** Resolve one channel's placement: explicit `methods[]` entry (clamped for
 * the never-a-tab channels) → `DEFAULT_PLACEMENT` (a method a partial
 * `methods[]` is silent on) → `"main"`. */
function resolvePlacement(id: ChannelId, explicit: ChannelPlacement | undefined): ChannelPlacement {
  if (explicit) return clampNeverMain(id, explicit);
  return DEFAULT_PLACEMENT[id] ?? "main";
}

/**
 * Resolve one channel's click behaviour once it is NOT `"main"`: explicit
 * `methods[]` value → OAuth defaults to `"redirect"` (rendered as direct
 * provider buttons, no dialog — there is no form to show) → everything else
 * opens a dialog with that channel's panel.
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
 * §37/§54-tuning, points 1/3/4; stapel-auth 0.6.0's `AuthCapabilities.methods`):
 * when `methods` is present, each channel's placement/order come from its
 * `AuthMethodInfo` entry (`id` match); a channel `methods` is silent on falls
 * back to `DEFAULT_PLACEMENT`. When `methods` is entirely absent (older
 * backend), the whole list runs through `legacyZones`. Either way, `main` is
 * capped at 3 (ПРАВИЛО 4) as a skin-level guarantee — never a backend promise.
 */
export function computeZones(
  channels: readonly ChannelId[],
  methods?: readonly AuthMethodInfo[]
): AuthZones {
  if (!methods || methods.length === 0) return legacyZones(channels);

  const byId = new Map(methods.map((m) => [m.id, m] as const));
  const orderOf = new Map<ChannelId, number>();
  const main: ChannelId[] = [];
  const bottom: ChannelId[] = [];
  const overflow: ChannelId[] = [];
  for (const id of channels) {
    const info = byId.get(id);
    orderOf.set(id, info?.order ?? DEFAULT_CHANNEL_PRIORITY.indexOf(id));
    const placement = resolvePlacement(id, info?.placement);
    const bucket = placement === "main" ? main : placement === "bottom" ? bottom : overflow;
    bucket.push(id);
  }
  const byOrder = (a: ChannelId, b: ChannelId): number => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0);
  main.sort(byOrder);
  bottom.sort(byOrder);
  overflow.sort(byOrder);
  if (main.length > 3) {
    overflow.unshift(...main.splice(3));
    overflow.sort(byOrder);
  }
  return { main, bottom, overflow };
}

/** A channel's icon descriptor from the backend's `methods[]`, if present. */
export function methodIconSvg(
  id: ChannelId,
  methods: readonly AuthMethodInfo[] | undefined
): string | undefined {
  return methods?.find((m) => m.id === id)?.icon_svg;
}

/** A channel's `interaction` from the backend's `methods[]`, if present. */
export function methodInteraction(
  id: ChannelId,
  methods: readonly AuthMethodInfo[] | undefined
): ChannelInteraction | undefined {
  return methods?.find((m) => m.id === id)?.interaction;
}
