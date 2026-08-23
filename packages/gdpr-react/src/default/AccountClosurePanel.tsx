/**
 * `<AccountClosurePanel>` — "is my account being deleted?", answered.
 *
 * THREE arms from `matchLoad`, and the ready arm has two shapes:
 *
 *   loading   — we are asking
 *   failed    — we could not ask                 (retry, never "you're fine")
 *   ready(null)   — nothing is being deleted     (offer the destructive door)
 *   ready(closure) — a DATE, and the way back    (never a countdown)
 *
 * ── Why `ready(null)` is not the empty state ──────────────────────────────
 *
 * The read answers **404** when no closure exists, which is what almost every
 * account looks like. `useAccountClosure` folds that into `null` — so the
 * panel is never "empty": it either offers deletion or reports one. A skin
 * that had rendered the raw 404 would put "not found" on the screen a person
 * opened to ask whether their account was about to disappear, which is the
 * one place an ambiguous answer is unacceptable.
 *
 * ── The banner carries a date, and so does the confirmation ───────────────
 *
 * `grace_ends_at` comes off the wire and is only FORMATTED here. The confirm
 * dialog shows the same instant BEFORE the person commits, so the promise on
 * the button and the promise in the banner are the same sentence — and both
 * are the instant the sweep task will act on, not a browser's arithmetic.
 *
 * ── Two 409s, told apart ──────────────────────────────────────────────────
 *
 * `closure_already_pending` is a no-op: somebody else's tab already did it,
 * so the panel simply re-reads and shows the banner. `legal_hold` is a legal
 * refusal a person is entitled to have explained, and it is rendered as its
 * own warning with the remediation the registry declares
 * (`contact_support`), never as a generic failure.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Modal,
  Skeleton,
  Typography,
} from "antd";
import { matchLoad, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import { toFlowError } from "../flows/errors.js";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { useAccountClosure } from "../model/closure.js";
import { formatDeletionDate } from "../model/dates.js";
import { isClosureAlreadyPending, isLegalHold } from "../model/refusals.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { GdprSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface AccountClosurePanelProps extends ThemeModeProp {
  /** Called once the closure has actually been started, for a host that wants
   * to route away (to a goodbye page) or refresh its own chrome. */
  readonly onClosureStarted?: () => void;
}

export function AccountClosurePanel(
  props: AccountClosurePanelProps
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useAccountClosure();
  const [confirming, setConfirming] = useState(false);

  const started = bag.initiate.isSuccess;
  const { onClosureStarted } = props;
  useEffect(() => {
    if (started) onClosureStarted?.();
  }, [started, onClosureStarted]);

  // A 409 "already pending" is not an error to SHOW: somebody else's tab (or
  // this one, twice) already started the closure, so the truthful screen is
  // the banner, not a complaint. The re-read is the model's job
  // (`useAccountClosure` invalidates on that code); this only suppresses the
  // alert.
  const initiateError = bag.initiate.error;
  const alreadyPending =
    initiateError != null && isClosureAlreadyPending(initiateError);

  const graceDate =
    bag.graceEndsAt !== undefined
      ? formatDeletionDate(bag.graceEndsAt, locale)
      : undefined;

  return (
    <GdprSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        data-testid="gdpr-closure"
        title={t(GDPR_I18N_KEYS.closureHeading)}
        size="small"
      >
        <Flex vertical gap={12}>
          {matchLoad(bag.state, {
            loading: () => (
              <div data-testid="gdpr-closure-loading">
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ),
            failed: (error) => (
              <ErrorAlert
                testId="gdpr-closure-failed"
                error={describe(toFlowError(error))}
                action={
                  <Button
                    size="small"
                    onClick={bag.refetch}
                    data-analytics="none"
                    data-analytics-reason="recovery affordance for a failed read — host app wraps with its own tracked()"
                  >
                    {t(GDPR_I18N_KEYS.retry)}
                  </Button>
                }
              />
            ),
            ready: (closure) =>
              closure === null ? (
                <IdleState
                  onOpen={() => setConfirming(true)}
                  busy={bag.initiate.isPending}
                  error={alreadyPending ? undefined : initiateError}
                />
              ) : (
                <ScheduledState
                  date={graceDate}
                  canCancel={bag.canCancel}
                  busy={bag.cancel.isPending}
                  onCancel={() => bag.cancel.mutate()}
                  error={bag.cancel.error}
                />
              ),
          })}
        </Flex>
      </Card>

      <Modal
        open={confirming}
        title={t(GDPR_I18N_KEYS.closureConfirmTitle)}
        okText={t(GDPR_I18N_KEYS.closureConfirmOk)}
        cancelText={t(GDPR_I18N_KEYS.closureConfirmCancel)}
        okButtonProps={{ danger: true, loading: bag.initiate.isPending }}
        onCancel={() => setConfirming(false)}
        onOk={() => {
          bag.initiate.mutate(undefined, {
            onSettled: () => setConfirming(false),
          });
        }}
      >
        {/* The confirm text carries the same date the banner will, so nobody
            commits to a deadline they are shown only afterwards. `{date}` is
            interpolated as the server's instant, formatted — the panel has no
            date of its own to offer before a closure exists, and says the
            sentence without one rather than inventing "in 30 days". */}
        <Typography.Paragraph data-testid="gdpr-closure-confirm-body">
          {graceDate !== undefined
            ? t(GDPR_I18N_KEYS.closureConfirmBody, { date: graceDate })
            : t(GDPR_I18N_KEYS.closureExplain)}
        </Typography.Paragraph>
      </Modal>
    </GdprSkinTheme>
  );
}

