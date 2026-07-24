/**
 * `<SecuritySettings/>` — a single composed "Security" settings page,
 * grouping this pair's `default/security/*` widgets into named sections
 * (SPEC point 4). Each widget self-wraps in its OWN `<Card title=…>` (see
 * every widget's own module doc) — this component only supplies the page
 * title/subtitle and the section grouping, it renders no settings UI itself
 * and adds no new backend surface.
 *
 * Grouping (owner spec, exact order):
 *   (a) Контактные данные   — EmailChangePanel, PhoneChangePanel
 *   (b) Пароль              — PasswordChangePanel
 *   (c) Двухфакторная       — TotpManager, PasskeysManager
 *   (d) Устройства и сессии — SessionsList, QrDeviceLinkPanel
 *   (e) Подключённые        — OAuthLinks
 *   (f) Журнал безопасности — AuditLogPanel
 *
 * Composed rather than left as ungrouped tabs because a host wiring
 * `@stapel/shell-react`'s nav needs ONE component per menu item — this reads
 * as one scrollable settings page with real section headings instead of a
 * flat stack (the ironmemo-port failure mode this rebuild fixes: no page
 * title, no per-section structure, a single `<Divider>`-separated blob). A
 * host that wants the pieces separately still can: every widget stays
 * individually exported from `./security/index.js`.
 */
import { Flex, Typography } from "antd";
import type { ReactElement, ReactNode } from "react";
import { useT } from "@stapel/core";
import type { WebauthnBinding } from "../headless/Passkey.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";
import { useCapabilities } from "../model/queries.js";
import { AuditLogPanel } from "./security/AuditLogPanel.js";
import { EmailChangePanel } from "./security/EmailChangePanel.js";
import { OAuthLinks } from "./security/OAuthLinks.js";
import { PasskeysManager } from "./security/PasskeysManager.js";
import { PasswordChangePanel } from "./security/PasswordChangePanel.js";
import { PhoneChangePanel } from "./security/PhoneChangePanel.js";
import { QrDeviceLinkPanel } from "./security/QrDeviceLinkPanel.js";
import { SessionsList } from "./security/SessionsList.js";
import { TotpManager } from "./security/TotpManager.js";

export interface SecuritySettingsProps {
  /** Drives the passkeys section's `navigator.credentials.create()` ceremony
   * automatically when supplied — see `PasskeysManagerProps`. */
  readonly webauthnCreate?: WebauthnBinding;
  /** Runs an OAuth provider's SDK/popup and resolves the resulting
   * `access_token` for the connected-accounts section — see
   * `OAuthLinksProps`. Omit to disable "Connect". */
  readonly getOAuthAccessToken?: (providerId: string) => Promise<string>;
  /** Where a QR-linked device lands after it receives this session — see
   * `QrDeviceLinkPanelProps.redirectUrl`. Defaults to `/`. */
  readonly qrRedirectUrl?: string;
  /** Shared empty-state glyph override, applied to every sub-widget that
   * accepts one (sessions, passkeys, oauth). */
  readonly emptyIcon?: ReactNode;
}

/** One grouped section: a heading + its widgets, stacked with `gap="middle"`
 * so each widget's own Card reads as a distinct block within the group. */
function Section(props: { heading: string; children: ReactNode }): ReactElement {
  return (
    <Flex vertical gap="middle" style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {props.heading}
      </Typography.Title>
      {props.children}
    </Flex>
  );
}

/** Full security settings page: page title/subtitle, then the widgets in
 * grouped, titled sections — sessions, TOTP, passkeys, password, email/phone
 * change, connected accounts, QR device linking, and the audit log. */
export function SecuritySettings(props: SecuritySettingsProps = {}): ReactElement {
  const t = useT();
  const caps = useCapabilities();
  // Hide the whole "Connected accounts" group when this deployment has no
  // OAuth providers configured at all — a heading over an empty-state card
  // reading "no providers configured" is dead chrome for a real end user
  // (owner: this section should disappear, not explain itself). Stays
  // hidden while capabilities are still loading too, so the section never
  // flashes in only to vanish once caps resolves.
  const hasOAuthProviders = (caps.data?.registration.oauth.length ?? 0) > 0;
  return (
    <Flex vertical gap="large" style={{ width: "100%" }} data-testid="security-settings">
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {t(AUTH_I18N_KEYS.secPageTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secPageSubtitle)}</Typography.Text>
      </div>

      <Section heading={t(AUTH_I18N_KEYS.secGroupContact)}>
        <EmailChangePanel />
        <PhoneChangePanel />
      </Section>

      <Section heading={t(AUTH_I18N_KEYS.secGroupPassword)}>
        <PasswordChangePanel />
      </Section>

      <Section heading={t(AUTH_I18N_KEYS.secGroupTwoFactor)}>
        <TotpManager />
        <PasskeysManager
          {...(props.webauthnCreate !== undefined ? { webauthnCreate: props.webauthnCreate } : {})}
          {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})}
        />
      </Section>

      <Section heading={t(AUTH_I18N_KEYS.secGroupDevices)}>
        <SessionsList {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})} />
        <QrDeviceLinkPanel
          {...(props.qrRedirectUrl !== undefined ? { redirectUrl: props.qrRedirectUrl } : {})}
        />
      </Section>

      {hasOAuthProviders && (
        <Section heading={t(AUTH_I18N_KEYS.secGroupConnected)}>
          <OAuthLinks
            {...(props.getOAuthAccessToken !== undefined
              ? { getAccessToken: props.getOAuthAccessToken }
              : {})}
            {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})}
          />
        </Section>
      )}

      <Section heading={t(AUTH_I18N_KEYS.secGroupAudit)}>
        <AuditLogPanel />
      </Section>
    </Flex>
  );
}
