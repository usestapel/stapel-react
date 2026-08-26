/**
 * `<PolicyDisclosurePane>` — the public page behind DSA Art. 15: what can be
 * reported, what runs automatically, and what a person is entitled to.
 *
 * ── Every claim on this page is COMPUTED, not written ─────────────────────
 *
 * `GET policy` builds its answer from the deployment's live configuration —
 * the registered reasons, the screening stages actually wired, the confidence
 * floor actually applied, whether an appeal is actually routed to a different
 * moderator. So this pane renders data and never prose about the data: a
 * deployment that turns its screener off says "nothing is screened
 * automatically" here on the next page load, with no copy change anywhere.
 *
 * Anonymous-safe: this is the module's only `AllowAny` route, and a rules page
 * that demanded a session would be the one page nobody could check the rules on.
 */
import type { ReactElement } from "react";
import { Card, Flex, List, Table, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import type { PolicyReason, PolicyRule } from "../api/types.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useReportPolicy } from "../headless/useReport.js";
import { usePolicyText } from "./copy.js";
import type { ThemeModeProp } from "./types.js";

export interface PolicyDisclosurePaneProps extends ThemeModeProp {
  /** Narrow the disclosure to one kind of content, when the host links here
   * from a specific surface. */
  readonly targetType?: string;
  readonly "data-testid"?: string;
}

export function PolicyDisclosurePane(
  props: PolicyDisclosurePaneProps
): ReactElement {
  const t = useT();
  const policyText = usePolicyText();
  const testId = props["data-testid"] ?? "moderation-policy";
  const bag = useReportPolicy(props.targetType ?? "");

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <LoadBoundary
        state={bag.policy}
        testId={testId}
        skeletonRows={6}
        onRetry={bag.refetch}
      >
        {(policy) => (
          <Flex vertical gap={spacing["4"]} data-testid={testId}>
            <Typography.Title level={3} style={{ marginBottom: spacing["0"] }}>
              {t(MODERATION_I18N_KEYS.policyTitle)}
            </Typography.Title>

            <Card title={t(MODERATION_I18N_KEYS.policyReasons)} size="small">
              <Table
                size="small"
                pagination={false}
                scroll={{ x: true }}
                rowKey={(row: PolicyReason) => row.code}
                dataSource={[...policy.reasons]}
                data-testid={`${testId}-reasons`}
                columns={[
                  {
                    key: "code",
                    title: t(MODERATION_I18N_KEYS.policyColCode),
                    render: (_: unknown, row: PolicyReason): string =>
                      policyText.reasonLabel(row),
                  },
                  {
                    key: "description",
                    title: t(MODERATION_I18N_KEYS.policyColDescription),
                    render: (_: unknown, row: PolicyReason): string =>
                      policyText.reasonDescription(row),
                  },
                  {
                    key: "severity",
                    title: t(MODERATION_I18N_KEYS.policyColSeverity),
                    render: (_: unknown, row: PolicyReason): number => row.severity,
                  },
                  {
                    key: "needsDetail",
                    title: t(MODERATION_I18N_KEYS.policyColNeedsDetail),
                    render: (_: unknown, row: PolicyReason): ReactElement | null =>
                      row.requires_description ? (
                        <Tag color="processing">
                          {t(MODERATION_I18N_KEYS.policyNeedsDetailYes)}
                        </Tag>
                      ) : null,
                  },
                ]}
              />
            </Card>

            <Card title={t(MODERATION_I18N_KEYS.policyRules)} size="small">
              {policy.rules.length === 0 ? (
                <EmptyState
                  testId={`${testId}-rules-empty`}
                  compact
                  title={t(MODERATION_I18N_KEYS.policyRulesEmpty)}
                />
              ) : (
                <List
                  size="small"
                  dataSource={[...policy.rules]}
                  rowKey={(row: PolicyRule) => row.code}
                  data-testid={`${testId}-rules`}
                  renderItem={(rule: PolicyRule) => (
                    <List.Item>
                      <Typography.Text>
                        {policyText.ruleDescription(rule)}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card title={t(MODERATION_I18N_KEYS.policyAutomated)} size="small">
              <Flex vertical gap={spacing["2"]} data-testid={`${testId}-automated`}>
                <Typography.Text>
                  {policy.automated_means.enabled
                    ? t(MODERATION_I18N_KEYS.policyAutomatedOn, {
                        stages: policy.automated_means.stages.join(", "),
                      })
                    : t(MODERATION_I18N_KEYS.policyAutomatedOff)}
                </Typography.Text>
                {policy.automated_means.enabled ? (
                  <>
                    <Typography.Text type="secondary">
                      {t(MODERATION_I18N_KEYS.policyConfidenceFloor, {
                        floor: policy.automated_means.confidence_floor,
                      })}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {t(MODERATION_I18N_KEYS.policyOnUnavailable, {
                        behaviour: policy.automated_means.on_unavailable,
                      })}
                    </Typography.Text>
                  </>
                ) : null}
              </Flex>
            </Card>

            <Card title={t(MODERATION_I18N_KEYS.policyHumanReview)} size="small">
              <Flex vertical gap={spacing["2"]} data-testid={`${testId}-human`}>
                {policy.human_review.always_available ? (
                  <Typography.Text>
                    {t(MODERATION_I18N_KEYS.policyHumanAlways)}
                  </Typography.Text>
                ) : null}
                <Typography.Text>
                  {t(
                    policy.human_review.appeal_requires_different_actor
                      ? MODERATION_I18N_KEYS.policyAppealDifferentActor
                      : MODERATION_I18N_KEYS.policyAppealSameActorAllowed
                  )}
                </Typography.Text>
              </Flex>
            </Card>
          </Flex>
        )}
      </LoadBoundary>
    </SkinTheme>
  );
}
