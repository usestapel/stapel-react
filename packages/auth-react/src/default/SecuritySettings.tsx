/**
 * `<SecuritySettings/>` — a single composed "Security" settings screen
 * stacking this pair's six standalone `default/security/*` widgets
 * (`SessionsList`, `TotpManager`, `PasskeysManager`, `PasswordChangePanel`,
 * `OAuthLinks`, `QrDeviceLinkPanel`). Each widget already owns its own data
 * fetching, title, and empty state — this component adds no new backend
 * surface, it only lays them out as one navigable page (the nav-manifest
 * `"auth.security"` entry's component).
 *
 * Composed rather than left as six separate menu entries because a host
 * wiring `@stapel/shell-react`'s nav needs ONE component per menu item —
 * six ungrouped tabs would be a worse default than one scrollable settings
 * page with the pair's existing per-section titles standing in as headers.
 * A host that wants the pieces separately still can: every widget stays
 * individually exported from `./security/index.js`.
 */
import { Card, Divider, Flex } from "antd";
import type { ReactElement, ReactNode } from "react";
import type { WebauthnBinding } from "../headless/Passkey.js";
import { SessionsList } from "./security/SessionsList.js";
import { TotpManager } from "./security/TotpManager.js";
import { PasskeysManager } from "./security/PasskeysManager.js";
import { PasswordChangePanel } from "./security/PasswordChangePanel.js";
import { OAuthLinks } from "./security/OAuthLinks.js";
import { QrDeviceLinkPanel } from "./security/QrDeviceLinkPanel.js";

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

/** Full security settings screen: sessions, TOTP, passkeys, password,
 * connected accounts, and QR device linking — one page. */
export function SecuritySettings(props: SecuritySettingsProps = {}): ReactElement {
  return (
    <Card data-testid="security-settings">
      <Flex vertical gap="large">
        <SessionsList {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})} />
        <Divider style={{ margin: 0 }} />
        <TotpManager />
        <Divider style={{ margin: 0 }} />
        <PasskeysManager
          {...(props.webauthnCreate !== undefined ? { webauthnCreate: props.webauthnCreate } : {})}
          {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})}
        />
        <Divider style={{ margin: 0 }} />
        <PasswordChangePanel />
        <Divider style={{ margin: 0 }} />
        <OAuthLinks
          {...(props.getOAuthAccessToken !== undefined
            ? { getAccessToken: props.getOAuthAccessToken }
            : {})}
          {...(props.emptyIcon !== undefined ? { emptyIcon: props.emptyIcon } : {})}
        />
        <Divider style={{ margin: 0 }} />
        <QrDeviceLinkPanel
          {...(props.qrRedirectUrl !== undefined ? { redirectUrl: props.qrRedirectUrl } : {})}
        />
      </Flex>
    </Card>
  );
}
