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
 *    one opens a DIALOG with that channel's panel. It does NOT try to squeeze
 *    into the tab strip — that was the bug: an overflow pick used to set
 *    `active` to a channel absent from the tabs' own `items`, so nothing
 *    rendered at all.
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
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  ConfigProvider,
  Divider,
  Drawer,
  Dropdown,
  Flex,
  Modal,
  Spin,
  Tabs,
  Typography,
} from "antd";
import type { TabsProps } from "antd";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useBreakpoint, useT } from "@stapel/core";
import { useCapabilities } from "../model/queries.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";
import type { AuthI18nKey } from "../i18n/keys.js";
import {
  DEFAULT_CHANNEL_PRIORITY,
  computeZones,
  enabledChannels,
  methodIconSvg,
  methodInteraction,
  resolveInteraction,
} from "./channels.js";
import type { ChannelId } from "./channels.js";
import type { AuthMethodInfo } from "../api/types.js";
import {
  MagicLinkPanel,
  OAuthPanel,
  OtpPanel,
  PasskeyPanel,
  PasswordPanel,
  QrPanel,
  SsoPanel,
} from "./panels.js";

/** A system notice for zone A's single Alert slot (ПРАВИЛО 3). */
export interface AuthPanelNotice {
  readonly type: "error" | "warning" | "info" | "success";
  /** An i18n key resolved with `t()`. */
  readonly key: string;
}

export interface AuthPanelProps {
  /**
   * Light or dark. The theme is derived from `@stapel/tokens` via
   * `toAntdThemeConfig(mode)` — no manual token wiring. Default `"light"`.
   */
  readonly mode?: ThemeMode;
  /** Override the channel order (ПРАВИЛО 2). Defaults to the ratified priority. */
  readonly channelPriority?: readonly ChannelId[];
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
}

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
  const { mode = "light", channelPriority = DEFAULT_CHANNEL_PRIORITY } = props;
  const t = useT();
  const theme = useMemo(() => toAntdThemeConfig(mode), [mode]);
  const caps = useCapabilities();
  const [openChannel, setOpenChannel] = useState<ChannelId | null>(null);
  const [active, setActive] = useState<ChannelId | null>(null);
  // UX reference: Waylot's sign-in sheet keeps every alt method in ONE bottom
  // sheet on mobile rather than a separate page. `useBreakpoint` (already in
  // `@stapel/core`) makes that cheap here too — same dialog content, just a
  // `Drawer` sliding up from the bottom on phones instead of a centred
  // `Modal` on tablet/desktop.
  const isPhone = useBreakpoint() === "phone";

  const login = caps.data?.login;
  const methods = caps.data?.methods;
  const channels = login ? enabledChannels(login, channelPriority) : [];
  const zones = computeZones(channels, methods);
  const oauthProviders = login?.oauth ?? [];

  /** Zone-B/dialog panel for a channel. OAuth/SSO get real panels now (a
   * provider-button group and a domain-lookup form respectively) — they were
   * `null` in the §54 pilot, which silently dropped them whenever they landed
   * outside a tab. */
  function channelPanel(id: ChannelId): ReactElement | null {
    switch (id) {
      case "email":
        return <OtpPanel channel="email" />;
      case "phone":
        return <OtpPanel channel="phone" />;
      case "password":
        return <PasswordPanel />;
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

  const tabs: TabsProps["items"] = zones.main
    .map((id) => {
      const panel = channelPanel(id);
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
    setOpenChannel(id);
  }

  return (
    <ConfigProvider theme={theme}>
      <Flex vertical gap="large" style={{ width: "100%" }} data-testid="auth-panel">
        {/* Zone A — title + the single system-notice slot */}
        <Typography.Title level={3}>
          {t(AUTH_I18N_KEYS.uiLoginTitle)}
        </Typography.Title>
        {props.notice && (
          <Alert
            type={props.notice.type}
            message={t(props.notice.key)}
            showIcon
          />
        )}

        {/* Zone B — main channels as tabs (or a lone form) */}
        {caps.isLoading ? (
          <Flex justify="center">
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

        {/* Zone C — the bottom icon row (social + qr/passkey by default) and
            the "More ways to sign in" overflow menu. */}
        {(zones.bottom.length > 0 || overflowItems.length > 0) && (
          <Flex vertical gap="small" style={{ width: "100%" }}>
            <Divider plain>{t(AUTH_I18N_KEYS.uiOr)}</Divider>
            {zones.bottom.length > 0 && (
              <BottomRow
                ids={zones.bottom}
                oauthProviders={oauthProviders}
                onPick={pick}
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
              <Flex justify="center">
                <Dropdown menu={{ items: overflowItems }} trigger={["click"]}>
                  <Typography.Link data-analytics="none" data-analytics-reason="local-ui-open-overflow-menu">
                    {t(AUTH_I18N_KEYS.uiMoreMethods)}
                  </Typography.Link>
                </Dropdown>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>

      {/* The alt-method dialog (owner directive point 1): picking anything
          from the bottom row or the overflow menu (other than a direct OAuth
          redirect) opens THIS, never a phantom fourth tab. A Modal on
          tablet/desktop, a bottom Drawer ("sheet") on phone. */}
      {isPhone ? (
        <Drawer
          open={openChannel !== null}
          title={openChannel ? t(CHANNEL_LABEL[openChannel]) : undefined}
          onClose={() => setOpenChannel(null)}
          placement="bottom"
          size="large"
          destroyOnHidden
        >
          {openChannel ? channelPanel(openChannel) : null}
        </Drawer>
      ) : (
        <Modal
          open={openChannel !== null}
          title={openChannel ? t(CHANNEL_LABEL[openChannel]) : undefined}
          onCancel={() => setOpenChannel(null)}
          footer={null}
          destroyOnHidden
        >
          {openChannel ? channelPanel(openChannel) : null}
        </Modal>
      )}
    </ConfigProvider>
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
        style={{ display: "inline-flex", width: 16, height: 16 }}
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
  labelFor: (id: ChannelId) => string;
  methods?: readonly AuthMethodInfo[];
  iconOverrides?: Readonly<Partial<Record<ChannelId, ReactNode>>>;
  oauthRedirectUri?: string;
  oauthIconOverrides?: Readonly<Record<string, ReactNode>>;
}): ReactElement {
  return (
    <Flex wrap gap="small" justify="center" data-testid="auth-bottom-row">
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
