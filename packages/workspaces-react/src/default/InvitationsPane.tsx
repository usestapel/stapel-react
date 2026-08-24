/**
 * `<InvitationsPane/>` — the admin's "who has not joined yet" console
 * (stapel-workspaces #109). Four endpoints that had four hooks and zero
 * pixels: list, revoke, resend, rename.
 *
 * ## Why each control is gated the way it is
 *
 * The three writes are refused by the backend on the invitation's own state,
 * not on the caller's role, so the state is what the screen gates on and the
 * reason is the one the endpoint would give:
 *
 *  - **Revoke** and **rename** need a `pending` row. A terminal invitation
 *    answers `error.400.invitation_already_used` / `_revoked` / `_declined` /
 *    `_expired`; offering the control and letting the person discover that is
 *    the "button that leads to a refusal" defect.
 *  - **Resend** additionally accepts an `expired` row on purpose — a dead TTL
 *    is the commonest reason to resend — and it is NOT an idempotent poke: it
 *    rotates the token, so every earlier link (including the one in the
 *    invitee's inbox) stops working. The confirm says that, because an admin
 *    who does not know it will send two links and wonder which one works.
 *
 * Nothing here shows the invite TOKEN: it is a bearer credential that only
 * ever leaves the backend inside the invitation email, and the response shape
 * deliberately does not carry it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Input, Segmented, Typography, theme as antdTheme } from "antd";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  mapLoad,
  useT,
  useTPlural,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { useInvitations } from "../model/queries.js";
import {
  useRenameInvitation,
  useResendInvitation,
  useRevokeInvitation,
} from "../model/mutations.js";
import { useWorkspaceFormat } from "../model/format.js";
import type { Invitation, InvitationStatusFilter, InvitationsParams } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { AnchorPager, Muted, PersonLine, StatusTag } from "./parts.js";
import { RoleLabel } from "./RoleSelectField.js";

export interface InvitationsPaneProps {
  workspaceId: string;
  /**
   * Whether the caller may administer invitations (capability
   * `members.invite`). The host knows its own verdict — pass `false` for a
   * read-only view, which says so instead of silently dropping the controls.
   * Default `true`.
   */
  canManage?: boolean;
}

/** The status a row is in, as the backend derives it. */
const STATUS_KEY: Record<string, string> = {
  pending: WORKSPACES_I18N_KEYS.invitationsStatusPending,
  accepted: WORKSPACES_I18N_KEYS.invitationsStatusAccepted,
  declined: WORKSPACES_I18N_KEYS.invitationsStatusDeclined,
  revoked: WORKSPACES_I18N_KEYS.invitationsStatusRevoked,
  expired: WORKSPACES_I18N_KEYS.invitationsStatusExpired,
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "info",
  accepted: "success",
  declined: "neutral",
  revoked: "neutral",
  expired: "warning",
};

interface Walk {
  readonly anchor: string | undefined;
  readonly direction: "next" | "prev" | undefined;
  readonly index: number;
}

const FIRST_PAGE: Walk = { anchor: undefined, direction: undefined, index: 1 };

