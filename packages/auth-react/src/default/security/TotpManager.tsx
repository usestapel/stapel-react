/**
 * `<TotpManager/>` — default skin for the security-settings two-factor screen
 * (owner directive point 5; auth-sa.md §11). Enable/replace uses the pair's
 * existing `TotpSetup` headless flow (start → QR/secret → confirm → one-time
 * backup codes); disable uses the existing `useDisableTotp` mutation.
 * Status/backup-count read from the existing `useSecurityStatus` query.
 *
 * REPLACE + DELAYED REMOVAL (stapel-auth ≥0.9.0): mirrors
 * `AuthenticatorChangePanel`'s instant/delayed split, scoped to one factor:
 *  - **Replace** (proof of the CURRENT device, applied immediately): the SAME
 *    `TotpSetup` headless flow, now proof-gated — `TotpSetupState`'s
 *    `"proofRequired"` step surfaces the 400 `totp_proof_required` the
 *    backend raises when an active device already exists and no proof was
 *    given.
 *  - **Delayed removal** ("lost device", 14-day wait, no proof required): the
 *    new `useTotpDelayedChangeStatus`/`useInitiateTotpDelayedChange`/
 *    `useCancelTotpDelayedChange` hooks — plain CRUD, not a flow machine,
 *    same as the channel delayed-change hooks. `useTotpDelayedChangeStatus`
 *    is checked FIRST on every render: a pending delayed removal
 *    short-circuits the whole card in favor of a pending-status banner (SPEC
 *    — same "pending banner instead of the change UI" rule as
 *    `AuthenticatorChangePanel`).
 *
 * SMS-based disable (`_TOTPDisableByOTP`) is left for a follow-up — this
 * ships authenticator-code and backup-code disable only.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { FlowError } from "@stapel/core";
import type { TotpSetupBag } from "../../headless/TotpSetup.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  QRCode,
  Result,
  Spin,
  Typography,
} from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import { useQueryClient } from "@tanstack/react-query";
import { TotpSetup } from "../../headless/TotpSetup.js";
import type { DelayedChangeStatus } from "../../api/types.js";
import {
  useCancelTotpDelayedChange,
  useDisableTotp,
  useInitiateTotpDelayedChange,
} from "../../model/mutations.js";
import {
  useCapabilities,
  useSecurityStatus,
  useTotpDelayedChangeStatus,
} from "../../model/queries.js";
import { authQueryKeys } from "../../model/queryKeys.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";

const LOW_BACKUP_THRESHOLD = 3;
/** Fallback when the backend omits `otp.totp_code_length` (stapel-auth <0.6.0). */
const DEFAULT_TOTP_LENGTH = 6;
/** Backend error code for a delayed-removal initiate with no verified email
 * or phone to notify (stapel-auth ≥0.9.0) — a dead end, not a retry loop. */
const NO_VERIFIED_CONTACT_CODE = "error.400.no_verified_contact";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/**
 * Delayed-removal ("lost device") initiate form — no old-proof, no new value
 * either (unlike the channel flow's `DelayedRequestForm`, TOTP delayed change
 * has no new-value axis: the only outcome is a scheduled disable), just an
 * explanation + a confirm action. `no_verified_contact` is a genuine dead end
 * (support case) — rendered as a `Result`, not another retry of the same
 * form.
 */
function DelayedInitiateForm(props: { onStarted: () => void }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const initiate = useInitiateTotpDelayedChange();

  if (initiate.isError && initiate.error.code === NO_VERIFIED_CONTACT_CODE) {
    return (
      <Result
        status="warning"
        title={t(AUTH_I18N_KEYS.secTotpNoContactTitle)}
        subTitle={t(AUTH_I18N_KEYS.secTotpNoContactHint)}
      />
    );
  }

  return (
    <Flex vertical gap="middle">
      <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secTotpDelayedHint)}</Typography.Text>
      {initiate.isError && (
        <Alert
          type="error"
          showIcon
          message={formatError({
            code: initiate.error.code,
            params: initiate.error.params,
            status: initiate.error.status,
            message: initiate.error.message,
            language: initiate.error.language,
          })}
        />
      )}
      <Button
        danger
        block
        loading={initiate.isPending}
        onClick={() => initiate.mutate(undefined, { onSuccess: props.onStarted })}
        data-analytics="flow"
      >
        {t(AUTH_I18N_KEYS.secTotpDelayedCta)}
      </Button>
    </Flex>
  );
}

