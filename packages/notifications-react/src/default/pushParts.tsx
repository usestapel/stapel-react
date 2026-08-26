/**
 * The two push bodies, each taking a {@link DeviceRegistrationBag} rather than
 * mounting its own.
 *
 * `PushSettingsPane` renders the toggle and the device list together, and they
 * are two views of ONE state: the switch is "does the list contain a row whose
 * fingerprint is mine, and is it active?". Mounting a `<DeviceRegistration>`
 * inside each would give them separate token/fingerprint state, so the list
 * could know which row is this device while the switch did not — the exact
 * class of disagreement this pair's blocker was made of.
 *
 * So the bodies are pure functions of a bag, and whoever composes them decides
 * how many bags there are. The exported components each mount one; the pane
 * mounts one for both.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Switch, Tag, Typography, theme as antdTheme } from "antd";
import {
  EmptyState,
  ErrorAlert,
  GatedControl,
  LoadList,
  SkinConfirm,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  actionBlockedByFailure,
  useI18n,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { DeviceRegistrationBag, PushState } from "../headless/DeviceRegistration.js";
import type { DeviceListItem } from "../api/types.js";
import { formatDateTime } from "../model/format.js";
import { NOTIFICATIONS_I18N_KEYS } from "../i18n/keys.js";

// ── the toggle ──────────────────────────────────────────────────────────────

/** The sentence beside the switch for each state, and the muted line under it
 * where a state needs explaining that the gate does not already carry. */
function stateCopy(state: PushState): { label: string; hint?: string } {
  switch (state) {
    case "loading":
      return { label: NOTIFICATIONS_I18N_KEYS.pushChecking };
    case "on":
      return { label: NOTIFICATIONS_I18N_KEYS.pushOn };
    case "off":
    case "failed":
      return { label: NOTIFICATIONS_I18N_KEYS.pushOff };
    case "inactive":
      return {
        label: NOTIFICATIONS_I18N_KEYS.pushInactive,
        hint: NOTIFICATIONS_I18N_KEYS.pushInactiveHint,
      };
    case "unknown":
      return { label: NOTIFICATIONS_I18N_KEYS.pushUnknown };
    case "denied":
      return { label: NOTIFICATIONS_I18N_KEYS.pushDenied };
    case "unsupported":
      return { label: NOTIFICATIONS_I18N_KEYS.pushUnsupported };
  }
}

/**
 * Why the switch cannot be operated, as an `ActionAvailability` — so the
 * reason is rendered BESIDE the control by `GatedControl`, linked with
 * `aria-describedby`, and never hidden in a tooltip a touch device cannot
 * reach.
 *
 * `unknown` is a gate rather than a switch that silently does nothing: that
 * combination — a control that answers and sends no request — is precisely the
 * defect this rewrite exists to end.
 */
function gateFor(state: PushState, error: unknown): ActionAvailability {
  switch (state) {
    case "unsupported":
      return actionBlocked(NOTIFICATIONS_I18N_KEYS.pushUnsupportedHint);
    case "denied":
      return actionBlocked(NOTIFICATIONS_I18N_KEYS.pushDeniedHint);
    case "unknown":
      return actionBlocked(NOTIFICATIONS_I18N_KEYS.pushUnknownHint);
    case "failed":
      return actionBlockedByFailure(error);
    default:
      // `loading` is not gated: the Switch's own `loading` disables it, and a
      // second "Loading…" sentence under a spinner is noise, not information.
      return actionAvailable();
  }
}

