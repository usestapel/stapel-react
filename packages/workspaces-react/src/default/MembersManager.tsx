/**
 * `<MembersManager/>` — the default skin for "who is in this workspace":
 * the roster, an invite, a role change, a name correction, a removal, and a
 * page walk that actually reaches the second page.
 *
 * Roles come from the EFFECTIVE registry via `<RoleSelectField/>` (GET /roles,
 * org-program §A2) — never a hardcoded builtin four: a deployment that
 * overlays `STAPEL_WORKSPACES["ROLES"]` (e.g. a `secretary`) sees its roles
 * here, labelled by `workspaces.role.<key>` where a bundle carries one and
 * title-cased from the key where it does not. `owner` is offered only on an
 * existing member's row (the backend enforces "only an owner grants owner"
 * and last-owner protection); the invite dialog leaves it out.
 *
 * ## What a row's controls are allowed to claim
 *
 * A control that offers an action the caller's situation makes impossible is
 * a lie the backend then has to tell. Two such rows exist here, and the
 * members contract answers only one of them:
 *
 *  - **The last owner.** Answerable: `MemberResponse.role` is on every row and
 *    the page envelope says whether the page IS the roster
 *    (`MembersBag.rosterComplete`). With the whole roster in hand, "exactly
 *    one row holds `owner`" is a fact, so "Remove" on that row is switched off
 *    with the reason printed beside it. On any page of a longer roster nothing
 *    is claimed — a count of a page is not a count of the roster.
 *  - **The caller's own row.** Answerable only by the SERVER. This pair has no
 *    caller identity to compare `user_id` against (`@stapel/core`'s session
 *    exposes a STATUS, never a subject; the mandate axis resolves to
 *    `anonymous`/`guest`/`member`, never to a user id), and `my_role ===
 *    "owner"` does not make the caller the user in `owner_id` once more than
 *    one membership can hold the role — guessing would grey out somebody
 *    else's row. So the row is gated on `MemberResponse.is_self`, the
 *    server-derived flag (stapel-workspaces 0.30.0), and on nothing else: a
 *    build talking to a backend that does not send it claims nothing rather
 *    than guessing. See {@link isSelf}.
 *
 * `is_self` gates TWO controls, not one. `MemberPasswordResetView` refuses
 * the caller's own row with the byte-identical 404 it gives for a stranger —
 * correct on the server (one refusal shape, nothing to learn from the
 * difference) and invisible to a client without this flag: an ungated "Reset
 * password" on your own row comes back with a 404 that reads as "this member
 * has been removed". Both controls therefore ask {@link isSelf} first.
 *
 * ## Two-factor evidence
 *
 * `MemberResponse.mfa_compliant` is true / false / **null**, and null is a
 * state of its own — nobody has asked yet (WORK-01). Under a `require_mfa`
 * policy those members are the ones an administrator acts on, so the column
 * prints three different things and never folds the unknown into a "no".
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Card, Flex, Input, Typography, theme as antdTheme } from "antd";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
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
import { Members } from "../headless/Members.js";
import type { MembersBag } from "../headless/Members.js";
import type { Member, MembersParams } from "../api/types.js";
import { useResetMemberPassword } from "../model/mutations.js";
import { ActiveWorkspaceBoundary } from "./ActiveWorkspace.js";
import { useWorkspaceFormat } from "../model/format.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { AnchorPager, Muted, PersonLine, RowActions, StatusTag } from "./parts.js";
import { RoleSelectField } from "./RoleSelectField.js";

export interface MembersManagerProps {
  /**
   * The workspace whose roster this is. OPTIONAL: omitted (the way the nav
   * contract mounts this screen — it routes, it does not hand over an ambient
   * scope), the active workspace is read from the runtime selection
   * (`WorkspaceSelection`), and a screen with none renders the designed
   * "choose a workspace" state rather than a blank.
   */
  workspaceId?: string;
  /**
   * Whether the caller may invite, change roles, rename and remove members.
   * The host already knows the caller's own verdict in this workspace (e.g.
   * `useCapabilities(workspaceId).can("members.invite")`, or the coarser
   * `my_role`); this component doesn't re-derive it — pass `false` for a
   * read-only roster, which says so rather than silently dropping controls.
   * Default `true`.
   */
  canManage?: boolean;
}

