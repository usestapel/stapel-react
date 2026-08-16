/**
 * `<QrConfirmPanel/>` — the SECOND half of the `login_request` QR dance, and
 * the half this pair used to leave to chance.
 *
 * The dance: a signed-out desktop shows a `login_request` QR (`QrPanel`, the
 * sign-in screen's QR channel) and polls `/qr/{key}/status/`. A signed-in
 * phone scans it; stapel-auth's `/qr/{key}/scan/` sees an authenticated
 * scanner and redirects the phone to **`/qr-confirm?key=…`** (`qr/views.py`,
 * the path is hardcoded there). Only a `POST /qr/{key}/confirm/` from that
 * screen mints the grant the desktop is waiting for.
 *
 * That screen did not exist. The pair shipped the code, the poll loop and the
 * `qrConfirm` client method, but nothing to render at the address the backend
 * sends the scanner to — so every host resolved `/qr-confirm` through its own
 * catch-all, the phone landed on the home page looking perfectly fine, and
 * the desktop polled a key that nobody would ever confirm. No error was
 * raised on either device, because nothing failed: a route simply wasn't
 * there. This component, plus the `auth.qr_confirm` entry in the pair's nav
 * manifest, is what makes the backend's redirect land somewhere.
 *
 * The host owns the URL, so it reads `?key=` and passes it in (a router-free
 * pair cannot read the address bar for the host). `qrKey: null` is a stated
 * outcome, not a blank screen — a scanner that arrives without a code has to
 * be told to scan again.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Flex, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { toFlowError } from "../flows/errors.js";
import { useConfirmQrLogin, useRejectQrLogin } from "../model/mutations.js";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

/** The address bar is where the backend put the key, so an unconfigured
 *  mount reads it from there — the nav-manifest scaffold mounts every screen
 *  prop-free, and a component that can only work when a host remembers to
 *  thread a prop is the same fork this file exists to close. A host with a
 *  router of its own passes `qrKey` explicitly instead. */
function keyFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("key");
}

export interface QrConfirmPanelProps {
  /** The `key` query parameter of `/qr-confirm?key=…`. Omit to read it off
   *  the current address; `null` states "there is none" — rendered as a
   *  stated problem, never a silent no-op screen. */
  readonly qrKey?: string | null;
  /** Called after the waiting device has been signed in. A host typically
   *  navigates home from here. */
  readonly onApproved?: () => void;
  /** Called after the request was declined. */
  readonly onDeclined?: () => void;
  /** Override the heading (default: the `auth.qr.confirm.title` key). */
  readonly title?: string;
  /** Override the explanation line (default: `auth.qr.confirm.subtitle`). */
  readonly subtitle?: string;
}

type Settled = "approved" | "declined" | null;

export function QrConfirmPanel(props: QrConfirmPanelProps): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const confirm = useConfirmQrLogin();
  const reject = useRejectQrLogin();
  const [settled, setSettled] = useState<Settled>(null);
  const { onApproved, onDeclined } = props;
  const [readKey] = useState<string | null>(() =>
    props.qrKey === undefined ? keyFromLocation() : props.qrKey
  );
  const qrKey = props.qrKey === undefined ? readKey : props.qrKey;

  const title = props.title ?? t(AUTH_I18N_KEYS.qrConfirmTitle);

  if (qrKey === null || qrKey === "") {
    return (
      <Card title={title} data-testid="qr-confirm-panel" style={{ width: "100%" }}>
        <Alert type="warning" showIcon message={t(AUTH_I18N_KEYS.qrConfirmNoKey)} />
      </Card>
    );
  }

  // A refusal from either call is SHOWN. The person is standing in front of
  // a decision they were asked to make; "nothing happened" is not an answer
  // to it, and the device on the other end is still waiting either way.
  const failure = (confirm.error ?? reject.error) as StapelApiError | null;
  const busy = confirm.isPending || reject.isPending;

  return (
    <Card title={title} data-testid="qr-confirm-panel" style={{ width: "100%" }}>
      <Flex vertical gap="middle" style={{ width: "100%" }}>
        {settled === null && (
          <Typography.Text type="secondary">
            {props.subtitle ?? t(AUTH_I18N_KEYS.qrConfirmSubtitle)}
          </Typography.Text>
        )}

        {settled === "approved" && (
          <Alert
            type="success"
            showIcon
            message={t(AUTH_I18N_KEYS.qrConfirmApproved)}
          />
        )}

        {settled === "declined" && (
          <Alert
            type="info"
            showIcon
            message={t(AUTH_I18N_KEYS.qrConfirmDeclined)}
          />
        )}

        {failure !== null && settled === null && (
          <Alert type="error" showIcon message={formatError(toFlowError(failure))} />
        )}

        {settled === null && (
          <Flex gap="small" wrap>
            <Button
              type="primary"
              loading={confirm.isPending}
              disabled={busy}
              data-analytics="flow"
              onClick={() => {
                confirm.mutate(qrKey, {
                  onSuccess: () => {
                    setSettled("approved");
                    onApproved?.();
                  },
                });
              }}
            >
              {t(AUTH_I18N_KEYS.qrConfirmApprove)}
            </Button>
            <Button
              danger
              loading={reject.isPending}
              disabled={busy}
              data-analytics="flow"
              onClick={() => {
                reject.mutate(qrKey, {
                  onSuccess: () => {
                    setSettled("declined");
                    onDeclined?.();
                  },
                });
              }}
            >
              {t(AUTH_I18N_KEYS.qrConfirmDecline)}
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
