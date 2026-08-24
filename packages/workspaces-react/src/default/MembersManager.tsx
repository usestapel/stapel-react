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
 *
 * ## What a row's controls are allowed to claim
 *
 * A control that offers an action the caller's situation makes impossible is
 * a lie the backend then has to tell. Two such rows exist here, and the
 * members contract answers only one of them:
 *
 *  - **The last owner.** Answerable: `MemberResponse.role` is on every row and
 *    `has_next` says whether the page IS the roster (`MembersBag.rosterComplete`).
 *    With the whole roster in hand, "exactly one row holds `owner`" is a fact,
 *    so "Remove" on that row is switched off with the reason printed beside it.
 *    On a roster longer than one page nothing is claimed — a count of a page is
 *    not a count of the roster.
 *  - **The caller's own row.** NOT answerable, and therefore NOT gated. Nothing
 *    in the contract identifies the caller among the rows: `MemberResponse`
 *    carries no `is_self`, the page carries no "you are" pointer, and this pair
 *    has no caller identity to compare `user_id` against (`@stapel/core`'s
 *    session exposes a STATUS, never a subject; the mandate axis resolves to
 *    `anonymous`/`guest`/`member`, never to a user id). `WorkspaceResponse`
 *    carries `owner_id` and `my_role`, but neither settles it: `my_role ===
 *    "owner"` does not make the caller the user in `owner_id` once more than
 *    one membership can hold the `owner` role. Guessing here would grey out
 *    somebody else's row. The backend would need ONE of: an `is_self` boolean
 *    on `MemberResponse`, or the caller's `user_id` on the members page.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Empty, Flex, Input, Popconfirm, Select, Table, Typography } from "antd";
import type { TableProps } from "antd";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  loadedRowsOrEmpty,
  matchList,
  useActionGate,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { SkinDialog } from "@stapel/tokens-antd/skin";
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

/** The system-protected role the backend's last-owner rule is about. */
const OWNER_ROLE = "owner";

/** One entry of the role picker: the registry key plus its resolved label. */
interface RoleOption {
  readonly value: string;
  readonly label: string;
}

/** The muted sentence that sits under a switched-off control. */
function BlockedReason(props: { readonly text: string }): ReactElement {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {props.text}
    </Typography.Text>
  );
}

/**
 * One row's "Remove", switched off WITH ITS REASON when the backend would
 * refuse it (last-owner protection).
 *
 * Its own component because `useActionGate` is a hook and a row is rendered
 * from a `columns` callback — and because a disabled button receives no
 * pointer events, so the reason has to be text beside it, never a tooltip
 * (core's `actionGate.ts`; `auth-react`'s `OAuthLinks` is the reference).
 */
function RemoveMemberAction(props: {
  readonly availability: ActionAvailability;
  readonly onConfirm: () => void;
}): ReactElement {
  const t = useT();
  const gate = useActionGate(props.availability);
  return (
    <Flex vertical align="flex-start" gap={4}>
      <Popconfirm
        title={t(WORKSPACES_I18N_KEYS.membersRemoveConfirm)}
        onConfirm={props.onConfirm}
        disabled={gate.disabled}
      >
        <Button danger type="link" disabled={gate.disabled}>
          {t(WORKSPACES_I18N_KEYS.membersRemove)}
        </Button>
      </Popconfirm>
      {gate.reason !== undefined && <BlockedReason text={gate.reason} />}
    </Flex>
  );
}

/**
 * The invite dialog — a bottom sheet on a phone, a centred modal on
 * tablet/desktop, because that is what `SkinDialog` is (owner ruling
 * 2026-08-24, stated once in `@stapel/tokens-antd/skin`).
 *
 * A component rather than inline JSX for the same reason as
 * {@link RemoveMemberAction}: the dialog's submit is gated, `useActionGate` is
 * a hook, and the surrounding JSX lives inside render-prop closures where a
 * hook call would not have a stable owner.
 */
