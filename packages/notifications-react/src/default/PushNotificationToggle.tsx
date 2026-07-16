/**
 * `<PushNotificationToggle/>` — default skin for the "push notifications"
 * settings surface. Built entirely on this pair's EXISTING
 * `DeviceRegistration` headless wrapper (`useRegisterDevice` /
 * `useUnregisterDevice`) — no new backend surface. stapel-notifications has
 * NO endpoint to list a caller's already-registered devices (see
 * `ironmemo-libgaps.md` §Settings-инвентарь), so this skin can't render a
 * persisted on/off state the way `<ProfileSettings/>` can — it models the
 * single real settings action the contract supports: bind (or unbind) THIS
 * device's push token. Getting a fresh token (VAPID/APNs/FCM) is a host
 * concern — see `getToken`.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Card, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import { DeviceRegistration } from "../headless/DeviceRegistration.js";
import type { Platform } from "../api/types.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";

export interface PushNotificationToggleProps {
  /** Resolve a fresh push token when the caller turns notifications ON (e.g.
   * from the browser Push API's `PushSubscription`, or a native bridge). This
   * pair doesn't obtain tokens itself — VAPID/APNs/FCM wiring is a host
   * concern, not a headless module's. */
  getToken(): Promise<string>;
  /** Device platform sent with the registration. Default `"web"`. */
  platform?: Platform;
}

export function PushNotificationToggle(props: PushNotificationToggleProps): ReactElement {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  return (
    <DeviceRegistration>
      {({ register, unregister, isRegistering, isUnregistering, isError, error }) => {
        async function handleChange(next: boolean): Promise<void> {
          if (next) {
            const fresh = await props.getToken();
            setToken(fresh);
            setEnabled(true);
            register(fresh, props.platform ?? "web");
          } else {
            if (token) unregister(token);
            setEnabled(false);
          }
        }

        return (
          <Card data-testid="push-notification-toggle">
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {t(NOTIFICATIONS_I18N_KEYS.pushSettingsTitle)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(NOTIFICATIONS_I18N_KEYS.pushSettingsSubtitle)}
            </Typography.Text>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <Switch
                checked={enabled}
                loading={isRegistering || isUnregistering}
                onChange={(next) => {
                  void handleChange(next);
                }}
              />
              <Typography.Text>
                {enabled
                  ? t(NOTIFICATIONS_I18N_KEYS.deviceRegistered)
                  : t(NOTIFICATIONS_I18N_KEYS.deviceRegister)}
              </Typography.Text>
            </div>

            {isError && error && (
              <Alert style={{ marginTop: 12 }} type="error" showIcon message={error.message} />
            )}
          </Card>
        );
      }}
    </DeviceRegistration>
  );
}
