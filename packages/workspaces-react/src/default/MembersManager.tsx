/**
 * `<MembersManager/>` — default skin for the "members & roles" settings
 * screen (owner directive: "настройки воркспейса (имя/участники/роли/
 * инвайты)"). Built entirely on this pair's EXISTING `Members` headless
 * wrapper (`useMembers`/`useInviteMembers`/`useUpdateMemberRole`/
 * `useRemoveMember`) — no new backend surface.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Input, Modal, Popconfirm, Select, Table, Typography } from "antd";
import type { TableProps } from "antd";
import { useT } from "@stapel/core";
import { Members } from "../headless/Members.js";
import type { Member, WorkspaceRole } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";

export interface MembersManagerProps {
  workspaceId: string;
  /**
   * Whether the caller may invite, change roles, and remove members. The
   * host already knows the caller's own role in this workspace (e.g. from
   * `useWorkspace(workspaceId).data?.my_role`); this component doesn't
   * re-derive it — pass `false` for a read-only roster (e.g. a `viewer`/
   * `member` looking at their teammates). Default `true`.
   */
  canManage?: boolean;
}

const ROLES: readonly WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

const ROLE_KEY: Record<
  WorkspaceRole,
  "roleOwner" | "roleAdmin" | "roleMember" | "roleViewer"
> = {
  owner: "roleOwner",
  admin: "roleAdmin",
  member: "roleMember",
  viewer: "roleViewer",
};

function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (ROLES as readonly string[]).includes(value);
}

export function MembersManager(props: MembersManagerProps): ReactElement {
  const t = useT();
  const canManage = props.canManage ?? true;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");

  return (
    <Members workspaceId={props.workspaceId}>
      {({ members, isLoading, isError, error, invite, isInviting, updateRole, remove }) => {
        function openInvite(): void {
          setEmailsText("");
          setInviteRole("member");
          setInviteOpen(true);
        }

        function submitInvite(): void {
          const emails = emailsText
            .split(/[,\s]+/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
          if (emails.length === 0) return;
          invite({ emails, role: inviteRole });
          setInviteOpen(false);
        }

        const columns: TableProps<Member>["columns"] = [
          {
            title: "Email",
            dataIndex: "email",
            key: "email",
            render: (value: string | null) => value ?? "—",
          },
          {
            title: t(WORKSPACES_I18N_KEYS.membersInviteRoleLabel),
            key: "role",
            render: (_: unknown, member: Member) => {
              const role = isWorkspaceRole(member.role) ? member.role : "member";
              return canManage ? (
                <Select<WorkspaceRole>
                  value={role}
                  style={{ width: 140 }}
                  onChange={(next) => updateRole({ userId: member.user_id, role: next })}
                  options={ROLES.map((r) => ({ value: r, label: t(WORKSPACES_I18N_KEYS[ROLE_KEY[r]]) }))}
                />
              ) : (
                <span>{t(WORKSPACES_I18N_KEYS[ROLE_KEY[role]])}</span>
              );
            },
          },
          ...(canManage
            ? [
                {
                  title: "",
                  key: "actions",
                  render: (_: unknown, member: Member) => (
                    <Popconfirm
                      title={t(WORKSPACES_I18N_KEYS.membersRemoveConfirm)}
                      onConfirm={() => remove(member.user_id)}
                    >
                      <Button danger type="link">
                        {t(WORKSPACES_I18N_KEYS.membersRemove)}
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ];

        return (
          <Card data-testid="members-manager">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <Typography.Title level={4} style={{ marginTop: 0 }}>
                  {t(WORKSPACES_I18N_KEYS.membersTitle)}
                </Typography.Title>
                <Typography.Text type="secondary">{t(WORKSPACES_I18N_KEYS.membersSubtitle)}</Typography.Text>
              </div>
              {canManage && (
                <Button
                  type="primary"
                  onClick={openInvite}
                  data-analytics="none"
                  data-analytics-reason="local-ui-open-invite-dialog"
                >
                  {t(WORKSPACES_I18N_KEYS.membersInvite)}
                </Button>
              )}
            </div>

            {isError && error && (
              <Alert style={{ marginTop: 12 }} type="error" showIcon message={error.message} />
            )}

            <Table<Member>
              style={{ marginTop: 16 }}
              size="small"
              loading={isLoading}
              rowKey={(member) => member.id}
              dataSource={members as Member[]}
              columns={columns}
              pagination={false}
            />

            <Modal
              title={t(WORKSPACES_I18N_KEYS.membersInviteDialogTitle)}
              open={inviteOpen}
              onCancel={() => setInviteOpen(false)}
              onOk={submitInvite}
              okButtonProps={{ loading: isInviting, disabled: emailsText.trim().length === 0 }}
            >
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersInviteEmailsLabel)}</Typography.Text>
                  <Input
                    value={emailsText}
                    onChange={(e) => setEmailsText(e.target.value)}
                    placeholder={t(WORKSPACES_I18N_KEYS.membersInviteEmailsPlaceholder)}
                  />
                </div>
                <div>
                  <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersInviteRoleLabel)}</Typography.Text>
                  <Select<WorkspaceRole>
                    value={inviteRole}
                    onChange={setInviteRole}
                    style={{ width: "100%" }}
                    options={ROLES.filter((r) => r !== "owner").map((r) => ({
                      value: r,
                      label: t(WORKSPACES_I18N_KEYS[ROLE_KEY[r]]),
                    }))}
                  />
                </div>
              </div>
            </Modal>
          </Card>
        );
      }}
    </Members>
  );
}
