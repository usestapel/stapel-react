/**
 * `<AuthPanel/>` — the §54 pilot default skin for `@stapel/auth-react`. It is
 * the pair's existing headless layer (flows + `useCapabilities`) rendered with
 * an Ant Design skin whose theme comes AUTOMATICALLY from the user's
 * `@stapel/tokens` via `@stapel/tokens-antd`. Import it and you have a working,
 * themed sign-in screen — zero hand-written UI.
 *
 * Lives behind the `@stapel/auth-react/default` subpath so apps that build
 * their own visuals never pull `antd` into their bundle (§54 form).
 *
 * The layout follows domain-guidelines-auth exactly: four zones A-D in fixed
 * order (ПРАВИЛО 3), channels discovered from the backend and sorted by the
 * ratified priority (ПРАВИЛА 1-2), cut into ≤3 primary tabs + ≤2 secondary
 * buttons + a "More" overflow (ПРАВИЛО 4), with exactly one primary button per
 * screen (ПРАВИЛО 5).
 */
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  ConfigProvider,
  Divider,
  Dropdown,
  Flex,
  Spin,
  Tabs,
  Typography,
} from "antd";
import type { TabsProps } from "antd";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { useCapabilities } from "../model/queries.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";
import type { AuthI18nKey } from "../i18n/keys.js";
import {
  DEFAULT_CHANNEL_PRIORITY,
  enabledChannels,
  splitZones,
} from "./channels.js";
import type { ChannelId } from "./channels.js";
import {
  MagicLinkPanel,
  OtpPanel,
  PasskeyPanel,
  PasswordPanel,
  QrPanel,
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

/** Zone-B panel for a channel (SSO/OAuth redirect channels have no inline
 * panel here in the pilot — they surface as secondary buttons only). */
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
    case "oauth":
    case "sso":
      return null;
  }
}

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

  const channels = caps.data
    ? enabledChannels(caps.data.login, channelPriority)
    : [];
  const zones = splitZones(channels);
  const [active, setActive] = useState<ChannelId | null>(null);

  // Active tab: the user's pick if it is a primary tab, else the first primary.
  const primaryActive =
    active && zones.primary.includes(active) ? active : zones.primary[0];

  const tabs: TabsProps["items"] = zones.primary
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
    onClick: () => setActive(id),
  }));

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

        {/* Zone B — primary channels as tabs (or a lone form) */}
        {caps.isLoading ? (
          <Flex justify="center">
            <Spin />
          </Flex>
        ) : tabs.length <= 1 ? (
          tabs[0]?.children
        ) : (
          <Tabs
            {...(primaryActive ? { activeKey: primaryActive } : {})}
            onChange={(k) => setActive(k as ChannelId)}
            items={tabs}
          />
        )}

        {/* Zone C — secondary channels + "More" overflow */}
        {(zones.secondary.length > 0 || zones.overflow.length > 0) && (
          <>
            <Divider plain>{t(AUTH_I18N_KEYS.uiOr)}</Divider>
            <Flex vertical gap="small" style={{ width: "100%" }}>
              {zones.secondary.map((id) => (
                <SecondaryChannel
                  key={id}
                  id={id}
                  label={t(CHANNEL_LABEL[id])}
                  panel={channelPanel(id)}
                />
              ))}
              {overflowItems.length > 0 && (
                <Dropdown menu={{ items: overflowItems }}>
                  <Typography.Link>
                    {t(AUTH_I18N_KEYS.uiMoreMethods)}
                  </Typography.Link>
                </Dropdown>
              )}
            </Flex>
          </>
        )}
      </Flex>
    </ConfigProvider>
  );
}

/**
 * A zone-C secondary channel: a disclosure whose body is the same headless
 * panel used in zone B (redirect-only channels without an inline panel render
 * just their label). Kept inline (no modal) per the guideline spirit.
 */
function SecondaryChannel(props: {
  id: ChannelId;
  label: string;
  panel: ReactElement | null;
}): ReactElement {
  const [open, setOpen] = useState(false);
  if (!props.panel) {
    return <Typography.Text type="secondary">{props.label}</Typography.Text>;
  }
  return (
    <Flex vertical gap="small">
      <Typography.Link
        onClick={() => setOpen((o) => !o)}
        data-analytics="none"
        data-analytics-reason="local-ui-toggle-secondary-channel"
      >
        {props.label}
      </Typography.Link>
      {open && props.panel}
    </Flex>
  );
}
