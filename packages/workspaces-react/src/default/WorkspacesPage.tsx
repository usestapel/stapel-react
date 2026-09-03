/**
 * `<WorkspacesPage/>` — the default skin for {@link WorkspaceList}: the
 * roster of workspaces a person belongs to, the door into each one, the
 * "open this one by default" choice, and the create control.
 *
 * §54 said every headless primitive gets an AntD default; this was the one
 * missing, and it is the one every app needs on day one — the audit found
 * `useCanCreateWorkspace` existing only to feed a create button nobody had
 * drawn.
 *
 * Three answers come from the SERVER and are never re-derived here:
 *
 *  - `can_create_workspace` — the instance's `WORKSPACE_CREATE_POLICY`, over
 *    the same helper the POST gate uses, so a drawn button always opens.
 *  - `preferred_workspace_id` — the person's explicit home, which the
 *    instance default documents itself as yielding to. Never `workspaces[0]`
 *    (that guess was tracker #239) and never `last_accessed_at`, which is
 *    telemetry.
 *  - `is_guest` — someone here on a link rather than a membership. An empty
 *    list means something different to them, and the screen says which.
 */
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Input, Typography, theme as antdTheme } from "antd";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  requireLoaded,
  useT,
  useTPlural,
} from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinDialog,
  SkinTheme,
  useBlockedButtonClassName,
} from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { WorkspaceList } from "../headless/WorkspaceList.js";
import type { WorkspaceListBag } from "../headless/WorkspaceList.js";
import { useWorkspaces } from "../model/queries.js";
import {
  useClearPreferredWorkspace,
  useSetPreferredWorkspace,
} from "../model/mutations.js";
import type { Workspace } from "../api/types.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";
import { LoadFailure, Muted, StatusTag, SCREEN_STACK } from "./parts.js";
import { RoleLabel } from "./RoleSelectField.js";

export interface WorkspacesPageProps {
  /**
   * Open a workspace. The pair owns no router (there are several, and a
   * library that picks one picks it for every host), so the door is the
   * host's: omit it and no "Open" control is drawn, because a button that
   * goes nowhere is worse than no button.
   */
  onOpen?(workspace: Workspace): void;
}

export function WorkspacesPage(props: WorkspacesPageProps): ReactElement {
  return (
    <SkinTheme surface="base" data-testid="workspaces-page">
      <WorkspaceList>
        {(bag) => (
          <PageBody
            bag={bag}
            {...(props.onOpen !== undefined ? { onOpen: props.onOpen } : {})}
          />
        )}
      </WorkspaceList>
    </SkinTheme>
  );
}

