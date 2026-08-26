/**
 * `<WorkspaceSettings/>` — the default skin for a workspace's own settings:
 * its name, the security policy everyone in it has to meet, and the one
 * irreversible act (deletion). Participants and roles live in the sibling
 * `<MembersManager/>`; invitations in `<InvitationsPane/>`.
 *
 * ## Two rules this screen exists to state
 *
 * **A control never claims what the endpoint would refuse.** The delete
 * button used to be drawn from `my_role === "owner"`. That derivation is
 * wrong on exactly two workspaces — the instance's default one, and a
 * personal one the next sign-in re-mints — and the backend added
 * `WorkspaceResponse.can_delete` + `delete_blocked_reason` (0.26.0) because
 * of it: the verdict comes from the SAME `deletion_block_reason()` the DELETE
 * raises from, so a screen built on it cannot promise what the endpoint
 * denies. `delete_blocked_reason` is an error CODE (`error.409.workspace_is_
 * personal`), which is already a key in this pair's generated bundle, so the
 * refusal renders in the reader's language beside the switched-off control.
 * The same rule applies to the name field, which is gated on the capability
 * `workspace.update` rather than on a role name — a deployment role can hold
 * the capability without being called owner.
 *
 * **A policy says what HOLDS, not what was asked for.** `settings.security.
 * require_mfa` is a flag somebody set; `mfa_enforcement` is how far the
 * sweep actually got (WORK-01, 0.25.0). An administrator who switched MFA on
 * and was told "saved" while half the organization was never checked is the
 * defect the status block answers, and `unverified_members` is the number
 * they have to get to zero.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Card, Checkbox, Flex, Input, Switch, Typography } from "antd";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  loadStateFromQuery,
  useT,
  useTPlural,
} from "@stapel/core";
import type { ActionAvailability, TranslateFn } from "@stapel/core";
import {
  ErrorAlert,
  GatedButton,
  GatedControl,
  LoadBoundary,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { hasCapability } from "../model/capabilities.js";
import { useCapabilityGate, useWorkspace } from "../model/queries.js";
import {
  useDeleteWorkspace,
  useUpdateSecuritySettings,
  useUpdateWorkspace,
} from "../model/mutations.js";
import { useWorkspaceFormat } from "../model/format.js";
import type {
  ProvisionedUserPolicy,
  Workspace,
  WorkspaceSecuritySettings,
} from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { ActiveWorkspaceBoundary } from "./ActiveWorkspace.js";
import { Muted, StatusTag, SCREEN_STACK, FIELD_STACK } from "./parts.js";

export interface WorkspaceSettingsProps {
  /**
   * The workspace being configured. OPTIONAL: omitted (the way the nav
   * contract mounts this screen — a route, never an ambient scope), the
   * active workspace comes from the runtime selection, and a screen with none
   * renders the designed "choose a workspace" state rather than a blank.
   */
  workspaceId?: string;
  /** Called after a successful delete — the host navigates away / switches
   * to another workspace. Not called on cancel or failure. */
  onDeleted?(): void;
}

/** The two first-login demands an organization may raise, in the order the
 * backend documents them. Independent checkboxes, never alternatives. */
const POLICIES: readonly {
  readonly value: ProvisionedUserPolicy;
  readonly labelKey: string;
}[] = [
  {
    value: "password_change",
    labelKey: WORKSPACES_I18N_KEYS.securityPolicyPasswordChange,
  },
  { value: "mfa_enroll", labelKey: WORKSPACES_I18N_KEYS.securityPolicyMfaEnroll },
];

/** `settings.security`, typed. The block lives inside the free-form settings
 * JSON, so the generated types say `object` and this is the read side of the
 * documented correction in `api/types.ts`. */
