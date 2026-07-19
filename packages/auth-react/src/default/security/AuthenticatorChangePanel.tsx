/**
 * `<AuthenticatorChangePanel/>` — shared, channel-parametrized implementation
 * behind `<EmailChangePanel/>`/`<PhoneChangePanel/>`. Built entirely on
 * EXISTING pair surface, never rebuilt here:
 *
 *  - **Instant** (old-channel proof, applied immediately): the EXISTING
 *    `<AuthenticatorChange>` headless component (`headless/misc.tsx`), itself
 *    driving the EXISTING `authenticatorChangeFlow` state machine —
 *    request-old → verify-old → request-new → verify-new.
 *  - **Delayed** (14-day wait, no old-channel proof required): the EXISTING
 *    `useDelayedChangeStatus`/`useCancelDelayedChange` hooks, plus the new
 *    `useInitiateDelayedChange` mutation (same `changeDelayedInitiate` API
 *    call the flow doc already named — it just had no component wired to it
 *    yet).
 *
 * `useDelayedChangeStatus` is checked FIRST on every render: a pending
 * delayed change short-circuits the whole change UI in favor of a
 * pending-status banner with a cancel action (SPEC — "if a pending delayed
 * change already exists on mount, show that banner INSTEAD of the change
 * form").
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Flex, Form, Input, Popconfirm, Result, Spin, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { AuthenticatorChangeBag } from "../../headless/misc.js";
import { AuthenticatorChange } from "../../headless/misc.js";
import type { DelayedChangeStatus, OtpChannel } from "../../api/types.js";
import { useCancelDelayedChange, useInitiateDelayedChange } from "../../model/mutations.js";
import { useCapabilities, useDelayedChangeStatus, useMe } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import type { AuthI18nKey } from "../../i18n/keys.js";

const CHANNEL_LABEL: Record<OtpChannel, AuthI18nKey> = {
  email: AUTH_I18N_KEYS.uiChannelEmail,
  phone: AUTH_I18N_KEYS.uiChannelPhone,
};
/** Fallback when the backend omits `otp` metadata (stapel-auth <0.6.0). */
const DEFAULT_OTP_LENGTH = 6;

/** `j•••@x.com` — first local-part character kept, the rest collapsed. */
function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return value;
  return `${value.slice(0, 1)}•••${value.slice(at)}`;
}

/** `+7 ••• ••• 12 34` — country digit(s) + last two pairs kept, the middle
 * collapsed. Best-effort formatting; exact grouping isn't a contract, only
 * "clearly masked, ends in something recognizable" is. */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  const cc = digits.slice(0, Math.max(1, digits.length - 10));
  const last2 = digits.slice(-2);
  const prev2 = digits.slice(-4, -2);
  return `+${cc} ••• ••• ${prev2} ${last2}`;
}

function maskValue(channel: OtpChannel, value: string): string {
  return channel === "email" ? maskEmail(value) : maskPhone(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/** The delayed-strategy request form ("no access to your old {channel}?"):
 * collects the NEW value only — no old-channel proof, by design (the
 * trade-off is the 14-day wait the pending banner then displays). */
function DelayedRequestForm(props: { channel: OtpChannel; onStarted: () => void }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const initiate = useInitiateDelayedChange(props.channel);
  const channelLabel = t(CHANNEL_LABEL[props.channel]);

  return (
    <Form
      layout="vertical"
      onFinish={(v: { value?: string }) =>
        initiate.mutate(v.value ?? "", { onSuccess: props.onStarted })
      }
    >
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.secChangeDelayedFormHint, { channel: channelLabel })}
      </Typography.Text>
      {initiate.isError && (
        <Alert
          type="error"
          showIcon
          style={{ margin: "12px 0" }}
          message={formatError({
            code: initiate.error.code,
            params: initiate.error.params,
            status: initiate.error.status,
            message: initiate.error.message,
            language: initiate.error.language,
          })}
        />
      )}
      <Form.Item
        name="value"
        label={t(AUTH_I18N_KEYS.secChangeNewValueLabel, { channel: channelLabel })}
        style={{ marginTop: 12 }}
      >
        <Input autoFocus type={props.channel === "email" ? "email" : "tel"} />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={initiate.isPending} data-analytics="flow">
        {t(AUTH_I18N_KEYS.secChangeDelayedSubmitCta)}
      </Button>
    </Form>
  );
}