export function InvitationsPane(props: InvitationsPaneProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const canManage = props.canManage ?? true;
  const [status, setStatus] = useState<InvitationStatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [walk, setWalk] = useState<Walk>(FIRST_PAGE);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [resending, setResending] = useState<Invitation | null>(null);
  const [renaming, setRenaming] = useState<Invitation | null>(null);

  const params: InvitationsParams = {
    status,
    ...(walk.anchor !== undefined ? { anchor: walk.anchor } : {}),
    ...(walk.direction !== undefined ? { direction: walk.direction } : {}),
    ...(search.trim() !== "" ? { search: search.trim() } : {}),
  };
  const query = useInvitations(props.workspaceId, params);
  const revokeMutation = useRevokeInvitation(props.workspaceId);
  const resendMutation = useResendInvitation(props.workspaceId);
  const renameMutation = useRenameInvitation(props.workspaceId);
  const page = query.data ?? null;

  /** A new filter or a new search is a new walk — an anchor from the old one
   * points into a list that no longer exists. */
  function restart(apply: () => void): void {
    apply();
    setWalk(FIRST_PAGE);
  }

  return (
    <SkinTheme data-testid="invitations-pane">
      <Card>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
            {t(WORKSPACES_I18N_KEYS.invitationsTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(WORKSPACES_I18N_KEYS.invitationsSubtitle)}
          </Typography.Text>
          {page !== null && (
            <Muted testId="invitations-count">
              {tPlural(WORKSPACES_I18N_KEYS.invitationsCount, { count: page.count })}
            </Muted>
          )}
        </Flex>

        <Flex gap={spacing["3"]} wrap align="center" style={{ marginTop: spacing["4"] }}>
          <Segmented<InvitationStatusFilter>
            value={status}
            onChange={(next) => restart(() => setStatus(next))}
            aria-label={t(WORKSPACES_I18N_KEYS.invitationsFilterLabel)}
            data-testid="invitations-filter"
            options={[
              { value: "pending", label: t(WORKSPACES_I18N_KEYS.invitationsFilterPending) },
              {
                value: "never_accepted",
                label: t(WORKSPACES_I18N_KEYS.invitationsFilterNeverAccepted),
              },
              { value: "all", label: t(WORKSPACES_I18N_KEYS.invitationsFilterAll) },
            ]}
          />
          <Input
            value={search}
            onChange={(event) => restart(() => setSearch(event.target.value))}
            placeholder={t(WORKSPACES_I18N_KEYS.invitationsSearchPlaceholder)}
            aria-label={t(WORKSPACES_I18N_KEYS.invitationsSearchPlaceholder)}
            allowClear
            style={{ flex: "1 1 12rem" }}
            data-testid="invitations-search"
          />
        </Flex>

        <ErrorAlert
          thrown={revokeMutation.error ?? resendMutation.error ?? renameMutation.error}
          style={{ marginTop: spacing["3"] }}
          testId="invitations-write-error"
        />

        {!canManage && (
          <div style={{ marginTop: spacing["2"] }}>
            <Muted testId="invitations-read-only">
              {t(WORKSPACES_I18N_KEYS.membersBlockedReadOnly)}
            </Muted>
          </div>
        )}

        <div style={{ marginTop: spacing["4"] }}>
          <LoadList
            state={mapLoad(loadStateFromQuery(query), (loaded) => loaded.items)}
            testId="invitations-list"
            onRetry={() => {
              void query.refetch();
            }}
            empty={
              <EmptyState
                title={t(WORKSPACES_I18N_KEYS.invitationsEmpty)}
                testId="invitations-list-empty"
              />
            }
          >
            {(invitations) => (
              <div role="list" data-testid="invitations-rows">
                {invitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    canManage={canManage}
                    onRename={() => setRenaming(invitation)}
                    onResend={() => setResending(invitation)}
                    onRevoke={() => setRevoking(invitation)}
                  />
                ))}
              </div>
            )}
          </LoadList>
        </div>

        {page !== null && (
          <AnchorPager
            hasPrev={page.has_prev}
            hasNext={page.has_next}
            prevLabel={t(WORKSPACES_I18N_KEYS.pagerPrev)}
            nextLabel={t(WORKSPACES_I18N_KEYS.pagerNext)}
            position={t(WORKSPACES_I18N_KEYS.pagerPosition, { page: walk.index })}
            testId="invitations-pager"
            onPrev={() =>
              setWalk({
                anchor: page.prev_anchor ?? undefined,
                direction: "prev",
                index: Math.max(1, walk.index - 1),
              })
            }
            onNext={() =>
              setWalk({
                anchor: page.next_anchor ?? undefined,
                direction: "next",
                index: walk.index + 1,
              })
            }
          />
        )}

        <SkinConfirm
          open={revoking !== null}
          danger
          title={t(WORKSPACES_I18N_KEYS.invitationsRevokeConfirm)}
          body={t(WORKSPACES_I18N_KEYS.invitationsRevokeConfirmBody, {
            email: revoking?.email ?? "",
          })}
          confirmLabel={t(WORKSPACES_I18N_KEYS.invitationsRevoke)}
          cancelLabel={t(WORKSPACES_I18N_KEYS.cancel)}
          confirming={revokeMutation.isPending}
          onConfirm={() => {
            if (revoking !== null) revokeMutation.mutate(revoking.id);
            setRevoking(null);
          }}
          onCancel={() => setRevoking(null)}
          data-testid="invitations-revoke-confirm"
        />

        <SkinConfirm
          open={resending !== null}
          title={t(WORKSPACES_I18N_KEYS.invitationsResendConfirm)}
          body={t(WORKSPACES_I18N_KEYS.invitationsResendConfirmBody, {
            email: resending?.email ?? "",
          })}
          confirmLabel={t(WORKSPACES_I18N_KEYS.invitationsResend)}
          cancelLabel={t(WORKSPACES_I18N_KEYS.cancel)}
          confirming={resendMutation.isPending}
          onConfirm={() => {
            if (resending !== null) resendMutation.mutate(resending.id);
            setResending(null);
          }}
          onCancel={() => setResending(null)}
          data-testid="invitations-resend-confirm"
        />

        <RenameInvitationDialog
          invitation={renaming}
          onClose={() => setRenaming(null)}
          isRenaming={renameMutation.isPending}
          onRename={(displayName) => {
            if (renaming !== null) {
              renameMutation.mutate({ invitationId: renaming.id, displayName });
            }
            setRenaming(null);
          }}
        />
      </Card>
    </SkinTheme>
  );
}

/** Only a live invitation can be withdrawn or corrected. */
function pendingOnly(invitation: Invitation): ActionAvailability {
  return invitation.status === "pending"
    ? actionAvailable()
    : actionBlocked(WORKSPACES_I18N_KEYS.invitationsBlockedTerminal);
}