/** Nothing is being deleted: explain the consequence, then offer the door. */
function IdleState(props: {
  onOpen: () => void;
  busy: boolean;
  error: unknown;
}): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const legalHold = props.error != null && isLegalHold(props.error);
  return (
    <Flex vertical gap={12} data-testid="gdpr-closure-idle">
      <Alert
        type="success"
        showIcon
        data-testid="gdpr-closure-none"
        message={t(GDPR_I18N_KEYS.closureNone)}
      />
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t(GDPR_I18N_KEYS.closureExplain)}
      </Typography.Paragraph>
      {legalHold ? (
        <Alert
          type="warning"
          showIcon
          data-testid="gdpr-closure-legal-hold"
          message={t(GDPR_I18N_KEYS.errorLegalHold)}
        />
      ) : props.error != null ? (
        <ErrorAlert
          testId="gdpr-closure-initiate-failed"
          error={describe(toFlowError(props.error))}
        />
      ) : null}
      <div>
        <Button
          danger
          loading={props.busy}
          onClick={props.onOpen}
          data-testid="gdpr-closure-initiate"
          data-analytics="none"
          data-analytics-reason="opens a confirm dialog; the destructive step is the modal's ok — host app wraps with its own tracked()"
        >
          {t(GDPR_I18N_KEYS.closureInitiate)}
        </Button>
      </div>
    </Flex>
  );
}

/** A closure exists: the DATE, and the way back while there is one. */
function ScheduledState(props: {
  date: string | undefined;
  canCancel: boolean;
  busy: boolean;
  onCancel: () => void;
  error: unknown;
}): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  // Grace is over once the erasure is running: the module stops accepting a
  // cancel, and the panel must stop implying one is possible.
  const erasing = !props.canCancel;
  return (
    <Flex vertical gap={12} data-testid="gdpr-closure-scheduled">
      <Alert
        type={erasing ? "error" : "warning"}
        showIcon
        data-testid="gdpr-closure-banner"
        message={
          props.date !== undefined
            ? t(GDPR_I18N_KEYS.closureScheduled, { date: props.date })
            : t(GDPR_I18N_KEYS.closureDeleting)
        }
        description={
          erasing ? (
            <Typography.Text type="secondary" data-testid="gdpr-closure-final">
              {t(GDPR_I18N_KEYS.closureDeleting)}
            </Typography.Text>
          ) : undefined
        }
      />
      {props.error != null ? (
        <ErrorAlert
          testId="gdpr-closure-cancel-failed"
          error={describe(toFlowError(props.error))}
        />
      ) : null}
      {props.canCancel ? (
        <div>
          <Button
            type="primary"
            loading={props.busy}
            onClick={props.onCancel}
            data-testid="gdpr-closure-cancel"
            data-analytics="none"
            data-analytics-reason="recovery affordance — host app wraps with its own tracked()"
          >
            {t(GDPR_I18N_KEYS.closureCancel)}
          </Button>
        </div>
      ) : null}
    </Flex>
  );
}