const DEFAULT_INVITE_ROLE = "member";

/** The system-protected role the backend's last-owner rule is about. */
const OWNER_ROLE = "owner";

/** The suspension the `require_mfa` sweep writes. Any other reason is shown
 * as the plain "suspended" tag — this pair does not invent copy for a value
 * the backend has not documented. */
const SUSPENDED_NO_MFA = "no_mfa";

/** A page of the walk. Anchor + direction is the whole cursor; `index` is how
 * many steps this screen has taken, which is the only page NUMBER an anchor
 * API can honestly show. */
interface Walk {
  readonly anchor: string | undefined;
  readonly direction: "next" | "prev" | undefined;
  readonly index: number;
}

const FIRST_PAGE: Walk = { anchor: undefined, direction: undefined, index: 1 };

/** A shape good enough to send: the backend answers `error.400.invalid_email`
 * per address after a round trip, and finding out one at a time is the defect
 * this closes. Deliberately loose — address validation belongs to the server;
 * this only catches what is obviously not an address. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitEmails(text: string): readonly string[] {
  return text
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function MembersManager(props: MembersManagerProps): ReactElement {
  return (
    <SkinTheme data-testid="members-manager">
      <ActiveWorkspaceBoundary
        workspaceId={props.workspaceId}
        testId="members-manager-workspace"
      >
        {(workspaceId) => (
          <Roster workspaceId={workspaceId} canManage={props.canManage ?? true} />
        )}
      </ActiveWorkspaceBoundary>
    </SkinTheme>
  );
}

/** The roster once the workspace is known — the walk and the filter live here
 * because the cursor belongs to this screen's state, not to the bag's. */
function Roster(props: {
  readonly workspaceId: string;
  readonly canManage: boolean;
}): ReactElement {
  const [walk, setWalk] = useState<Walk>(FIRST_PAGE);
  const [search, setSearch] = useState("");

  const params: MembersParams = {
    ...(walk.anchor !== undefined ? { anchor: walk.anchor } : {}),
    ...(walk.direction !== undefined ? { direction: walk.direction } : {}),
    ...(search.trim() !== "" ? { search: search.trim() } : {}),
  };

  return (
    <Members workspaceId={props.workspaceId} params={params}>
      {(bag) => (
        <RosterCard
          bag={bag}
          workspaceId={props.workspaceId}
          canManage={props.canManage}
          walk={walk}
          search={search}
          onSearch={(value) => {
            // A new filter is a new walk: an anchor from the old one points
            // into a list that no longer exists.
            setSearch(value);
            setWalk(FIRST_PAGE);
          }}
          onWalk={setWalk}
        />
      )}
    </Members>
  );
}

