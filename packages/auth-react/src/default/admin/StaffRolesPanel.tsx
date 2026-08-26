/**
 * `<StaffRolesPanel/>` — who has elevated access, and who gave it to them.
 *
 * The contract identifies accounts by UUID and nothing else: `GET
 * /staff-roles/` returns `user`, `role_name` and `assigned_by` as bare ids,
 * and this pair has no user directory to resolve them against. So the rows
 * print the id, labelled as an account id, rather than a fabricated display
 * name — and the filter is by id for the same reason. A host that HAS a
 * directory (profiles-react) composes the two; inventing a name here would
 * put the wrong person's name beside a permission grant.
 *
 * `assigned_by: null` means the assignment came from the system (a fixture, a
 * management command, a bootstrap), which is a different fact from "we don't
 * know", and it is said as such.
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
import type { StaffRoleAssignment } from "../../api/types.js";
import { useStaffRoles } from "../../model/queries.js";
import { useAssignStaffRole, useRemoveStaffRole } from "../../model/mutations.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityList, SecurityListRow } from "../security/SecurityListRow.js";
import { AdminScreen } from "./AdminScreen.js";
import { ForbiddenState, forbiddenGate, isForbidden } from "./forbidden.js";

interface AssignFormValues {
  readonly user_id?: string;
  readonly role?: string;
}

/** One assignment: the role, the account it is on, and its provenance. */
function RoleRow(props: {
  assignment: StaffRoleAssignment;
  onRemove: () => void;
}): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const a = props.assignment;
  return (
    <SecurityListRow
      data-testid="staff-role-row"
      title={a.role_name}
      badges={<Tag>{t(AUTH_I18N_KEYS.adminRolesUserRow, { id: a.user })}</Tag>}
      meta={
        <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
          {`${
            a.assigned_by === null
              ? t(AUTH_I18N_KEYS.adminRolesAssignedBySystem)
              : t(AUTH_I18N_KEYS.adminRolesAssignedBy, { who: a.assigned_by })
          } ${t(AUTH_I18N_KEYS.adminRolesAssignedOn, { date: when.date(a.created_at) })}`}
        </Typography.Text>
      }
      actions={
        <Button
          type="text"
          danger
          onClick={props.onRemove}
          aria-label={t(AUTH_I18N_KEYS.adminRolesRemoveLabel, {
            role: a.role_name,
            id: a.user,
          })}
          data-analytics="none"
          data-analytics-reason="local-ui-open-staff-role-remove-confirm"
        >
          {t(AUTH_I18N_KEYS.adminRolesRemove)}
        </Button>
      }
    />
  );
}