function InviteDialog(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly emailsText: string;
  readonly onEmailsChange: (value: string) => void;
  readonly role: string;
  readonly onRoleChange: (role: string) => void;
  readonly roleOptions: readonly RoleOption[];
  readonly rolesLoading: boolean;
  readonly rolesFailed: boolean;
  readonly isInviting: boolean;
  /** Send the invitations. Named for the domain, not for a DOM event: there is
   * no form here, and the one real click point is the button below — which
   * declares its own analytics outcome (§3.2). */
  readonly onInvite: () => void;
}): ReactElement {
  const t = useT();
  // Ordered the way it would be explained out loud: the outage first, the
  // thing the person can fix second.
  const gate = useActionGate(
    firstBlock(
      props.rolesFailed
        ? actionBlocked(WORKSPACES_I18N_KEYS.rolesLoadFailed)
        : actionAvailable(),
      props.emailsText.trim().length === 0
        ? actionBlocked(WORKSPACES_I18N_KEYS.membersInviteBlockedNoEmails)
        : actionAvailable()
    )
  );

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(WORKSPACES_I18N_KEYS.membersInviteDialogTitle)}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="members-invite-dialog"
      footer={
        <Flex vertical align="flex-end" gap={4}>
          <Button
            type="primary"
            loading={props.isInviting}
            disabled={gate.disabled}
            onClick={props.onInvite}
            data-analytics="none"
            data-analytics-reason="pair-defines-no-analytics-events-yet"
          >
            {t(WORKSPACES_I18N_KEYS.membersInviteSubmit)}
          </Button>
          {gate.reason !== undefined && <BlockedReason text={gate.reason} />}
        </Flex>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersInviteEmailsLabel)}</Typography.Text>
          <Input
            value={props.emailsText}
            onChange={(e) => props.onEmailsChange(e.target.value)}
            placeholder={t(WORKSPACES_I18N_KEYS.membersInviteEmailsPlaceholder)}
          />
        </div>
        <div>
          <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersInviteRoleLabel)}</Typography.Text>
          {/* A failed registry read is not an empty registry: an enabled
              picker over `[]` offers a choice that does not exist. The reason
              is already stated above the dialog's opener and again under the
              blocked submit. */}
          {props.rolesFailed ? (
            <BlockedReason text={t(WORKSPACES_I18N_KEYS.rolesLoadFailed)} />
          ) : (
            <Select<string>
              value={props.role}
              onChange={props.onRoleChange}
              style={{ width: "100%" }}
              loading={props.rolesLoading}
              options={[...props.roleOptions]}
            />
          )}
        </div>
      </div>
    </SkinDialog>
  );
}

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
          {({ state, rosterComplete, writeError, invite, isInviting, updateRole, remove, refetch }) => {
            const { labelFor } = rolesBag;
            // The registry read is a SEPARATE load from the roster's, and it
            // gets its own sentence below rather than silently producing an
            // empty picker — a role menu with nothing in it and a role menu
            // that could not be fetched look identical to a person.
            const rolesFailed = rolesBag.state.status === "failed";
            const rolesLoading = rolesBag.state.status === "loading";
            const roleOptions: readonly RoleOption[] = loadedRowsOrEmpty(rolesBag.state).map((r) => ({
              value: r.role,
              label: labelFor(r.role),
            }));
            const inviteRoleOptions = roleOptions.filter(
              (o) => o.value !== OWNER_ROLE
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

            /**
             * Whether removing THIS member is offerable. Only the last-owner
             * rule is decidable here, and only over a complete roster — see
             * the module doc for the one the contract cannot answer.
             */
            function removeAvailability(
              member: Member,
              rows: readonly Member[]
            ): ActionAvailability {
              if (!rosterComplete || member.role !== OWNER_ROLE) {
                return actionAvailable();
              }
              const owners = rows.filter((m) => m.role === OWNER_ROLE).length;
              return owners <= 1
                ? actionBlocked(WORKSPACES_I18N_KEYS.membersRemoveBlockedLastOwner)
                : actionAvailable();
            }

            /** Columns need the rows: "is this the last owner?" is a question
             * about the set, not about the cell. */
            function columnsFor(
              rows: readonly Member[]
            ): NonNullable<TableProps<Member>["columns"]> {
              return [
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
                    // No registry, no picker. The alternative — an ENABLED
                    // Select over `options: []` — is a control that cannot do
                    // the one thing it is for; the stated failure above the
                    // table says why, and the role itself still reads.
                    canManage && !rolesFailed ? (
                      <Select<string>
                        value={member.role}
                        style={{ width: 160 }}
                        loading={rolesLoading}
                        onChange={(next) => updateRole({ userId: member.user_id, role: next })}
                        // A member's CURRENT role may be missing from the
                        // registry options (a deployment removed an overlay
                        // role) — antd shows the raw value then, which matches
                        // labelFor's raw-name fallback contract.
                        options={[...roleOptions]}
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
                          <RemoveMemberAction
                            availability={removeAvailability(member, rows)}
                            onConfirm={() => remove(member.user_id)}
                          />
                        ),
                      },
                    ]
                  : []),
              ];
            }

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
                      columns={columnsFor([])}
                      pagination={false}
                      scroll={{ x: true }}
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
                      columns={columnsFor(members)}
                      pagination={false}
                      // Three columns do not fit a phone. Without this the
                      // last one is simply unreachable (sibling reference:
                      // gdpr-react's DsarQueue).
                      scroll={{ x: true }}
                    />
                  ),
                })}

                <InviteDialog
                  open={inviteOpen}
                  onClose={() => setInviteOpen(false)}
                  emailsText={emailsText}
                  onEmailsChange={setEmailsText}
                  role={inviteRole}
                  onRoleChange={setInviteRole}
                  roleOptions={inviteRoleOptions}
                  rolesLoading={rolesLoading}
                  rolesFailed={rolesFailed}
                  isInviting={isInviting}
                  onInvite={submitInvite}
                />
              </Card>
            );
          }}
        </Members>
      )}
    </RoleSelect>
  );
}
