/**
 * `<PushSettingsPane/>` — the push-notification settings screen: this device's
 * switch, and the account's device registry under it.
 *
 * The nav manifest routes this one (a `submenu` entry under
 * `profiles.settings`, the same placement `auth-react` gives `auth.security`),
 * because push is a per-account security surface and not a page of its own.
 *
 * ── One bag, two views ────────────────────────────────────────────────────
 *
 * Both halves read the SAME `<DeviceRegistration>`. Mounting one inside each
 * would give them separate token/fingerprint state, so the list could know
 * which row is this device while the switch above it did not — two components
 * disagreeing about one fact, which is how the original defect was shaped.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { DeviceRegistration } from "../headless/DeviceRegistration.js";
import type { Platform } from "../api/types.js";
import { PushDeviceListBody, PushToggleBody } from "./pushParts.js";

/** The reading measure a settings column stops growing at — element geometry,
 * not a viewport breakpoint, so the pane is right at 390px and at 1440px. */
const PANE_MEASURE = "44rem";

export interface PushSettingsPaneProps {
  /** Obtain a push token when the person turns push ON (may prompt). */
  getToken(): Promise<string>;
  /** The token this device already holds; must not prompt. */
  currentToken?: () => Promise<string | null>;
  platform?: Platform;
  supported?: boolean;
  surface?: SkinSurface;
  mode?: "light" | "dark";
}

export function PushSettingsPane(props: PushSettingsPaneProps): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface={props.surface ?? "base"}
      data-testid="push-settings-pane"
      style={{
        width: "100%",
        maxWidth: PANE_MEASURE,
        padding: spacing[4],
        minHeight: "100%",
      }}
    >
      <DeviceRegistration
        getToken={props.getToken}
        {...(props.currentToken !== undefined ? { currentToken: props.currentToken } : {})}
        {...(props.platform !== undefined ? { platform: props.platform } : {})}
        {...(props.supported !== undefined ? { supported: props.supported } : {})}
      >
        {(bag) => (
          <Flex vertical gap={spacing[6]}>
            <PushToggleBody bag={bag} heading />
            <PushDeviceListBody bag={bag} heading />
          </Flex>
        )}
      </DeviceRegistration>
    </SkinTheme>
  );
}