/** Pending-delayed-change banner — replaces the entire change UI while a
 * delayed request is in flight. */
function PendingBanner(props: { channel: OtpChannel; status: DelayedChangeStatus }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const cancel = useCancelDelayedChange(props.channel);
  const s = props.status;
  const channelLabel = t(CHANNEL_LABEL[props.channel]);

  return (
    <Flex vertical gap="middle">
      <Alert
        type="info"
        showIcon
        message={t(AUTH_I18N_KEYS.secChangePendingMessage, {
          value: s.new_value_masked ?? "",
          date: s.scheduled_at ? formatDate(s.scheduled_at) : "",
          days: s.days_remaining ?? 0,
        })}
        description={t(AUTH_I18N_KEYS.secChangePendingNote, { channel: channelLabel })}
      />
      {cancel.isError && (
        <Alert
          type="error"
          showIcon
          message={formatError({
            code: cancel.error.code,
            params: cancel.error.params,
            status: cancel.error.status,
            message: cancel.error.message,
            language: cancel.error.language,
          })}
        />
      )}
      <Flex>
        <Popconfirm
          title={t(AUTH_I18N_KEYS.secChangeCancelConfirmTitle)}
          onConfirm={() => {
            if (s.change_request_id) cancel.mutate(s.change_request_id);
          }}
          okText={t(AUTH_I18N_KEYS.secChangePendingCancel)}
          okButtonProps={{ danger: true, loading: cancel.isPending }}
        >
          <Button danger data-analytics="flow">
            {t(AUTH_I18N_KEYS.secChangePendingCancel)}
          </Button>
        </Popconfirm>
      </Flex>
    </Flex>
  );
}

/** The instant-strategy journey — a genuine component (not hooks inlined in
 * the render-prop lambda), same rule every other security dialog in this
 * pair follows, plus the local "no access to old {channel}?" branch into the
 * delayed form. */
function ChangeJourney(props: {
  channel: OtpChannel;
  bag: AuthenticatorChangeBag;
  onDone: () => void;
  onDelayedStarted: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const caps = useCapabilities();
  const [showDelayed, setShowDelayed] = useState(false);
  const { bag, channel } = props;
  const s = bag.state;
  const channelLabel = t(CHANNEL_LABEL[channel]);
  const otpLength =
    (channel === "email" ? caps.data?.otp?.email_code_length : caps.data?.otp?.phone_code_length) ??
    DEFAULT_OTP_LENGTH;

  if (showDelayed && s.step === "idle") {
    return <DelayedRequestForm channel={channel} onStarted={props.onDelayedStarted} />;
  }

  if (s.step === "changed") {
    return (
      <Result
        status="success"
        title={t(AUTH_I18N_KEYS.secChangeSuccess, { channel: channelLabel })}
        extra={
          <Button type="primary" onClick={props.onDone} data-analytics="flow">
            {t(AUTH_I18N_KEYS.uiSubmit)}
          </Button>
        }
      />
    );
  }

  if (s.step === "error") {
    return (
      <Flex vertical gap="middle" align="center">
        <Alert type="error" showIcon message={formatError(s.error)} />
        <Button onClick={bag.reset} data-analytics="flow">
          {t(AUTH_I18N_KEYS.secChangeRetry)}
        </Button>
      </Flex>
    );
  }

  if (s.step === "idle") {
    return (
      <Flex vertical gap="middle">
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.secChangeInstantHint, { channel: channelLabel })}
        </Typography.Text>
        <Button type="primary" block onClick={() => bag.startInstant(channel)} data-analytics="flow">
          {t(AUTH_I18N_KEYS.uiSendCode)}
        </Button>
        <Button type="link" onClick={() => setShowDelayed(true)} data-analytics="flow">
          {t(AUTH_I18N_KEYS.secChangeNoAccessCta, { channel: channelLabel })}
        </Button>
      </Flex>
    );
  }

  if (s.step === "requestingOld") {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }

  if (s.step === "oldCodeSent" || s.step === "verifyingOld") {
    return (
      <Form layout="vertical" onFinish={(v: { code?: string }) => bag.submitOldCode(v.code ?? "")}>
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.secChangeOldCodeHint, {
            target: s.step === "oldCodeSent" ? s.target : "",
          })}
        </Typography.Text>
        <Form.Item name="code" label={t(AUTH_I18N_KEYS.otpEnterCode)} style={{ marginTop: 12 }}>
          <Input.OTP length={otpLength} autoFocus />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={s.step === "verifyingOld"}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.secChangeConfirmCta)}
        </Button>
      </Form>
    );
  }

  if (s.step === "oldVerified" || s.step === "requestingNew") {
    return (
      <Form layout="vertical" onFinish={(v: { value?: string }) => bag.requestNew(v.value ?? "")}>
        <Form.Item name="value" label={t(AUTH_I18N_KEYS.secChangeNewValueLabel, { channel: channelLabel })}>
          <Input autoFocus type={channel === "email" ? "email" : "tel"} />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={s.step === "requestingNew"}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.secChangeRequestNewCta, { channel: channelLabel })}
        </Button>
      </Form>
    );
  }

  // newCodeSent / verifyingNew — the only remaining steps.
  return (
    <Form layout="vertical" onFinish={(v: { code?: string }) => bag.submitNewCode(v.code ?? "")}>
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.secChangeNewCodeHint, {
          target: s.step === "newCodeSent" ? s.target : "",
        })}
      </Typography.Text>
      <Form.Item name="code" label={t(AUTH_I18N_KEYS.otpEnterCode)} style={{ marginTop: 12 }}>
        <Input.OTP length={otpLength} autoFocus />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        block
        loading={s.step === "verifyingNew"}
        data-analytics="flow"
      >
        {t(AUTH_I18N_KEYS.secChangeConfirmCta)}
      </Button>
    </Form>
  );
}

