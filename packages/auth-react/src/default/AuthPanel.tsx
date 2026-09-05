/**
 * `<AuthPanel/>` — the default skin for `@stapel/auth-react`. It is the
 * pair's existing headless layer (flows + `useCapabilities`) rendered with an
 * Ant Design skin whose theme comes AUTOMATICALLY from the user's
 * `@stapel/tokens` via `@stapel/tokens-antd`. Import it and you have a
 * working, themed sign-in screen — zero hand-written UI.
 *
 * Lives behind the `@stapel/auth-react/default` subpath so apps that build
 * their own visuals never pull `antd` into their bundle (§54 form).
 *
 * Layout (owner directive, tuning §54's pilot): every enabled channel is
 * sorted by priority (`channelPriority`, defaulting to the ratified
 * `DEFAULT_CHANNEL_PRIORITY`) then cut into three zones by `computeZones`
 * (`./channels.js`):
 *
 *  - **main** — up to 3 channels, rendered INLINE as tabs (or a lone form).
 *  - **bottom** — a persistent icon-button row beneath the form (social
 *    provider buttons + qr/passkey by default) — never a tab, never adds one.
 *  - **overflow** — behind the "More ways to sign in" three-dot menu; picking
 *    one opens a DIALOG with that channel's panel — a bottom sheet on a phone
 *    and a centred modal above the tablet breakpoint, which is not decided
 *    here: `@stapel/tokens-antd/skin`'s `SkinDialog` states that rule once for
 *    the whole fleet. It does NOT try to squeeze
 *    into the tab strip — that was the bug: an overflow pick used to set
 *    `active` to a channel absent from the tabs' own `items`, so nothing
 *    rendered at all.
 *
 * PASSKEY IS NOT A PANEL (owner ruling 2026-08-24). Clicking it raises the
 * browser's own WebAuthn prompt immediately; this skin renders nothing until
 * that prompt has an outcome, and then only if the outcome was not a sign-in.
 * The failure sheet names WHICH outcome it was — cancelled or no credential,
 * timed out, insecure origin, this browser cannot — and offers the action that
 * outcome deserves. What it replaced was a dialog containing a "Use a passkey"
 * button: two screens of ours in front of the one screen that decides
 * anything, neither of which the person had a choice to make on.
 *
 * SSO and OAuth are never a `main` tab (`computeZones` clamps this even if a
 * backend plan claims otherwise) — SSO's domain-lookup form and OAuth's
 * provider-button group both read badly as a single tab. OAuth additionally
 * never opens a dialog: each provider button is its own direct, full-page
 * redirect (`resolveInteraction` → `"redirect"`), so it renders identically
 * whether it's in the bottom row or (rarer) the overflow dialog.
 *
 * stapel-auth ≥0.6.0 drives all of this from the backend via
 * `capabilities.methods` (per-method `placement`/`order`/`interaction`/
 * `icon_svg` — see `api/types.ts`'s `AuthMethodInfo`). Alpha-canon (owner
 * directive): there is no supported older backend — every real deployment is
 * kept upgraded to the latest stapel-auth — so a missing/empty `methods[]`
 * is a configuration error `computeZones` throws on loudly, rather than a
 * signal to silently reproduce a fixed placement table.
 */
import { spacing, fontSize, radii } from "@stapel/tokens";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Divider,
  Dropdown,
  Flex,
  Spin,
  Tabs,
  Typography,
} from "antd";
import type { TabsProps } from "antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { SkinDialog, SkinTheme } from "@stapel/tokens-antd/skin";
import { SlotPlaceholder, useFormatFlowError, useT } from "@stapel/core";
import { usePasskeyLogin } from "../headless/Passkey.js";
import { passkeyFailureOf } from "../flows/errors.js";
import { isWebauthnSupported } from "../webauthn.js";
import { useCapabilities } from "../model/queries.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";
import type { AuthI18nKey } from "../i18n/keys.js";
import {
  DEFAULT_CHANNEL_PRIORITY,
  computeZones,
  enabledChannels,
  enabledRegistrationChannels,
  methodIconSvg,
  methodInteraction,
  resolveInteraction,
} from "./channels.js";
import type { ChannelId } from "./channels.js";
import type { AuthMethodInfo, SignupAttribution } from "../api/types.js";
import {
  MagicLinkPanel,
  OAuthPanel,
  OtpPanel,
  PasskeyPanel,
  PasswordPanel,
  PasswordRegisterPanel,
  QrPanel,
  SsoPanel,
} from "./panels.js";
import { AnonymousSession } from "../headless/misc.js";
import type { FlowError } from "../flows/errors.js";

