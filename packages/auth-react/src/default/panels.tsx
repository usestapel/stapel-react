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
import type { ElementRef, ReactElement, ReactNode } from "react";
import {
  Alert,
  Avatar,
  Button,
  Flex,
  Form,
  Input,
  QRCode,
  Result,
  Typography,
} from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { FlowError } from "../flows/errors.js";
import type { OAuthProviderInfo, OtpChannel } from "../api/types.js";
import { authUrls } from "../api/urls.js";
import type { QrLoginState } from "../flows/qrLoginFlow.js";
import type { SsoState } from "../flows/ssoFlow.js";
import { useCapabilities } from "../model/queries.js";
import { PasswordlessLogin } from "../headless/PasswordlessLogin.js";
import { PasswordLogin } from "../headless/PasswordLogin.js";
import { QrLogin } from "../headless/QrLogin.js";
import { PasskeyLogin } from "../headless/Passkey.js";
import { MagicLink, SsoDiscovery } from "../headless/misc.js";
import { useAuthApi } from "../model/context.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

/**
 * Fallback digit count when the backend doesn't send `otp_code_length`
 * (stapel-auth <0.6.0) — every backend has used 6 to date, so this is the
 * ONE safe fallback, not a guess between arbitrary lengths.
 */
const DEFAULT_OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

/**
 * Inline error copy for a flow error (ПРАВИЛО 8) — routed through core's
 * `useFormatFlowError` (frontend-core-architecture gap fix): bundle template
 * → the backend's own locale-matched message → the raw code, instead of a
 * bare `t(code, params)` that shows an unformatted code whenever a bundle key
 * is missing.
 */
function useErrorText(): (e: FlowError | undefined) => string | undefined {
  const format = useFormatFlowError();
  return (e) => (e ? format(e) : undefined);
}

/** `Form.Item` error props for a flow error, spread so no `undefined` is
 * passed under `exactOptionalPropertyTypes`. Empty object when there's no
 * error. */
function useFieldError(): (
  e: FlowError | undefined
) => { validateStatus: "error"; help: string } | Record<string, never> {
  const format = useFormatFlowError();
  return (e) => (e ? { validateStatus: "error", help: format(e) } : {});
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

/**
 * The OTP code step — auto-submits the moment every cell is filled (owner
 * directive: no "Confirm" button, matching every real-world OTP UX). Guards
 * against a double-submit with `submittedRef` (armed the instant length is
 * reached, only re-armed by a FRESH error — a `verifying`/success re-render
 * can't re-trigger it since the value doesn't change again on its own). On
 * error the cells clear and refocus so the next attempt starts clean.
 */
function OtpCodeStep(props: {
  target: string;
  length: number;
  error: FlowError | undefined;
  submitting: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
  /** Purely a static marker for `stapel/clickable-needs-event` — the actual
   * submit happens inside, on `Input.OTP`'s auto-fill (a flow action; the
   * machine auto-emits `flow.<id>.<step>`), not on a DOM click/submit here. */
  "data-analytics"?: "flow";
}): ReactElement {
  const t = useT();
  const errorText = useErrorText();
  const [code, setCode] = useState("");
  const submittedRef = useRef(false);
  const otpRef = useRef<ElementRef<typeof Input.OTP>>(null);

  useEffect(() => {
    if (!props.error) return;
    setCode("");
    submittedRef.current = false;
    otpRef.current?.focus();
  }, [props.error]);

  function handleChange(value: string): void {
    setCode(value);
    if (value.length === props.length && !submittedRef.current && !props.submitting) {
      submittedRef.current = true;
      props.onSubmit(value);
    }
  }

  return (
    <Flex vertical gap="middle">
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.otpSentTo, { target: props.target })}
      </Typography.Text>
      <Flex vertical gap="small">
        <Typography.Text>{t(AUTH_I18N_KEYS.otpEnterCode)}</Typography.Text>
        <Input.OTP
          ref={otpRef}
          length={props.length}
          value={code}
          onChange={handleChange}
          autoFocus
          disabled={props.submitting}
          {...(props.error ? { status: "error" as const } : {})}
        />
        {props.error && (
          <Alert type="error" showIcon message={errorText(props.error)} />
        )}
      </Flex>
      <ResendLink onResend={props.onResend} />
    </Flex>
  );
}

