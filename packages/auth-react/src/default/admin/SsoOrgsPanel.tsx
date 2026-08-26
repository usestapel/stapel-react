/**
 * `<SsoOrgsPanel/>` — enterprise-SSO organizations (auth-sa.md §18), the
 * domain → identity-provider binding an operator manages.
 *
 * ## The identity-provider form is WRITE-ONLY, and it says so
 *
 * The contract carries `PUT` and `PATCH` on `/sso/orgs/{slug}/config/` and
 * **no `GET`**. So this screen cannot show what an organization's connection
 * is currently set to — and the one thing it must not do is render an empty
 * form that looks like the current state. The dialog states the fact before
 * the fields, and saving sends `PUT`: a whole connection stated, because a
 * `PATCH` composed against values nobody could read is a guess about a
 * security boundary. When the contract grows a read, the dialog can preload
 * and the choice becomes real (see the pair's REQUESTS file).
 *
 * Deleting an organization takes every account on its domain off its SSO
 * route, so it goes through a danger confirm that names the organization.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { fontSize } from "@stapel/tokens";
import { loadStateFromQuery, useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinConfirm,
  SkinDialog,
} from "@stapel/tokens-antd/skin";
import type { SsoOrg, SsoOrgConfig, SsoProtocol } from "../../api/types.js";
import { useSsoOrgs } from "../../model/queries.js";
import {
  useCreateSsoOrg,
  useDeleteSsoOrg,
  useSaveSsoOrgConfig,
  useUpdateSsoOrg,
} from "../../model/mutations.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityList, SecurityListRow } from "../security/SecurityListRow.js";
import { AdminScreen } from "./AdminScreen.js";

interface OrgFormValues {
  readonly name?: string;
  readonly slug?: string;
  readonly domain?: string;
  readonly sso_enforced?: boolean;
}

/** One organization: what it is, which domain it claims, whether SSO is the
 *  only way in, and the three things an operator can do to it. */
function OrgRow(props: {
  org: SsoOrg;
  onEdit: () => void;
  onConfigure: () => void;
  onDelete: () => void;
}): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const org = props.org;
  return (
    <SecurityListRow
      data-testid="sso-org-row"
      title={org.name}
      badges={
        <>
          <Tag>{org.slug}</Tag>
          <Tag color={org.sso_enforced === true ? "blue" : "default"}>
            {t(
              org.sso_enforced === true
                ? AUTH_I18N_KEYS.adminSsoEnforcedOn
                : AUTH_I18N_KEYS.adminSsoEnforcedOff
            )}
          </Tag>
        </>
      }
      meta={
        <>
          {org.domain !== undefined && org.domain !== "" && (
            <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
              {org.domain}
            </Typography.Text>
          )}
          <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(AUTH_I18N_KEYS.adminSsoCreatedOn, { date: when.date(org.created_at) })}
          </Typography.Text>
        </>
      }
      actions={
        <>
          <Button
            type="text"
            onClick={props.onConfigure}
            aria-label={t(AUTH_I18N_KEYS.adminSsoConfigTitle)}
            data-analytics="none"
            data-analytics-reason="local-ui-open-sso-config"
          >
            {t(AUTH_I18N_KEYS.adminSsoConfigure)}
          </Button>
          <Button
            type="text"
            onClick={props.onEdit}
            aria-label={t(AUTH_I18N_KEYS.adminSsoEditLabel, { name: org.name })}
            data-analytics="none"
            data-analytics-reason="local-ui-open-sso-edit"
          >
            {t(AUTH_I18N_KEYS.adminSsoEdit)}
          </Button>
          <Button
            type="text"
            danger
            onClick={props.onDelete}
            aria-label={t(AUTH_I18N_KEYS.adminSsoDeleteLabel, { name: org.name })}
            data-analytics="none"
            data-analytics-reason="local-ui-open-sso-delete-confirm"
          >
            {t(AUTH_I18N_KEYS.adminSsoDelete)}
          </Button>
        </>
      }
    />
  );
}

/** SAML fields, OIDC fields, or neither — driven by the chosen protocol so an
 *  operator never fills a box the selected protocol has no use for. */
