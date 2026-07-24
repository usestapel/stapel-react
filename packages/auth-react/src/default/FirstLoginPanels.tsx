/**
 * Default skins for the first-login enforcement pair (org-program §C2,
 * stapel-auth ≥0.12.0): `ForcedPasswordChangeCard` (requires=password_change)
 * and `MfaEnrollPanel` (requires=mfa_enroll). Both follow the AuthPanel canon:
 * self-themed via `ConfigProvider` + `toAntdThemeConfig(mode)` so they work
 * standalone (a host routing the intermediates itself), and compose cleanly
 * inside `AuthPanel`'s own provider (nested antd ConfigProviders merge).
 *
 * `MfaEnrollPanel` deliberately does NOT embed `TotpManager`/`PasskeysManager`
 * (the security-settings skins): those are status-driven managers reading
 * `useSecurityStatus`/`usePasskeys` — endpoints OUTSIDE the limited
 * enroll-only session's surface (they answer 403 `mfa_enrollment_required`
 * there). It instead dresses the pair's EXISTING `TotpSetup` /
 * `PasskeyRegistration` headless journeys — the exact enrollment surface the
 * limited session allows — inside `MfaEnrollGate`'s enroll-scoped runtime.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  ConfigProvider,
  Flex,
  Form,
  Input,
  QRCode,
  Result,
  Segmented,
  Spin,
  Typography,
} from "antd";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { FlowError } from "../flows/errors.js";
import type { AuthTokens } from "../api/types.js";
import type { MfaEnrollMethod } from "../flows/firstLoginFlow.js";
import { ForcedPasswordChange, MfaEnrollGate } from "../headless/FirstLogin.js";
import type { MfaEnrollGateBag } from "../headless/FirstLogin.js";
import { TotpSetup } from "../headless/TotpSetup.js";
import type { TotpSetupBag } from "../headless/TotpSetup.js";
import { PasskeyRegistration } from "../headless/Passkey.js";
import type { WebauthnBinding } from "../headless/Passkey.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

/** Fallback when the backend omits `otp.totp_code_length` metadata. */
const DEFAULT_TOTP_LENGTH = 6;

// ── ForcedPasswordChangeCard ────────────────────────────────────────────────

export interface ForcedPasswordChangeCardProps {
  /** `challenge_token` from the login's FIRST_LOGIN_REQUIRED intermediate. */
  readonly challengeToken: string;
  /** Light or dark — theme from `@stapel/tokens` via `toAntdThemeConfig`. */
  readonly mode?: ThemeMode;
  /** THIN WebAuthn binding, forwarded to the chained enroll panel's passkey
   * journey (both-flags accounts chain password_change → mfa_enroll). */
  readonly webauthnCreate?: WebauthnBinding;
}

/**
 * The forced first-login password-change form (new password + confirm, one
 * primary action — ПРАВИЛО 5). On success the session is adopted through the
 * runtime; when the account also owes MFA enrollment the card chains straight
 * into {@link MfaEnrollPanel} with the fresh challenge.
 */
export function ForcedPasswordChangeCard(
  props: ForcedPasswordChangeCardProps
): ReactElement {
  const { mode = "light" } = props;
  const t = useT();
  const formatError = useFormatFlowError();
  const theme = useMemo(() => toAntdThemeConfig(mode), [mode]);
  const [mismatch, setMismatch] = useState(false);

  return (
    <ConfigProvider theme={theme}>
      <ForcedPasswordChange challengeToken={props.challengeToken}>
        {(bag) => {
          const s = bag.state;
          if (s.step === "authenticated") {
            return (
              <Result
                status="success"
                title={t(AUTH_I18N_KEYS.forcedChangeSuccess)}
              />
            );
          }
          if (s.step === "mfaEnrollRequired") {
            return (
              <MfaEnrollPanel
                challengeToken={s.challengeToken}
                mode={mode}
                {...(props.webauthnCreate !== undefined
                  ? { webauthnCreate: props.webauthnCreate }
                  : {})}
              />
            );
          }
          return (
            <Flex vertical gap="middle" data-testid="forced-password-change-card">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t(AUTH_I18N_KEYS.forcedChangeTitle)}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t(AUTH_I18N_KEYS.forcedChangeHint)}
              </Typography.Text>
              <Form
                layout="vertical"
                onFinish={(v: { password?: string; confirm?: string }) => {
                  const password = v.password ?? "";
                  if (password !== (v.confirm ?? "")) {
                    setMismatch(true);
                    return;
                  }
                  setMismatch(false);
                  // Submit the form value DIRECTLY (the bag's controlled
                  // `newPassword` only lands next render — antd Form owns the
                  // field here).
                  bag.submit(password);
                }}
              >
                <Form.Item
                  name="password"
                  label={t(AUTH_I18N_KEYS.forcedChangeNewLabel)}
                  {...(bag.error
                    ? {
                        validateStatus: "error" as const,
                        help: formatError(bag.error),
                      }
                    : {})}
                >
                  <Input.Password autoFocus />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  label={t(AUTH_I18N_KEYS.forcedChangeConfirmLabel)}
                  {...(mismatch
                    ? {
                        validateStatus: "error" as const,
                        help: t(AUTH_I18N_KEYS.forcedChangeMismatch),
                      }
                    : {})}
                >
                  <Input.Password />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={s.step === "submitting"}
                >
                  {t(AUTH_I18N_KEYS.forcedChangeSubmit)}
                </Button>
              </Form>
            </Flex>
          );
        }}
      </ForcedPasswordChange>
    </ConfigProvider>
  );
}

