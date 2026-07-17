/**
 * `<PasskeysManager/>` — default skin for the security-settings passkeys
 * screen (owner directive point 5; auth-sa.md §17). List + remove use the
 * pair's existing `usePasskeys`/`useRemovePasskey` hooks; adding one uses the
 * existing `PasskeyRegistration` headless flow. No new backend surface.
 *
 * THIN WebAuthn (MODULE.md "Thin-WebAuthn TODO", the same honest scope the
 * sign-in `PasskeyPanel` follows): the single `navigator.credentials.create()`
 * browser step is NOT performed here unless the host supplies `webauthnCreate`
 * — without it, `awaitingCredential` renders guidance copy instead of silently
 * hanging.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Button, Empty, Flex, Form, Input, Modal, Popconfirm, Spin, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { Passkey } from "../../api/types.js";
import { PasskeyRegistration } from "../../headless/Passkey.js";
import type { PasskeyRegistrationBag, WebauthnBinding } from "../../headless/Passkey.js";
import { useRemovePasskey } from "../../model/mutations.js";
import { usePasskeys } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/** One passkey row: name + created/last-used + remove. */
function PasskeyRow(props: { passkey: Passkey; onRemove: () => void; removing: boolean }): ReactElement {
  const t = useT();
  const p = props.passkey;
  return (
    <Flex justify="space-between" align="center" style={{ width: "100%" }}>
      <Flex vertical gap={2}>
        <Typography.Text strong>{p.device_name}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(p.created_at)}
        </Typography.Text>
      </Flex>
      <Popconfirm
        title={t(AUTH_I18N_KEYS.secPasskeysRemoveConfirmTitle)}
        onConfirm={props.onRemove}
        okText={t(AUTH_I18N_KEYS.secPasskeysRemove)}
        okButtonProps={{ danger: true, loading: props.removing }}
      >
        <Button type="link" danger data-analytics="flow">
          {t(AUTH_I18N_KEYS.secPasskeysRemove)}
        </Button>
      </Popconfirm>
    </Flex>
  );
}

/** The add-passkey dialog's body, given the registration bag — a genuine
 * component (not hooks inlined in a render-prop lambda). */
function AddJourney(props: {
  bag: PasskeyRegistrationBag;
  deviceName: string;
  onDone: () => void;
}): ReactElement {
  const t = useT();
  const formatError = useFormatFlowError();
  const { bag, deviceName } = props;
  const s = bag.state;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bag.begin(deviceName);
  }, [bag, deviceName]);

  if (s.step === "idle" || s.step === "beginning" || s.step === "completing") {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }
  if (s.step === "error") {
    return <Alert type="error" showIcon message={formatError(s.error)} />;
  }
  if (s.step === "registered") {
    return (
      <Flex vertical gap="middle" align="center">
        <Typography.Text>{t(AUTH_I18N_KEYS.secPasskeysAddedSuccess)}</Typography.Text>
        <Button type="primary" onClick={props.onDone} data-analytics="flow">
          {t(AUTH_I18N_KEYS.uiSubmit)}
        </Button>
      </Flex>
    );
  }
  // awaitingCredential: no webauthnCreate binding was supplied to drive the
  // browser ceremony automatically — thin by design (see module doc).
  return <Typography.Text type="secondary">{t(AUTH_I18N_KEYS.secPasskeysAwaitingCeremony)}</Typography.Text>;
}

function AddDialogBody(props: { deviceName: string; onDone: () => void; webauthnCreate: WebauthnBinding | undefined }): ReactElement {
  return (
    <PasskeyRegistration {...(props.webauthnCreate !== undefined ? { webauthnCreate: props.webauthnCreate } : {})}>
      {(bag) => <AddJourney bag={bag} deviceName={props.deviceName} onDone={props.onDone} />}
    </PasskeyRegistration>
  );
}

export interface PasskeysManagerProps {
  /** Drives the `navigator.credentials.create()` ceremony automatically when
   * supplied (thin by design otherwise — see module doc). */
  readonly webauthnCreate?: WebauthnBinding;
  /** Override the empty-state glyph (canon default: a plain shield outline,
   * matching the `icon_svg` auth-contract's aesthetic — see `./icons.tsx`). */
  readonly emptyIcon?: ReactNode;
}

/** Full passkey security screen: list, remove, add (name → begin → ceremony). */
export function PasskeysManager(props: PasskeysManagerProps): ReactElement {
  const t = useT();
  const passkeys = usePasskeys();
  const remove = useRemovePasskey();
  const [addOpen, setAddOpen] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const list = passkeys.data ?? [];

  function closeAdd(): void {
    setAddOpen(false);
    setDeviceName(null);
  }

  return (
    <Flex vertical gap="middle" style={{ width: "100%" }} data-testid="passkeys-manager">
      <Flex justify="space-between" align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t(AUTH_I18N_KEYS.secPasskeysTitle)}
        </Typography.Title>
        <Button
          type="primary"
          onClick={() => setAddOpen(true)}
          data-analytics="none"
          data-analytics-reason="local-ui-open-add-passkey-dialog"
        >
          {t(AUTH_I18N_KEYS.secPasskeysAdd)}
        </Button>
      </Flex>

      {passkeys.isLoading ? (
        <Spin />
      ) : list.length === 0 ? (
        <Empty
          image={props.emptyIcon ?? <SecurityEmptyIcon />}
          description={t(AUTH_I18N_KEYS.secPasskeysEmpty)}
        />
      ) : (
        <Flex vertical gap="middle">
          {list.map((p) => (
            <PasskeyRow
              key={p.id}
              passkey={p}
              onRemove={() => remove.mutate(p.id)}
              removing={remove.isPending && remove.variables === p.id}
            />
          ))}
        </Flex>
      )}

      <Modal
        title={t(AUTH_I18N_KEYS.secPasskeysAddTitle)}
        open={addOpen}
        onCancel={closeAdd}
        footer={null}
        destroyOnHidden
      >
        {deviceName === null ? (
          <Form layout="vertical" onFinish={(v: { name?: string }) => setDeviceName((v.name ?? "").trim())}>
            <Form.Item name="name" label={t(AUTH_I18N_KEYS.secPasskeysNameLabel)}>
              <Input autoFocus placeholder={t(AUTH_I18N_KEYS.secPasskeysNamePlaceholder)} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block data-analytics="flow">
              {t(AUTH_I18N_KEYS.secPasskeysBeginCta)}
            </Button>
          </Form>
        ) : (
          <AddDialogBody
            deviceName={deviceName}
            onDone={closeAdd}
            webauthnCreate={props.webauthnCreate}
          />
        )}
      </Modal>
    </Flex>
  );
}