function PageBody(props: {
  readonly bag: WorkspaceListBag;
  readonly onOpen?: (workspace: Workspace) => void;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { bag } = props;
  const listQuery = useWorkspaces();
  const [creating, setCreating] = useState(false);
  const list = listQuery.data ?? null;
  const failureId = useId();

  // The create verdict is a property of the LIST response, so it is blocked
  // while the list is loading — with core's own sentence — and by the policy
  // when the list arrived and says no.
  //
  // A FAILED read is deliberately not routed through the gate. `requireLoaded`
  // would hand the button its own copy of the outage ("We could not load what
  // this needs…" plus `HTTP 503`) directly above the alert that states the
  // same outage with the retry — the same bad news twice, in two wordings,
  // with two different recoveries. The read has exactly one failure surface on
  // this screen, and the button points at it.
  const listState = loadStateFromQuery(listQuery);
  const listFailed = listState.status === "failed";
  const blockedLook = useBlockedButtonClassName();
  const createGate = requireLoaded(listState, (loaded) =>
    loaded.can_create_workspace === true
      ? actionAvailable()
      : actionBlocked(WORKSPACES_I18N_KEYS.listCreateBlockedPolicy)
  );

  const rows = bag.state.status === "ready" ? bag.state.data : [];

  return (
    <div style={SCREEN_STACK}>
      <Card>
        <Flex justify="space-between" align="flex-start" gap={spacing["4"]} wrap>
          <Flex vertical gap={spacing["1"]}>
            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
              {t(WORKSPACES_I18N_KEYS.pageTitle)}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t(WORKSPACES_I18N_KEYS.pageSubtitle)}
            </Typography.Text>
            {bag.state.status === "ready" && (
              <Muted testId="workspaces-count">
                {tPlural(WORKSPACES_I18N_KEYS.listCount, { count: rows.length })}
              </Muted>
            )}
          </Flex>
          {/* The one primary on the screen. */}
          {listFailed ? (
            <Button
              type="primary"
              // `aria-disabled` + antd's own unavailable paint, never html
              // `disabled`: the button has to stay focusable for the
              // `aria-describedby` below to be announced at all, and it
              // carries no `onClick`, so there is nothing to suppress.
              aria-disabled
              className={blockedLook}
              aria-describedby={failureId}
              data-disabled-reason="the roster read failed; the alert below says so once and carries the retry"
              data-analytics="none"
              data-analytics-reason="local-ui-open-create-dialog"
              data-testid="workspaces-create-open"
            >
              {t(WORKSPACES_I18N_KEYS.listCreate)}
            </Button>
          ) : (
            <GatedButton
              gate={createGate}
              type="primary"
              onClick={() => setCreating(true)}
              testId="workspaces-create-open"
              data-analytics="none"
              data-analytics-reason="local-ui-open-create-dialog"
            >
              {t(WORKSPACES_I18N_KEYS.listCreate)}
            </GatedButton>
          )}
        </Flex>

        {list?.is_guest === true && (
          <div style={{ marginTop: spacing["3"] }}>
            <Muted testId="workspaces-guest">
              {t(WORKSPACES_I18N_KEYS.listGuestNotice)}
            </Muted>
          </div>
        )}

        <ErrorAlert
          thrown={bag.createError}
          style={{ marginTop: spacing["3"] }}
          testId="workspaces-create-error"
        />

        <div style={{ marginTop: spacing["4"] }}>
          <LoadList
            state={bag.state}
            testId="workspaces-list"
            onRetry={bag.refetch}
            failed={(error) => (
              <div id={failureId}>
                <LoadFailure
                  error={error}
                  onRetry={bag.refetch}
                  testId="workspaces-list-failed"
                />
              </div>
            )}
            empty={
              <EmptyState
                title={t(WORKSPACES_I18N_KEYS.listEmpty)}
                testId="workspaces-list-empty"
                // The RESTRICTION is stated once, beside the switched-off
                // control above; this line is the other half — what the person
                // can actually do about it. Saying "this installation does not
                // hand out workspaces" here as well was the same fact twice in
                // two wordings on one 390px screen.
                hint={
                  createGate.available === true
                    ? t(WORKSPACES_I18N_KEYS.listEmptyHint)
                    : t(WORKSPACES_I18N_KEYS.listInstanceClosed)
                }
                {...(createGate.available === true
                  ? {
                      action: (
                        <Button
                          type="primary"
                          onClick={() => setCreating(true)}
                          data-analytics="none"
                          data-analytics-reason="local-ui-open-create-dialog"
                        >
                          {t(WORKSPACES_I18N_KEYS.listCreate)}
                        </Button>
                      ),
                    }
                  : {})}
              />
            }
          >
            {(workspaces) => (
              <div role="list" data-testid="workspaces-rows">
                {workspaces.map((workspace) => (
                  <WorkspaceRow
                    key={workspace.id}
                    workspace={workspace}
                    isPreferred={list?.preferred_workspace_id === workspace.id}
                    {...(props.onOpen !== undefined ? { onOpen: props.onOpen } : {})}
                  />
                ))}
              </div>
            )}
          </LoadList>
        </div>
      </Card>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        isCreating={bag.isCreating}
        onCreate={(name) => {
          bag.create({ name });
          setCreating(false);
        }}
      />
    </div>
  );
}

