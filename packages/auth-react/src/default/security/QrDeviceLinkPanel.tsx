/**
 * `<QrDeviceLinkPanel/>` — default skin for `session_share` QR device-handoff
 * (auth-sa.md §8; ironmemo parity — a logged-in device generates a QR, an
 * unauthenticated device scans it with a camera and receives the same
 * session). Built entirely on the pair's EXISTING `QrLogin` headless flow
 * (`qrGenerate`/`qrStatus`/`qrReject` — no new backend surface): this
 * component only adds the UI shape ironmemo's frontend already validated —
 * immediate QR render on trigger (no extra "generate" click), a live TTL
 * countdown, silent auto-refresh on backend-reported `expired` (the flow's
 * existing behavior), and a Cancel action that best-effort tells the backend
 * to invalidate the pending key.
 *
 * GENERIC BY DESIGN — not settings-bound. The primary product surface for
 * this flow is expected to be a "continue this on your phone" moment (e.g. a
 * live call/meeting page handing off via `redirectUrl`), with the security-
 * settings "add a device" card a secondary placement. Title/subtitle/
 * `redirectUrl` are all props so a host can drop this anywhere; it only
 * lives under `security/` because that's where the pair's default-skin
 * components are organized, not because it's settings-only.
 *
 * `allowUnauthenticatedScanner` defaults to `true` here because an
 * unauthenticated scanner is the entire point of this component (stapel-auth
 * defaults the flag to `false` server-side and 403s otherwise — see
 * `QRGenerateRequest.allow_unauthenticated_scanner` in stapel-auth's schema).
 * A host that wants the stricter "same-user-only" merge behavior instead of
 * "any camera can claim this session" can pass `allowUnauthenticatedScanner={false}`.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Flex, QRCode, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { QrLoginBag } from "../../headless/QrLogin.js";
import type { QrLoginState } from "../../flows/qrLoginFlow.js";
import { QrLogin } from "../../headless/QrLogin.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m)}:${r.toString().padStart(2, "0")}`;
}

/** Antd's `<QRCode status>` primitive expresses generating/expired visually
 * (ПРАВИЛО 6 — states are expressed by the primitive, not hand-drawn
 * overlays); the text countdown below it is the ironmemo-parity addition. */
function qrCodeStatus(step: QrLoginState["step"]): "active" | "expired" | "loading" {
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

/** Live TTL countdown for the current `awaitingScan` key. Resets whenever the
 * key changes (manual refresh, or the flow's own silent auto-regenerate on a
 * backend-reported `expired`). Counts down from the `expires_in` the backend
 * handed back at generate time — the backend's own `expired` status (seen on
 * the next poll tick) is still what actually drives the refresh, this is
 * display-only. */
function useCountdown(state: QrLoginState): number | null {
  const key = state.step === "awaitingScan" ? state.key : null;
  const expiresIn = state.step === "awaitingScan" ? state.expiresIn : null;
  const deadlineRef = useRef<number | null>(null);
  const seenKeyRef = useRef<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (key === null || expiresIn === null) {
      deadlineRef.current = null;
      seenKeyRef.current = null;
      setSecondsLeft(null);
      return;
    }
    if (seenKeyRef.current !== key) {
      seenKeyRef.current = key;
      deadlineRef.current = Date.now() + expiresIn * 1000;
      setSecondsLeft(expiresIn);
    }
    const id = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      setSecondsLeft(Math.max(0, (deadline - Date.now()) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [key, expiresIn]);

  return secondsLeft;
}

/** The active journey — a genuine component (not hooks inlined in the
 * render-prop lambda), same rule the sign-in `QrPanel` and other security
 * dialogs follow, so its `useCountdown`/`useEffect` are unambiguously its
 * own hooks. */
function QrJourney(props: {
  bag: QrLoginBag;
  type: "session_share" | "login_request";
  redirectUrl: string;
  allowUnauthenticatedScanner: boolean;
  onCancel: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag, type, redirectUrl, allowUnauthenticatedScanner } = props;
  const s = bag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bag.start(type, redirectUrl, allowUnauthenticatedScanner);
  }, [bag, type, redirectUrl, allowUnauthenticatedScanner]);

  const secondsLeft = useCountdown(s);
  const scanUrl = s.step === "awaitingScan" ? s.scanUrl : "-";
  const regenerate = (): void => bag.start(type, redirectUrl, allowUnauthenticatedScanner);

  return (
    <Flex vertical align="center" gap="middle">
      <QRCode value={scanUrl} status={qrCodeStatus(s.step)} onRefresh={regenerate} size={200} />

      {s.step === "awaitingScan" && (
        <Typography.Text type="secondary">
          {secondsLeft !== null && secondsLeft > 0
            ? t(AUTH_I18N_KEYS.secQrExpiresIn, { time: formatCountdown(secondsLeft) })
            : t(AUTH_I18N_KEYS.secQrExpiring)}
        </Typography.Text>
      )}

      {s.step === "fulfilled" && (
        <Alert type="success" showIcon message={t(AUTH_I18N_KEYS.secQrFulfilled)} />
      )}

      {s.step === "rejected" && (
        <Flex vertical align="center" gap="small">
          <Alert type="warning" showIcon message={t(AUTH_I18N_KEYS.secQrRejected)} />
          <Button onClick={regenerate} data-analytics="flow">
            {t(AUTH_I18N_KEYS.secQrRetry)}
          </Button>
        </Flex>
      )}

      {s.step === "error" && (
        <Flex vertical align="center" gap="small">
          <Alert type="error" showIcon message={formatError(s.error)} />
          <Button onClick={regenerate} data-analytics="flow">
            {t(AUTH_I18N_KEYS.secQrRetry)}
          </Button>
        </Flex>
      )}

      {(s.step === "awaitingScan" || s.step === "generating") && (
        <Button type="link" onClick={props.onCancel} data-analytics="flow">
          {t(AUTH_I18N_KEYS.secQrCancel)}
        </Button>
      )}
    </Flex>
  );
}

