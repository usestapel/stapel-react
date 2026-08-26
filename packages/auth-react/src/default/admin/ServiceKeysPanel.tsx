/**
 * `<ServiceKeysPanel/>` — machine credentials: the keys scripts, integrations
 * and sibling services use to call this API without a person's session.
 *
 * ## The secret exists exactly once, and the screen is built around that
 *
 * `POST /service-keys` is the ONLY response that carries the full key; every
 * later read returns the stored (masked) form. So issuing a key does not
 * close into the list — it hands the secret over in a dialog the operator has
 * to acknowledge, with a copy control and the plain statement that this is
 * the only time it is shown. Closing that dialog is the acknowledgement; the
 * value is not kept anywhere afterwards.
 *
 * ## Off is not gone
 *
 * Deleting a key breaks every caller holding it, instantly and with no way
 * back. Switching it off does the same thing reversibly. Both are offered,
 * the reversible one first, and the delete confirm says which is which
 * instead of asking "are you sure?".
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { fontSize } from "@stapel/tokens";
import { loadStateFromQuery, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinDialog,
} from "@stapel/tokens-antd/skin";
import type { ServiceKey } from "../../api/types.js";
import { useServiceKeys } from "../../model/queries.js";
import {
  useCreateServiceKey,
  useDeleteServiceKey,
  useUpdateServiceKey,
} from "../../model/mutations.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityList, SecurityListRow } from "../security/SecurityListRow.js";
import { AdminScreen } from "./AdminScreen.js";
import { ForbiddenState, forbiddenGate, isForbidden } from "./forbidden.js";

interface KeyFormValues {
  readonly name?: string;
  readonly description?: string;
  readonly allowed_endpoints?: string;
}

/**
 * `allowed_endpoints` is `unknown` on the contract (the backend stores a JSON
 * blob). This pair writes and reads the one shape stapel-auth documents — a
 * list of paths — and treats anything else as "not a list we can count",
 * which prints the same neutral label as an empty one rather than a number
 * invented from a shape nobody promised.
 */
function endpointList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const paths = value.filter((v): v is string => typeof v === "string");
  return paths.length === value.length ? paths : null;
}

/** One machine credential: what it is for, whether it is live, what it may
 *  reach, and when it was last actually used. */
function KeyRow(props: {
  serviceKey: ServiceKey;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
}): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const k = props.serviceKey;
  const active = k.is_active !== false;
  const endpoints = endpointList(k.allowed_endpoints);
  return (
    <SecurityListRow
      data-testid="service-key-row"
      title={k.name}
      badges={
        <>
          <Tag color={active ? "green" : "default"} data-testid="service-key-state">
            {t(active ? AUTH_I18N_KEYS.adminKeysActive : AUTH_I18N_KEYS.adminKeysInactive)}
          </Tag>
          <Tag>
            {endpoints === null || endpoints.length === 0
              ? t(AUTH_I18N_KEYS.adminKeysEndpointsAll)
              : t(AUTH_I18N_KEYS.adminKeysEndpointsCount, { count: endpoints.length })}
          </Tag>
        </>
      }
      meta={
        <>
          {k.description !== undefined && k.description !== "" && (
            <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
              {k.description}
            </Typography.Text>
          )}
          <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(AUTH_I18N_KEYS.adminKeysCreatedOn, { date: when.date(k.created_at) })}
          </Typography.Text>
          {/* "Never used" is a fact worth printing: it is how an operator
              spots a key that was issued for something that never shipped. */}
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
            data-testid="service-key-last-used"
          >
            {k.last_used_at === null
              ? t(AUTH_I18N_KEYS.adminKeysNeverUsed)
              : t(AUTH_I18N_KEYS.adminKeysLastUsed, { date: when.relative(k.last_used_at) })}
          </Typography.Text>
        </>
      }
      actions={
        <>
          <Button
            type="text"
            loading={props.toggling}
            onClick={props.onToggle}
            data-analytics="flow"
          >
            {t(active ? AUTH_I18N_KEYS.adminKeysDisable : AUTH_I18N_KEYS.adminKeysEnable)}
          </Button>
          <Button
            type="text"
            danger
            onClick={props.onDelete}
            aria-label={t(AUTH_I18N_KEYS.adminKeysDeleteLabel, { name: k.name })}
            data-analytics="none"
            data-analytics-reason="local-ui-open-service-key-delete-confirm"
          >
            {t(AUTH_I18N_KEYS.adminKeysDelete)}
          </Button>
        </>
      }
    />
  );
}

/** The one moment the secret exists. Nothing here is stored; closing the
 *  dialog is the operator's acknowledgement that they have it. */