/** A system notice for zone A's single Alert slot (RULE 3). */
export interface AuthPanelNotice {
  readonly type: "error" | "warning" | "info" | "success";
  /** An i18n key resolved with `t()`. */
  readonly key: string;
}

export interface AuthPanelProps {
  /**
   * Light or dark. DEFAULTS TO THE DOCUMENT'S LIVE MODE (`SkinTheme` →
   * `useThemeMode`), not to a side. It used to default to `"light"`, which
   * rendered light inputs and a black heading on a dark page — the `Create
   * account` title was effectively invisible under `<html data-theme="dark">`
   * (visual pass CF-1). Pass this only to PIN a side, e.g. a demo showing both.
   */
  readonly mode?: ThemeMode;
  /**
   * A wordmark, logo or product name above the form. Left out, a dev build
   * shows a slot placeholder and a production build shows nothing — the
   * sign-in screen is the one surface where a host's identity belongs, and an
   * unfilled slot should be visible to the person wiring it, not to the user.
   */
  readonly brand?: ReactNode;
  /**
   * The legal footer (terms, privacy). Same slot semantics as {@link brand}:
   * this pair cannot write a host's terms link, and inventing one would be
   * worse than saying it is missing.
   */
  readonly legal?: ReactNode;
  /**
   * `"login"` (default) renders every enabled LOGIN channel, same as always.
   * `"register"` renders a REGISTRATION surface instead — THE IDENTITY MODEL:
   * ONLY the channels that DEANONYMIZE by establishing a verified identity
   * anchor (email/phone/oauth/sso; see `enabledRegistrationChannels` +
   * `REGISTRATION_ANCHORS`), intersected with the backend's per-method
   * `can_register` (stapel-auth ≥0.7.0). Password/passkey/qr/magic_link NEVER
   * appear here: they are credentials, not anchors — setting a password does
   * not create an identity (it only makes a guest account portable), so it
   * has no place on a "create an account" screen. Named `variant`, not
   * `mode`, to avoid colliding with the light/dark `mode` prop above.
   */
  readonly variant?: "login" | "register";
  /** Override the channel order (RULE 2). Defaults to the ratified priority. */
  readonly channelPriority?: readonly ChannelId[];
  /**
   * Which channels count as REGISTRATION anchors on the `variant="register"`
   * surface. Defaults to `REGISTRATION_ANCHORS` (email/phone/oauth/sso — THE
   * IDENTITY MODEL, where registration == deanonymization). A deployment that
   * deliberately wants classic login/password accounts ("90s-style" — password
   * IS the account) passes its own set INCLUDING `"password"`, wired from its
   * app env, and MUST pair it with the backend's `AUTH_PASSWORD_DEANONYMIZES=
   * True` so the server actually promotes. Ignored on the login surface.
   */
  readonly registrationAnchors?: readonly ChannelId[];
  /** Optional zone-A system notice (session revoked, link expired, …). */
  readonly notice?: AuthPanelNotice;
  /**
   * Replace a channel's bottom-row / overflow-menu icon (keyed by
   * `ChannelId`). Takes precedence over the backend's `methods[].icon_svg`.
   */
  readonly iconOverrides?: Readonly<Partial<Record<ChannelId, ReactNode>>>;
  /**
   * Replace a specific OAuth PROVIDER's icon (keyed by provider id, e.g.
   * `"google"`, `"github"`) — finer-grained than `iconOverrides.oauth`,
   * which would replace the whole social button group at once.
   */
  readonly oauthIconOverrides?: Readonly<Record<string, ReactNode>>;
  /** Where an OAuth provider redirects back to. Default `location.href`. */
  readonly oauthRedirectUri?: string;
  /**
   * Suppress the sign-in ↔ create-account switch in the footer. The switch is
   * ON by default and flips this component's own surface — the register
   * variant used to be a dead end (one field, one button, no way back) and the
   * sign-in variant offered no way to register at all, so every host wired two
   * routes by hand to get the pair of doors every account system has.
   * A deployment that genuinely has no self-service registration passes
   * `false`; the switch also hides itself when the backend reports no
   * registration channel, so it is never a control that leads nowhere.
   */
  readonly showVariantSwitch?: boolean;
  /**
   * Offer "continue as a guest" on the sign-in surface. Default ON, tracking
   * the backend's `registration.anonymous` capability.
   *
   * Pass `false` on a host that mints guest accounts AUTOMATICALLY (see
   * `createAuthRuntime`'s `autoAnonymous`). There the choice is made by the
   * act — the visitor presses a heart and the account appears — and the
   * button becomes the thing it was removed for being on this exact
   * deployment once before: a control that answers a press with silence. It
   * mints a session and leaves the person on the sign-in screen, because a
   * guest is not a member and nothing on this page changes for them.
   *
   * This is not the client hiding a capability the server advertises. The
   * server's statement is "guest accounts exist here", and it stays true;
   * what the host is saying is that they are not obtained by pressing this.
   */
  readonly showGuestEntry?: boolean;
  /**
   * Who owns the frame (owner ruling 2026-09-02: pair visuals must never
   * force themselves on a host).
   *
   * - `"card"` (default): this panel paints its own page ground and floats
   *   its own raised card on it — a working sign-in SCREEN out of the box,
   *   exactly as before this prop existed.
   * - `"bare"`: NO page surface and NO card. Zones A–D render directly, so
   *   the host owns the frame, the width, the padding and the background —
   *   a host that already wraps this panel in its own branded card stops
   *   getting a card-in-card squeezed into that card's padding. The antd
   *   token algorithm still applies (`SkinTheme surface="bare"` themes
   *   without painting), and the brand/legal slots render ONLY when passed:
   *   no `SlotPlaceholder` even in a dev build, because a host that owns
   *   the chrome already states its identity outside the panel.
   */
  readonly chrome?: "card" | "bare";
  /**
   * WHICH HEADING LEVEL zone A's title takes. Default `3`, what this panel
   * has always rendered, so no existing host changes shape.
   *
   * The level is a fact about the DOCUMENT, not about this panel. Mounted on
   * its own `/sign-in` route the title IS the page's `<h1>`; mounted inside a
   * host's own branded card under the host's own `<h1>` (`chrome="bare"` —
   * the same composition that prop exists for) a second first-level heading
   * is an outline with two beginnings, and a panel in a dialog wants an
   * `<h2>`. Only the composing surface knows which, and it had no way to say.
   *
   * The words are unchanged: this moves the tag, never the copy.
   */
  readonly headingLevel?: 1 | 2 | 3;
  /**
   * WHERE THIS SIGN-UP CAME FROM — forwarded to the email/phone code panels,
   * which carry it on the verify call that registers the account. See
   * `SignupAttribution`; a function is read at the moment of the call, for a
   * capture that is itself still landing when the screen mounts.
   *
   * The panel neither captures nor interprets it: an advertising click
   * identifier is read off the landing URL minutes before any auth screen
   * exists, so only the host can hold it, and only the server decides whether
   * a given verify REGISTERS (where it is stored) or logs in (where it is
   * ignored).
   */
  readonly attribution?:
    | SignupAttribution
    | (() => SignupAttribution | undefined);
}