function RosterCard(props: {
  readonly bag: MembersBag;
  readonly workspaceId: string;
  readonly canManage: boolean;
  readonly walk: Walk;
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly onWalk: (walk: Walk) => void;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { bag, canManage } = props;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [renaming, setRenaming] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);

  const page = bag.page;
  const rosterEmpty = bag.state.status === "ready" && bag.state.data.length === 0;
  const showSearch = !rosterEmpty || props.search.trim() !== "";

  return (
    <Card data-testid="members-manager-card">
      <Flex justify="space-between" align="flex-start" gap={spacing["4"]} wrap>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
            {t(WORKSPACES_I18N_KEYS.membersTitle)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(WORKSPACES_I18N_KEYS.membersSubtitle)}
          </Typography.Text>
          {page !== null && (
            <Muted testId="members-count">
              {tPlural(WORKSPACES_I18N_KEYS.membersCount, { count: page.count })}
            </Muted>
          )}
        </Flex>
        {/* The one primary on this screen. Everything else on a row is a
            quiet link or a danger link — and on an EMPTY roster the empty
            state owns the invite door instead, because two solid "Invite"
            buttons on one screen is not emphasis, it is a coin toss. */}
        {canManage && !rosterEmpty && (
          <Button
            type="primary"
            onClick={() => setInviteOpen(true)}
            data-analytics="none"
            data-analytics-reason="local-ui-open-invite-dialog"
            data-testid="members-invite-open"
          >
            {t(WORKSPACES_I18N_KEYS.membersInvite)}
          </Button>
        )}
      </Flex>

      {!canManage && (
        <div style={{ marginTop: spacing["2"] }}>
          <Muted testId="members-read-only">
            {t(WORKSPACES_I18N_KEYS.membersBlockedReadOnly)}
          </Muted>
        </div>
      )}

      {/* A filter over nothing is furniture. It stays while a SEARCH is
          running (that is how a person clears one that matched nobody) and
          goes when the roster itself is empty. */}
      {showSearch && (
        <div style={{ marginTop: spacing["4"] }}>
          <Input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder={t(WORKSPACES_I18N_KEYS.membersSearchPlaceholder)}
            aria-label={t(WORKSPACES_I18N_KEYS.membersSearchPlaceholder)}
            allowClear
            data-testid="members-search"
          />
        </div>
      )}

      {/* A write that failed — the roster read has its own arm below. */}
      <ErrorAlert
        thrown={bag.writeError}
        style={{ marginTop: spacing["3"] }}
        testId="members-write-error"
      />

      <div style={{ marginTop: spacing["4"] }}>
        <LoadList
          state={bag.state}
          testId="members-list"
          onRetry={bag.refetch}
          empty={
            <EmptyState
              title={t(WORKSPACES_I18N_KEYS.membersEmpty)}
              testId="members-list-empty"
              {...(canManage
                ? {
                    action: (
                      <Button
                        type="primary"
                        onClick={() => setInviteOpen(true)}
                        data-analytics="none"
                        data-analytics-reason="local-ui-open-invite-dialog"
                        data-testid="members-invite-open"
                      >
                        {t(WORKSPACES_I18N_KEYS.membersInvite)}
                      </Button>
                    ),
                  }
                : {})}
            />
          }
        >
          {(members) => (
            <div role="list" data-testid="members-rows">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  rows={members}
                  bag={bag}
                  canManage={canManage}
                  onRename={() => setRenaming(member)}
                  onRemove={() => setRemoving(member)}
                  onResetPassword={() => setResetting(member)}
                />
              ))}
            </div>
          )}
        </LoadList>
      </div>

      {page !== null && (
        <AnchorPager
          hasPrev={page.hasPrev}
          hasNext={page.hasNext}
          prevLabel={t(WORKSPACES_I18N_KEYS.pagerPrev)}
          nextLabel={t(WORKSPACES_I18N_KEYS.pagerNext)}
          position={t(WORKSPACES_I18N_KEYS.pagerPosition, { page: props.walk.index })}
          testId="members-pager"
          onPrev={() =>
            props.onWalk({
              anchor: page.prevAnchor ?? undefined,
              direction: "prev",
              index: Math.max(1, props.walk.index - 1),
            })
          }
          onNext={() =>
            props.onWalk({
              anchor: page.nextAnchor ?? undefined,
              direction: "next",
              index: props.walk.index + 1,
            })
          }
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        isInviting={bag.isInviting}
        onInvite={(body) => {
          bag.invite(body);
          setInviteOpen(false);
        }}
      />

      <RenameDialog
        member={renaming}
        onClose={() => setRenaming(null)}
        isRenaming={bag.isRenaming}
        onRename={(displayName) => {
          if (renaming === null) return;
          bag.rename({ userId: renaming.user_id, displayName });
          setRenaming(null);
        }}
      />

      <PasswordResetDialog
        workspaceId={props.workspaceId}
        member={resetting}
        onClose={() => setResetting(null)}
      />

      {/* ONE confirm for the list, keyed by the pending row — not one per
          row, which is N dialogs mounted to answer a question about one. */}
      <SkinConfirm
        open={removing !== null}
        danger
        title={t(WORKSPACES_I18N_KEYS.membersRemoveConfirm)}
        body={t(WORKSPACES_I18N_KEYS.membersRemoveConfirmBody, {
          member: removing?.display_name ?? removing?.email ?? "",
        })}
        confirmLabel={t(WORKSPACES_I18N_KEYS.membersRemove)}
        cancelLabel={t(WORKSPACES_I18N_KEYS.cancel)}
        confirming={bag.isRemoving}
        onConfirm={() => {
          if (removing !== null) bag.remove(removing.user_id);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
        data-testid="members-remove-confirm"
      />
    </Card>
  );
}

/**
 * Is this row the READER? The server's answer (`MemberResponse.is_self`,
 * stapel-workspaces 0.30.0) and only the server's.
 *
 * The field is OPTIONAL in the contract, and the `=== true` is the whole
 * point of reading it that way: a deployment on an older backend sends
 * nothing, and the absence must read as "the server did not say" — never as
 * "no". A comparison against a session id would be the client re-deriving an
 * identity it does not hold, which is the shape of the `my_role` defect
 * `can_delete` was added to close.
 */
function isSelf(member: Member): boolean {
  return member.is_self === true;
}

/**
 * Whether removing THIS member is offerable. Two rules, in the order a person
 * would be told them; everything else is the backend's to refuse.
 */
function removeAvailability(
  member: Member,
  rows: readonly Member[],
  rosterComplete: boolean
): ActionAvailability {
  if (isSelf(member)) {
    return actionBlocked(WORKSPACES_I18N_KEYS.membersRemoveBlockedSelf);
  }
  if (!rosterComplete || member.role !== OWNER_ROLE) return actionAvailable();
  const owners = rows.filter((row) => row.role === OWNER_ROLE).length;
  return owners <= 1
    ? actionBlocked(WORKSPACES_I18N_KEYS.membersRemoveBlockedLastOwner)
    : actionAvailable();
}

/**
 * Whether "Reset password" is offerable on THIS row. One rule, and it is the
 * server's: `MemberPasswordResetView` refuses the caller's own row with the
 * byte-identical 404 it gives for a stranger ("Yourself is not in the set
 * this endpoint acts on"), so an ungated button here would read the backend's
 * correct refusal as "this member has been removed" and say so to an admin
 * looking at their own name. Everything else — the owner-target rule, the
 * privileged-account refusal, the step-up — the backend answers, and this
 * screen states rather than predicts.
 */
function resetPasswordAvailability(member: Member): ActionAvailability {
  return isSelf(member)
    ? actionBlocked(WORKSPACES_I18N_KEYS.membersResetBlockedSelf)
    : actionAvailable();
}

function MemberRow(props: {
  readonly member: Member;
  readonly rows: readonly Member[];
  readonly bag: MembersBag;
  readonly canManage: boolean;
  readonly onRename: () => void;
  readonly onRemove: () => void;
  readonly onResetPassword: () => void;
}): ReactElement {
  const t = useT();
  const format = useWorkspaceFormat();
  const { token } = antdTheme.useToken();
  const { member, bag, canManage } = props;

  const lastSeen = format.relative(member.last_accessed_at);
  const joined = format.date(member.accepted_at ?? member.invited_at);

  const tags: ReactNode = (
    <>
      {member.suspended_at !== null && member.suspended_at !== undefined && (
        <StatusTag tone="danger" testId="member-suspended">
          {t(WORKSPACES_I18N_KEYS.membersSuspended)}
        </StatusTag>
      )}
      {member.provisioned === true && (
        <StatusTag tone="neutral">{t(WORKSPACES_I18N_KEYS.membersProvisioned)}</StatusTag>
      )}
      <MfaTag compliant={member.mfa_compliant ?? null} />
    </>
  );

  return (
    <div
      role="listitem"
      data-testid={`member-row-${member.user_id}`}
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
        name={member.display_name ?? null}
        email={member.email}
        tags={tags}
        caption={
          <>
            {joined !== null && t(WORKSPACES_I18N_KEYS.membersJoined, { date: joined })}
            {joined !== null && " · "}
            {lastSeen === null
              ? t(WORKSPACES_I18N_KEYS.membersLastSeenNever)
              : t(WORKSPACES_I18N_KEYS.membersLastSeen, { date: lastSeen })}
            {member.suspension_reason === SUSPENDED_NO_MFA && (
              <> · {t(WORKSPACES_I18N_KEYS.membersSuspendedNoMfa)}</>
            )}
          </>
        }
      />
      <Flex gap={spacing["3"]} align="center" wrap>
        <div style={{ minWidth: "10rem" }}>
          <RoleSelectField
            value={member.role}
            size="small"
            label={t(WORKSPACES_I18N_KEYS.membersRolePickerLabel, {
              member: member.display_name ?? member.email ?? member.role,
            })}
            disabled={!canManage}
            onChange={(role) => bag.updateRole({ userId: member.user_id, role })}
            testId={`member-role-${member.user_id}`}
          />
        </div>
      </Flex>
      {/* The controls, and — as a footnote spanning the row, not as
          paragraphs inside the action column — the refusals behind them. The
          viewer's OWN row refuses two of the three, and while those reasons
          lived beside the buttons they widened the column until that one row
          wrapped to the stacked phone layout in the middle of a desktop
          table, two geometries deep. */}
      {canManage && (
        <RowActions
          testId={`member-blocked-${member.user_id}`}
          actions={[
            {
              key: "rename",
              gate: actionAvailable(),
              label: t(WORKSPACES_I18N_KEYS.membersRename),
              onClick: props.onRename,
              testId: `member-rename-${member.user_id}`,
            },
            {
              key: "reset",
              gate: resetPasswordAvailability(member),
              label: t(WORKSPACES_I18N_KEYS.membersResetPassword),
              onClick: props.onResetPassword,
              testId: `member-reset-password-${member.user_id}`,
            },
            {
              key: "remove",
              gate: removeAvailability(member, props.rows, bag.rosterComplete),
              label: t(WORKSPACES_I18N_KEYS.membersRemove),
              onClick: props.onRemove,
              danger: true,
              testId: `member-remove-${member.user_id}`,
            },
          ]}
        />
      )}
    </div>
  );
}

/** Three states, never two: confirmed, missing, and nobody has asked. */
function MfaTag(props: { readonly compliant: boolean | null }): ReactElement {
  const t = useT();
  if (props.compliant === true) {
    return (
      <StatusTag tone="success" testId="member-mfa">
        {`${t(WORKSPACES_I18N_KEYS.membersMfaLabel)}: ${t(WORKSPACES_I18N_KEYS.membersMfaCompliant)}`}
      </StatusTag>
    );
  }
  if (props.compliant === false) {
    return (
      <StatusTag tone="warning" testId="member-mfa">
        {`${t(WORKSPACES_I18N_KEYS.membersMfaLabel)}: ${t(WORKSPACES_I18N_KEYS.membersMfaNoncompliant)}`}
      </StatusTag>
    );
  }
  return (
    <StatusTag tone="neutral" testId="member-mfa">
      {`${t(WORKSPACES_I18N_KEYS.membersMfaLabel)}: ${t(WORKSPACES_I18N_KEYS.membersMfaUnknown)}`}
    </StatusTag>
  );
}

/**
 * The invite dialog — a bottom sheet on a phone, a centred modal on
 * tablet/desktop, because that is what `SkinDialog` is (owner ruling
 * 2026-08-24, stated once in `@stapel/tokens-antd/skin`).
 */
function InviteDialog(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly isInviting: boolean;
  readonly onInvite: (body: {
    emails: string[];
    role: string;
    display_name?: string;
  }) => void;
}): ReactElement {
  const t = useT();
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState(DEFAULT_INVITE_ROLE);
  const [displayName, setDisplayName] = useState("");

  const emails = splitEmails(emailsText);
  const firstBad = emails.find((email) => !looksLikeEmail(email));
  // Ordered the way it would be explained out loud: the thing that is empty
  // first, the thing that is wrong second.
  const gate = firstBlock(
    emails.length === 0
      ? actionBlocked(WORKSPACES_I18N_KEYS.membersInviteBlockedNoEmails)
      : actionAvailable(),
    firstBad !== undefined
      ? actionBlocked(WORKSPACES_I18N_KEYS.membersInviteBlockedBadEmail, {
          email: firstBad,
        })
      : actionAvailable()
  );

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(WORKSPACES_I18N_KEYS.membersInviteDialogTitle)}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="members-invite-dialog"
      footer={
        <GatedButton
          gate={gate}
          type="primary"
          loading={props.isInviting}
          onClick={() => {
            props.onInvite({
              emails: [...emails],
              role,
              ...(displayName.trim() !== "" ? { display_name: displayName.trim() } : {}),
            });
            setEmailsText("");
            setDisplayName("");
            setRole(DEFAULT_INVITE_ROLE);
          }}
          testId="members-invite-submit"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(WORKSPACES_I18N_KEYS.membersInviteSubmit)}
        </GatedButton>
      }
    >
      <Flex vertical gap={spacing["3"]}>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Text>
            {t(WORKSPACES_I18N_KEYS.membersInviteEmailsLabel)}
          </Typography.Text>
          <Input
            value={emailsText}
            onChange={(event) => setEmailsText(event.target.value)}
            placeholder={t(WORKSPACES_I18N_KEYS.membersInviteEmailsPlaceholder)}
            aria-label={t(WORKSPACES_I18N_KEYS.membersInviteEmailsLabel)}
          />
        </Flex>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Text>{t(WORKSPACES_I18N_KEYS.membersInviteNameLabel)}</Typography.Text>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t(WORKSPACES_I18N_KEYS.membersInviteNamePlaceholder)}
            aria-label={t(WORKSPACES_I18N_KEYS.membersInviteNameLabel)}
          />
        </Flex>
        <RoleSelectField
          value={role}
          onChange={setRole}
          excludeOwner
          showLabel
          label={t(WORKSPACES_I18N_KEYS.membersInviteRoleLabel)}
          testId="members-invite-role"
        />
      </Flex>
    </SkinDialog>
  );
}