export interface QrDeviceLinkPanelProps {
  /** Where the scanning device lands after it receives the session. Relative
   * path or full same-origin URL. Defaults to `/`. This is the panel's
   * primary use case: hand off to e.g. a live meeting/call page, not just
   * "back to the app". */
  readonly redirectUrl?: string;
  /** Override the heading. Defaults to the `auth.sec.qr.title` i18n key. */
  readonly title?: string;
  /** Override the description line. Defaults to `auth.sec.qr.subtitle`. */
  readonly subtitle?: string;
  /** `session_share` only: allow a scanner with NO session to receive this
   * session (stapel-auth 403s an unauthenticated scan otherwise). Defaults to
   * `true` — an already-logged-in scanner still just merges into this
   * session either way; this flag only gates the unauthenticated-scanner
   * case, which is this component's whole reason to exist. */
  readonly allowUnauthenticatedScanner?: boolean;
}

/** Device-handoff QR panel: a trigger that renders the code immediately (no
 * extra clicks — ПРАВИЛО 6), live TTL countdown, silent auto-refresh, and
 * fulfilled/rejected/error status. Not mounted (and not polling) until the
 * host renders it and the user clicks through — same idle-until-triggered
 * shape as `TotpManager`/`PasskeysManager`'s dialogs, just inline instead of
 * a `Modal` so the QR is visible without stacking a dialog on top of a
 * settings page (or a call page, its primary use case). */
export function QrDeviceLinkPanel(props: QrDeviceLinkPanelProps): ReactElement {
  const t = useT();
  const [active, setActive] = useState(false);
  const redirectUrl = props.redirectUrl ?? "/";
  const allowUnauthenticatedScanner = props.allowUnauthenticatedScanner ?? true;

  return (
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="qr-device-link-panel">
      <div>
        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
          {props.title ?? t(AUTH_I18N_KEYS.secQrTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">
          {props.subtitle ?? t(AUTH_I18N_KEYS.secQrSubtitle)}
        </Typography.Text>
      </div>

      {!active ? (
        <Flex>
          <Button
            type="primary"
            onClick={() => setActive(true)}
            data-analytics="none"
            data-analytics-reason="local-ui-reveal-qr-panel"
          >
            {t(AUTH_I18N_KEYS.secQrShowCta)}
          </Button>
        </Flex>
      ) : (
        <QrLogin>
          {(bag) => (
            <QrJourney
              bag={bag}
              type="session_share"
              redirectUrl={redirectUrl}
              allowUnauthenticatedScanner={allowUnauthenticatedScanner}
              onCancel={() => {
                bag.cancel();
                setActive(false);
              }}
            />
          )}
        </QrLogin>
      )}
    </Flex>
  );
}