/** Pending-delayed-removal banner — replaces the entire card body while a
 * delayed removal is in flight. */
function PendingBanner(props: { status: DelayedChangeStatus }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const cancel = useCancelTotpDelayedChange();
  const s = props.status;

  return (
    <Flex vertical gap="middle">
      <Alert
        type="info"
        showIcon
        message={t(AUTH_I18N_KEYS.secTotpPendingMessage, {
          date: s.scheduled_at ? formatDate(s.scheduled_at) : "",
          days: s.days_remaining ?? 0,
        })}
        description={t(AUTH_I18N_KEYS.secTotpPendingNote)}
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

/** The replace-proof form ("confirm your current device before replacing
 * it") — shown BEFORE `bag.start()` is even called when the caller already
 * knows a device is active (`isReplace`), and again reactively whenever the
 * backend answers with `"proofRequired"` (stale caller knowledge, or a wrong
 * proof on retry — `error` is set in that second case only). Also hosts the
 * "lost your authenticator?" escape hatch into the delayed flow, same
 * placement as `AuthenticatorChangePanel`'s "no access to old {channel}?". */
function ProofForm(props: {
  bag: TotpSetupBag;
  error?: FlowError;
  onLostDevice: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const [useBackup, setUseBackup] = useState(false);
  const { bag } = props;

  return (
    <Form
      layout="vertical"
      onFinish={(v: { proof?: string }) => {
        const proof = useBackup
          ? ({ backup_code: v.proof ?? "" } as const)
          : ({ code: v.proof ?? "" } as const);
        bag.start(proof);
      }}
    >
      <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secTotpReplaceHint)}</Typography.Text>
      {props.error && (
        <Alert
          type="error"
          showIcon
          style={{ margin: "12px 0" }}
          message={formatError(props.error)}
        />
      )}
      <Form.Item
        name="proof"
        label={t(
          useBackup ? AUTH_I18N_KEYS.secTotpDisableBackupLabel : AUTH_I18N_KEYS.secTotpDisableCodeLabel
        )}
        style={{ marginTop: 12 }}
      >
        <Input autoFocus />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        block
        loading={bag.state.step === "starting"}
        data-analytics="flow"
      >
        {t(AUTH_I18N_KEYS.secTotpReplaceContinueCta)}
      </Button>
      <Button
        type="link"
        onClick={() => setUseBackup((b) => !b)}
        data-analytics="none"
        data-analytics-reason="local-ui-toggle-backup-code"
      >
        {t(AUTH_I18N_KEYS.secTotpUseBackupToggle)}
      </Button>
      <Button type="link" onClick={props.onLostDevice} data-analytics="flow">
        {t(AUTH_I18N_KEYS.secTotpLostCta)}
      </Button>
    </Form>
  );
}

/** The enable/replace dialog's body, given the `TotpSetup` bag — a genuine
 * component (not hooks inlined in a render-prop lambda, same rule the
 * sign-in QR panel follows) so its `useRef`/`useEffect` are unambiguously ITS
 * OWN hooks. Auto-starts on mount for FIRST-TIME enrollment only — no
 * redundant "Set up" click inside a dialog the user opened by clicking "Set
 * up". A REPLACE (`isReplace`) instead opens straight on the proof form
 * (SPEC point 1 — "collects proof, THEN enrolls"), never firing the
 * proof-less request the backend would just 400 on. */
function SetupJourney(props: {
  bag: TotpSetupBag;
  isReplace: boolean;
  onDone: () => void;
  onDelayedStarted: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const [code, setCode] = useState("");
  const [showDelayed, setShowDelayed] = useState(false);
  const caps = useCapabilities();
  const totpLength = caps.data?.otp?.totp_code_length ?? DEFAULT_TOTP_LENGTH;
  const { bag, isReplace } = props;
  const s = bag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || isReplace) return;
    started.current = true;
    bag.start();
  }, [bag, isReplace]);

  if (showDelayed) {
    return <DelayedInitiateForm onStarted={props.onDelayedStarted} />;
  }
  if (s.step === "proofRequired") {
    return (
      <ProofForm
        bag={bag}
        {...(s.error ? { error: s.error } : {})}
        onLostDevice={() => setShowDelayed(true)}
      />
    );
  }
  if (s.step === "idle" && isReplace) {
    return <ProofForm bag={bag} onLostDevice={() => setShowDelayed(true)} />;
  }

  if (s.step === "idle" || s.step === "starting") {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }
  if (s.step === "startError") {
    return (
      <Flex vertical gap="middle" align="center">
        <Alert type="error" showIcon message={formatError(s.error)} />
        <Button type="primary" onClick={() => bag.start()} data-analytics="flow">
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
        <Button type="primary" onClick={props.onDone} data-analytics="flow">
          {t(AUTH_I18N_KEYS.secTotpBackupCodesAck)}
        </Button>
      </Flex>
    );
  }
  // enrolling / confirming / confirmError — the QR + manual code + confirm form.
  const err = s.step === "confirmError" ? s.error : undefined;
  return (
    <Flex vertical gap="middle" align="center">
      <Typography.Text>{t(AUTH_I18N_KEYS.secTotpScanHint)}</Typography.Text>
      <QRCode value={s.qrUri} />
      <Typography.Text type="secondary">
        {t(AUTH_I18N_KEYS.secTotpSecretLabel)}: <Typography.Text code>{s.secret}</Typography.Text>
      </Typography.Text>
      <Form
        layout="vertical"
        style={{ width: "100%" }}
        onFinish={(v: { code?: string }) => bag.confirm(v.code ?? code)}
      >
        <Form.Item
          name="code"
          label={t(AUTH_I18N_KEYS.secTotpConfirmLabel)}
          {...(err ? { validateStatus: "error" as const, help: formatError(err) } : {})}
        >
          <Input.OTP length={totpLength} autoFocus onChange={setCode} />
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

/** The enable/replace dialog's body wrapper: mounts the `TotpSetup` headless
 * flow fresh on every open (the `Modal`'s `destroyOnHidden` unmounts this
 * between opens, so a new flow instance — and a clean `"idle"` state — is
 * exactly what the next open gets; no manual `bag.reset()` needed). */
function SetupDialogBody(props: {
  isReplace: boolean;
  onDone: () => void;
  onDelayedStarted: () => void;
}): ReactElement {
  return (
    <TotpSetup>
      {(bag) => (
        <SetupJourney
          bag={bag}
          isReplace={props.isReplace}
          onDone={props.onDone}
          onDelayedStarted={props.onDelayedStarted}
        />
      )}
    </TotpSetup>
  );
}

/** The disable dialog's body: TOTP code or a backup code. */
function DisableDialogBody(props: { onDisabled: () => void }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const [useBackup, setUseBackup] = useState(false);
  const disable = useDisableTotp();
  return (
    <Form
      layout="vertical"
      onFinish={(v: { proof?: string }) => {
        const request = useBackup
          ? ({ method: "_TOTPDisableByBackup", backup_code: v.proof ?? "" } as const)
          : ({ method: "_TOTPDisableByTOTP", code: v.proof ?? "" } as const);
        disable.mutate(request, { onSuccess: props.onDisabled });
      }}
    >
      <Form.Item
        name="proof"
        label={t(
          useBackup ? AUTH_I18N_KEYS.secTotpDisableBackupLabel : AUTH_I18N_KEYS.secTotpDisableCodeLabel
        )}
      >
        <Input autoFocus />
      </Form.Item>
      {disable.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={formatError({
            code: disable.error.code,
            params: disable.error.params,
            status: disable.error.status,
            message: disable.error.message,
            language: disable.error.language,
          })}
        />
      )}
      <Button type="primary" danger htmlType="submit" block loading={disable.isPending} data-analytics="flow">
        {t(AUTH_I18N_KEYS.secTotpDisable)}
      </Button>
      <Button
        type="link"
        onClick={() => setUseBackup((b) => !b)}
        data-analytics="none"
        data-analytics-reason="local-ui-toggle-backup-code"
      >
        {t(AUTH_I18N_KEYS.secTotpUseBackupToggle)}
      </Button>
    </Form>
  );
}