function ProtocolFields(props: { protocol: SsoProtocol }): ReactElement {
  const t = useT();
  if (props.protocol === "oidc") {
    return (
      <>
        <Form.Item name="oidc_client_id" label={t(AUTH_I18N_KEYS.adminSsoOidcClientId)}>
          <Input />
        </Form.Item>
        <Form.Item
          name="oidc_client_secret"
          label={t(AUTH_I18N_KEYS.adminSsoOidcClientSecret)}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="oidc_discovery_url"
          label={t(AUTH_I18N_KEYS.adminSsoOidcDiscovery)}
        >
          <Input />
        </Form.Item>
        <Form.Item name="oidc_scopes" label={t(AUTH_I18N_KEYS.adminSsoOidcScopes)}>
          <Input />
        </Form.Item>
      </>
    );
  }
  return (
    <>
      <Form.Item name="saml_entity_id" label={t(AUTH_I18N_KEYS.adminSsoSamlEntityId)}>
        <Input />
      </Form.Item>
      <Form.Item name="saml_sso_url" label={t(AUTH_I18N_KEYS.adminSsoSamlSsoUrl)}>
        <Input />
      </Form.Item>
      <Form.Item name="saml_slo_url" label={t(AUTH_I18N_KEYS.adminSsoSamlSloUrl)}>
        <Input />
      </Form.Item>
      <Form.Item name="saml_x509_cert" label={t(AUTH_I18N_KEYS.adminSsoSamlCert)}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Form.Item
        name="saml_name_id_format"
        label={t(AUTH_I18N_KEYS.adminSsoSamlNameId)}
      >
        <Input />
      </Form.Item>
      <Form.Item name="attr_email" label={t(AUTH_I18N_KEYS.adminSsoAttrEmail)}>
        <Input />
      </Form.Item>
      <Form.Item name="attr_first_name" label={t(AUTH_I18N_KEYS.adminSsoAttrFirstName)}>
        <Input />
      </Form.Item>
      <Form.Item name="attr_last_name" label={t(AUTH_I18N_KEYS.adminSsoAttrLastName)}>
        <Input />
      </Form.Item>
    </>
  );
}

