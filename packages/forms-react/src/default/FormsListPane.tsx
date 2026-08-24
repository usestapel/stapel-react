/**
 * `<FormsListPane>` — the admin surface's entry point: the workspace's forms,
 * the button that makes another one, and the two per-form acts that are not
 * the builder's business — configure who gets told, and delete.
 *
 * Rendered through the substrate's `<LoadList>`, whose arms are the point:
 * "no forms in this workspace yet" is reachable only from a load that actually
 * succeeded, so that sentence can never be said about an outage.
 *
 * ── The delete confirmation is a SkinConfirm, and there is exactly one ──────
 *
 * One dialog for the whole list, keyed by the pending row — not one per row
 * (which mounts a dialog per form and photographs identically). It is a bottom
 * sheet on a phone and a centred modal above the tablet breakpoint, because
 * `SkinConfirm` owns that rule once for the fleet. `danger` puts the focus on
 * CANCEL and stops a backdrop tap from confirming: a soft-delete closes an
 * open form, and the public link stops resolving the moment it returns.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, List, Segmented, Space, Tag, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FormRow, FormState } from "../api/types.js";
import { FormList } from "../headless/FormList.js";
import { FormSettingsPane } from "./FormSettingsPane.js";
import { SETTINGS_DIALOG_WIDTH } from "./geometry.js";
import { MissingWorkspaceNotice, useFormsWorkspaceId } from "./workspace.js";
import { skinThemeProps } from "./types.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

export interface FormsListPaneProps extends ThemeModeProp {
  /** Omit to use the runtime's `workspaceId` (the routable case). */
  readonly workspaceId?: string;
  /** Called when a row is activated — the host routes to the builder. */
  readonly onOpen?: (form: FormRow) => void;
}