/** Resend also accepts an expired row — reviving a dead TTL is what it is
 * mostly for — and refuses the three terminal states. */
function resendable(invitation: Invitation): ActionAvailability {
  return invitation.status === "pending" || invitation.status === "expired"
    ? actionAvailable()
    : actionBlocked(WORKSPACES_I18N_KEYS.invitationsBlockedResendTerminal);
}

function InvitationRow(props: {
  readonly invitation: Invitation;
  readonly canManage: boolean;
  readonly onRename: () => void;
  readonly onResend: () => void;
  readonly onRevoke: () => void;
}): ReactElement {
  const t = useT();
  const format = useWorkspaceFormat();
  const { token } = antdTheme.useToken();
  const { invitation } = props;
  const statusKey = STATUS_KEY[invitation.status];
  const expires = format.relative(invitation.expires_at);
  const lastSent = format.relative(invitation.last_sent_at);

  return (
    <div
      role="listitem"
      data-testid={`invitation-row-${invitation.id}`}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing["3"],
        paddingTop: spacing["3"],
        paddingBottom: spacing["3"],
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      <PersonLine
        name={invitation.display_name ?? null}
        email={invitation.email}
        tags={
          <StatusTag
            tone={STATUS_TONE[invitation.status] ?? "neutral"}
            testId={`invitation-status-${invitation.id}`}
          >
            {statusKey === undefined ? invitation.status : t(statusKey)}
          </StatusTag>
        }
        caption={
          <>
            <RoleLabel role={invitation.role} />
            {expires !== null && (
              <>
                {" · "}
                {t(WORKSPACES_I18N_KEYS.invitationsExpiresLabel)}: {expires}
              </>
            )}
            {" · "}
            {lastSent === null
              ? t(WORKSPACES_I18N_KEYS.invitationsSentNever)
              : `${t(WORKSPACES_I18N_KEYS.invitationsSentLabel)}: ${lastSent}`}
          </>
        }
      />
      {props.canManage && (
        <Flex gap={spacing["2"]} align="flex-start" wrap>
          <GatedButton
            gate={pendingOnly(invitation)}
            type="link"
            size="small"
            onClick={props.onRename}
            testId={`invitation-rename-${invitation.id}`}
            data-analytics="none"
            data-analytics-reason="opens the rename dialog"
          >
            {t(WORKSPACES_I18N_KEYS.invitationsRename)}
          </GatedButton>
          <GatedButton
            gate={resendable(invitation)}
            type="link"
            size="small"
            onClick={props.onResend}
            testId={`invitation-resend-${invitation.id}`}
            data-analytics="none"
            data-analytics-reason="opens the resend confirm"
          >
            {t(WORKSPACES_I18N_KEYS.invitationsResend)}
          </GatedButton>
          <GatedButton
            gate={pendingOnly(invitation)}
            danger
            type="link"
            size="small"
            onClick={props.onRevoke}
            testId={`invitation-revoke-${invitation.id}`}
            data-analytics="none"
            data-analytics-reason="opens the revoke confirm"
          >
            {t(WORKSPACES_I18N_KEYS.invitationsRevoke)}
          </GatedButton>
        </Flex>
      )}
    </div>
  );
}

/**
 * The name correction one step before the member rename: the invitee has not
 * accepted, so there is no profile to write and the hint lives on the
 * invitation. `accept_invitation` copies it onto the membership.
 */
function RenameInvitationDialog(props: {
  readonly invitation: Invitation | null;
  readonly onClose: () => void;
  readonly isRenaming: boolean;
  readonly onRename: (displayName: string | null) => void;
}): ReactElement {
  const t = useT();
  const current = props.invitation?.display_name ?? "";
  const [value, setValue] = useState(current);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (props.invitation !== null && editingId !== props.invitation.id) {
    setEditingId(props.invitation.id);
    setValue(props.invitation.display_name ?? "");
  }

  const gate =
    value.trim() === current.trim()
      ? actionBlocked(WORKSPACES_I18N_KEYS.membersRenameBlockedUnchanged)
      : actionAvailable();

  return (
    <SkinDialog
      open={props.invitation !== null}
      onClose={props.onClose}
      title={t(WORKSPACES_I18N_KEYS.invitationsRenameDialogTitle)}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="invitations-rename-dialog"
      footer={
        <GatedButton
          gate={gate}
          type="primary"
          loading={props.isRenaming}
          onClick={() => props.onRename(value.trim() === "" ? null : value.trim())}
          testId="invitations-rename-submit"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(WORKSPACES_I18N_KEYS.membersRenameSubmit)}
        </GatedButton>
      }
    >
      <Flex vertical gap={spacing["2"]}>
        <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersRenameLabel)}</Typography.Text>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t(WORKSPACES_I18N_KEYS.membersRenamePlaceholder)}
          aria-label={t(WORKSPACES_I18N_KEYS.membersRenameLabel)}
          data-testid="invitations-rename-input"
        />
      </Flex>
    </SkinDialog>
  );
}
