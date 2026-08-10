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
import { Badge, Button, Card, Input, Popconfirm, Spin, Typography } from "antd";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  useActionGate,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import { useWorkspace } from "../model/queries.js";
import { useUpdateWorkspace, useDeleteWorkspace } from "../model/mutations.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface WorkspaceSettingsProps {
  workspaceId: string;
  /** Called after a successful delete — the host navigates away / switches
   * to another workspace. Not called on cancel or failure. */
  onDeleted?(): void;
}

export function WorkspaceSettings(props: WorkspaceSettingsProps): ReactElement {
  const t = useT();
  // Never the raw `.message` — for a response with no error envelope that
  // is the transport's own "Request failed with status 500" (owner report
  // 2026-08-09). `useErrorText` folds any thrown value into the one dialect.
  const errorDisplay = useErrorDisplay(WORKSPACES_I18N_KEYS.unknownError);
  const query = useWorkspace(props.workspaceId);
  const updateMutation = useUpdateWorkspace(props.workspaceId);
  const deleteMutation = useDeleteWorkspace();

  const workspace = query.data;
  const [name, setName] = useState("");

  // Two unrelated situations used to share one `disabled={!isOwner ||
  // !name.trim()}` bit, and a person facing either of them saw the same dead
  // button. `firstBlock` keeps them two, in the order you would explain them.
  const isOwner = workspace?.my_role === "owner";
  const saveGate = useActionGate(
    firstBlock(
      isOwner ? actionAvailable() : actionBlocked(WORKSPACES_I18N_KEYS.blockedNotOwner),
      name.trim() ? actionAvailable() : actionBlocked(WORKSPACES_I18N_KEYS.blockedNameRequired)
    )
  );

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
      <ErrorAlert
        testId="workspace-settings-error"
        error={
          errorDisplay(query.error) ?? {
            message: t(WORKSPACES_I18N_KEYS.unknownError),
            detail: undefined,
          }
        }
      />
    );
  }

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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
            />
            {!isOwner && (
              <div>
                <Typography.Text type="secondary" data-testid="workspace-name-blocked">
                  {t(WORKSPACES_I18N_KEYS.blockedNotOwner)}
                </Typography.Text>
              </div>
            )}
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

        <ErrorAlert error={errorDisplay(updateMutation.error)} style={{ marginTop: 12 }} />

        <Button
          type="primary"
          style={{ marginTop: 16 }}
          loading={updateMutation.isPending}
          disabled={saveGate.disabled}
          onClick={handleSave}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {updateMutation.isPending ? t(WORKSPACES_I18N_KEYS.saving) : t(WORKSPACES_I18N_KEYS.save)}
        </Button>
        {/* Beside the control, as TEXT: a disabled button receives no pointer
            events, so a tooltip on it is a reason nobody can read. */}
        {saveGate.reason !== undefined && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary" data-testid="workspace-save-blocked">
              {saveGate.reason}
            </Typography.Text>
          </div>
        )}
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
