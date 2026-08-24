/**
 * `<PushDeviceList/>` — every device your account sends push to, and the way
 * to stop sending to one.
 *
 * This is the product half of `GET /devices/` (stapel-notifications 0.17.0).
 * The toggle answers "is push on HERE"; this answers the question a person
 * actually opens a security page to ask — *what else is receiving my
 * notifications, and how do I get rid of it?* Before the list endpoint existed
 * there was no answer at all, and an old phone kept getting push forever.
 *
 * ── Three rules the rows follow, each from the backend's own reasoning ────
 *
 * 1. **Inactive rows are shown, marked.** `is_active: false` means the push
 *    provider rejected the token: registered, delivered nothing. Hiding those
 *    rows would render the account as smaller than it is; showing them
 *    unmarked would claim delivery that is not happening.
 * 2. **This device is named** — the row whose fingerprint matches the token
 *    this browser holds, so removing it is not a guess. That requires
 *    `currentToken`; without it no row is marked and none is mismarked.
 * 3. **Removal goes by ID, never by token.** A client cannot produce the token
 *    of any device but its own, so `DELETE /devices/by-id/{id}/` is the only
 *    honest road. A stale id answers `error.404.device_not_found`, and the
 *    invalidated read then corrects the list.
 *
 * `last_seen` is rendered as "Last registered …", not "Last seen": the column
 * records registrations (clients re-register on launch), not deliveries, and a
 * label promising the second would be a lie on somebody's security page.
 */
import type { ReactElement } from "react";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { DeviceRegistration } from "../headless/DeviceRegistration.js";
import { PushDeviceListBody } from "./pushParts.js";

export interface PushDeviceListProps {
  /** The token this device already holds, so its row can be marked. Must not
   * prompt — see `PushNotificationToggle`. */
  currentToken?: () => Promise<string | null>;
  /** Draw the heading above the list. */
  heading?: boolean;
  surface?: SkinSurface;
  mode?: "light" | "dark";
}

export function PushDeviceList(props: PushDeviceListProps = {}): ReactElement {
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface={props.surface ?? "raised"}
      data-testid="push-device-list"
      style={{ width: "100%", padding: spacing[4] }}
    >
      <DeviceRegistration
        {...(props.currentToken !== undefined ? { currentToken: props.currentToken } : {})}
      >
        {(bag) => <PushDeviceListBody bag={bag} heading={props.heading ?? true} />}
      </DeviceRegistration>
    </SkinTheme>
  );
}
