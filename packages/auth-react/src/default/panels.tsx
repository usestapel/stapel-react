/**
 * Zone-B channel panels for the default auth skin (domain-guidelines-auth).
 * Each panel is the pair's existing headless component (state + flow) dressed
 * in Ant Design per the guideline rules: one primary button (ПРАВИЛО 5),
 * inline errors at the source (ПРАВИЛО 8), OTP via `Input.OTP` (ПРАВИЛО 9),
 * inline TOTP step-up (ПРАВИЛО 10), QR as an inline panel — never a modal
 * (ПРАВИЛО 6). No colour/px literals: theming comes entirely from the
 * `ConfigProvider` fed by `toAntdThemeConfig` (ПРАВИЛО 12).
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  QRCode,
  Result,
  Typography,
} from "antd";
import { useT } from "@stapel/core";
import type { FlowError } from "../flows/errors.js";
import type { OtpChannel } from "../api/types.js";
import type { QrLoginState } from "../flows/qrLoginFlow.js";
import { PasswordlessLogin } from "../headless/PasswordlessLogin.js";
import { PasswordLogin } from "../headless/PasswordLogin.js";
import { QrLogin } from "../headless/QrLogin.js";
import { PasskeyLogin } from "../headless/Passkey.js";
import { MagicLink } from "../headless/misc.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

/** Inline error copy for a flow error — `t(code, params)` (ПРАВИЛО 8). */
function useErrorText(): (e: FlowError | undefined) => string | undefined {
  const t = useT();
  return (e) => (e ? t(e.code, e.params) : undefined);
}

/** `Form.Item` error props for a flow error, spread so no `undefined` is
 * passed under `exactOptionalPropertyTypes`. Empty object when there's no
 * error. */
function useFieldError(): (
  e: FlowError | undefined
) => { validateStatus: "error"; help: string } | Record<string, never> {
  const t = useT();
  return (e) =>
    e ? { validateStatus: "error", help: t(e.code, e.params) } : {};
}

/**
 * A resend link with its OWN cooldown (ПРАВИЛО 9 / anti-pattern З-4: the
 * countdown belongs to THIS channel's flow, never shared). The OTP headless
 * bag exposes no `resendIn`, so the skin owns the timer locally — scoped to
 * this panel instance, so it cannot leak into another flow.
 */
function ResendLink(props: { onResend: () => void }): ReactElement {
  const t = useT();
  const [left, setLeft] = useState(RESEND_COOLDOWN_S);
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [left]);
  const resend = (): void => {
    props.onResend();
    setLeft(RESEND_COOLDOWN_S);
  };
  return (
    <Button
      type="link"
      disabled={left > 0}
      onClick={resend}
      data-analytics="flow"
    >
      {left > 0
        ? t(AUTH_I18N_KEYS.uiResendIn, { s: left })
        : t(AUTH_I18N_KEYS.otpResend)}
    </Button>
  );
}

/** Email / phone one-time-code panel (ПРАВИЛА 8-9). */
export function OtpPanel(props: { channel: OtpChannel }): ReactElement {
  const t = useT();
  const fieldError = useFieldError();
  const { channel } = props;
  const labelKey =
    channel === "email"
      ? AUTH_I18N_KEYS.uiEmailLabel
      : AUTH_I18N_KEYS.uiPhoneLabel;
  const placeholderKey =
    channel === "email"
      ? AUTH_I18N_KEYS.uiEmailPlaceholder
      : AUTH_I18N_KEYS.uiPhonePlaceholder;

  return (
    <PasswordlessLogin>
      {(bag) => {
        const s = bag.state;
        const sent =
          s.step === "codeSent" ||
          s.step === "verifying" ||
          s.step === "codeError";
        if (s.step === "authenticated") {
          return <Result status="success" title={t(AUTH_I18N_KEYS.verificationSuccess)} />;
        }
        if (sent) {
          const err = s.step === "codeError" ? s.error : undefined;
          return (
            <Flex vertical gap="middle">
              <Typography.Text type="secondary">
                {t(AUTH_I18N_KEYS.otpSentTo, { target: s.target })}
              </Typography.Text>
              <Form
                layout="vertical"
                onFinish={(v: { code?: string }) =>
                  bag.submitCode(v.code ?? "")
                }
              >
                <Form.Item
                  name="code"
                  label={t(AUTH_I18N_KEYS.otpEnterCode)}
                  {...fieldError(err)}
                >
                  <Input.OTP length={OTP_LENGTH} autoFocus />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={s.step === "verifying"}
                >
                  {t(AUTH_I18N_KEYS.uiSubmit)}
                </Button>
              </Form>
              <ResendLink onResend={() => bag.resend()} />
            </Flex>
          );
        }
        const reqErr =
          s.step === "requestError" || s.step === "locked" ? s.error : undefined;
        return (
          <Form
            layout="vertical"
            onFinish={(v: { value?: string }) =>
              bag.requestCode(channel, v.value ?? "")
            }
          >
            <Form.Item name="value" label={t(labelKey)} {...fieldError(reqErr)}>
              <Input
                autoFocus
                inputMode={channel === "email" ? "email" : "tel"}
                placeholder={t(placeholderKey)}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={s.step === "requesting"}
            >
              {t(AUTH_I18N_KEYS.uiSendCode)}
            </Button>
          </Form>
        );
      }}
    </PasswordlessLogin>
  );
}