// ── MfaEnrollPanel ──────────────────────────────────────────────────────────

export interface MfaEnrollPanelProps {
  /** `challenge_token` from FIRST_LOGIN_REQUIRED (requires=mfa_enroll) — or
   * the forced password change's chained challenge. */
  readonly challengeToken: string;
  readonly mode?: ThemeMode;
  /** Restrict/reorder the offered factors. Default `["totp", "passkey"]`. */
  readonly methods?: readonly MfaEnrollMethod[];
  /** THIN WebAuthn binding for the passkey journey
   * (`navigator.credentials.create` — host-injected, MODULE.md
   * "Thin-WebAuthn"). Without it the passkey option still renders; the host
   * must then drive the ceremony itself via the headless layer instead. */
  readonly webauthnCreate?: WebauthnBinding;
  /** Total digits of a TOTP confirm code. Default 6. */
  readonly totpCodeLength?: number;
}

/**
 * The first-login MFA enrollment screen: factor picker (authenticator app /
 * passkey) over the pair's existing setup journeys, inside
 * {@link MfaEnrollGate}'s enroll-scoped runtime. Completing a factor commits
 * the full session through the runtime (`session.setTokens`).
 */
export function MfaEnrollPanel(props: MfaEnrollPanelProps): ReactElement {
  const { mode = "light" } = props;
  const theme = useMemo(() => toAntdThemeConfig(mode), [mode]);

  return (
    <ConfigProvider theme={theme}>
      <MfaEnrollGate
        challengeToken={props.challengeToken}
        {...(props.methods !== undefined ? { methods: props.methods } : {})}
      >
        {(bag) => (
          <MfaEnrollBody
            bag={bag}
            {...(props.webauthnCreate !== undefined
              ? { webauthnCreate: props.webauthnCreate }
              : {})}
            totpCodeLength={props.totpCodeLength ?? DEFAULT_TOTP_LENGTH}
          />
        )}
      </MfaEnrollGate>
    </ConfigProvider>
  );
}

const METHOD_LABEL: Record<
  MfaEnrollMethod,
  (typeof AUTH_I18N_KEYS)["mfaEnrollMethodTotp" | "mfaEnrollMethodPasskey"]
> = {
  totp: AUTH_I18N_KEYS.mfaEnrollMethodTotp,
  passkey: AUTH_I18N_KEYS.mfaEnrollMethodPasskey,
};

/** The gate's body — a real component (not hooks in a render-prop lambda). */
function MfaEnrollBody(props: {
  bag: MfaEnrollGateBag;
  webauthnCreate?: WebauthnBinding;
  totpCodeLength: number;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag } = props;
  const s = bag.state;

  if (s.step === "idle" || s.step === "exchanging") {
    return (
      <Flex vertical gap="middle" align="center" data-testid="mfa-enroll-panel">
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.mfaEnrollPreparing)}
        </Typography.Text>
        <Spin />
      </Flex>
    );
  }
  if (s.step === "exchangeError" || s.step === "completeError") {
    return (
      <Flex vertical gap="middle" data-testid="mfa-enroll-panel">
        <Alert type="error" showIcon message={formatError(s.error)} />
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.mfaEnrollRestartHint)}
        </Typography.Text>
      </Flex>
    );
  }
  if (s.step === "completing" || s.step === "authenticated") {
    return (
      <Result status="success" title={t(AUTH_I18N_KEYS.mfaEnrollSuccess)} />
    );
  }

  // enrolling — the factor picker + the active journey.
  const active = bag.active ?? bag.methods[0] ?? "totp";
  return (
    <Flex vertical gap="middle" data-testid="mfa-enroll-panel">
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t(AUTH_I18N_KEYS.mfaEnrollTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.mfaEnrollHint)}
      </Typography.Text>
      {bag.methods.length > 1 && (
        <Segmented
          value={active}
          onChange={(v) => bag.choose(v as MfaEnrollMethod)}
          options={bag.methods.map((m) => ({
            value: m,
            label: t(METHOD_LABEL[m]),
          }))}
          data-analytics="none"
          data-analytics-reason="local-ui-pick-enroll-method"
        />
      )}
      {active === "totp" ? (
        <TotpSetup>
          {(setupBag) => (
            <EnrollTotpJourney
              setupBag={setupBag}
              codeLength={props.totpCodeLength}
              onComplete={bag.complete}
            />
          )}
        </TotpSetup>
      ) : (
        <PasskeyRegistration
          {...(props.webauthnCreate !== undefined
            ? { webauthnCreate: props.webauthnCreate }
            : {})}
        >
          {(regBag) => {
            const rs = regBag.state;
            if (rs.step === "registered") {
              return (
                <EnrollFinish
                  tokens={rs.passkey.tokens ?? null}
                  onComplete={bag.complete}
                />
              );
            }
            const err = rs.step === "error" ? rs.error : undefined;
            return (
              <Flex vertical gap="middle">
                <Button
                  type="primary"
                  block
                  loading={rs.step !== "idle" && rs.step !== "error"}
                  onClick={() => regBag.begin()}
                  data-analytics="flow"
                >
                  {t(AUTH_I18N_KEYS.mfaEnrollMethodPasskey)}
                </Button>
                {err && (
                  <Alert type="error" showIcon message={formatError(err)} />
                )}
              </Flex>
            );
          }}
        </PasskeyRegistration>
      )}
    </Flex>
  );
}