/** Full email/phone change screen: masked current value + an "Изменить"
 * trigger that opens the instant flow (default) or, via a secondary link,
 * the delayed one — OR, if a delayed change is already pending, the pending
 * banner in place of all of the above. */
export function AuthenticatorChangePanel(props: { readonly channel: OtpChannel }): ReactElement {
  const t = useT();
  const { channel } = props;
  const me = useMe();
  const delayedStatus = useDelayedChangeStatus(channel);
  const [open, setOpen] = useState(false);
  const channelLabel = t(CHANNEL_LABEL[channel]);
  const currentValue = channel === "email" ? me.data?.email : me.data?.phone;
  const testId = channel === "email" ? "email-change-panel" : "phone-change-panel";

  return (
    <Card title={channelLabel} data-testid={testId} style={{ width: "100%" }}>
      <Flex vertical gap="middle" style={{ width: "100%" }}>
        {me.isLoading || delayedStatus.isLoading ? (
          <Spin size="small" />
        ) : delayedStatus.isError ? (
          <Alert type="error" showIcon message={delayedStatus.error.message} />
        ) : delayedStatus.data?.has_pending_change ? (
          <PendingBanner channel={channel} status={delayedStatus.data} />
        ) : open ? (
          <AuthenticatorChange>
            {(bag) => (
              <ChangeJourney
                channel={channel}
                bag={bag}
                onDone={() => {
                  setOpen(false);
                  bag.reset();
                }}
                onDelayedStarted={() => {
                  setOpen(false);
                  bag.reset();
                }}
              />
            )}
          </AuthenticatorChange>
        ) : (
          <Flex justify="space-between" align="center" wrap="wrap" gap="small">
            <Typography.Text>
              {t(AUTH_I18N_KEYS.secChangeCurrentValue, {
                channel: channelLabel,
                value: currentValue ? maskValue(channel, currentValue) : "—",
              })}
            </Typography.Text>
            <Button
              onClick={() => setOpen(true)}
              data-analytics="none"
              data-analytics-reason="local-ui-open-change-flow"
            >
              {t(AUTH_I18N_KEYS.secChangeCta, { channel: channelLabel })}
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
