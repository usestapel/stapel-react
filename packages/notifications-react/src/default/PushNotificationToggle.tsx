/**
 * `<PushNotificationToggle/>` — one switch, and it tells the truth.
 *
 * Every position it can be in is derived from `GET /devices/` plus this
 * device's token fingerprint (see `headless/DeviceRegistration.tsx`). There is
 * no `useState(false)` here and nothing to flip optimistically: a registration
 * that fails leaves the switch where it was, because the switch is drawing the
 * server's answer and the server's answer did not change.
 *
 * What that fixes, concretely, is the defect the audit called this pair's
 * blocker:
 *
 *   - the switch used to render OFF on every mount even for a device that was
 *     receiving push;
 *   - after a reload it held no token, so `if (token) unregister(token)` sent
 *     NOTHING and the next line flipped the UI off anyway — the person
 *     believed push was disabled and the server kept sending;
 *   - `await props.getToken()` was unguarded, so the commonest real path (the
 *     permission prompt refused) rejected into `void handleChange(next)`, the
 *     switch sprang back, and no message appeared at all.
 *
 * All three are now states with their own sentence beside the control:
 * `denied`, `unsupported`, `unknown`, `inactive`. None of them is a switch
 * position guessed at.
 */
import type { ReactElement } from "react";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { DeviceRegistration } from "../headless/DeviceRegistration.js";
import type { Platform } from "../api/types.js";
import { PushToggleBody } from "./pushParts.js";

export interface PushNotificationToggleProps {
  /**
   * Obtain a push token for this device when the person turns notifications
   * ON. VAPID/APNs/FCM wiring is a host concern, not a headless module's, and
   * this is called only from a deliberate toggle — never on mount.
   */
  getToken(): Promise<string>;
  /**
   * The token this device ALREADY holds (`registration.pushManager
   * .getSubscription()`, a cached FCM token), or `null` when it holds none.
   * Must not prompt.
   *
   * Strongly recommended: without it the switch cannot find this device's row
   * in the registry after a reload, and honestly reports `unknown` rather than
   * drawing a position it does not know.
   */
  currentToken?: () => Promise<string | null>;
  /** Device platform sent with the registration. Default `"web"`. */
  platform?: Platform;
  /** `false` where the host knows push cannot work here at all. */
  supported?: boolean;
  /** Draw the heading above the control. `false` inside a pane that already
   * carries it. */
  heading?: boolean;
  /** What the skin paints under itself; `"bare"` inside a host-painted card. */
  surface?: SkinSurface;
  /** Pin the theme side (a demo showing both). Defaults to the live mode. */
  mode?: "light" | "dark";
}

export function PushNotificationToggle(
  props: PushNotificationToggleProps
): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface={props.surface ?? "raised"}
      data-testid="push-notification-toggle"
      style={{ width: "100%", padding: spacing[4] }}
    >
      <DeviceRegistration
        getToken={props.getToken}
        {...(props.currentToken !== undefined ? { currentToken: props.currentToken } : {})}
        {...(props.platform !== undefined ? { platform: props.platform } : {})}
        {...(props.supported !== undefined ? { supported: props.supported } : {})}
      >
        {(bag) => <PushToggleBody bag={bag} heading={props.heading ?? true} />}
      </DeviceRegistration>
    </SkinTheme>
  );
}
