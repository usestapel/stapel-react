/**
 * `<TotpManager/>` — default skin for the security-settings two-factor screen
 * (owner directive point 5; auth-sa.md §11). Enable uses the pair's existing
 * `TotpSetup` headless flow (start → QR/secret → confirm → one-time backup
 * codes); disable uses the existing `useDisableTotp` mutation. Status/backup-
 * count read from the existing `useSecurityStatus` query. No new backend
 * surface. SMS-based disable (`_TOTPDisableByOTP`) is left for a follow-up —
 * this ships authenticator-code and backup-code disable only.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { TotpSetupBag } from "../../headless/TotpSetup.js";
import {
  Alert,
  Badge,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  QRCode,
  Spin,
  Typography,
} from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import { useQueryClient } from "@tanstack/react-query";
import { TotpSetup } from "../../headless/TotpSetup.js";
import { useDisableTotp } from "../../model/mutations.js";
import { useSecurityStatus } from "../../model/queries.js";
import { authQueryKeys } from "../../model/queryKeys.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";

const LOW_BACKUP_THRESHOLD = 3;

/** The enable dialog's body, given the `TotpSetup` bag — a genuine component
 * (not hooks inlined in a render-prop lambda, same rule the sign-in QR panel
 * follows) so its `useRef`/`useEffect` are unambiguously ITS OWN hooks.
 * Auto-starts on mount — no redundant "Set up" click inside a dialog the user
 * opened by clicking "Set up". */
function SetupJourney(props: { bag: TotpSetupBag; onDone: () => void }): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const [code, setCode] = useState("");
  const { bag } = props;
  const s = bag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bag.start();
  }, [bag]);

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
          <Input.OTP length={6} autoFocus onChange={setCode} />
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

/** The enable dialog's body wrapper: mounts the `TotpSetup` headless flow. */
function SetupDialogBody(props: { onDone: () => void }): ReactElement {
  return (
    <TotpSetup>{(bag) => <SetupJourney bag={bag} onDone={props.onDone} />}</TotpSetup>
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

/** Full two-factor security screen: status + enable/disable dialogs. */
export function TotpManager(): ReactElement {
  const t = useT();
  const status = useSecurityStatus();
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const enabled = status.data?.totp.is_enabled ?? false;
  const backupRemaining = status.data?.totp.backup_codes_remaining ?? 0;
  const lowBackup = enabled && backupRemaining < LOW_BACKUP_THRESHOLD;

  function refreshStatus(): void {
    void queryClient.invalidateQueries({ queryKey: authQueryKeys.securityStatus() });
  }

  return (
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="totp-manager">
      <Flex justify="space-between" align="center">
        <div>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>
            {t(AUTH_I18N_KEYS.secTotpTitle)}
          </Typography.Title>
          {status.isLoading ? (
            <Spin size="small" />
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
        </div>
        {!status.isLoading &&
          (enabled ? (
            <Button danger onClick={() => setDisableOpen(true)} data-analytics="none" data-analytics-reason="local-ui-open-disable-dialog">
              {t(AUTH_I18N_KEYS.secTotpDisable)}
            </Button>
          ) : (
            <Button type="primary" onClick={() => setSetupOpen(true)} data-analytics="none" data-analytics-reason="local-ui-open-setup-dialog">
              {t(AUTH_I18N_KEYS.secTotpSetUp)}
            </Button>
          ))}
      </Flex>

      <Modal
        title={t(AUTH_I18N_KEYS.secTotpSetupTitle)}
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <SetupDialogBody
          onDone={() => {
            setSetupOpen(false);
            refreshStatus();
          }}
        />
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
    </Flex>
  );
}
