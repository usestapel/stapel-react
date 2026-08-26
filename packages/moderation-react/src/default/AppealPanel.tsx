/**
 * `<AppealPanel>` — the page at `/account/appeals?case=<uuid>` (DSA Art. 20).
 *
 * ── The empty arm here is an EXPLANATION, not a shrug ─────────────────────
 *
 * Without a `case` in the link there is nothing to appeal against, and the
 * pair cannot go and find one: `GET cases` and `GET cases/{id}` are both
 * behind the moderation mandate, so the subject of a decision has no endpoint
 * that lists decisions about them. The id travels exactly one way — the deep
 * link in the takedown notification. A composer drawn anyway would have a
 * submit button that could never light up, so the panel says WHY instead, and
 * still lists the appeals already sent (that read is the person's own).
 *
 * ── Three refusals, three sentences ───────────────────────────────────────
 *
 * "you already appealed this" (409), "this case is not decided yet, so there
 * is nothing to appeal" (409) and "this decision was not about your content"
 * (403) are three different situations that a screen branching on status would
 * merge into two. They are read by code.
 */
import type { ReactElement } from "react";
import { Card, Flex, Input, List, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { AppealState } from "../api/enums.js";
import type { Appeal } from "../api/types.js";
import { MODERATION_I18N_KEYS, appealStateKey } from "../i18n/keys.js";
import { useAppeal } from "../headless/useAppeal.js";
import { formatDate, shortId } from "../model/format.js";
import { appealRefusalKey } from "./copy.js";
import type { ThemeModeProp } from "./types.js";

/** The backend's own `MAX_APPEAL_BODY`. */
const BODY_MAX = 10000;

/** antd semantic presets only — never a hex, never a brand colour. */
const STATE_TONE: Readonly<Record<AppealState, string>> = {
  open: "processing",
  upheld: "default",
  overturned: "success",
  withdrawn: "default",
};

export interface AppealPanelProps extends ThemeModeProp {
  /** From the notification link's `?case=` parameter. The host reads the query
   * string — a pair does not own the router. */
  readonly caseId?: string;
  /** When the appeal is about the sanction rather than the decision. */
  readonly sanctionId?: string;
  readonly "data-testid"?: string;
}

export function AppealPanel(props: AppealPanelProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const testId = props["data-testid"] ?? "moderation-appeal";
  const bag = useAppeal({
    ...(props.caseId !== undefined ? { caseId: props.caseId } : {}),
    ...(props.sanctionId !== undefined ? { sanctionId: props.sanctionId } : {}),
  });

  const refusal = bag.state.step === "refused" ? bag.state.error : undefined;
  const namedRefusal = refusal !== undefined ? appealRefusalKey(refusal) : undefined;

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing["4"]} data-testid={testId}>
        <Card title={t(MODERATION_I18N_KEYS.appealTitle)} size="small">
          {bag.state.step === "no_case" ? (
            <EmptyState
              testId={`${testId}-need-link`}
              title={t(MODERATION_I18N_KEYS.appealNeedLink)}
              hint={t(MODERATION_I18N_KEYS.appealNeedLinkHint)}
            />
          ) : bag.state.step === "submitted" ? (
            <Typography.Text data-testid={`${testId}-submitted`}>
              {t(MODERATION_I18N_KEYS.appealSubmitted)}
            </Typography.Text>
          ) : (
            <Flex vertical gap={spacing["3"]}>
              <Typography.Text type="secondary">
                {t(MODERATION_I18N_KEYS.appealAbout, {
                  caseRef: shortId(props.caseId ?? ""),
                })}
              </Typography.Text>

              {refusal !== undefined ? (
                namedRefusal !== undefined ? (
                  <ErrorAlert testId={`${testId}-refused`} message={t(namedRefusal)} />
                ) : (
                  <ErrorAlert testId={`${testId}-refused`} error={describe(refusal)} />
                )
              ) : null}

              <Flex vertical gap={spacing["1"]}>
                <Typography.Text strong>
                  {t(MODERATION_I18N_KEYS.appealBody)}
                </Typography.Text>
                <Input.TextArea
                  value={bag.body}
                  rows={6}
                  maxLength={BODY_MAX}
                  showCount
                  aria-label={t(MODERATION_I18N_KEYS.appealBody)}
                  data-testid={`${testId}-body`}
                  onChange={(event) => {
                    bag.setBody(event.target.value);
                  }}
                />
              </Flex>

              <GatedButton
                gate={bag.submit}
                type="primary"
                testId={`${testId}-submit`}
                data-analytics="flow"
                onClick={bag.run}
              >
                {t(MODERATION_I18N_KEYS.appealSubmit)}
              </GatedButton>
            </Flex>
          )}
        </Card>

        <Card title={t(MODERATION_I18N_KEYS.appealsTitle)} size="small">
          <LoadList
            state={bag.rows.rows}
            testId={`${testId}-list`}
            skeletonRows={3}
            onRetry={bag.rows.refetch}
            empty={
              <EmptyState
                testId={`${testId}-list-empty`}
                title={t(MODERATION_I18N_KEYS.appealsEmpty)}
                hint={t(MODERATION_I18N_KEYS.appealsEmptyHint)}
              />
            }
          >
            {(rows) => (
              <Flex vertical gap={spacing["2"]}>
                <List
                  dataSource={[...rows]}
                  rowKey={(row: Appeal) => row.id}
                  data-testid={`${testId}-rows`}
                  renderItem={(row: Appeal) => (
                    <List.Item>
                      <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
                        <Flex gap={spacing["2"]} align="center" wrap>
                          <Tag color={STATE_TONE[row.state]}>
                            {t(appealStateKey(row.state))}
                          </Tag>
                          <Typography.Text type="secondary">
                            {formatDate(row.created_at, locale)}
                          </Typography.Text>
                        </Flex>
                        <Typography.Paragraph
                          ellipsis={{ rows: 3, expandable: true }}
                          style={{ marginBottom: spacing["0"] }}
                        >
                          {row.body}
                        </Typography.Paragraph>
                        {row.resolution_note !== "" ? (
                          <Typography.Text type="secondary">
                            {`${t(MODERATION_I18N_KEYS.appealResolutionNote)}: ${row.resolution_note}`}
                          </Typography.Text>
                        ) : null}
                      </Flex>
                    </List.Item>
                  )}
                />
                {bag.rows.hasMore ? (
                  <GatedButton
                    gate={bag.loadMore}
                    testId={`${testId}-more`}
                    data-analytics="none"
                    data-analytics-reason="pagination — the same list, one page further"
                    onClick={bag.rows.loadMore}
                  >
                    {t(MODERATION_I18N_KEYS.appealsLoadMore)}
                  </GatedButton>
                ) : null}
              </Flex>
            )}
          </LoadList>
        </Card>
      </Flex>
    </SkinTheme>
  );
}
