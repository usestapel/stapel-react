/**
 * Channel discovery + zone-splitting for the default auth skin
 * (domain-guidelines-auth ПРАВИЛА 1-4, tuned per owner directive — see
 * AuthPanel.tsx's module doc). PURE — no React, no antd — so the mechanics
 * (which channels render, and how the priority-sorted list is cut into
 * main/bottom/overflow) are unit-testable in isolation from the markup.
 */
import type { AuthMethodInfo, ChannelInteraction, ChannelPlacement, LoginCapabilities } from "../api/types.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";
import type { AuthI18nKey } from "../i18n/keys.js";

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
 * Also the fallback WITHIN-ZONE ordering for a channel `AuthMethodInfo.order`
 * is silent on (see `computeZones`).
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
 * password/magic_link default to `overflow`. Used as the per-channel
 * fallback for a method a partial `methods[]` is silent on — NOT as a
 * substitute for `methods[]` itself (there is no supported backend that
 * omits it; see `computeZones`).
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
 * each channel's placement/order come from its `AuthMethodInfo` entry (`id`
 * match); a channel `methods` is silent on falls back to `DEFAULT_PLACEMENT`.
 * `main` is capped at 3 (ПРАВИЛО 4) as a skin-level guarantee — never a
 * backend promise.
 *
 * Alpha-canon (owner directive): there is no supported "old backend" — every
 * real deployment (миттудей, айронмемо) is kept upgraded to the latest
 * stapel-auth. A missing/empty `methods[]` on a NON-EMPTY channel list is
 * therefore a configuration error, not a signal to fall back to a fixed
 * placement table — it throws loudly instead of silently reproducing a
 * layout the backend never actually asked for. (An empty `channels` list —
 * e.g. capabilities still loading — is not an error: there is nothing to
 * place yet.)
 */
export function computeZones(
  channels: readonly ChannelId[],
  methods?: readonly AuthMethodInfo[]
): AuthZones {
  if (channels.length === 0) return { main: [], bottom: [], overflow: [] };
  if (!methods || methods.length === 0) {
    throw new Error(
      "@stapel/auth-react: capabilities().methods is missing — backend older than stapel-auth 0.6.0 is not supported. Upgrade the backend to stapel-auth ≥0.6.0."
    );
  }

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

/**
 * THE IDENTITY MODEL — the channels that can DEANONYMIZE, i.e. establish a
 * verified identity ANCHOR. Registration == deanonymization, so the
 * registration surface is exactly these and only these. Everything else is a
 * CREDENTIAL, not an anchor:
 *
 *  - `password` — setting a password on an anonymous session only makes that
 *    SAME guest account portable (loginable from another device); it does not
 *    create an identity and does not deanonymize. It is therefore NEVER a
 *    registration channel, regardless of the backend's `can_register` flag
 *    (that flag gates the deployment's `register()` primitive, which still
 *    requires a real anchor alongside the password — see stapel-auth's
 *    password/views.py `register()`). "Set a password" belongs on the login
 *    surface / account settings, not on the "create an account" screen.
 *  - `passkey`/`qr`/`magic_link` — login-only, no registration axis exists.
 */
export const REGISTRATION_ANCHORS: readonly ChannelId[] = [
  "email",
  "phone",
  "oauth",
  "sso",
];

/** Enabled channels FOR REGISTRATION, in priority order — the intersection of
 * the anchor channels (`anchors`, defaulting to `REGISTRATION_ANCHORS` — THE
 * IDENTITY MODEL) with the ones the backend marks `can_register === true` on
 * its per-method `methods[]` (stapel-auth ≥0.7.0). By default a non-anchor
 * channel (password/passkey/qr/magic_link) NEVER appears here even if a
 * backend sends `can_register: true` for it — registration is deanonymization,
 * and only an anchor deanonymizes.
 *
 * `anchors` is the CONFIGURABLE seam (owner directive 2026-07-20): a
 * deployment that deliberately wants classic login/password accounts
 * ("90s-style" — password IS the account and DOES deanonymize) passes its own
 * set INCLUDING `"password"`, wired from its app env. It must pair this with
 * the backend's `AUTH_PASSWORD_DEANONYMIZES=True` so the promote actually
 * happens server-side — the two knobs together, one per side. */
export function enabledRegistrationChannels(
  methods: readonly AuthMethodInfo[] | undefined,
  priority: readonly ChannelId[] = DEFAULT_CHANNEL_PRIORITY,
  anchors: readonly ChannelId[] = REGISTRATION_ANCHORS
): ChannelId[] {
  if (!methods) return [];
  const anchorSet = new Set<string>(anchors);
  const canRegister = new Set(
    methods.filter((m) => m.can_register && anchorSet.has(m.id)).map((m) => m.id)
  );
  return priority.filter((id) => canRegister.has(id));
}

/**
 * A method's display capability label (SecuritySettings widgets — owner
 * directive point 5's per-method-capability follow-up): "For sign-in" / "For
 * registration" / "Sign-in and registration", derived from `methods[]`'s
 * `can_login`/`can_register`.
 *
 * `password` + an ANONYMOUS viewer is a special case (THE IDENTITY MODEL):
 * password is a CREDENTIAL, never an anchor, so an anonymous account's
 * password never means "registration" no matter what `can_register` says
 * (that flag describes the deployment's `register()` capability, which
 * still requires a real anchor alongside the password — see
 * password/views.py `register()`). For that viewer, password's login
 * capability is reframed as making their SAME guest account portable
 * (loginable from another device) rather than a generic "For sign-in".
 */
export function methodCapabilityLabel(
  id: ChannelId,
  methods: readonly AuthMethodInfo[] | undefined,
  isAnonymous: boolean
): AuthI18nKey | undefined {
  const info = methods?.find((m) => m.id === id);
  if (!info) return undefined;
  if (id === "password" && isAnonymous && info.can_login) {
    return AUTH_I18N_KEYS.secMethodCapPortableAnon;
  }
  if (info.can_login && info.can_register) return AUTH_I18N_KEYS.secMethodCapBoth;
  if (info.can_register) return AUTH_I18N_KEYS.secMethodCapRegister;
  if (info.can_login) return AUTH_I18N_KEYS.secMethodCapLogin;
  return undefined;
}