function SecretDialog(props: { secret: string | null; onClose: () => void }): ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <SkinDialog
      open={props.secret !== null}
      onClose={props.onClose}
      title={t(AUTH_I18N_KEYS.adminKeysSecretTitle)}
      dismissLabel={t(AUTH_I18N_KEYS.adminKeysSecretDone)}
      data-testid="service-key-secret-dialog"
    >
      <Flex vertical gap="middle">
        <Typography.Text type="secondary">
          {t(AUTH_I18N_KEYS.adminKeysSecretHint)}
        </Typography.Text>
        <Input.TextArea
          readOnly
          autoSize
          value={props.secret ?? ""}
          aria-label={t(AUTH_I18N_KEYS.adminKeysSecretTitle)}
          data-testid="service-key-secret"
        />
        <Flex gap="small" wrap>
          <Button
            onClick={() => {
              const secret = props.secret;
              if (secret === null) return;
              // A page served without a secure context has no clipboard API.
              // The value is on screen and selectable either way, so the copy
              // control simply does not claim success it did not have.
              void navigator.clipboard
                ?.writeText(secret)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
            data-analytics="none"
            data-analytics-reason="local-ui-copy-service-key"
          >
            {t(copied ? AUTH_I18N_KEYS.adminKeysSecretCopied : AUTH_I18N_KEYS.adminKeysSecretCopy)}
          </Button>
          <Button type="primary" onClick={props.onClose} data-analytics="flow">
            {t(AUTH_I18N_KEYS.adminKeysSecretDone)}
          </Button>
        </Flex>
      </Flex>
    </SkinDialog>
  );
}

/** The operator's machine-credential list: issue, switch off, delete. */
export function ServiceKeysPanel(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const keys = useServiceKeys();
  const create = useCreateServiceKey();
  const update = useUpdateServiceKey();
  const remove = useDeleteServiceKey();

  const [issuing, setIssuing] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ServiceKey | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const state = loadStateFromQuery(keys);

  function submit(values: KeyFormValues): void {
    const endpoints = (values.allowed_endpoints ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    create.mutate(
      {
        name: values.name ?? "",
        description: values.description ?? "",
        is_active: true,
        allowed_endpoints: endpoints,
      },
      {
        onSuccess: (issued) => setSecret(issued.key),
        onSettled: () => setIssuing(false),
      }
    );
  }

  // The read's verdict gates the write: a console that may not LIST keys may
  // not issue one either, and an enabled primary over a refusal card is a
  // dead end one click away (visual pass N9).
  const gate = forbiddenGate(keys.error);
  const issueButton = (
    <GatedButton
      gate={gate}
      type="primary"
      testId="service-keys-issue"
      onClick={() => setIssuing(true)}
      data-analytics="none"
      data-analytics-reason="local-ui-open-service-key-create"
    >
      {t(AUTH_I18N_KEYS.adminKeysIssue)}
    </GatedButton>
  );

  return (
    <AdminScreen
      testId="admin-service-keys"
      title={t(AUTH_I18N_KEYS.adminKeysTitle)}
      subtitle={t(AUTH_I18N_KEYS.adminKeysSubtitle)}
      action={issueButton}
    >
      <Card style={{ width: "100%" }}>
        <LoadList
          state={state}
          testId="service-keys"
          onRetry={() => void keys.refetch()}
          failed={(error) =>
            isForbidden(error) ? (
              <ForbiddenState testId="service-keys-forbidden" />
            ) : (
              <ErrorAlert thrown={error} onRetry={() => void keys.refetch()} />
            )
          }
          empty={
            <EmptyState
              title={t(AUTH_I18N_KEYS.adminKeysEmpty)}
              hint={t(AUTH_I18N_KEYS.adminKeysEmptyHint)}
              action={issueButton}
            />
          }
        >
          {(list) => (
            <SecurityList ruleColor={token.colorBorderSecondary}>
              {list.map((k) => (
                <KeyRow
                  key={k.id}
                  serviceKey={k}
                  toggling={update.isPending && togglingId === k.id}
                  onToggle={() => {
                    setTogglingId(k.id);
                    update.mutate(
                      { id: k.id, body: { is_active: k.is_active === false } },
                      { onSettled: () => setTogglingId(null) }
                    );
                  }}
                  onDelete={() => setDeleting(k)}
                />
              ))}
            </SecurityList>
          )}
        </LoadList>

        <ErrorAlert thrown={create.error} />
        <ErrorAlert thrown={update.error} />
        <ErrorAlert thrown={remove.error} />
      </Card>

      <SkinDialog
        open={issuing}
        onClose={() => setIssuing(false)}
        title={t(AUTH_I18N_KEYS.adminKeysIssue)}
        dismissLabel={t(AUTH_I18N_KEYS.adminKeysCancel)}
        data-testid="service-key-dialog"
      >
        <Form layout="vertical" onFinish={submit}>
          <Form.Item name="name" label={t(AUTH_I18N_KEYS.adminKeysNameLabel)}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="description"
            label={t(AUTH_I18N_KEYS.adminKeysDescriptionLabel)}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="allowed_endpoints"
            label={t(AUTH_I18N_KEYS.adminKeysEndpointsLabel)}
            extra={t(AUTH_I18N_KEYS.adminKeysEndpointsHint)}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={create.isPending}
            data-analytics="flow"
          >
            {t(AUTH_I18N_KEYS.adminKeysIssue)}
          </Button>
        </Form>
      </SkinDialog>

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />

      <SkinConfirm
        open={deleting !== null}
        danger
        title={t(AUTH_I18N_KEYS.adminKeysDeleteConfirmTitle, {
          name: deleting?.name ?? "",
        })}
        body={t(AUTH_I18N_KEYS.adminKeysDeleteConfirmBody)}
        confirmLabel={t(AUTH_I18N_KEYS.adminKeysDelete)}
        confirming={remove.isPending}
        data-testid="service-key-delete-confirm"
        onConfirm={() => {
          const target = deleting;
          if (target === null) return;
          remove.mutate(target.id, { onSettled: () => setDeleting(null) });
        }}
        onCancel={() => setDeleting(null)}
      />
    </AdminScreen>
  );
}