/**
 * The page ground the card floats on. `minHeight: 100%` (not `100vh`) keeps
 * the geometry ELEMENT-relative: the panel fills whatever box the host gives
 * it — a route outlet, a demo frame, a phone viewport — instead of measuring
 * the window and overflowing every container that is not the window.
 */
const PAGE_STYLE: CSSProperties = {
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: spacing[4],
  boxSizing: "border-box",
};

/**
 * The card. `maxWidth` in `rem` rather than px so it scales with the root
 * type size, and `width: 100%` so on a phone it is the column — the form's
 * element width, which every control inside then inherits (the visual pass
 * found two centred pills breaking an otherwise strictly full-width column).
 */
const CARD_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: "26rem",
  padding: spacing[6],
  borderRadius: radii.lg,
  boxSizing: "border-box",
};

const CHANNEL_LABEL: Record<ChannelId, AuthI18nKey> = {
  email: AUTH_I18N_KEYS.uiChannelEmail,
  phone: AUTH_I18N_KEYS.uiChannelPhone,
  password: AUTH_I18N_KEYS.uiChannelPassword,
  passkey: AUTH_I18N_KEYS.uiChannelPasskey,
  oauth: AUTH_I18N_KEYS.uiChannelOauth,
  sso: AUTH_I18N_KEYS.uiChannelSso,
  qr: AUTH_I18N_KEYS.uiChannelQr,
  magic_link: AUTH_I18N_KEYS.uiChannelMagicLink,
};

