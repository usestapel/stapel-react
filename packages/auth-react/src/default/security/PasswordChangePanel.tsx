/**
 * `<PasswordChangePanel/>` — default skin for the security-settings password
 * screen (owner directive point 5; auth-sa.md §4). Tabs come from the
 * existing `usePasswordMethods()` query (`"password"` → old-password form,
 * `"email"`/`"phone"` → OTP-verified change via the existing `PasswordChange`
 * headless flow). A `"totp"` method entry is informational only — the
 * headless flow's OTP channel is email/phone-only, so there is nothing this
 * skin can drive for it yet; left for a follow-up alongside a TOTP-specific
 * verification path.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Flex, Form, Input, Result, Tabs, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { OtpChannel } from "../../api/types.js";
import { PasswordChange } from "../../headless/PasswordChange.js";
import type { PasswordChangeBag } from "../../headless/PasswordChange.js";
import { useCapabilities, usePasswordMethods } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import type { AuthI18nKey } from "../../i18n/keys.js";

const CHANNEL_LABEL: Record<OtpChannel, AuthI18nKey> = {
  email: AUTH_I18N_KEYS.uiChannelEmail,
  phone: AUTH_I18N_KEYS.uiChannelPhone,
};
/** Fallback when the backend omits `otp` metadata (stapel-auth <0.6.0). */
const DEFAULT_OTP_LENGTH = 6;

/** The `"password"` tab: old password + new password. */
function OldPasswordTab(props: { bag: PasswordChangeBag }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag } = props;
  const s = bag.state;
  if (s.step === "changed") {
    return <Result status="success" title={t(AUTH_I18N_KEYS.secPasswordSuccess)} />;
  }
  const err = s.step === "error" ? s.error : undefined;
  return (
    <Form
      layout="vertical"
      onFinish={(v: { oldPassword?: string; newPassword?: string }) =>
        bag.changeWithPassword(v.oldPassword ?? "", v.newPassword ?? "")
      }
    >
      {err && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={formatError(err)} />}
      <Form.Item name="oldPassword" label={t(AUTH_I18N_KEYS.secPasswordOldLabel)}>
        <Input.Password autoFocus />
      </Form.Item>
      <Form.Item name="newPassword" label={t(AUTH_I18N_KEYS.secPasswordNewLabel)}>
        <Input.Password />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={s.step === "changing"} data-analytics="flow">
        {t(AUTH_I18N_KEYS.secPasswordChangeCta)}
      </Button>
    </Form>
  );
}

/** An `"email"`/`"phone"` tab: request a code, then verify + set the new password. */
function OtpTab(props: { bag: PasswordChangeBag; channel: OtpChannel; target: string | null | undefined }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const caps = useCapabilities();
  const { bag, channel } = props;
  const s = bag.state;
  const otpLength =
    (channel === "email" ? caps.data?.otp?.email_code_length : caps.data?.otp?.phone_code_length) ??
    DEFAULT_OTP_LENGTH;

  if (s.step === "changed") {
    return <Result status="success" title={t(AUTH_I18N_KEYS.secPasswordSuccess)} />;
  }

  const forThisChannel =
    (s.step === "otpSent" || s.step === "verifyingOtp" || s.step === "otpError") &&
    s.method === channel;

  if (forThisChannel && (s.step === "otpSent" || s.step === "verifyingOtp" || s.step === "otpError")) {
    const err = s.step === "otpError" ? s.error : undefined;
    return (
      <Form
        layout="vertical"
        onFinish={(v: { code?: string; newPassword?: string }) =>
          bag.submitOtp(v.code ?? "", v.newPassword ?? "")
        }
      >
        {err && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={formatError(err)} />}
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.secPasswordViaOtpHint, { target: s.target })}
        </Typography.Text>
        <Form.Item name="code" label={t(AUTH_I18N_KEYS.otpEnterCode)}>
          <Input.OTP length={otpLength} autoFocus />
        </Form.Item>
        <Form.Item name="newPassword" label={t(AUTH_I18N_KEYS.secPasswordNewLabel)}>
          <Input.Password />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={s.step === "verifyingOtp"}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.secPasswordChangeCta)}
        </Button>
      </Form>
    );
  }

  const requesting = s.step === "requestingOtp" && s.method === channel;
  return (
    <Flex vertical gap="middle">
      {props.target && (
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.secPasswordViaOtpHint, { target: props.target })}
        </Typography.Text>
      )}
      <Button
        type="primary"
        block
        loading={requesting}
        onClick={() => bag.requestOtp(channel)}
        data-analytics="flow"
      >
        {t(AUTH_I18N_KEYS.uiSendCode)}
      </Button>
    </Flex>
  );
}

/** Full password-change screen: tabs from the backend's `usePasswordMethods()`. */
export function PasswordChangePanel(): ReactElement {
  const t = useT();
  const methods = usePasswordMethods();
  const [active, setActive] = useState<string | null>(null);

  const entries = methods.data?.methods ?? [];
  const tabIds = entries
    .map((m) => m.method)
    .filter((m): m is "password" | "email" | "phone" => m === "password" || m === "email" || m === "phone");
  const activeTab = active && tabIds.includes(active as (typeof tabIds)[number]) ? active : tabIds[0];

  if (methods.isLoading) return <Flex justify="center"><Typography.Text type="secondary">…</Typography.Text></Flex>;
  if (tabIds.length === 0) return <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secPasswordTitle)}</Typography.Text>;

  return (
    <PasswordChange>
      {(bag) => (
        <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="password-change-panel">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(AUTH_I18N_KEYS.secPasswordTitle)}
          </Typography.Title>
          {tabIds.length === 1 ? (
            tabIds[0] === "password" ? (
              <OldPasswordTab bag={bag} />
            ) : (
              <OtpTab
                bag={bag}
                channel={tabIds[0] as OtpChannel}
                target={entries.find((m) => m.method === tabIds[0])?.target}
              />
            )
          ) : (
            <Tabs
              {...(activeTab ? { activeKey: activeTab } : {})}
              onChange={setActive}
              items={tabIds.map((id) => ({
                key: id,
                label: id === "password" ? t(AUTH_I18N_KEYS.secPasswordTitle) : t(CHANNEL_LABEL[id]),
                children:
                  id === "password" ? (
                    <OldPasswordTab bag={bag} />
                  ) : (
                    <OtpTab
                      bag={bag}
                      channel={id}
                      target={entries.find((m) => m.method === id)?.target}
                    />
                  ),
              }))}
            />
          )}
        </Flex>
      )}
    </PasswordChange>
  );
}
