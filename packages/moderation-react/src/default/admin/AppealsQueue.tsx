/**
 * `<AppealsQueue>` — the moderator's side of DSA Art. 20.
 *
 * ── Two refusals share this screen and mean opposite things ───────────────
 *
 * `403 moderation_same_actor` says the appeal is not YOURS to hear because you
 * decided the case; the appeal is fine and so are you, and a colleague will
 * take it. `409 moderation_appeal_resolved` says there is nothing left to
 * decide. Both are read by code, in the sheet, from the mutation's error —
 * never guessed from the row, because a colleague can decide an appeal between
 * the page being drawn and this sheet being submitted.
 *
 * ── Overturning reopens the case ──────────────────────────────────────────
 *
 * `overturned` is the module's single backward edge (`resolved → queued`), so
 * the outcome radio carries a one-line meaning for each choice rather than
 * three bare words: "the decision stands", "the case is reopened and decided
 * again", "the person took the appeal back".
 */
import type { ReactElement } from "react";
import { Card, Flex, Input, List, Segmented, Radio, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { actionAvailable, actionBlocked, useI18n, useT } from "@stapel/core";
import { APPEAL_OUTCOMES, APPEAL_STATES } from "../../api/enums.js";
import type { AppealOutcome, AppealState } from "../../api/enums.js";
import type { Appeal } from "../../api/types.js";
import {
  MODERATION_I18N_KEYS,
  appealOutcomeHintKey,
  appealOutcomeKey,
  appealStateKey,
} from "../../i18n/keys.js";
import { useAppealsQueue } from "../../headless/useAppealsQueue.js";
import { useModerationRuntime } from "../../model/context.js";
import { formatInstant, shortId } from "../../model/format.js";
import { appealResolveRefusalKey } from "../copy.js";
import type { ThemeModeProp } from "../types.js";

/** antd semantic presets only. */
const STATE_TONE: Readonly<Record<AppealState, string>> = {
  open: "processing",
  upheld: "default",
  overturned: "success",
  withdrawn: "default",
};

export interface AppealsQueueProps extends ThemeModeProp {
  readonly "data-testid"?: string;
}

export function AppealsQueue(props: AppealsQueueProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const runtime = useModerationRuntime();
  const testId = props["data-testid"] ?? "moderation-appeals";
  const bag = useAppealsQueue();

  const label = (userId: string): string =>
    runtime.userLabel !== undefined ? runtime.userLabel(userId) : shortId(userId);

  const namedRefusal =
    bag.error != null ? appealResolveRefusalKey(bag.error) : undefined;

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing["4"]} data-testid={testId}>
        <Card
          size="small"
          title={t(MODERATION_I18N_KEYS.appealQueueTitle)}
        >
          {/* The state filter is a row of its own, not the card header's
              `extra`: a header extra never shrinks, so at 390px the six-state
              `Segmented` measured 551px and dragged the whole page out of the
              viewport. Here it scrolls inside its own box. */}
          <div
            style={{
              maxWidth: "100%",
              overflowX: "auto",
              marginBottom: spacing["3"],
            }}
          >
            <Segmented
              value={bag.filterState}
              data-testid={`${testId}-filter-state`}
              options={[
                { value: "", label: t(MODERATION_I18N_KEYS.queueFilterAny) },
                ...APPEAL_STATES.map((state) => ({
                  value: state as string,
                  label: t(appealStateKey(state)),
                })),
              ]}
              onChange={(value) => {
                bag.setFilterState(String(value));
              }}
            />
          </div>
          <LoadList
            state={bag.rows}
            testId={testId}
            skeletonRows={3}
            onRetry={bag.refetch}
            empty={
              <EmptyState
                testId={`${testId}-empty`}
                title={t(MODERATION_I18N_KEYS.appealQueueEmpty)}
                hint={t(MODERATION_I18N_KEYS.appealQueueEmptyHint)}
              />
            }
          >
            {(rows) => (
              <Flex vertical gap={spacing["3"]}>
                <List
                  size="small"
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
                            {t(MODERATION_I18N_KEYS.appealQueueAppellant, {
                              who: label(row.appellant_id),
                            })}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {formatInstant(row.created_at, locale)}
                          </Typography.Text>
                        </Flex>
                        <Typography.Paragraph
                          ellipsis={{ rows: 3, expandable: true }}
                          style={{ marginBottom: spacing["0"] }}
                        >
                          {row.body}
                        </Typography.Paragraph>
                        <GatedButton
                          gate={
                            row.state === "open"
                              ? actionAvailable()
                              : actionBlocked(
                                  MODERATION_I18N_KEYS.appealQueueAlreadyDecided
                                )
                          }
                          size="small"
                          testId={`${testId}-resolve-${row.id}`}
                          data-analytics="none"
                          data-analytics-reason="opens the resolve sheet; the write happens on submit"
                          onClick={() => {
                            bag.openResolve(row);
                          }}
                        >
                          {t(MODERATION_I18N_KEYS.appealQueueResolve)}
                        </GatedButton>
                      </Flex>
                    </List.Item>
                  )}
                />
                {bag.hasMore ? (
                  <GatedButton
                    gate={bag.loadMore}
                    testId={`${testId}-more`}
                    data-analytics="none"
                    data-analytics-reason="pagination — the same list, one keyset page further"
                    onClick={bag.runLoadMore}
                  >
                    {t(MODERATION_I18N_KEYS.appealQueueLoadMore)}
                  </GatedButton>
                ) : null}
              </Flex>
            )}
          </LoadList>
        </Card>

        <SkinDialog
          open={bag.resolving !== null}
          onClose={bag.closeResolve}
          title={t(MODERATION_I18N_KEYS.appealQueueResolve)}
          dismissLabel={t(MODERATION_I18N_KEYS.dialogDismiss)}
          data-testid={`${testId}-sheet`}
          footer={
            <GatedButton
              gate={bag.submit}
              type="primary"
              testId={`${testId}-submit`}
              data-analytics="none"
              data-analytics-reason="staff decision write — the host app wraps it with its own tracked()"
              onClick={bag.run}
            >
              {t(MODERATION_I18N_KEYS.appealQueueResolve)}
            </GatedButton>
          }
        >
          <Flex vertical gap={spacing["3"]}>
            {bag.error != null ? (
              namedRefusal !== undefined ? (
                <ErrorAlert testId={`${testId}-refused`} message={t(namedRefusal)} />
              ) : (
                <ErrorAlert testId={`${testId}-refused`} thrown={bag.error} />
              )
            ) : null}

            {bag.resolving !== null ? (
              <Typography.Paragraph style={{ marginBottom: spacing["0"] }}>
                {bag.resolving.body}
              </Typography.Paragraph>
            ) : null}

            <Radio.Group
              value={bag.outcome}
              aria-label={t(MODERATION_I18N_KEYS.appealQueueOutcome)}
              data-testid={`${testId}-outcome`}
              onChange={(event) => {
                bag.setOutcome(event.target.value as AppealOutcome);
              }}
            >
              <Flex vertical gap={spacing["2"]}>
                {APPEAL_OUTCOMES.map((outcome) => (
                  <Radio key={outcome} value={outcome}>
                    <Flex vertical>
                      <Typography.Text>{t(appealOutcomeKey(outcome))}</Typography.Text>
                      <Typography.Text type="secondary">
                        {t(appealOutcomeHintKey(outcome))}
                      </Typography.Text>
                    </Flex>
                  </Radio>
                ))}
              </Flex>
            </Radio.Group>

            <Flex vertical gap={spacing["1"]}>
              <Typography.Text type="secondary">
                {t(MODERATION_I18N_KEYS.appealQueueNote)}
              </Typography.Text>
              <Input.TextArea
                value={bag.note}
                rows={3}
                aria-label={t(MODERATION_I18N_KEYS.appealQueueNote)}
                data-testid={`${testId}-note`}
                onChange={(event) => {
                  bag.setNote(event.target.value);
                }}
              />
            </Flex>
          </Flex>
        </SkinDialog>
      </Flex>
    </SkinTheme>
  );
}