function securityOf(workspace: Workspace): WorkspaceSecuritySettings {
  const settings = (workspace.settings ?? {}) as Record<string, unknown>;
  return (settings["security"] ?? {}) as WorkspaceSecuritySettings;
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * May this caller exercise `capability` in this workspace?
 *
 * `my_capabilities` is the mandate the server granted, and it is what the
 * server re-checks — so it is what the screen reads. It is also ADDITIVE
 * (stapel-workspaces ≥0.6.0): a deployment on an older backend sends the
 * field not at all, and treating that silence as "no" would switch the whole
 * settings screen off for its owner. So the absence — and only the absence —
 * falls back to the pre-0.6 rule this pair used to apply everywhere. Where
 * the field IS present, `my_role` is never consulted: a deployment role can
 * hold `workspace.update` without being called owner, and the endpoint would
 * accept it.
 */
function mayUse(workspace: Workspace, capability: string): boolean {
  const granted = workspace.my_capabilities;
  if (granted === undefined) return workspace.my_role === "owner";
  return hasCapability(granted, capability);
}

export function WorkspaceSettings(props: WorkspaceSettingsProps): ReactElement {
  return (
    <SkinTheme surface="base" data-testid="workspace-settings">
      <ActiveWorkspaceBoundary
        workspaceId={props.workspaceId}
        testId="workspace-settings-workspace"
      >
        {(workspaceId) => (
          <SettingsBody
            workspaceId={workspaceId}
            {...(props.onDeleted !== undefined ? { onDeleted: props.onDeleted } : {})}
          />
        )}
      </ActiveWorkspaceBoundary>
    </SkinTheme>
  );
}

function SettingsBody(props: {
  readonly workspaceId: string;
  readonly onDeleted?: (() => void) | undefined;
}): ReactElement {
  const query = useWorkspace(props.workspaceId);
  return (
    <LoadBoundary
      state={loadStateFromQuery(query)}
      testId="workspace-settings-load"
      onRetry={() => {
        void query.refetch();
      }}
    >
      {(workspace) => (
        <div style={SCREEN_STACK}>
          <GeneralCard workspace={workspace} workspaceId={props.workspaceId} />
          <SecurityCard workspace={workspace} workspaceId={props.workspaceId} />
          <DangerZone
            workspace={workspace}
            workspaceId={props.workspaceId}
            {...(props.onDeleted !== undefined ? { onDeleted: props.onDeleted } : {})}
          />
        </div>
      )}
    </LoadBoundary>
  );
}

/** Name, slug, type — the parts of a workspace a person renames. */
function GeneralCard(props: {
  readonly workspace: Workspace;
  readonly workspaceId: string;
}): ReactElement {
  const t = useT();
  const updateMutation = useUpdateWorkspace(props.workspaceId);
  const [name, setName] = useState(props.workspace.name);

  useEffect(() => {
    setName(props.workspace.name);
  }, [props.workspace.name]);

  // Ordered the way it would be explained out loud: what you may do first,
  // then what you have not done yet.
  const canManage: ActionAvailability = mayUse(props.workspace, "workspace.update")
    ? actionAvailable()
    : actionBlocked(WORKSPACES_I18N_KEYS.blockedCannotManage);
  const saveGate = firstBlock(
    canManage,
    name.trim() === ""
      ? actionBlocked(WORKSPACES_I18N_KEYS.blockedNameRequired)
      : actionAvailable(),
    name.trim() === props.workspace.name
      ? actionBlocked(WORKSPACES_I18N_KEYS.blockedUnchanged)
      : actionAvailable()
  );

  const typeKey =
    props.workspace.type === "personal"
      ? WORKSPACES_I18N_KEYS.typePersonal
      : WORKSPACES_I18N_KEYS.typeWork;

  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(WORKSPACES_I18N_KEYS.settingsTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t(WORKSPACES_I18N_KEYS.settingsSubtitle)}
      </Typography.Text>

      <div style={{ ...FIELD_STACK, marginTop: spacing["4"] }}>
        <GatedControl gate={canManage} testId="workspace-name-field">
          {(bind) => (
            <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
              <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldName)}</Typography.Text>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label={t(WORKSPACES_I18N_KEYS.fieldName)}
                {...bind}
              />
            </Flex>
          )}
        </GatedControl>
        <Flex vertical gap={spacing["1"]}>
          <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldSlug)}</Typography.Text>
          <Typography.Text code>{props.workspace.slug}</Typography.Text>
        </Flex>
        <Flex vertical gap={spacing["1"]} align="flex-start">
          <Typography.Text>{t(WORKSPACES_I18N_KEYS.fieldType)}</Typography.Text>
          <StatusTag tone="neutral" testId="workspace-type">
            {t(typeKey)}
          </StatusTag>
        </Flex>
      </div>

      <ErrorAlert
        thrown={updateMutation.error}
        style={{ marginTop: spacing["3"] }}
        testId="workspace-settings-write-error"
      />

      <div style={{ marginTop: spacing["4"] }}>
        <GatedButton
          gate={saveGate}
          type="primary"
          loading={updateMutation.isPending}
          onClick={() => {
            updateMutation.mutate({ name: name.trim() });
          }}
          testId="workspace-save"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {updateMutation.isPending
            ? t(WORKSPACES_I18N_KEYS.saving)
            : t(WORKSPACES_I18N_KEYS.save)}
        </GatedButton>
      </div>
    </Card>
  );
}