/** TOTP journey inside the enroll session: auto-start → QR + secret →
 * confirm → one-time backup codes → finish (commit the full session). */
function EnrollTotpJourney(props: {
  setupBag: TotpSetupBag;
  codeLength: number;
  onComplete: (tokens: AuthTokens | null) => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { setupBag } = props;
  const s = setupBag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setupBag.start();
  }, [setupBag]);

  if (s.step === "idle" || s.step === "starting") {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }
  if (s.step === "startError" || s.step === "proofRequired") {
    // `proofRequired` cannot legitimately happen on a first-login enroll (a
    // provisioned account has no active device) — treat both as plain errors.
    const error: FlowError | undefined = s.error;
    return (
      <Flex vertical gap="middle" align="center">
        {error && <Alert type="error" showIcon message={formatError(error)} />}
        <Button type="primary" onClick={() => setupBag.start()} data-analytics="flow">
          {t(AUTH_I18N_KEYS.secTotpSetUp)}
        </Button>
      </Flex>
    );
  }
  if (s.step === "done") {
    return (
      <Flex vertical gap="middle">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(AUTH_I18N_KEYS.secTotpBackupCodesTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.secTotpBackupCodesHint)}
        </Typography.Text>
        <Flex vertical gap={4}>
          {s.backupCodes.map((c) => (
            <Typography.Text code key={c}>
              {c}
            </Typography.Text>
          ))}
        </Flex>
        <Button
          type="primary"
          onClick={() => props.onComplete(s.tokens)}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.mfaEnrollBackupCodesAck)}
        </Button>
      </Flex>
    );
  }
  // enrolling / confirming / confirmError — QR + manual secret + confirm.
  const err = s.step === "confirmError" ? s.error : undefined;
  return (
    <Flex vertical gap="middle" align="center">
      <Typography.Text>{t(AUTH_I18N_KEYS.secTotpScanHint)}</Typography.Text>
      <QRCode value={s.qrUri} />
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.secTotpSecretLabel)}:{" "}
        <Typography.Text code>{s.secret}</Typography.Text>
      </Typography.Text>
      <Form
        layout="vertical"
        style={{ width: "100%" }}
        onFinish={(v: { code?: string }) => setupBag.confirm(v.code ?? "")}
      >
        <Form.Item
          name="code"
          label={t(AUTH_I18N_KEYS.secTotpConfirmLabel)}
          {...(err
            ? { validateStatus: "error" as const, help: formatError(err) }
            : {})}
        >
          <Input.OTP length={props.codeLength} autoFocus />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={s.step === "confirming"}
          data-analytics="flow"
        >
          {t(AUTH_I18N_KEYS.secTotpConfirmCta)}
        </Button>
      </Form>
    </Flex>
  );
}

/** Passkey enroll finish: commit the tokens the complete endpoint returned.
 * Fires once on mount — a real component so the effect is unambiguous. */
function EnrollFinish(props: {
  tokens: AuthTokens | null;
  onComplete: (tokens: AuthTokens | null) => void;
}): ReactElement {
  const fired = useRef(false);
  const { tokens, onComplete } = props;
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    onComplete(tokens);
  }, [tokens, onComplete]);
  return (
    <Flex justify="center">
      <Spin />
    </Flex>
  );
}