/** The operator's organization list, with create / edit / configure / delete. */
export function SsoOrgsPanel(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const orgs = useSsoOrgs();
  const create = useCreateSsoOrg();
  const update = useUpdateSsoOrg();
  const remove = useDeleteSsoOrg();
  const saveConfig = useSaveSsoOrgConfig();

  // `null` = closed, `"new"` = the create form, an org = editing that org.
  const [editing, setEditing] = useState<SsoOrg | null | "new">(null);
  const [configuring, setConfiguring] = useState<SsoOrg | null>(null);
  const [protocol, setProtocol] = useState<SsoProtocol>("saml");
  const [deleting, setDeleting] = useState<SsoOrg | null>(null);

  const state = loadStateFromQuery(orgs);
  const editTarget = editing === "new" || editing === null ? null : editing;

  function submitOrg(values: OrgFormValues): void {
    const body = {
      name: values.name ?? "",
      slug: values.slug ?? "",
      domain: values.domain ?? "",
      sso_enforced: values.sso_enforced ?? false,
    };
    if (editTarget !== null) {
      update.mutate(
        { slug: editTarget.slug, body },
        { onSettled: () => setEditing(null) }
      );
      return;
    }
    create.mutate(body, { onSettled: () => setEditing(null) });
  }

  function submitConfig(values: Record<string, unknown>): void {
    const target = configuring;
    if (target === null) return;
    const body = { ...values, protocol } as SsoOrgConfig;
    saveConfig.mutate(
      // `replace`: the contract has no read, so a partial write composed
      // against unknown values would be a guess. State the whole connection.
      { slug: target.slug, body, replace: true },
      { onSettled: () => setConfiguring(null) }
    );
  }

  return (
    <AdminScreen
      testId="admin-sso"
      title={t(AUTH_I18N_KEYS.adminSsoTitle)}
      subtitle={t(AUTH_I18N_KEYS.adminSsoSubtitle)}
      action={
        <Button
          type="primary"
          onClick={() => setEditing("new")}
          data-analytics="none"
          data-analytics-reason="local-ui-open-sso-create"
        >
          {t(AUTH_I18N_KEYS.adminSsoAdd)}
        </Button>
      }
    >
      <Card style={{ width: "100%" }}>
        <LoadList
          state={state}
          testId="sso-orgs"
          onRetry={() => void orgs.refetch()}
          empty={
            <EmptyState
              title={t(AUTH_I18N_KEYS.adminSsoEmpty)}
              hint={t(AUTH_I18N_KEYS.adminSsoEmptyHint)}
              action={
                <Button
                  type="primary"
                  onClick={() => setEditing("new")}
                  data-analytics="none"
                  data-analytics-reason="local-ui-open-sso-create"
                >
                  {t(AUTH_I18N_KEYS.adminSsoAdd)}
                </Button>
              }
            />
          }
        >
          {(list) => (
            <SecurityList ruleColor={token.colorBorderSecondary}>
              {list.map((org) => (
                <OrgRow
                  key={org.id}
                  org={org}
                  onEdit={() => setEditing(org)}
                  onConfigure={() => setConfiguring(org)}
                  onDelete={() => setDeleting(org)}
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
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t(
          editTarget !== null ? AUTH_I18N_KEYS.adminSsoEdit : AUTH_I18N_KEYS.adminSsoAdd
        )}
        dismissLabel={t(AUTH_I18N_KEYS.adminSsoCancel)}
        data-testid="sso-org-dialog"
      >
        {/* Keyed by the row: antd reads `initialValues` once per Form
            instance, so a single long-lived form opens on the previous
            organization every time after the first. */}
        <Form
          key={editTarget?.id ?? "new"}
          layout="vertical"
          initialValues={{
            name: editTarget?.name ?? "",
            slug: editTarget?.slug ?? "",
            domain: editTarget?.domain ?? "",
            sso_enforced: editTarget?.sso_enforced ?? false,
          }}
          onFinish={submitOrg}
        >
          <Form.Item name="name" label={t(AUTH_I18N_KEYS.adminSsoNameLabel)}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="slug"
            label={t(AUTH_I18N_KEYS.adminSsoSlugLabel)}
            extra={t(AUTH_I18N_KEYS.adminSsoSlugHint)}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="domain"
            label={t(AUTH_I18N_KEYS.adminSsoDomainLabel)}
            extra={t(AUTH_I18N_KEYS.adminSsoDomainHint)}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="sso_enforced"
            label={t(AUTH_I18N_KEYS.adminSsoEnforcedLabel)}
            valuePropName="checked"
          >
            <Switch aria-label={t(AUTH_I18N_KEYS.adminSsoEnforcedLabel)} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={create.isPending || update.isPending}
            data-analytics="flow"
          >
            {t(AUTH_I18N_KEYS.adminSsoSave)}
          </Button>
        </Form>
      </SkinDialog>

      <SkinDialog
        open={configuring !== null}
        onClose={() => setConfiguring(null)}
        title={t(AUTH_I18N_KEYS.adminSsoConfigTitle)}
        dismissLabel={t(AUTH_I18N_KEYS.adminSsoCancel)}
        data-testid="sso-config-dialog"
      >
        <Form
          key={configuring?.id ?? "none"}
          layout="vertical"
          initialValues={{ is_active: true }}
          onFinish={submitConfig}
        >
          {/* The write-only fact, before the fields — not discovered by an
              operator who assumed the empty boxes were the current state. */}
          <Alert
            type="info"
            showIcon
            title={t(AUTH_I18N_KEYS.adminSsoConfigNew)}
            data-testid="sso-config-writeonly"
          />
          <Form.Item label={t(AUTH_I18N_KEYS.adminSsoProtocolLabel)}>
            <Select<SsoProtocol>
              value={protocol}
              onChange={setProtocol}
              aria-label={t(AUTH_I18N_KEYS.adminSsoProtocolLabel)}
              data-testid="sso-protocol"
              options={[
                { value: "saml", label: t(AUTH_I18N_KEYS.adminSsoProtocolSaml) },
                { value: "oidc", label: t(AUTH_I18N_KEYS.adminSsoProtocolOidc) },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="is_active"
            label={t(AUTH_I18N_KEYS.adminSsoActiveLabel)}
            valuePropName="checked"
          >
            <Switch aria-label={t(AUTH_I18N_KEYS.adminSsoActiveLabel)} />
          </Form.Item>
          <ProtocolFields protocol={protocol} />
          <ErrorAlert thrown={saveConfig.error} />
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saveConfig.isPending}
            data-analytics="flow"
          >
            {t(AUTH_I18N_KEYS.adminSsoSave)}
          </Button>
        </Form>
      </SkinDialog>

      <SkinConfirm
        open={deleting !== null}
        danger
        title={t(AUTH_I18N_KEYS.adminSsoDeleteConfirmTitle, {
          name: deleting?.name ?? "",
        })}
        body={t(AUTH_I18N_KEYS.adminSsoDeleteConfirmBody)}
        confirmLabel={t(AUTH_I18N_KEYS.adminSsoDelete)}
        confirming={remove.isPending}
        data-testid="sso-delete-confirm"
        onConfirm={() => {
          const target = deleting;
          if (target === null) return;
          remove.mutate(target.slug, { onSettled: () => setDeleting(null) });
        }}
        onCancel={() => setDeleting(null)}
      />
    </AdminScreen>
  );
}