/**
 * The name correction an owner/admin applies without waiting for the person
 * themselves. It writes the CANONICAL name (stapel-profiles), which the hint
 * under the field says out loud — a workspace-local note is what people
 * expect from a field in a workspace screen, and this is not one.
 */
function RenameDialog(props: {
  readonly member: Member | null;
  readonly onClose: () => void;
  readonly isRenaming: boolean;
  readonly onRename: (displayName: string | null) => void;
}): ReactElement {
  const t = useT();
  const current = props.member?.display_name ?? "";
  const [value, setValue] = useState(current);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Seed the field from the row the dialog was opened for, without an effect:
  // a different member in the same mounted dialog is a different edit.
  if (props.member !== null && editingId !== props.member.id) {
    setEditingId(props.member.id);
    setValue(props.member.display_name ?? "");
  }

  const gate =
    value.trim() === current.trim()
      ? actionBlocked(WORKSPACES_I18N_KEYS.membersRenameBlockedUnchanged)
      : actionAvailable();

  return (
    <SkinDialog
      open={props.member !== null}
      onClose={props.onClose}
      title={t(WORKSPACES_I18N_KEYS.membersRenameDialogTitle)}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="members-rename-dialog"
      footer={
        <GatedButton
          gate={gate}
          type="primary"
          loading={props.isRenaming}
          onClick={() => props.onRename(value.trim() === "" ? null : value.trim())}
          testId="members-rename-submit"
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
          data-testid="members-rename-input"
        />
        <Muted>{t(WORKSPACES_I18N_KEYS.membersRenameHint)}</Muted>
      </Flex>
    </SkinDialog>
  );
}

/**
 * Reset a member's password on the organization's order — an account takeover
 * performed on purpose, so the dialog states every part of it before the
 * click and once more after.
 *
 * Three things this surface has to get right, all of them the backend's own
 * rules stated on the glass rather than re-derived:
 *
 *  - **The step-up is announced, not discovered.** The capability is declared
 *    `high`, so `@requires_verification(scope="sensitive")` will demand a
 *    fresh confirmation; core's client drives the challenge and replays the
 *    call. A person who reads "you will be asked to confirm" before pressing
 *    the button experiences a step, not a refusal.
 *  - **The generated password is shown ONCE.** It comes back only when the
 *    request omitted one, is never re-fetchable, and the hook deliberately
 *    keeps it out of the query cache (`gcTime: 0`). Closing the dialog resets
 *    the mutation, so the credential leaves the screen with it.
 *  - **`notified: false` is said out loud.** It means the account had no
 *    channel to be told on, which makes the admin the only person who can
 *    tell them — silence there is how a reset becomes indistinguishable from
 *    a takeover.
 */
function PasswordResetDialog(props: {
  readonly workspaceId: string;
  readonly member: Member | null;
  readonly onClose: () => void;
}): ReactElement {
  const t = useT();
  const reset = useResetMemberPassword(props.workspaceId);
  const { member } = props;
  const who = member?.display_name ?? member?.email ?? "";
  const result = reset.data;

  const close = (): void => {
    // The result carries a live credential: it goes when the dialog goes.
    reset.reset();
    props.onClose();
  };

  return (
    <SkinDialog
      open={member !== null}
      onClose={close}
      title={t(WORKSPACES_I18N_KEYS.membersResetDialogTitle, { member: who })}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="members-reset-dialog"
      footer={
        result === undefined ? (
          <Button
            type="primary"
            danger
            loading={reset.isPending}
            onClick={() => {
              if (member !== null) reset.mutate({ userId: member.user_id });
            }}
            data-testid="members-reset-submit"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(WORKSPACES_I18N_KEYS.membersResetSubmit)}
          </Button>
        ) : (
          <Button
            type="primary"
            onClick={close}
            data-testid="members-reset-done"
            data-analytics="none"
            data-analytics-reason="local-ui-close-dialog"
          >
            {t(WORKSPACES_I18N_KEYS.dialogClose)}
          </Button>
        )
      }
    >
      <Flex vertical gap={spacing["3"]}>
        {result === undefined ? (
          <>
            <Typography.Text>
              {t(WORKSPACES_I18N_KEYS.membersResetDialogBody)}
            </Typography.Text>
            <Muted testId="members-reset-stepup">
              {t(WORKSPACES_I18N_KEYS.membersResetStepUp)}
            </Muted>
            <ErrorAlert thrown={reset.error} testId="members-reset-error" />
          </>
        ) : (
          <Flex vertical gap={spacing["2"]} data-testid="members-reset-result">
            <Typography.Text>
              {t(WORKSPACES_I18N_KEYS.membersResetDone, { member: who })}
            </Typography.Text>
            {typeof result.generated_password === "string" && (
              <>
                <Typography.Text>
                  {t(WORKSPACES_I18N_KEYS.membersResetGenerated)}
                </Typography.Text>
                <Typography.Text code data-testid="members-reset-password">
                  {result.generated_password}
                </Typography.Text>
                <Muted>{t(WORKSPACES_I18N_KEYS.membersResetGeneratedHint)}</Muted>
              </>
            )}
            {result.notified === false && (
              <Muted testId="members-reset-not-notified">
                {t(WORKSPACES_I18N_KEYS.membersResetNotNotified)}
              </Muted>
            )}
          </Flex>
        )}
      </Flex>
    </SkinDialog>
  );
}