/** The staff-role list: filter by account, assign, remove. */
export function StaffRolesPanel(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  // The COMMITTED filter — typing does not refetch on every keystroke, so a
  // half-typed UUID never becomes a request.
  const [filter, setFilter] = useState("");
  const [draftFilter, setDraftFilter] = useState("");
  const roles = useStaffRoles(filter === "" ? undefined : filter);
  const assign = useAssignStaffRole();
  const remove = useRemoveStaffRole();
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<StaffRoleAssignment | null>(null);

  const state = loadStateFromQuery(roles);

  // See `forbidden.tsx`: the read's verdict gates the write.
  const gate = forbiddenGate(roles.error);
  const assignButton = (
    <GatedButton
      gate={gate}
      type="primary"
      testId="staff-roles-assign"
      onClick={() => setAssigning(true)}
      data-analytics="none"
      data-analytics-reason="local-ui-open-staff-role-assign"
    >
      {t(AUTH_I18N_KEYS.adminRolesAssign)}
    </GatedButton>
  );

  return (
    <AdminScreen
      testId="admin-staff-roles"
      title={t(AUTH_I18N_KEYS.adminRolesTitle)}
      subtitle={t(AUTH_I18N_KEYS.adminRolesSubtitle)}
      action={assignButton}
    >
      <Card style={{ width: "100%" }}>
        <Flex vertical gap="middle" style={{ width: "100%" }}>
          <Flex gap="small" wrap align="center">
            <Input
              value={draftFilter}
              onChange={(e) => setDraftFilter(e.target.value)}
              onPressEnter={() => setFilter(draftFilter.trim())}
              placeholder={t(AUTH_I18N_KEYS.adminRolesUserLabel)}
              aria-label={t(AUTH_I18N_KEYS.adminRolesFilterLabel)}
              data-testid="staff-role-filter"
              style={{ maxWidth: "24rem" }}
            />
            <Button
              onClick={() => setFilter(draftFilter.trim())}
              data-analytics="none"
              data-analytics-reason="local-ui-apply-staff-role-filter"
            >
              {t(AUTH_I18N_KEYS.adminRolesFilterLabel)}
            </Button>
            {filter !== "" && (
              <Button
                type="link"
                onClick={() => {
                  setDraftFilter("");
                  setFilter("");
                }}
                data-analytics="none"
                data-analytics-reason="local-ui-clear-staff-role-filter"
              >
                {t(AUTH_I18N_KEYS.adminRolesFilterClear)}
              </Button>
            )}
          </Flex>

          <LoadList
            failed={(error) =>
              isForbidden(error) ? (
                <ForbiddenState testId="staff-roles-forbidden" />
              ) : (
                <ErrorAlert thrown={error} onRetry={() => void roles.refetch()} />
              )
            }
            state={state}
            testId="staff-roles"
            onRetry={() => void roles.refetch()}
            empty={
              <EmptyState
                title={t(AUTH_I18N_KEYS.adminRolesEmpty)}
                hint={t(AUTH_I18N_KEYS.adminRolesEmptyHint)}
                action={assignButton}
              />
            }
          >
            {(list) => (
              <SecurityList ruleColor={token.colorBorderSecondary}>
                {list.map((a) => (
                  <RoleRow key={a.id} assignment={a} onRemove={() => setRemoving(a)} />
                ))}
              </SecurityList>
            )}
          </LoadList>

          <ErrorAlert thrown={assign.error} />
          <ErrorAlert thrown={remove.error} />
        </Flex>
      </Card>

      <SkinDialog
        open={assigning}
        onClose={() => setAssigning(false)}
        title={t(AUTH_I18N_KEYS.adminRolesAssign)}
        dismissLabel={t(AUTH_I18N_KEYS.adminRolesCancel)}
        data-testid="staff-role-dialog"
      >
        <Form
          layout="vertical"
          onFinish={(values: AssignFormValues) =>
            assign.mutate(
              { user_id: values.user_id ?? "", role: values.role ?? "" },
              { onSettled: () => setAssigning(false) }
            )
          }
        >
          <Form.Item
            name="user_id"
            label={t(AUTH_I18N_KEYS.adminRolesUserLabel)}
            extra={t(AUTH_I18N_KEYS.adminRolesUserHint)}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="role"
            label={t(AUTH_I18N_KEYS.adminRolesRoleLabel)}
            extra={t(AUTH_I18N_KEYS.adminRolesRoleHint)}
          >
            <Input />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={assign.isPending}
            data-analytics="flow"
          >
            {t(AUTH_I18N_KEYS.adminRolesAssign)}
          </Button>
        </Form>
      </SkinDialog>

      <SkinConfirm
        open={removing !== null}
        danger
        title={t(AUTH_I18N_KEYS.adminRolesRemoveConfirmTitle, {
          role: removing?.role_name ?? "",
        })}
        body={t(AUTH_I18N_KEYS.adminRolesRemoveConfirmBody)}
        confirmLabel={t(AUTH_I18N_KEYS.adminRolesRemove)}
        confirming={remove.isPending}
        data-testid="staff-role-remove-confirm"
        onConfirm={() => {
          const target = removing;
          if (target === null) return;
          remove.mutate(target.id, { onSettled: () => setRemoving(null) });
        }}
        onCancel={() => setRemoving(null)}
      />
    </AdminScreen>
  );
}
