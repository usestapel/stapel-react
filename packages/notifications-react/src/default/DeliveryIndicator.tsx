/**
 * The freshness of the list, said out loud.
 *
 * A notification feed that has quietly stopped updating looks exactly like a
 * notification feed with nothing new in it. So the mode is drawn, always:
 * `Live` with a dot when a socket is carrying the news, `Checking every
 * minute` when this deployment has no socket and the newest page is being
 * polled at the interval the backend documents, and a named refusal with a
 * `Reconnect` beside it when the socket will not come back on its own.
 *
 * `polling` is deliberately not styled as a warning. It is a supported
 * deployment (`stapel-notifications[realtime]` is an optional extra), and
 * dressing a correct configuration as a fault trains people to ignore the
 * indicator — which is how the silent-degradation defect survives its own fix.
 */
import type { ReactElement } from "react";
import { Badge, Button, Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";
import type { FeedDelivery, FeedRefusalKind } from "../model/delivery.js";

const REFUSAL_KEY: Record<FeedRefusalKind, string> = {
  session: NOTIFICATIONS_I18N_KEYS.liveRefusedSession,
  origin: NOTIFICATIONS_I18N_KEYS.liveRefusedOrigin,
  forbidden: NOTIFICATIONS_I18N_KEYS.liveRefusedForbidden,
  stream_unknown: NOTIFICATIONS_I18N_KEYS.liveRefusedUnknown,
  revoked: NOTIFICATIONS_I18N_KEYS.liveRefusedRevoked,
};

export function DeliveryIndicator(props: {
  delivery: FeedDelivery;
}): ReactElement {
  const t = useT();
  const { mode, refusal, reconnect } = props.delivery;

  if (mode === "refused") {
    return (
      <Flex
        align="center"
        gap={spacing[2]}
        wrap
        data-testid="notification-delivery"
        data-delivery-mode={mode}
      >
        <Badge status="error" text={t(NOTIFICATIONS_I18N_KEYS.liveStopped)} />
        <Typography.Text type="secondary">
          {t(REFUSAL_KEY[refusal ?? "stream_unknown"])}
        </Typography.Text>
        {reconnect !== undefined && (
          <Button
            size="small"
            onClick={reconnect}
            data-analytics="none"
            data-analytics-reason="recovery affordance for a refused socket — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {t(NOTIFICATIONS_I18N_KEYS.liveReconnect)}
          </Button>
        )}
      </Flex>
    );
  }

  if (mode === "live") {
    return (
      <Flex
        align="center"
        gap={spacing[2]}
        data-testid="notification-delivery"
        data-delivery-mode={mode}
      >
        <Badge status="success" text={t(NOTIFICATIONS_I18N_KEYS.liveOn)} />
      </Flex>
    );
  }

  if (mode === "connecting" || mode === "reconnecting") {
    return (
      <Flex
        align="center"
        gap={spacing[2]}
        data-testid="notification-delivery"
        data-delivery-mode={mode}
      >
        <Badge
          status="processing"
          text={t(
            mode === "connecting"
              ? NOTIFICATIONS_I18N_KEYS.liveConnecting
              : NOTIFICATIONS_I18N_KEYS.liveReconnecting
          )}
        />
      </Flex>
    );
  }

  return (
    <Flex
      vertical
      gap={spacing[1]}
      data-testid="notification-delivery"
      data-delivery-mode={mode}
    >
      <Badge status="default" text={t(NOTIFICATIONS_I18N_KEYS.livePolling)} />
      <Typography.Text type="secondary">
        {t(NOTIFICATIONS_I18N_KEYS.livePollingHint)}
      </Typography.Text>
    </Flex>
  );
}
