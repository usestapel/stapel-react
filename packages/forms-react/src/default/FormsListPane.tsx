/**
 * `<FormsListPane>` — the admin surface's entry point: the workspace's forms,
 * and the button that makes another one.
 *
 * Rendered through core's `matchList`, whose FOUR required arms are the point:
 * "no forms in this workspace yet" is reachable only from a load that
 * actually succeeded, so that sentence can never be said about an outage.
 */
import type { ReactElement } from "react";
import { Button, Empty, Flex, List, Segmented, Spin, Tag, Typography } from "antd";
import {
  matchList,
  toFlowError,
  useDescribeFlowError,
  useT,
} from "@stapel/core";
import type { FormRow, FormState } from "../api/types.js";
import { FormList } from "../headless/FormList.js";
import { FormsSkinTheme } from "./theme.js";
import { ErrorAlert } from "./ErrorAlert.js";
import type { ThemeModeProp } from "./types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

export interface FormsListPaneProps extends ThemeModeProp {
  readonly workspaceId: string;
  /** Called when a row is activated — the host routes to the builder. */
  readonly onOpen?: (form: FormRow) => void;
}

export function FormsListPane(props: FormsListPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <FormsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <FormList
        workspaceId={props.workspaceId}
        {...(props.onOpen ? { onCreated: props.onOpen } : {})}
      >
        {(bag) => (
          <Flex vertical gap={16}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t(FORMS_I18N_KEYS.listTitle)}
              </Typography.Title>
              <Flex gap={8} align="center">
                <Segmented<string>
                  value={bag.filter ?? "all"}
                  onChange={(next) =>
                    bag.setFilter(next === "all" ? null : (next as FormState))
                  }
                  options={[
                    { value: "all", label: t(FORMS_I18N_KEYS.responsesAllVersions) },
                    { value: "draft", label: t(FORMS_I18N_KEYS.builderStateDraft) },
                    { value: "open", label: t(FORMS_I18N_KEYS.builderStateOpen) },
                    { value: "closed", label: t(FORMS_I18N_KEYS.builderStateClosed) },
                  ]}
                />
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
              </Flex>
            </Flex>

            {bag.error !== null && (
              <ErrorAlert
                testId="forms-list-error"
                error={describe(toFlowError(bag.error))}
              />
            )}

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 24 }}>
                  <Spin data-testid="forms-list-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="forms-list-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(FORMS_I18N_KEYS.listLoadFailed),
                  }}
                  action={
                    <Button
                      size="small"
                      onClick={bag.refetch}
                      data-analytics="none"
                      data-analytics-reason="retry of a failed read; no flow to step"
                    >
                      {t(FORMS_I18N_KEYS.fillRetry)}
                    </Button>
                  }
                />
              ),
              empty: () => (
                <Empty
                  data-testid="forms-list-empty"
                  description={t(FORMS_I18N_KEYS.listEmpty)}
                />
              ),
              ready: (rows) => (
                <List<FormRow>
                  data-testid="forms-list"
                  dataSource={[...rows]}
                  renderItem={(row) => (
                    <List.Item
                      key={row.id}
                      onClick={() => props.onOpen?.(row)}
                      // Navigation into the builder, not a tracked outcome:
                      // the host owns its own routing analytics, and this
                      // pair emitting a funnel step for "opened a row" would
                      // put a forms.* event in somebody else's funnel.
                      data-analytics="none"
                      data-analytics-reason="host-owned navigation; no forms flow is stepped"
                      style={{ cursor: props.onOpen ? "pointer" : "default" }}
                    >
                      <List.Item.Meta
                        title={row.title}
                        description={t(FORMS_I18N_KEYS.listSubmissionCount, {
                          count: row.submission_count ?? 0,
                        })}
                      />
                      <Tag>{row.state}</Tag>
                    </List.Item>
                  )}
                />
              ),
            })}
          </Flex>
        )}
      </FormList>
    </FormsSkinTheme>
  );
}
