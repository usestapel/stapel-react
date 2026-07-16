/**
 * `<WorkspaceSettings/>` — default skin for the "workspace" settings screen
 * (owner directive: workspace name/general settings, one of the settings
 * surfaces this liberary pair owns). Built entirely on this pair's EXISTING
 * hooks (`useWorkspace`, `useUpdateWorkspace`, `useDeleteWorkspace`) — no new
 * backend surface. Participants/roles live in the sibling
 * `<MembersManager/>` (a workspace's settings page composes both).
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Badge, Button, Card, Input, Popconfirm, Spin, Typography } from "antd";
import { useT } from "@stapel/core";
import { useWorkspace } from "../model/queries.js";
import { useUpdateWorkspace, useDeleteWorkspace } from "../model/mutations.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";

export interface WorkspaceSettingsProps {
  workspaceId: string;
  /** Called after a successful delete — the host navigates away / switches
   * to another workspace. Not called on cancel or failure. */
  onDeleted?(): void;
}

export function WorkspaceSettings(props: WorkspaceSettingsProps): ReactElement {
  const t = useT();
  const query = useWorkspace(props.workspaceId);
  const updateMutation = useUpdateWorkspace(props.workspaceId);
  const deleteMutation = useDeleteWorkspace();

  const workspace = query.data;
  const [name, setName] = useState("");

  useEffect(() => {
    if (workspace) setName(workspace.name);
  }, [workspace]);

  function handleSave(): void {
    updateMutation.mutate({ name: name.trim() });
  }

  function handleDelete(): void {
    deleteMutation.mutate(props.workspaceId, {
      onSuccess: () => props.onDeleted?.(),
    });
  }

  if (query.isLoading && !workspace) {
    return <Spin data-testid="workspace-settings-loading" />;
  }
  if (!workspace) {
    return (
      <Alert
        data-testid="workspace-settings-error"
        type="error"
        showIcon
        message={query.error?.message ?? t(WORKSPACES_I18N_KEYS.unknownError)}
      />
    );
  }

  const isOwner = workspace.my_role === "owner";

  return (
    <div data-testid="workspace-settings" style={{ display: "grid", gap: 16 }}>
      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(WORKSPACES_I18N_KEYS.settingsTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(WORKSPACES_I18N_KEYS.settingsSubtitle)}</Typography.Text>

        <div style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 16 }}>
          <div>
            <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldName)}</Typography.Text>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
          </div>
          <div>
            <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldSlug)}</Typography.Text>
            <div>
              <Typography.Text code>{workspace.slug}</Typography.Text>
            </div>
          </div>
          <div>
            <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldType)}</Typography.Text>
            <div>
              <Badge status="default" text={workspace.type} />
            </div>
          </div>
        </div>

        {updateMutation.error && (
          <Alert
            style={{ marginTop: 12 }}
            type="error"
            showIcon
            message={updateMutation.error.message}
          />
        )}

        <Button
          type="primary"
          style={{ marginTop: 16 }}
          loading={updateMutation.isPending}
          disabled={!isOwner || !name.trim()}
          onClick={handleSave}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {updateMutation.isPending ? t(WORKSPACES_I18N_KEYS.saving) : t(WORKSPACES_I18N_KEYS.save)}
        </Button>
      </Card>

      {isOwner && (
        <Card>
          <Typography.Title level={5} type="danger" style={{ marginTop: 0 }}>
            {t(WORKSPACES_I18N_KEYS.dangerZoneTitle)}
          </Typography.Title>
          <Popconfirm
            title={t(WORKSPACES_I18N_KEYS.deleteWorkspaceConfirm)}
            onConfirm={handleDelete}
            okButtonProps={{ loading: deleteMutation.isPending, danger: true }}
          >
            <Button danger>{t(WORKSPACES_I18N_KEYS.deleteWorkspace)}</Button>
          </Popconfirm>
        </Card>
      )}
    </div>
  );
}
