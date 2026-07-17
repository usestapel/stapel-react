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
import { Alert, Button, Drawer, Flex, Modal, QRCode, Typography } from "antd";
import { useBreakpoint, useFormatFlowError, useT } from "@stapel/core";
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

  // Latches once a code has actually been shown — distinguishes the FIRST
  // generate (a bare antd loading spinner is the right amount of ceremony)
  // from an auto-REGENERATE after the backend reports `expired` (owner UX
  // audit, ironmemo-frontend reference semantics reproduced: say so, rather
  // than silently swapping the old code for a spinner with zero explanation —
  // indistinguishable, without this line, from the panel just hanging).
  const hadKeyRef = useRef(false);
  if (s.step === "awaitingScan") hadKeyRef.current = true;

  const secondsLeft = useCountdown(s);
  const scanUrl = s.step === "awaitingScan" ? s.scanUrl : "-";
  const regenerate = (): void => bag.start(type, redirectUrl, allowUnauthenticatedScanner);

  return (
    <Flex vertical align="center" gap="middle">
      {/* Explicit white/black, never the app's ambient theme (owner UX audit
          2026-07-17): a QR code IS the content, not decor — it needs real
          light/dark contrast plus a light quiet-zone margin to be
          camera-scannable. antd's `<QRCode>` defaults to a transparent
          background, which over anything but a plain white page renders a
          technically-valid but practically unscannable low-contrast
          pattern — the same bug already fixed once for the in-room QR
          modal (`components/room/QRModal.tsx` in the meettoday host app);
          this is that same fix applied to the settings-tab surface. */}
      {/* eslint-disable-next-line stapel/no-raw-colors -- deliberate, theme-INDEPENDENT pure white/black: a QR code's camera contrast is a functional requirement, not decor, and must not follow dark mode into low-contrast token colours */}
      <div style={{ background: "#ffffff", padding: 16, borderRadius: 8 }}>
        <QRCode
          value={scanUrl}
          status={qrCodeStatus(s.step)}
          onRefresh={regenerate}
          color="#000000"
          bgColor="#ffffff"
          bordered={false}
          size={240}
        />
      </div>

      {s.step === "generating" && hadKeyRef.current && (
        <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secQrRegenerating)}</Typography.Text>
      )}

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

/** Device-handoff QR panel: a settings-list-style row (title/subtitle + a
 * trigger) that opens the actual QR journey in a dialog — a `Modal` on
 * tablet/desktop, a bottom `Drawer` ("sheet") on phone (`useBreakpoint`,
 * same convention `AuthPanel`'s alt-method dialog follows), NOT inline
 * below the row (owner UX audit 2026-07-17: an inline reveal read as "stuck
 * in the settings list" and, on phone, pushed the rest of the security tab
 * out of view — the mounting problem was this component itself, not
 * whatever the host wrapped it in). Not mounted (and not polling) until the
 * dialog is actually opened — same idle-until-triggered shape as
 * `TotpManager`/`PasskeysManager`'s dialogs, which this now matches exactly. */
export function QrDeviceLinkPanel(props: QrDeviceLinkPanelProps): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isPhone = useBreakpoint() === "phone";
  const redirectUrl = props.redirectUrl ?? "/";
  const allowUnauthenticatedScanner = props.allowUnauthenticatedScanner ?? true;
  const title = props.title ?? t(AUTH_I18N_KEYS.secQrTitle);

  const body = (
    <QrLogin>
      {(bag) => (
        <QrJourney
          bag={bag}
          type="session_share"
          redirectUrl={redirectUrl}
          allowUnauthenticatedScanner={allowUnauthenticatedScanner}
          onCancel={() => {
            bag.cancel();
            setOpen(false);
          }}
        />
      )}
    </QrLogin>
  );

  return (
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="qr-device-link-panel">
      <div>
        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">
          {props.subtitle ?? t(AUTH_I18N_KEYS.secQrSubtitle)}
        </Typography.Text>
      </div>

      <Flex>
        <Button
          type="primary"
          onClick={() => setOpen(true)}
          data-analytics="none"
          data-analytics-reason="local-ui-open-qr-dialog"
        >
          {t(AUTH_I18N_KEYS.secQrShowCta)}
        </Button>
      </Flex>

      {isPhone ? (
        <Drawer open={open} title={title} onClose={() => setOpen(false)} placement="bottom" size="large" destroyOnHidden>
          {body}
        </Drawer>
      ) : (
        <Modal open={open} title={title} onCancel={() => setOpen(false)} footer={null} destroyOnHidden>
          {body}
        </Modal>
      )}
    </Flex>
  );
}
