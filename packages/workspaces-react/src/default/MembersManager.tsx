/**
 * `<MembersManager/>` — default skin for the "members & roles" settings
 * screen (owner directive: workspace settings — name/members/roles/
 * invites). Built entirely on this pair's EXISTING `Members` headless
 * wrapper (`useMembers`/`useInviteMembers`/`useUpdateMemberRole`/
 * `useRemoveMember`) — no new backend surface.
 *
 * Roles come from the EFFECTIVE registry via the `RoleSelect` headless
 * (GET /roles, org-program §A2) — not a hardcoded builtin four: a deployment
 * that overlays `STAPEL_WORKSPACES["ROLES"]` (e.g. a `secretary`) sees its
 * roles here with `workspaces.role.<key>` labels (client-bundle merge,
 * raw-name fallback). `owner` is offered only in the member-row select (the
 * backend enforces "only an owner grants owner" and last-owner protection);
 * the invite dialog filters it out, as before.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Empty, Input, Modal, Popconfirm, Select, Table, Typography } from "antd";
import type { TableProps } from "antd";
import { loadedRowsOrEmpty, matchList, useErrorDisplay, useT } from "@stapel/core";
import { Members } from "../headless/Members.js";
import { RoleSelect } from "../headless/RoleSelect.js";
import type { RoleSelectBag } from "../headless/RoleSelect.js";
import type { Member } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

export interface MembersManagerProps {
  workspaceId: string;
  /**
   * Whether the caller may invite, change roles, and remove members. The
   * host already knows the caller's own verdict in this workspace (e.g.
   * `useCapabilities(workspaceId).can("members.invite")`, or the coarser
   * `my_role`); this component doesn't re-derive it — pass `false` for a
   * read-only roster. Default `true`.
   */
  canManage?: boolean;
}

const DEFAULT_INVITE_ROLE = "member";

export function MembersManager(props: MembersManagerProps): ReactElement {
  const t = useT();
  // Never the raw `.message` — for a response with no error envelope that
  // is the transport's own "Request failed with status 500" (owner report
  // 2026-08-09). `useErrorText` folds any thrown value into the one dialect.
  const errorDisplay = useErrorDisplay(WORKSPACES_I18N_KEYS.unknownError);
  const canManage = props.canManage ?? true;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(DEFAULT_INVITE_ROLE);

  return (
    <RoleSelect>
      {(rolesBag: RoleSelectBag) => (
        <Members workspaceId={props.workspaceId}>
          {({ state, writeError, invite, isInviting, updateRole, remove, refetch }) => {
            const { labelFor } = rolesBag;
            // The registry read is a SEPARATE load from the roster's, and it
            // gets its own sentence below rather than silently producing an
            // empty picker — a role menu with nothing in it and a role menu
            // that could not be fetched look identical to a person.
            const rolesFailed = rolesBag.state.status === "failed";
            const rolesLoading = rolesBag.state.status === "loading";
            const roleOptions = loadedRowsOrEmpty(rolesBag.state).map((r) => ({
              value: r.role,
              label: labelFor(r.role),
            }));
            const inviteRoleOptions = roleOptions.filter(
              (o) => o.value !== "owner"
            );

            function openInvite(): void {
              setEmailsText("");
              setInviteRole(DEFAULT_INVITE_ROLE);
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
                render: (_: unknown, member: Member) =>
                  canManage ? (
                    <Select<string>
                      value={member.role}
                      style={{ width: 160 }}
                      loading={rolesLoading}
                      onChange={(next) => updateRole({ userId: member.user_id, role: next })}
                      // A member's CURRENT role may be missing from the
                      // registry options (a deployment removed an overlay
                      // role) — antd shows the raw value then, which matches
                      // labelFor's raw-name fallback contract.
                      options={roleOptions}
                    />
                  ) : (
                    <span>{labelFor(member.role)}</span>
                  ),
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

                {/* A write that failed — the roster read has its own arm below. */}
                {writeError !== null && (
                  <ErrorAlert error={errorDisplay(writeError)} style={{ marginTop: 12 }} />
                )}
                {rolesFailed && (
                  <ErrorAlert
                    testId="members-roles-error"
                    error={{ message: t(WORKSPACES_I18N_KEYS.rolesLoadFailed), detail: undefined }}
                    style={{ marginTop: 12 }}
                  />
                )}

                {matchList(state, {
                  loading: () => (
                    <Table<Member>
                      style={{ marginTop: 16 }}
                      size="small"
                      loading
                      rowKey={(member) => member.id}
                      dataSource={[]}
                      columns={columns}
                      pagination={false}
                    />
                  ),
                  // An antd Table with no rows renders "No data". On a failed
                  // read that is the empty-state lie with a built-in
                  // illustration, so the table does not get rendered at all.
                  failed: (error) => (
                    <div style={{ marginTop: 16 }} data-testid="members-list-error">
                      <ErrorAlert error={errorDisplay(error)} />
                      <Button
                        style={{ marginTop: 12 }}
                        onClick={refetch}
                        data-analytics="none"
                        data-analytics-reason="local-ui-refetch-after-a-stated-read-failure"
                      >
                        {t(WORKSPACES_I18N_KEYS.retry)}
                      </Button>
                    </div>
                  ),
                  empty: () => (
                    <Empty
                      style={{ marginTop: 16 }}
                      data-testid="members-list-empty"
                      description={t(WORKSPACES_I18N_KEYS.membersEmpty)}
                    />
                  ),
                  ready: (members) => (
                    <Table<Member>
                      style={{ marginTop: 16 }}
                      size="small"
                      rowKey={(member) => member.id}
                      dataSource={[...members]}
                      columns={columns}
                      pagination={false}
                    />
                  ),
                })}

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
                      <Select<string>
                        value={inviteRole}
                        onChange={setInviteRole}
                        style={{ width: "100%" }}
                        loading={rolesLoading}
                        options={inviteRoleOptions}
                      />
                    </div>
                  </div>
                </Modal>
              </Card>
            );
          }}
        </Members>
      )}
    </RoleSelect>
  );
}