function WorkspaceRow(props: {
  readonly workspace: Workspace;
  readonly isPreferred: boolean;
  readonly onOpen?: (workspace: Workspace) => void;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { token } = antdTheme.useToken();
  const setPreferred = useSetPreferredWorkspace();
  const clearPreferred = useClearPreferredWorkspace();
  const { workspace } = props;
  const owner = workspace.owner_display_name?.trim();

  return (
    <div
      role="listitem"
      data-testid={`workspace-row-${workspace.id}`}
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
      <Flex vertical gap={spacing["1"]} style={{ minWidth: 0 }}>
        <Flex gap={spacing["2"]} align="center" wrap>
          <Typography.Text strong>{workspace.name}</Typography.Text>
          {props.isPreferred && (
            <StatusTag tone="info" testId={`workspace-preferred-${workspace.id}`}>
              {t(WORKSPACES_I18N_KEYS.listPreferredTag)}
            </StatusTag>
          )}
        </Flex>
        {/* A workspace NAME stopped identifying one — a person can belong to
            several spaces all called "Personal", one per company. The owner is
            the second line for exactly that reason. */}
        {owner !== undefined && owner !== "" && (
          <Muted>{t(WORKSPACES_I18N_KEYS.listOwnerLine, { owner })}</Muted>
        )}
        <Muted>
          {tPlural(WORKSPACES_I18N_KEYS.listMemberCount, { count: workspace.member_count })}
          {workspace.my_role !== null && (
            <>
              {" · "}
              {t(WORKSPACES_I18N_KEYS.listYourRole)}:{" "}
              <RoleLabel role={workspace.my_role} />
            </>
          )}
        </Muted>
      </Flex>
      <Flex gap={spacing["2"]} align="center" wrap>
        {props.isPreferred ? (
          <Button
            type="link"
            size="small"
            loading={clearPreferred.isPending}
            onClick={() => clearPreferred.mutate()}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            data-testid={`workspace-clear-home-${workspace.id}`}
          >
            {t(WORKSPACES_I18N_KEYS.listClearPreferred)}
          </Button>
        ) : (
          <Button
            type="link"
            size="small"
            loading={setPreferred.isPending}
            onClick={() => setPreferred.mutate({ workspace_id: workspace.id })}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            data-testid={`workspace-set-home-${workspace.id}`}
          >
            {t(WORKSPACES_I18N_KEYS.listSetPreferred)}
          </Button>
        )}
        {props.onOpen !== undefined && (
          <Button
            onClick={() => props.onOpen?.(workspace)}
            data-analytics="none"
            data-analytics-reason="navigation — the host owns the router"
            data-testid={`workspace-open-${workspace.id}`}
          >
            {t(WORKSPACES_I18N_KEYS.listOpen)}
          </Button>
        )}
      </Flex>
    </div>
  );
}

function CreateDialog(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly isCreating: boolean;
  readonly onCreate: (name: string) => void;
}): ReactElement {
  const t = useT();
  const [name, setName] = useState("");
  const gate =
    name.trim() === ""
      ? actionBlocked(WORKSPACES_I18N_KEYS.listCreateBlockedNoName)
      : actionAvailable();

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(WORKSPACES_I18N_KEYS.listCreateDialogTitle)}
      dismissLabel={t(WORKSPACES_I18N_KEYS.dialogClose)}
      data-testid="workspaces-create-dialog"
      footer={
        <GatedButton
          gate={gate}
          type="primary"
          loading={props.isCreating}
          onClick={() => {
            props.onCreate(name.trim());
            setName("");
          }}
          testId="workspaces-create-submit"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(WORKSPACES_I18N_KEYS.listCreateSubmit)}
        </GatedButton>
      }
    >
      <Flex vertical gap={spacing["2"]}>
        <Typography.Text>{t(WORKSPACES_I18N_KEYS.listCreateNameLabel)}</Typography.Text>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t(WORKSPACES_I18N_KEYS.listCreateNamePlaceholder)}
          aria-label={t(WORKSPACES_I18N_KEYS.listCreateNameLabel)}
          data-testid="workspaces-create-name"
        />
      </Flex>
    </SkinDialog>
  );
}