/** The `require_mfa` policy: what was asked for, and what actually holds. */
function SecurityCard(props: {
  readonly workspace: Workspace;
  readonly workspaceId: string;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const format = useWorkspaceFormat();
  const mutation = useUpdateSecuritySettings(props.workspaceId);
  const gate = useCapabilityGate(props.workspaceId, "workspace.security.manage");
  const stored = useMemo(() => securityOf(props.workspace), [props.workspace]);
  const storedPolicies = useMemo<readonly ProvisionedUserPolicy[]>(
    () => stored.provisioned_user_policies ?? [],
    [stored]
  );

  /** What is SAVED, not what the person has just toggled: the enforcement
   * block describes the policy the server is acting on. */
  const storedRequireMfa = stored.require_mfa === true;
  const [requireMfa, setRequireMfa] = useState(stored.require_mfa === true);
  const [policies, setPolicies] = useState<readonly ProvisionedUserPolicy[]>(storedPolicies);

  useEffect(() => {
    setRequireMfa(stored.require_mfa === true);
    setPolicies(storedPolicies);
  }, [stored, storedPolicies]);

  const allowed = mayUse(props.workspace, "workspace.security.manage");
  const canManage: ActionAvailability = allowed
    ? actionAvailable()
    : actionBlocked(WORKSPACES_I18N_KEYS.securityBlockedCapability);
  const unchanged =
    requireMfa === (stored.require_mfa === true) &&
    sameStringSet(policies, storedPolicies);
  const saveGate = firstBlock(
    canManage,
    unchanged ? actionBlocked(WORKSPACES_I18N_KEYS.blockedUnchanged) : actionAvailable()
  );

  const enforcement = props.workspace.mfa_enforcement ?? null;

  return (
    <Card data-testid="workspace-security">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t(WORKSPACES_I18N_KEYS.securityTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t(WORKSPACES_I18N_KEYS.securitySubtitle)}
      </Typography.Text>

      <div style={{ ...FIELD_STACK, marginTop: spacing["4"] }}>
        <GatedControl gate={canManage} testId="workspace-require-mfa-field">
          {(bind) => (
            <Flex gap={spacing["3"]} align="flex-start">
              <Switch
                checked={requireMfa}
                onChange={setRequireMfa}
                aria-label={t(WORKSPACES_I18N_KEYS.securityRequireMfa)}
                data-testid="workspace-require-mfa"
                {...bind}
              />
              <Flex vertical gap={spacing["0"]}>
                <Typography.Text>
                  {t(WORKSPACES_I18N_KEYS.securityRequireMfa)}
                </Typography.Text>
                <Muted>{t(WORKSPACES_I18N_KEYS.securityRequireMfaHint)}</Muted>
              </Flex>
            </Flex>
          )}
        </GatedControl>

        <GatedControl gate={canManage} testId="workspace-policies-field">
          {(bind) => (
            <Flex vertical gap={spacing["2"]} align="flex-start">
              <Typography.Text>
                {t(WORKSPACES_I18N_KEYS.securityPoliciesLabel)}
              </Typography.Text>
              <Muted>{t(WORKSPACES_I18N_KEYS.securityPoliciesHint)}</Muted>
              {POLICIES.map((policy) => (
                <Checkbox
                  key={policy.value}
                  checked={policies.includes(policy.value)}
                  onChange={(event) => {
                    setPolicies((current) =>
                      event.target.checked
                        ? [...current, policy.value]
                        : current.filter((value) => value !== policy.value)
                    );
                  }}
                  data-testid={`workspace-policy-${policy.value}`}
                  {...bind}
                >
                  {t(policy.labelKey)}
                </Checkbox>
              ))}
            </Flex>
          )}
        </GatedControl>
      </div>

      {/* Said BEFORE the click, not discovered by a 403 after it: this
          capability is declared `high`, so the backend demands a fresh
          verification on top of the mandate. */}
      {allowed && gate.requiresStepUp && (
        <div style={{ marginTop: spacing["3"] }}>
          <Muted testId="workspace-security-stepup">
            {t(WORKSPACES_I18N_KEYS.securityStepUpNotice)}
          </Muted>
        </div>
      )}

      <ErrorAlert
        thrown={mutation.error}
        style={{ marginTop: spacing["3"] }}
        testId="workspace-security-error"
      />

      <div style={{ marginTop: spacing["4"] }}>
        <GatedButton
          gate={saveGate}
          type="primary"
          loading={mutation.isPending}
          onClick={() => {
            mutation.mutate({
              require_mfa: requireMfa,
              provisioned_user_policies: policies,
            });
          }}
          testId="workspace-security-save"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {mutation.isPending
            ? t(WORKSPACES_I18N_KEYS.securitySaving)
            : t(WORKSPACES_I18N_KEYS.securitySave)}
        </GatedButton>
      </div>

      <div style={{ marginTop: spacing["5"] }}>
        <Typography.Text strong>
          {t(WORKSPACES_I18N_KEYS.mfaStatusTitle)}
        </Typography.Text>
        {enforcement === null ? (
          <div style={{ marginTop: spacing["2"] }}>
            {/* The note and the switch read the SAME value. Deriving "not
                required in this workspace" from the absence of an enforcement
                status instead put that sentence under a switch that was ON —
                a screen contradicting itself two lines apart. The absence
                means the sweep has not reported, which is a different fact
                and is what it now says. */}
            <Muted testId="workspace-mfa-off">
              {t(
                storedRequireMfa
                  ? WORKSPACES_I18N_KEYS.mfaNoStatusYet
                  : WORKSPACES_I18N_KEYS.mfaOffNotice
              )}
            </Muted>
          </div>
        ) : (
          <Flex
            vertical
            gap={spacing["2"]}
            align="flex-start"
            style={{ marginTop: spacing["2"] }}
            data-testid="workspace-mfa-status"
          >
            <Flex gap={spacing["2"]} align="center" wrap>
              <Muted>{t(WORKSPACES_I18N_KEYS.mfaStateLabel)}</Muted>
              <StatusTag
                tone={
                  enforcement.state === "enforced"
                    ? "success"
                    : enforcement.state === "failed"
                      ? "danger"
                      : "warning"
                }
                testId="workspace-mfa-state"
              >
                {mfaStateLabel(t, enforcement.state)}
              </StatusTag>
            </Flex>
            <Muted>
              {tPlural(WORKSPACES_I18N_KEYS.mfaCheckedCount, {
                count: enforcement.checked_members ?? 0,
              })}
            </Muted>
            <Muted>
              {tPlural(WORKSPACES_I18N_KEYS.mfaNoncompliantCount, {
                count: enforcement.noncompliant_members ?? 0,
              })}
            </Muted>
            <Typography.Text
              type={(enforcement.unverified_members ?? 0) > 0 ? "warning" : "secondary"}
              data-testid="workspace-mfa-unverified"
            >
              {tPlural(WORKSPACES_I18N_KEYS.mfaUnverifiedCount, {
                count: enforcement.unverified_members ?? 0,
              })}
            </Typography.Text>
            {(enforcement.unverified_members ?? 0) > 0 && (
              <Muted>{t(WORKSPACES_I18N_KEYS.mfaUnverifiedHint)}</Muted>
            )}
            <Muted>
              {tPlural(WORKSPACES_I18N_KEYS.mfaAttemptsCount, {
                count: enforcement.attempts ?? 0,
              })}
            </Muted>
            {format.timestamp(enforcement.last_attempt_at) !== null && (
              <Muted>
                {t(WORKSPACES_I18N_KEYS.mfaLastAttempt, {
                  date: format.timestamp(enforcement.last_attempt_at),
                })}
              </Muted>
            )}
            {format.timestamp(enforcement.completed_at) !== null && (
              <Muted>
                {t(WORKSPACES_I18N_KEYS.mfaCompletedAt, {
                  date: format.timestamp(enforcement.completed_at),
                })}
              </Muted>
            )}
            {enforcement.last_error !== undefined && enforcement.last_error !== "" && (
              <Muted testId="workspace-mfa-error">
                {t(WORKSPACES_I18N_KEYS.mfaLastError, { error: enforcement.last_error })}
              </Muted>
            )}
          </Flex>
        )}
      </div>
    </Card>
  );
}

/** The four states the backend names, plus an honest line for a fifth this
 * build has never heard of. */
function mfaStateLabel(t: TranslateFn, state: string): string {
  switch (state) {
    case "pending":
      return t(WORKSPACES_I18N_KEYS.mfaStatePending);
    case "enforcing":
      return t(WORKSPACES_I18N_KEYS.mfaStateEnforcing);
    case "enforced":
      return t(WORKSPACES_I18N_KEYS.mfaStateEnforced);
    case "failed":
      return t(WORKSPACES_I18N_KEYS.mfaStateFailed);
    default:
      return t(WORKSPACES_I18N_KEYS.mfaStateOther, { state });
  }
}

/** Deletion — the one act on this screen nobody can take back. */
function DangerZone(props: {
  readonly workspace: Workspace;
  readonly workspaceId: string;
  readonly onDeleted?: () => void;
}): ReactElement {
  const t = useT();
  const mutation = useDeleteWorkspace();
  const [confirming, setConfirming] = useState(false);

  // THE SERVER'S ANSWER, not a rule re-derived from `my_role`. `can_delete`
  // is additive on the wire, so a backend that predates it sends neither
  // field; treating "absent" as "allowed" keeps such a deployment working
  // exactly as it did, and the refusal it might answer is a translated 409
  // rather than a promise this screen made.
  const canDelete = props.workspace.can_delete ?? true;
  const blockedReason = props.workspace.delete_blocked_reason;
  const deleteGate: ActionAvailability = canDelete
    ? actionAvailable()
    : actionBlocked(
        blockedReason !== undefined && blockedReason !== ""
          ? blockedReason
          : WORKSPACES_I18N_KEYS.deleteBlockedFallback
      );

  return (
    <Card data-testid="workspace-danger-zone">
      <Typography.Title level={5} type="danger" style={{ marginTop: 0 }}>
        {t(WORKSPACES_I18N_KEYS.dangerZoneTitle)}
      </Typography.Title>
      <ErrorAlert
        thrown={mutation.error}
        style={{ marginBottom: spacing["3"] }}
        testId="workspace-delete-error"
      />
      <GatedButton
        gate={deleteGate}
        danger
        onClick={() => setConfirming(true)}
        testId="workspace-delete"
        data-analytics="none"
        data-analytics-reason="opens the confirm; the delete itself is the tracked point"
      >
        {t(WORKSPACES_I18N_KEYS.deleteWorkspace)}
      </GatedButton>
      <SkinConfirm
        open={confirming}
        danger
        title={t(WORKSPACES_I18N_KEYS.deleteWorkspaceConfirm)}
        body={t(WORKSPACES_I18N_KEYS.deleteWorkspaceConfirmBody)}
        confirmLabel={t(WORKSPACES_I18N_KEYS.deleteWorkspace)}
        cancelLabel={t(WORKSPACES_I18N_KEYS.cancel)}
        confirming={mutation.isPending}
        onConfirm={() => {
          mutation.mutate(props.workspaceId, {
            onSuccess: () => props.onDeleted?.(),
            onSettled: () => setConfirming(false),
          });
        }}
        onCancel={() => setConfirming(false)}
        data-testid="workspace-delete-confirm"
      />
    </Card>
  );
}