/**
 * The rendered sign-in screen. Must sit under the pair's `<AuthProvider>` (for
 * the runtime) and a core `<I18nProvider>` (for copy) — the standard pair
 * wiring; this component adds only the visual layer + theme.
 */
export function AuthPanel(props: AuthPanelProps): ReactElement {
  const { channelPriority = DEFAULT_CHANNEL_PRIORITY } = props;
  const t = useT();
  const formatError = useFormatFlowError();
  const caps = useCapabilities();
  const [openChannel, setOpenChannel] = useState<ChannelId | null>(null);
  const [active, setActive] = useState<ChannelId | null>(null);
  // The surface the person is on RIGHT NOW. `props.variant` seeds it (a host
  // routing `/register` still lands on the register surface) and the footer
  // switch moves between them without a second route.
  const [picked, setPicked] = useState<"login" | "register" | null>(null);
  const variant = picked ?? props.variant ?? "login";

  // ── Passkey: the system prompt IS the first screen ──────────────────────
  //
  // Owner ruling (2026-08-24). This used to open OUR dialog and put a "Use a
  // passkey" button inside it, so the person pressed "Passkey", read a panel,
  // pressed a second button, and only THEN saw the thing the operating system
  // was going to ask them anyway. Two of the three screens were ours and
  // neither of them decided anything.
  //
  // Now `pick("passkey")` raises `navigator.credentials.get()` immediately and
  // renders nothing. A sheet appears only when the ceremony did NOT sign the
  // person in — and then it is about that specific outcome, with the other
  // methods one tap behind it. The dialog is a FALLBACK, not a preamble.
  //
  // The flow lives here rather than inside `PasskeyPanel` because a render
  // prop cannot be driven from outside the subtree it renders, and the button
  // that starts this is outside.
  const passkey = usePasskeyLogin();
  const passkeyError = passkey.state.step === "error" ? passkey.state.error : undefined;
  const [passkeyFallback, setPasskeyFallback] = useState(false);
  useEffect(() => {
    if (passkeyError !== undefined) setPasskeyFallback(true);
  }, [passkeyError]);
  const passkeyBusy =
    passkey.state.step === "beginning" ||
    passkey.state.step === "awaitingAssertion" ||
    passkey.state.step === "completing";
  function closePasskeyFallback(): void {
    setPasskeyFallback(false);
    passkey.reset();
  }

  const login = caps.data?.login;
  const registration = caps.data?.registration;
  const methods = caps.data?.methods;
  const channels =
    variant === "register"
      ? enabledRegistrationChannels(methods, channelPriority, props.registrationAnchors)
      : login
        ? enabledChannels(login, channelPriority)
        : [];
  const zones = computeZones(channels, methods);
  const oauthProviders = (variant === "register" ? registration?.oauth : login?.oauth) ?? [];

  /** Zone-B/dialog panel for a channel. OAuth/SSO get real panels now (a
   * provider-button group and a domain-lookup form respectively) — they were
   * `null` in the §54 pilot, which silently dropped them whenever they landed
   * outside a tab. */
  /**
   * `asMainTab` (owner UX audit 2026-07-17): a main-tab panel must not
   * repeat its own tab label as a field label ("Email" tab + "Email" field
   * label reads as "Email Email") — only `OtpPanel` actually has a field
   * label matching its own channel label, so it is the only one that reads
   * the flag. The overflow/bottom dialog has no tab label in view, so it
   * always gets the full (labelled) panel.
   */
  const otpAttribution =
    props.attribution !== undefined ? { attribution: props.attribution } : {};
  function channelPanel(id: ChannelId, opts?: { asMainTab?: boolean }): ReactElement | null {
    switch (id) {
      case "email":
        return <OtpPanel channel="email" {...otpAttribution} {...(opts?.asMainTab !== undefined ? { hideChannelLabel: opts.asMainTab } : {})} />;
      case "phone":
        return <OtpPanel channel="phone" {...otpAttribution} {...(opts?.asMainTab !== undefined ? { hideChannelLabel: opts.asMainTab } : {})} />;
      case "password":
        // By default password is a credential, never a registration anchor,
        // so `enabledRegistrationChannels` does not route it here on the
        // register surface (THE IDENTITY MODEL). A deployment can opt password
        // IN as an anchor via `registrationAnchors` (90s-style login/password
        // accounts) — only THEN does `password` reach this branch on the
        // register surface, and it must render the SET-password form
        // (`PasswordRegisterPanel`), not the login one (`PasswordPanel`).
        return variant === "register" ? <PasswordRegisterPanel /> : <PasswordPanel />;
      case "qr":
        return <QrPanel />;
      case "passkey":
        return <PasskeyPanel />;
      case "magic_link":
        return <MagicLinkPanel />;
      case "sso":
        return <SsoPanel />;
      case "oauth":
        return oauthProviders.length > 0 ? (
          <OAuthPanel
            providers={oauthProviders}
            {...(props.oauthRedirectUri !== undefined
              ? { redirectUri: props.oauthRedirectUri }
              : {})}
            {...(props.oauthIconOverrides !== undefined
              ? { iconOverrides: props.oauthIconOverrides }
              : {})}
          />
        ) : null;
    }
  }

  // Active tab: the user's pick if it is a main tab, else the first main one.
  const mainActive = active && zones.main.includes(active) ? active : zones.main[0];

  // A lone main channel renders as a bare form (no `<Tabs>` strip at all —
  // see the render below), so its own field label is the ONLY label in
  // view and must stay. Only suppress it when a REAL tab strip renders
  // (`zones.main.length > 1`), which is the only case with a tab label to
  // actually duplicate.
  const asMainTab = zones.main.length > 1;
  const tabs: TabsProps["items"] = zones.main
    .map((id) => {
      const panel = channelPanel(id, { asMainTab });
      return panel
        ? { key: id, label: t(CHANNEL_LABEL[id]), children: panel }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const overflowItems = zones.overflow.map((id) => ({
    key: id,
    label: t(CHANNEL_LABEL[id]),
    icon: (
      <ChannelIcon override={props.iconOverrides?.[id]} svg={methodIconSvg(id, methods)} />
    ),
    onClick: () => pick(id),
  }));

  /**
   * Pick an overflow/bottom channel (owner directive point 1: this used to
   * `setActive` and hope the tab strip picked it up — it never did, because
   * `tabs` is built from `zones.main` alone. Now every non-main channel opens
   * a DIALOG with its own panel, except OAuth (a direct provider redirect —
   * `resolveInteraction` returns `"redirect"`, so there's nothing to open).
   */
  function pick(id: ChannelId): void {
    const placement = zones.bottom.includes(id) ? "bottom" : "overflow";
    const interaction = resolveInteraction(id, placement, methodInteraction(id, methods));
    if (interaction === "redirect") return; // OAuth: the button IS the action.
    if (id === "passkey") {
      // A browser with no WebAuthn will never show a prompt, so calling
      // `begin()` would park the flow on `awaitingAssertion` for ever behind a
      // spinner. Say so instead, in the same sheet the failures use.
      if (!isWebauthnSupported()) {
        setPasskeyFallback(true);
        return;
      }
      passkey.reset();
      passkey.begin();
      return;
    }
    setOpenChannel(id);
  }

  const canRegister =
    (caps.data !== undefined &&
      enabledRegistrationChannels(methods, channelPriority, props.registrationAnchors)
        .length > 0) ||
    (caps.data?.registration.anonymous ?? false);
  // The switch is a real door or it is not there. It renders only when the
  // other side actually has something on it: no registration channel means no
  // "Create an account" link that leads to an empty screen.
  const showSwitch =
    (props.showVariantSwitch ?? true) && (variant === "register" || canRegister);
  // Guest entry: the backend's capability AND the host's willingness to
  // offer it as a manual choice. See `showGuestEntry`.
  const showGuestEntry =
    (props.showGuestEntry ?? true) &&
    variant === "login" &&
    (caps.data?.registration.anonymous ?? false);

  // Who owns the frame — see the `chrome` prop. `"bare"` must render no
  // surface of ours AND no dev placeholder: an unfilled slot is a message for
  // the developer wiring the CARD chrome; a host that took the chrome for
  // itself already answered it.
  const bare = props.chrome === "bare";

  /** Zones A–D — the panel's content, identical under either chrome. */
  const zoneContent = (
        <Flex vertical gap="large" style={{ width: "100%" }} data-testid="auth-panel">
          {/* Zone A — brand, title, and the single system-notice slot */}
          <Flex vertical gap="small">
            {props.brand ?? (bare ? null : <SlotPlaceholder name="brand" />)}
            <Typography.Title
              level={props.headingLevel ?? 3}
              style={{ margin: 0 }}
              data-testid="auth-panel-title"
            >
              {t(
                variant === "register"
                  ? AUTH_I18N_KEYS.uiRegisterTitle
                  : AUTH_I18N_KEYS.uiLoginTitle
              )}
            </Typography.Title>
          </Flex>
          {props.notice && (
            <Alert
              type={props.notice.type}
              title={t(props.notice.key)}
              showIcon
            />
          )}

          {/* Zone B — main channels as tabs (or a lone form) */}
          {caps.isLoading ? (
            <Flex justify="center" role="status" aria-busy="true">
              <Spin />
            </Flex>
          ) : tabs.length <= 1 ? (
            tabs[0]?.children
          ) : (
            <Tabs
              {...(mainActive ? { activeKey: mainActive } : {})}
              onChange={(k) => setActive(k as ChannelId)}
              items={tabs}
            />
          )}

          {/* Zone C — the alternative methods and the overflow menu. Each one
              is a FULL-WIDTH row in the same column geometry as the form above
              it: they used to be narrow centred pills inside an otherwise
              strictly full-width, left-aligned form, which read as a caption
              rather than as peer actions (visual pass C8). */}
          {(zones.bottom.length > 0 || overflowItems.length > 0) && (
            <Flex vertical gap="small" style={{ width: "100%" }}>
              <Divider plain>{t(AUTH_I18N_KEYS.uiOr)}</Divider>
              {zones.bottom.length > 0 && (
                <BottomRow
                  ids={zones.bottom}
                  oauthProviders={oauthProviders}
                  onPick={pick}
                  busyId={passkeyBusy ? "passkey" : null}
                  labelFor={(id) => t(CHANNEL_LABEL[id])}
                  {...(methods !== undefined ? { methods } : {})}
                  {...(props.iconOverrides !== undefined
                    ? { iconOverrides: props.iconOverrides }
                    : {})}
                  {...(props.oauthRedirectUri !== undefined
                    ? { oauthRedirectUri: props.oauthRedirectUri }
                    : {})}
                  {...(props.oauthIconOverrides !== undefined
                    ? { oauthIconOverrides: props.oauthIconOverrides }
                    : {})}
                />
              )}
              {overflowItems.length > 0 && (
                <Dropdown menu={{ items: overflowItems }} trigger={["click"]}>
                  <Button
                    block
                    type="text"
                    data-analytics="none"
                    data-analytics-reason="local-ui-open-overflow-menu"
                  >
                    {t(AUTH_I18N_KEYS.uiMoreMethods)}
                  </Button>
                </Dropdown>
              )}
            </Flex>
          )}

          {/* The FOOTER — where the escape hatches belong. Guest entry and the
              sign-in ↔ register switch used to sit in the primary column at
              the same width and weight as the primary action, so "Continue as
              guest" read as loud as "Send code" (visual pass C2). */}
          {(showSwitch || showGuestEntry || props.legal !== undefined) && (
            <Flex vertical gap="small" style={{ width: "100%" }}>
              <Divider style={{ margin: 0 }} />
              {/* Guest entry (owner directive 2026-07-17): NOT a
                  placement-tracked channel — a fixed skin element shown
                  whenever the backend allows anonymous registration. LOGIN
                  surface only: the registration surface is already the
                  "create an account" screen. */}
              {showGuestEntry && (
                <AnonymousSession>
                  {(bag) => {
                    const err =
                      bag.state.step === "error" ? bag.state.error : undefined;
                    return (
                      <Flex vertical gap={spacing[1]} style={{ width: "100%" }}>
                        <Button
                          block
                          type="text"
                          loading={bag.state.step === "creating"}
                          onClick={() => bag.create()}
                          data-analytics="flow"
                        >
                          {bag.state.step === "creating"
                            ? t(AUTH_I18N_KEYS.uiContinueAsGuestPending)
                            : t(AUTH_I18N_KEYS.uiContinueAsGuest)}
                        </Button>
                        <Typography.Text
                          type="secondary"
                          style={{
                            fontSize: fontSize.xs.fontSize,
                            textAlign: "center",
                          }}
                        >
                          {t(AUTH_I18N_KEYS.uiContinueAsGuestHint)}
                        </Typography.Text>
                        {err && (
                          <Typography.Text type="danger">
                            {formatError(err)}
                          </Typography.Text>
                        )}
                      </Flex>
                    );
                  }}
                </AnonymousSession>
              )}
              {showSwitch && (
                <Button
                  block
                  type="link"
                  onClick={() =>
                    setPicked(variant === "register" ? "login" : "register")
                  }
                  data-testid="auth-variant-switch"
                  data-analytics="none"
                  data-analytics-reason="local-ui-switch-auth-surface"
                >
                  {t(
                    variant === "register"
                      ? AUTH_I18N_KEYS.uiSwitchToLogin
                      : AUTH_I18N_KEYS.uiSwitchToRegister
                  )}
                </Button>
              )}
              {props.legal ?? (bare ? null : <SlotPlaceholder name="legal" />)}
            </Flex>
          )}
        </Flex>
  );

  /** The dialogs ride beside the zones under BOTH chromes — they portal out
   * of the layout anyway, so the chrome owns nothing about them. */
  const dialogs = (
    <>
      {/* The alt-method dialog (owner directive point 1): picking anything
          from the bottom row or the overflow menu (other than a direct OAuth
          redirect, or a passkey — see below) opens THIS, never a phantom
          fourth tab. Which SHAPE it takes is not decided here any more: a
          phone gets a bottom sheet and everything else a centred modal,
          stated once in `@stapel/tokens-antd/skin`. */}
      <SkinDialog
        open={openChannel !== null}
        onClose={() => setOpenChannel(null)}
        dismissLabel={t(AUTH_I18N_KEYS.uiClose)}
        data-testid="auth-channel-dialog"
        {...(openChannel ? { title: t(CHANNEL_LABEL[openChannel]) } : {})}
      >
        {openChannel ? channelPanel(openChannel) : null}
      </SkinDialog>

      {/* The passkey FALLBACK. Not a step in the passkey journey — the system
          prompt is the whole journey when it works. This is what is left when
          it did not: one sentence naming the actual outcome (cancelled or no
          credential / timed out / insecure origin / this browser cannot),
          the action that outcome deserves, and the door back to the other
          methods. */}
      <SkinDialog
        open={passkeyFallback}
        onClose={closePasskeyFallback}
        title={t(AUTH_I18N_KEYS.uiPasskeyFailedTitle)}
        dismissLabel={t(AUTH_I18N_KEYS.uiClose)}
        data-testid="auth-passkey-fallback"
      >
        <PasskeyFallbackBody
          error={passkeyError}
          onRetry={() => {
            setPasskeyFallback(false);
            passkey.reset();
            passkey.begin();
          }}
          onPickAnother={() => {
            closePasskeyFallback();
            setOpenChannel(null);
          }}
        />
      </SkinDialog>
    </>
  );

  // The BARE chrome (owner ruling 2026-09-02): no page ground, no card — the
  // host's own frame is the frame. `surface="bare"` still applies the antd
  // token algorithm (light/dark, brand, the phone control floor) but paints
  // nothing, so the host's background and padding stay the host's.
  if (bare) {
    return (
      <SkinTheme
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        surface="bare"
      >
        {zoneContent}
        {dialogs}
      </SkinTheme>
    );
  }

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
      style={PAGE_STYLE}
      data-testid="auth-panel-page"
    >
      {/* The CARD. Before this, the panel painted no surface of its own: the
          form floated on the host page, which is why dark mode produced
          light-theme text on a near-black background (visual pass CF-1/C10)
          and why a desktop sign-in was a bare 656px column of controls with
          no anchor. One raised surface fixes the legibility, gives the brand
          and legal slots somewhere to live, and makes "the form's width" a
          real measurement every control inside can inherit. A host that
          already HAS a card of its own opts out with `chrome="bare"` above. */}
      <SkinTheme surface="raised" style={CARD_STYLE}>
        {zoneContent}
      </SkinTheme>
      {dialogs}
    </SkinTheme>
  );
}

/**
 * What the fallback sheet says, per outcome.
 *
 * Five situations used to render one sentence — "Something went wrong. Please
 * try again." — because a `navigator.credentials` rejection is a DOMException,
 * not a `StapelApiError`, and the generic fold swallowed the difference. The
 * classification now happens in the flow (`toPasskeyFlowError`), and this is
 * where it earns its keep: the outcome decides not just the words but WHICH
 * ACTION is on screen.
 *
 *  - **timed out / the authenticator refused** — "Try again" is real advice,
 *    so the button is there and it is primary.
 *  - **cancelled, or no passkey on this device** — WebAuthn will not tell us
 *    which (saying so would make the prompt an oracle for whether an account
 *    exists here), so the copy says both and the primary action is the OTHER
 *    methods. Offering "try again" for a device with no credential is telling
 *    someone to repeat the thing that cannot work.
 *  - **this browser cannot do passkeys / insecure origin** — nothing to retry
 *    at all. No retry button is rendered; a disabled one would just be a
 *    second way of saying no.
 */
function PasskeyFallbackBody(props: {
  error: FlowError | undefined;
  onRetry: () => void;
  onPickAnother: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  // No error at all is the unsupported-browser path: `pick()` opens this sheet
  // without starting a ceremony, because a ceremony here never resolves.
  const failure = props.error ? passkeyFailureOf(props.error) : "unsupported";
  const message = props.error
    ? formatError(props.error)
    : t(AUTH_I18N_KEYS.passkeyUnsupported);
  const retryable = failure === "timeout" || failure === "failed";
  return (
    <Flex vertical gap="middle" data-testid="auth-passkey-fallback-body">
      <Alert
        type={retryable ? "warning" : "info"}
        showIcon
        title={message}
        data-passkey-failure={failure ?? "failed"}
      />
      <Flex gap="small" wrap>
        {retryable && (
          <Button
            type="primary"
            onClick={props.onRetry}
            data-analytics="none"
            data-analytics-reason="local-ui-retry-passkey-ceremony"
          >
            {t(AUTH_I18N_KEYS.uiRetry)}
          </Button>
        )}
        <Button
          {...(retryable ? {} : { type: "primary" as const })}
          onClick={props.onPickAnother}
          data-analytics="none"
          data-analytics-reason="local-ui-dismiss-passkey-fallback"
        >
          {t(AUTH_I18N_KEYS.uiPasskeyPickAnother)}
        </Button>
      </Flex>
    </Flex>
  );
}

/** An icon for a channel: a host override wins; otherwise the backend's own
 * `methods[].icon_svg` (stapel-auth ≥0.6.0, sanitized upstream) renders as
 * raw inline SVG; otherwise no icon (the label carries the button). */
function ChannelIcon(props: { override?: ReactNode; svg?: string | undefined }): ReactElement | null {
  if (props.override !== undefined) return <>{props.override}</>;
  if (props.svg) {
    return (
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", width: spacing[4], height: spacing[4] }}
        dangerouslySetInnerHTML={{ __html: props.svg }}
      />
    );
  }
  return null;
}

/** The persistent bottom icon row: OAuth renders its provider-button group
 * directly (no dialog, per `resolveInteraction`); every other bottom channel
 * (qr, passkey by default, or anything the backend places here) renders a
 * single icon button that opens the shared dialog above. */
function BottomRow(props: {
  ids: readonly ChannelId[];
  oauthProviders: Parameters<typeof OAuthPanel>[0]["providers"];
  onPick: (id: ChannelId) => void;
  /** The channel whose ceremony is running RIGHT NOW, if any. Passkey raises
   * the system prompt straight off this button and opens nothing of ours, so
   * without this the button is the only place a person can see that anything
   * is happening at all. */
  busyId: ChannelId | null;
  labelFor: (id: ChannelId) => string;
  methods?: readonly AuthMethodInfo[];
  iconOverrides?: Readonly<Partial<Record<ChannelId, ReactNode>>>;
  oauthRedirectUri?: string;
  oauthIconOverrides?: Readonly<Record<string, ReactNode>>;
}): ReactElement {
  return (
    <Flex vertical gap="small" style={{ width: "100%" }} data-testid="auth-bottom-row">
      {props.ids.map((id) =>
        id === "oauth" ? (
          <OAuthPanel
            key="oauth"
            providers={props.oauthProviders}
            {...(props.oauthRedirectUri !== undefined
              ? { redirectUri: props.oauthRedirectUri }
              : {})}
            {...(props.oauthIconOverrides !== undefined
              ? { iconOverrides: props.oauthIconOverrides }
              : {})}
          />
        ) : (
          <Button
            key={id}
            block
            loading={props.busyId === id}
            icon={
              <ChannelIcon
                override={props.iconOverrides?.[id]}
                svg={methodIconSvg(id, props.methods)}
              />
            }
            onClick={() => props.onPick(id)}
            data-analytics="none"
            data-analytics-reason="local-ui-open-bottom-row-channel"
          >
            {props.labelFor(id)}
          </Button>
        )
      )}
    </Flex>
  );
}