/**
 * Full two-factor security screen: status + enable/replace/disable dialogs,
 * with a pending delayed-removal banner short-circuiting everything else
 * while one is in flight (same rule as `AuthenticatorChangePanel`).
 */
export function TotpManager(): ReactElement {
  const t = useT();
  const status = useSecurityStatus();
  const delayedStatus = useTotpDelayedChangeStatus();
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const enabled = status.data?.totp.is_enabled ?? false;
  const backupRemaining = status.data?.totp.backup_codes_remaining ?? 0;
  const lowBackup = enabled && backupRemaining < LOW_BACKUP_THRESHOLD;
  const loading = status.isLoading || delayedStatus.isLoading;
  const hasPendingDelayed = delayedStatus.data?.has_pending_change ?? false;

  function closeSetup(): void {
    setSetupOpen(false);
    void queryClient.invalidateQueries({ queryKey: authQueryKeys.securityStatus() });
  }

  return (
    <Card
      title={t(AUTH_I18N_KEYS.secTotpTitle)}
      data-testid="totp-manager"
      style={{ width: "100%" }}
      extra={
        !loading &&
        !hasPendingDelayed &&
        (enabled ? (
          <Flex gap="small">
            <Button onClick={() => setSetupOpen(true)} data-analytics="none" data-analytics-reason="local-ui-open-replace-dialog">
              {t(AUTH_I18N_KEYS.secTotpReplace)}
            </Button>
            <Button danger onClick={() => setDisableOpen(true)} data-analytics="none" data-analytics-reason="local-ui-open-disable-dialog">
              {t(AUTH_I18N_KEYS.secTotpDisable)}
            </Button>
          </Flex>
        ) : (
          <Button type="primary" onClick={() => setSetupOpen(true)} data-analytics="none" data-analytics-reason="local-ui-open-setup-dialog">
            {t(AUTH_I18N_KEYS.secTotpSetUp)}
          </Button>
        ))
      }
    >
      {loading ? (
        <Spin size="small" />
      ) : hasPendingDelayed && delayedStatus.data ? (
        <PendingBanner status={delayedStatus.data} />
      ) : (
        <Flex gap="small" align="center">
          <Typography.Text>
            {t(enabled ? AUTH_I18N_KEYS.secTotpEnabled : AUTH_I18N_KEYS.secTotpDisabled)}
          </Typography.Text>
          {enabled && (
            <Badge
              count={t(AUTH_I18N_KEYS.secTotpBackupRemaining, { n: backupRemaining })}
              color={lowBackup ? "orange" : "blue"}
            />
          )}
        </Flex>
      )}

      <Modal
        title={t(enabled ? AUTH_I18N_KEYS.secTotpReplaceTitle : AUTH_I18N_KEYS.secTotpSetupTitle)}
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <SetupDialogBody isReplace={enabled} onDone={closeSetup} onDelayedStarted={closeSetup} />
      </Modal>

      <Modal
        title={t(AUTH_I18N_KEYS.secTotpDisableTitle)}
        open={disableOpen}
        onCancel={() => setDisableOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <DisableDialogBody onDisabled={() => setDisableOpen(false)} />
      </Modal>
    </Card>
  );
}