/** Email / phone one-time-code panel (ПРАВИЛА 8-9). */
export function OtpPanel(props: { channel: OtpChannel }): ReactElement {
  const t = useT();
  const fieldError = useFieldError();
  const caps = useCapabilities();
  const otpLength = caps.data?.login.otp_code_length ?? DEFAULT_OTP_LENGTH;
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
            <OtpCodeStep
              target={s.target}
              length={otpLength}
              error={err}
              submitting={s.step === "verifying"}
              onSubmit={(code) => bag.submitCode(code)}
              onResend={() => bag.resend()}
              data-analytics="flow"
            />
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

/**
 * Social panel — one button per configured OAuth provider (owner directive
 * point 1/4: OAuth is a GROUP of provider buttons, never a single form or a
 * tab). Each button is a direct, full-page redirect
 * (`authUrls(base).oauthAuthorize`, auth-sa.md §7 option A) — no client state,
 * no dialog needed, which is why `resolveInteraction("oauth", …)` defaults to
 * `"redirect"` in `channels.ts`. Rendered inline in the bottom icon row AND
 * (identically) inside the overflow dialog when a plan places `oauth` there.
 */
export function OAuthPanel(props: {
  providers: readonly OAuthProviderInfo[];
  /** `location.href` by default — where the provider redirects back to. */
  redirectUri?: string;
  /** Per-provider icon override (keyed by provider id), e.g. `{ google: <MyGoogleMark/> }`. */
  iconOverrides?: Readonly<Record<string, ReactNode>>;
}): ReactElement {
  const api = useAuthApi();
  const redirectUri =
    props.redirectUri ??
    (typeof window !== "undefined" ? window.location.href : "/");
  return (
    <Flex wrap gap="small" data-testid="oauth-panel">
      {props.providers.map((provider) => {
        const href = authUrls(api.client.baseUrl).oauthAuthorize(
          provider.id,
          redirectUri
        );
        const icon = props.iconOverrides?.[provider.id] ?? (
          <Avatar size="small">{provider.name.slice(0, 1).toUpperCase()}</Avatar>
        );
        return (
          <Button key={provider.id} href={href} icon={icon} data-analytics="flow">
            {provider.name}
          </Button>
        );
      })}
    </Flex>
  );
}

/** SSO domain-lookup panel (auth-sa.md §18). A real form — domain in, look up,
 * then a full-page redirect to the resolved org's IdP — so it always opens as
 * a DIALOG from the overflow menu (owner directive point 3), never a tab. */
export function SsoPanel(): ReactElement {
  const t = useT();
  const errorText = useErrorText();
  return (
    <SsoDiscovery>
      {(bag) => {
        const s: SsoState = bag.state;
        const err = s.step === "error" ? s.error : undefined;
        const resolved = s.step === "resolved" ? s.result : undefined;
        return (
          <Flex vertical gap="middle">
            <Form
              layout="vertical"
              onFinish={(v: { domain?: string }) => bag.lookup(v.domain ?? "")}
            >
              <Form.Item
                name="domain"
                label={t(AUTH_I18N_KEYS.uiSsoDomainLabel)}
                {...(err ? { validateStatus: "error" as const, help: errorText(err) } : {})}
              >
                <Input autoFocus placeholder={t(AUTH_I18N_KEYS.uiSsoDomainPlaceholder)} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={s.step === "looking"}>
                {t(AUTH_I18N_KEYS.uiSubmit)}
              </Button>
            </Form>
            {resolved && resolved.sso_required && resolved.org_slug && (
              <Button
                type="primary"
                block
                onClick={() => bag.beginLogin(resolved.org_slug as string)}
                data-analytics="flow"
              >
                {t(AUTH_I18N_KEYS.uiSsoContinue)}
              </Button>
            )}
          </Flex>
        );
      }}
    </SsoDiscovery>
  );
}