/** Password panel with the inline TOTP step-up branch (ПРАВИЛО 10). */
export function PasswordPanel(): ReactElement {
  const t = useT();
  const fieldError = useFieldError();
  const [useBackup, setUseBackup] = useState(false);
  return (
    <PasswordLogin>
      {(bag) => {
        const s = bag.state;
        if (s.step === "authenticated") {
          return <Result status="success" title={t(AUTH_I18N_KEYS.verificationSuccess)} />;
        }
        const totp =
          s.step === "totpRequired" ||
          s.step === "verifyingTotp" ||
          s.step === "totpError";
        if (totp) {
          const err = s.step === "totpError" ? s.error : undefined;
          return (
            <Form
              layout="vertical"
              onFinish={(v: { proof?: string }) =>
                bag.submitTotp(
                  useBackup
                    ? { backup_code: v.proof ?? "" }
                    : { code: v.proof ?? "" }
                )
              }
            >
              <Form.Item
                name="proof"
                label={t(
                  useBackup
                    ? AUTH_I18N_KEYS.totpUseBackup
                    : AUTH_I18N_KEYS.totpEnterCode
                )}
                {...fieldError(err)}
              >
                <Input autoFocus />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={s.step === "verifyingTotp"}
              >
                {t(AUTH_I18N_KEYS.uiSubmit)}
              </Button>
              <Button
                type="link"
                onClick={() => setUseBackup((b) => !b)}
                data-analytics="none"
                data-analytics-reason="local-ui-toggle-backup-code"
              >
                {t(AUTH_I18N_KEYS.totpUseBackup)}
              </Button>
            </Form>
          );
        }
        const err = s.step === "error" ? s.error : undefined;
        return (
          <Form
            layout="vertical"
            onFinish={(v: { loginId?: string; password?: string }) =>
              bag.login(v.loginId ?? "", v.password ?? "")
            }
          >
            <Form.Item
              name="loginId"
              label={t(AUTH_I18N_KEYS.uiEmailLabel)}
              {...(err ? { validateStatus: "error" as const } : {})}
            >
              <Input autoFocus placeholder={t(AUTH_I18N_KEYS.uiEmailPlaceholder)} />
            </Form.Item>
            <Form.Item
              name="password"
              label={t(AUTH_I18N_KEYS.passwordLabel)}
              {...fieldError(err)}
            >
              <Input.Password placeholder={t(AUTH_I18N_KEYS.uiPasswordPlaceholder)} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={s.step === "authenticating"}
            >
              {t(AUTH_I18N_KEYS.uiSubmit)}
            </Button>
          </Form>
        );
      }}
    </PasswordLogin>
  );
}

/** Map the QR flow step to antd's `<QRCode status>` (ПРАВИЛО 6 — states are
 * expressed by the primitive, not hand-drawn overlays). */
function qrStatus(step: QrLoginState["step"]): "active" | "expired" | "loading" {
  switch (step) {
    case "generating":
      return "loading";
    case "rejected":
    case "error":
      return "expired";
    default:
      return "active";
  }
}

/** QR panel — inline, renders the code immediately (ПРАВИЛО 6). */
export function QrPanel(): ReactElement {
  const t = useT();
  return (
    <QrLogin>
      {(bag) => (
        <QrPanelBody
          state={bag.state}
          onStart={() => bag.start("login_request", "/")}
          hint={t(AUTH_I18N_KEYS.uiQrHint)}
        />
      )}
    </QrLogin>
  );
}

function QrPanelBody(props: {
  state: QrLoginState;
  onStart: () => void;
  hint: string;
}): ReactElement {
  const { state, onStart } = props;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onStart();
  }, [onStart]);
  const scanUrl = state.step === "awaitingScan" ? state.scanUrl : "-";
  return (
    <Flex vertical align="center" gap="middle">
      <QRCode
        value={scanUrl}
        status={qrStatus(state.step)}
        onRefresh={onStart}
        size={200}
      />
      <Typography.Text type="secondary">{props.hint}</Typography.Text>
    </Flex>
  );
}

/** Passkey panel — a single primary trigger (ПРАВИЛО 5). */
export function PasskeyPanel(): ReactElement {
  const t = useT();
  const errorText = useErrorText();
  return (
    <PasskeyLogin>
      {(bag) => {
        const s = bag.state;
        const err = "error" in s ? (s.error as FlowError) : undefined;
        return (
          <Flex vertical gap="middle">
            <Button
              type="primary"
              block
              loading={s.step !== "idle" && !("error" in s)}
              onClick={() => bag.begin()}
              data-analytics="flow"
            >
              {t(AUTH_I18N_KEYS.uiPasskeyCta)}
            </Button>
            {err && <Alert type="error" showIcon message={errorText(err)} />}
          </Flex>
        );
      }}
    </PasskeyLogin>
  );
}

/** Magic-link panel — request form → "check your email" (ПРАВИЛО 11). */
export function MagicLinkPanel(): ReactElement {
  const t = useT();
  const fieldError = useFieldError();
  return (
    <MagicLink>
      {(bag) => {
        const s = bag.state;
        if (s.step === "sent") {
          return (
            <Result
              status="success"
              title={t(AUTH_I18N_KEYS.uiMagicLinkSentTitle)}
              subTitle={t(AUTH_I18N_KEYS.uiMagicLinkSentBody)}
            />
          );
        }
        const err = s.step === "error" ? s.error : undefined;
        return (
          <Form
            layout="vertical"
            onFinish={(v: { email?: string }) => bag.request(v.email ?? "")}
          >
            <Form.Item
              name="email"
              label={t(AUTH_I18N_KEYS.uiEmailLabel)}
              {...fieldError(err)}
            >
              <Input autoFocus placeholder={t(AUTH_I18N_KEYS.uiEmailPlaceholder)} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={s.step === "requesting"}
            >
              {t(AUTH_I18N_KEYS.uiMagicLinkCta)}
            </Button>
          </Form>
        );
      }}
    </MagicLink>
  );
}