export function FormsListPane(props: FormsListPaneProps): ReactElement {
  const t = useT();
  const workspaceId = useFormsWorkspaceId(props.workspaceId);
  /** The row whose delete is awaiting confirmation. */
  const [pendingDelete, setPendingDelete] = useState<FormRow | null>(null);
  /** The row whose settings dialog is open. */
  const [settingsFor, setSettingsFor] = useState<FormRow | null>(null);

  if (workspaceId === null) {
    return (
      <SkinTheme {...skinThemeProps(props)}>
        <MissingWorkspaceNotice testId="forms-list-no-workspace" />
      </SkinTheme>
    );
  }

  return (
    <SkinTheme {...skinThemeProps(props)}>
      <FormList
        workspaceId={workspaceId}
        {...(props.onOpen ? { onCreated: props.onOpen } : {})}
        onRemoved={() => setPendingDelete(null)}
      >
        {(bag) => {
          const createButton = (
            <Button
              type="primary"
              loading={bag.isCreating}
              data-analytics="flow"
              data-testid="forms-list-create"
              onClick={() =>
                bag.create({ title: t(FORMS_I18N_KEYS.listNewTitle) })
              }
            >
              {t(FORMS_I18N_KEYS.listCreate)}
            </Button>
          );

          return (
            <Flex vertical gap={spacing[4]}>
              <Flex justify="space-between" align="center" wrap gap={spacing[2]}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t(FORMS_I18N_KEYS.listTitle)}
                </Typography.Title>
                <Flex gap={spacing[2]} align="center" wrap>
                  <Segmented<string>
                    aria-label={t(FORMS_I18N_KEYS.listStateFilter)}
                    value={bag.filter ?? "all"}
                    onChange={(next) =>
                      bag.setFilter(next === "all" ? null : (next as FormState))
                    }
                    options={[
                      {
                        value: "all",
                        label: t(FORMS_I18N_KEYS.responsesAllVersions),
                      },
                      {
                        value: "draft",
                        label: t(FORMS_I18N_KEYS.builderStateDraft),
                      },
                      {
                        value: "open",
                        label: t(FORMS_I18N_KEYS.builderStateOpen),
                      },
                      {
                        value: "closed",
                        label: t(FORMS_I18N_KEYS.builderStateClosed),
                      },
                    ]}
                  />
                  {createButton}
                </Flex>
              </Flex>

              <ErrorAlert
                testId="forms-list-error"
                {...(bag.error !== null ? { thrown: bag.error } : {})}
              />

              <LoadList
                state={bag.state}
                onRetry={bag.refetch}
                testId="forms-list"
                failed={(thrown) => (
                  <ErrorAlert
                    testId="forms-list-failed"
                    message={t(FORMS_I18N_KEYS.listLoadFailed)}
                    thrown={thrown}
                    onRetry={bag.refetch}
                  />
                )}
                empty={
                  <EmptyState
                    testId="forms-list-empty"
                    title={t(FORMS_I18N_KEYS.listEmpty)}
                    hint={t(FORMS_I18N_KEYS.listEmptyHint)}
                    action={createButton}
                  />
                }
              >
                {(rows) => (
                  <List<FormRow>
                    data-testid="forms-list-rows"
                    dataSource={[...rows]}
                    renderItem={(row) => (
                      <List.Item
                        key={row.id}
                        data-testid={`forms-list-row-${row.id}`}
                        actions={[
                          <Button
                            key="settings"
                            size="small"
                            data-analytics="none"
                            data-analytics-reason="opens the settings dialog; the PATCH inside it is the tracked step"
                            data-testid={`forms-list-settings-${row.id}`}
                            onClick={() => setSettingsFor(row)}
                          >
                            {t(FORMS_I18N_KEYS.settingsOpen)}
                          </Button>,
                          <Button
                            key="delete"
                            size="small"
                            danger
                            data-analytics="none"
                            data-analytics-reason="opens the delete confirmation; the DELETE inside it is the tracked step"
                            data-testid={`forms-list-delete-${row.id}`}
                            onClick={() => setPendingDelete(row)}
                          >
                            {t(FORMS_I18N_KEYS.listDelete)}
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space size={spacing[2]}>
                              <Button
                                type="link"
                                // Navigation into the builder, not a tracked
                                // outcome: the host owns its routing
                                // analytics, and this pair emitting a funnel
                                // step for "opened a row" would put a forms.*
                                // event in somebody else's funnel.
                                data-analytics="none"
                                data-analytics-reason="host-owned navigation; no forms flow is stepped"
                                data-testid={`forms-list-open-${row.id}`}
                                style={{ padding: 0 }}
                                onClick={() => props.onOpen?.(row)}
                              >
                                {row.title}
                              </Button>
                              <Tag>{stateLabel(t, row.state as FormState)}</Tag>
                            </Space>
                          }
                          description={t(FORMS_I18N_KEYS.listSubmissionCount, {
                            count: row.submission_count ?? 0,
                          })}
                        />
                      </List.Item>
                    )}
                  />
                )}
              </LoadList>

              {/* ONE confirmation for the whole list, keyed by the pending
                  row — see the module header. */}
              <SkinConfirm
                open={pendingDelete !== null}
                danger
                confirming={bag.isRemoving}
                title={t(FORMS_I18N_KEYS.listDeleteConfirm, {
                  title: pendingDelete?.title ?? "",
                })}
                body={t(
                  pendingDelete?.state === "open"
                    ? FORMS_I18N_KEYS.listDeleteBodyOpen
                    : FORMS_I18N_KEYS.listDeleteBody,
                  { count: pendingDelete?.submission_count ?? 0 }
                )}
                confirmLabel={t(FORMS_I18N_KEYS.listDelete)}
                onConfirm={() => {
                  if (pendingDelete !== null) bag.remove(pendingDelete.id);
                }}
                onCancel={() => setPendingDelete(null)}
                data-testid="forms-list-delete-confirm"
              />

              <SkinDialog
                open={settingsFor !== null}
                onClose={() => setSettingsFor(null)}
                title={t(FORMS_I18N_KEYS.settingsTitle)}
                dismissLabel={t(FORMS_I18N_KEYS.settingsClose)}
                width={SETTINGS_DIALOG_WIDTH}
                data-testid="forms-list-settings-dialog"
              >
                {settingsFor !== null && (
                  <FormSettingsPane
                    workspaceId={workspaceId}
                    formId={settingsFor.id}
                    // The dialog already painted the surface; a second paint
                    // draws a card inside a card.
                    surface="bare"
                  />
                )}
              </SkinDialog>
            </Flex>
          );
        }}
      </FormList>
    </SkinTheme>
  );
}

/** A form's lifecycle state as a word, never the raw enum member. */
function stateLabel(t: (key: string) => string, state: FormState): string {
  const labels: Readonly<Record<FormState, string>> = {
    draft: t(FORMS_I18N_KEYS.builderStateDraft),
    open: t(FORMS_I18N_KEYS.builderStateOpen),
    closed: t(FORMS_I18N_KEYS.builderStateClosed),
  };
  return labels[state] ?? state;
}