export function PushToggleBody(props: {
  bag: DeviceRegistrationBag;
  heading: boolean;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  const copy = stateCopy(bag.state);
  const gate = gateFor(
    bag.state,
    bag.devices.status === "failed" ? bag.devices.error : undefined
  );

  return (
    <Flex vertical gap={spacing[3]}>
      {props.heading && (
        <Flex vertical gap={spacing[1]}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(NOTIFICATIONS_I18N_KEYS.pushSettingsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(NOTIFICATIONS_I18N_KEYS.pushSettingsSubtitle)}
          </Typography.Text>
        </Flex>
      )}

      <GatedControl gate={gate} layout="stack" testId="push-toggle">
        {(bind) => (
          <Flex align="center" gap={spacing[3]}>
            <Switch
              checked={bag.state === "on"}
              disabled={bind.disabled}
              loading={bag.busy || bag.state === "loading"}
              aria-label={t(NOTIFICATIONS_I18N_KEYS.pushToggleLabel)}
              {...(bind["aria-describedby"] !== undefined
                ? { "aria-describedby": bind["aria-describedby"] }
                : {})}
              onChange={(next) => {
                if (next) bag.enable();
                else bag.disable();
              }}
              data-testid="push-switch"
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            />
            <Flex vertical gap={spacing[1]}>
              <Typography.Text data-testid="push-state">{t(copy.label)}</Typography.Text>
              {copy.hint !== undefined && (
                <Typography.Text type="secondary">{t(copy.hint)}</Typography.Text>
              )}
            </Flex>
          </Flex>
        )}
      </GatedControl>

      {bag.blocked === "token_unavailable" && (
        <ErrorAlert
          testId="push-token-error"
          message={t(NOTIFICATIONS_I18N_KEYS.pushTokenUnavailable)}
          detail={t(NOTIFICATIONS_I18N_KEYS.pushTokenUnavailableHint)}
        />
      )}
      <ErrorAlert thrown={bag.error} testId="push-error" />
      {bag.devices.status === "failed" && (
        <ErrorAlert
          testId="push-devices-error"
          thrown={bag.devices.error}
          onRetry={bag.refetch}
        />
      )}
    </Flex>
  );
}

// ── the device list ─────────────────────────────────────────────────────────

const PLATFORM_KEY: Record<string, string> = {
  ios: NOTIFICATIONS_I18N_KEYS.platformIos,
  android: NOTIFICATIONS_I18N_KEYS.platformAndroid,
  web: NOTIFICATIONS_I18N_KEYS.platformWeb,
};

function DeviceRow(props: {
  device: DeviceListItem;
  isThisDevice: boolean;
  onRemove: (id: number) => void;
  busy: boolean;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const { device } = props;
  const platformKey = PLATFORM_KEY[device.platform];

  return (
    <li
      data-testid="push-device-row"
      data-device-id={device.id}
      data-device-active={String(device.is_active)}
      style={{ listStyle: "none", borderBottom: `1px solid ${token.colorSplit}` }}
    >
      <Flex
        gap={spacing[3]}
        align="center"
        justify="space-between"
        wrap
        style={{ paddingBlock: spacing[3] }}
      >
        <Flex vertical gap={spacing[1]} style={{ minWidth: 0 }}>
          <Flex gap={spacing[2]} align="center" wrap>
            {/* A platform the backend adds later has no label yet. The raw
                wire value is still worth showing — it is the spelling a
                support agent would be quoting — but as a CAPTION under a human
                title, never as the title itself. */}
            <Typography.Text strong>
              {platformKey !== undefined
                ? t(platformKey)
                : t(NOTIFICATIONS_I18N_KEYS.devicesPlatformOther)}
            </Typography.Text>
            {platformKey === undefined && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: token.fontSizeSM }}
                data-testid="push-device-platform-raw"
              >
                {device.platform}
              </Typography.Text>
            )}
            {props.isThisDevice && (
              <Tag color="blue" data-testid="push-device-current">
                {t(NOTIFICATIONS_I18N_KEYS.devicesThisDevice)}
              </Tag>
            )}
            {!device.is_active && (
              <Tag data-testid="push-device-inactive">
                {t(NOTIFICATIONS_I18N_KEYS.devicesInactive)}
              </Tag>
            )}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t(NOTIFICATIONS_I18N_KEYS.devicesLastSeen, {
              when: formatDateTime(device.last_seen, locale),
            })}
          </Typography.Text>
        </Flex>
        {/* Red TEXT, not a red outlined button: that is how every other pair in
            the fleet draws a destructive action on a list row, and a row that
            spends the only outlined control on its screen on "Remove" makes
            deletion the loudest thing on a settings page. `size` is left alone
            so the control keeps the phone touch floor `SkinTheme` sets. */}
        <Button
          type="text"
          danger
          disabled={props.busy}
          onClick={() => {
            props.onRemove(device.id);
          }}
          data-testid="push-device-remove"
          data-analytics="none"
          data-analytics-reason="opens a confirm; the removal is the tracked action — host app wraps with its own tracked()"
        >
          {t(NOTIFICATIONS_I18N_KEYS.devicesRemove)}
        </Button>
      </Flex>
    </li>
  );
}

export function PushDeviceListBody(props: {
  bag: DeviceRegistrationBag;
  heading: boolean;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  // ONE confirm for the whole list, keyed by the pending id — not one per row.
  const [pendingId, setPendingId] = useState<number | null>(null);

  return (
    <Flex vertical gap={spacing[3]}>
      {props.heading && (
        <Flex vertical gap={spacing[1]}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(NOTIFICATIONS_I18N_KEYS.devicesTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(NOTIFICATIONS_I18N_KEYS.devicesSubtitle)}
          </Typography.Text>
        </Flex>
      )}

      <LoadList
        state={bag.devices}
        onRetry={bag.refetch}
        testId="push-devices"
        empty={
          <EmptyState
            testId="push-devices-empty"
            title={t(NOTIFICATIONS_I18N_KEYS.devicesEmpty)}
            hint={t(NOTIFICATIONS_I18N_KEYS.devicesEmptyHint)}
            compact
          />
        }
      >
        {(devices) => (
          <ul style={{ margin: 0, padding: 0 }}>
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                isThisDevice={bag.thisDevice?.id === device.id}
                busy={bag.busy}
                onRemove={setPendingId}
              />
            ))}
          </ul>
        )}
      </LoadList>

      <SkinConfirm
        open={pendingId !== null}
        danger
        title={t(NOTIFICATIONS_I18N_KEYS.devicesRemoveQuestion)}
        body={t(NOTIFICATIONS_I18N_KEYS.devicesRemoveBody)}
        confirmLabel={t(NOTIFICATIONS_I18N_KEYS.devicesRemove)}
        confirming={bag.busy}
        data-testid="push-device-confirm"
        onConfirm={() => {
          if (pendingId !== null) bag.remove(pendingId);
          setPendingId(null);
        }}
        onCancel={() => {
          setPendingId(null);
        }}
      />
    </Flex>
  );
}
