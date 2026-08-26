/**
 * `<CaseDetail>` — one case card: what was reported, what was decided, and the
 * two acts a moderator can perform on it.
 *
 * ── The content block is the reason this screen exists ────────────────────
 *
 * `ContentDTO.available` is EXPLICIT on the wire (backend 0.3.0) precisely so
 * a console can draw a failed read as a failed read. A moderator must never be
 * handed an empty card that looks like empty content: "this app does not serve
 * the content of this kind of item" and "the post is blank" are different
 * findings and lead to opposite decisions. So `available: false` renders the
 * REASON — one of four named ones, or the backend's own message verbatim when
 * it is something else. Nothing here swallows an error.
 *
 * There is no evidence viewer. The wire still carries a reporter's own snapshot
 * for target types nobody serves content for, but the one consumer
 * (stapel-classified) stopped registering them in 0.3.x: the moderator reads
 * the message as it is, through the block above. A dialog asking to compare an
 * unverifiable copy against the real thing would add a second version of the
 * truth and no way to choose between them.
 *
 * ── Every control states why it is shut ───────────────────────────────────
 *
 * Claim, release, rescan and the verdict are all gated by the LEASE, which the
 * server enforces silently: it takes a case back when `claimed_until` passes.
 * Each gate carries the sentence for its own situation — "somebody else is
 * holding it", "take the case first", "this case is already decided" — beside
 * the control, never in a tooltip a disabled button would never fire.
 *
 * ── A sanction is confirmed, and the confirmation names itself ────────────
 *
 * "It breaks the rules" is one act; "and restrict this author for a week" is
 * another, and the second is the one that reaches a person's account. It goes
 * through `SkinConfirm` (a sheet on a phone), whose confirm button says what it
 * does rather than "OK".
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Card,
  Checkbox,
  Descriptions,
  Flex,
  Input,
  InputNumber,
  List,
  Radio,
  Segmented,
  Select,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { cssVar, spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  GatedControl,
  LoadBoundary,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  matchLoad,
  useDescribeFlowError,
  useI18n,
  useT,
} from "@stapel/core";
import {
  CONTENT_UNAVAILABLE_REASONS,
  DECISIONS,
  SANCTION_KINDS,
  isMember,
} from "../../api/enums.js";
import type { Decision, SanctionKind } from "../../api/enums.js";
import type {
  Appeal,
  CaseDetail as CaseDetailDto,
  CaseEvent,
  Content,
  Report,
  Sanction,
  Verdict,
} from "../../api/types.js";
import {
  MODERATION_I18N_KEYS,
  appealStateKey,
  caseOriginKey,
  caseStateKey,
  contentUnavailableKey,
  decisionHintKey,
  decisionKey,
  sanctionKindKey,
  sanctionStateKey,
  verdictSourceKey,
} from "../../i18n/keys.js";
import { useCase } from "../../headless/useCase.js";
import { useModerationRuntime } from "../../model/context.js";
import { useLiftSanction } from "../../model/queries.js";
import { formatDuration, formatInstant, shortId } from "../../model/format.js";
import { caseRefusalKey, usePolicyText } from "../copy.js";
import type { ThemeModeProp } from "../types.js";

/** One day, the shortest sanction length worth offering as a starting point. */
const DEFAULT_CUSTOM_SECONDS = 86_400;

export interface CaseDetailProps extends ThemeModeProp {
  readonly caseId?: string | undefined;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Who the reader is — this module has no `/me`, and without it the card
   * cannot tell the reader's own lease from a colleague's. */
  readonly viewerId?: string;
  readonly "data-testid"?: string;
}

export function CaseDetail(props: CaseDetailProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const runtime = useModerationRuntime();
  const testId = props["data-testid"] ?? "moderation-case";
  const bag = useCase({
    caseId: props.caseId,
    ...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {}),
  });
  const policyText = usePolicyText();
  const liftSanction = useLiftSanction();
  const [confirmingVerdict, setConfirmingVerdict] = useState(false);
  const [liftingId, setLiftingId] = useState<string | null>(null);
  const [liftNote, setLiftNote] = useState("");

  const label = (userId: string | null | undefined): string =>
    userId == null || userId === ""
      ? t(MODERATION_I18N_KEYS.caseSystemActor)
      : runtime.userLabel !== undefined
        ? runtime.userLabel(userId)
        : shortId(userId);

  const instant = (iso: string | null | undefined): string =>
    iso == null || iso === ""
      ? t(MODERATION_I18N_KEYS.unknownValue)
      : formatInstant(iso, locale);

  const refusal = bag.state.step === "refused" ? bag.state.error : undefined;
  const namedRefusal = refusal !== undefined ? caseRefusalKey(refusal) : undefined;
  const stepUp = bag.state.step === "verifying";

  function leaseLine(detail: CaseDetailDto): ReactNode {
    const { lease } = bag;
    if (lease.kind === "mine") {
      return lease.expired
        ? t(MODERATION_I18N_KEYS.caseLeaseExpired)
        : t(MODERATION_I18N_KEYS.caseLeaseMine, { until: instant(lease.until) });
    }
    if (lease.kind === "other") {
      // With no `userLabel` seam filled there is no name to print, and a bare
      // `shortId` on the glass is a machine value the reader cannot act on:
      // which colleague it is only matters when the host can say who.
      return runtime.userLabel !== undefined
        ? t(MODERATION_I18N_KEYS.caseLeaseOther, {
            who: label(lease.who),
            until: instant(lease.until),
          })
        : t(MODERATION_I18N_KEYS.caseLeaseOtherAnonymous, {
            until: instant(lease.until),
          });
    }
    return detail.state === "resolved"
      ? t(MODERATION_I18N_KEYS.caseBlockedResolved)
      : t(MODERATION_I18N_KEYS.caseLeaseFree);
  }

  function contentBlock(content: Content): ReactElement {
    if (content.available !== true) {
      const reason = content.error ?? "not_loaded";
      const known = isMember(CONTENT_UNAVAILABLE_REASONS, reason);
      return (
        <Flex vertical gap={spacing["1"]} data-testid={`${testId}-content-missing`}>
          <Tag color="warning">{t(MODERATION_I18N_KEYS.caseContent)}</Tag>
          <Typography.Text>
            {known
              ? t(contentUnavailableKey(reason))
              : t(contentUnavailableKey("not_loaded"))}
          </Typography.Text>
          {known ? null : (
            <Typography.Text type="secondary">{reason}</Typography.Text>
          )}
        </Flex>
      );
    }
    return (
      <Flex vertical gap={spacing["2"]} data-testid={`${testId}-content`}>
        {/* The title is the DIALOG's heading — see `caseHeading` — so printing
            it again here would be the same sentence twice in one sheet. */}
        {content.text !== undefined && content.text !== "" ? (
          <Typography.Paragraph style={{ marginBottom: spacing["0"] }}>
            {content.text}
          </Typography.Paragraph>
        ) : null}
        <Flex gap={spacing["3"]} wrap>
          {content.author_id !== undefined && content.author_id !== "" ? (
            <Typography.Text type="secondary">
              {`${t(MODERATION_I18N_KEYS.caseContentAuthor)}: ${label(content.author_id)}`}
            </Typography.Text>
          ) : null}
          {content.media !== undefined && content.media.length > 0 ? (
            <Typography.Text type="secondary">
              {t(MODERATION_I18N_KEYS.caseContentMedia, {
                count: content.media.length,
              })}
            </Typography.Text>
          ) : null}
          {content.url !== undefined && content.url !== "" ? (
            <Typography.Link href={content.url} target="_blank" rel="noreferrer">
              {t(MODERATION_I18N_KEYS.caseContentUrl)}
            </Typography.Link>
          ) : null}
        </Flex>
      </Flex>
    );
  }

  function actionBar(): ReactElement {
    return (
      <Flex gap={spacing["2"]} wrap data-testid={`${testId}-actions`}>
        <GatedButton
          gate={bag.claim}
          type="primary"
          testId={`${testId}-claim`}
          data-analytics="flow"
          onClick={bag.runClaim}
        >
          {t(
            bag.lease.kind === "mine"
              ? MODERATION_I18N_KEYS.caseExtend
              : MODERATION_I18N_KEYS.caseClaim
          )}
        </GatedButton>
        <GatedButton
          gate={bag.release}
          testId={`${testId}-release`}
          data-analytics="flow"
          onClick={bag.runRelease}
        >
          {t(MODERATION_I18N_KEYS.caseRelease)}
        </GatedButton>
        <GatedButton
          gate={bag.rescan}
          testId={`${testId}-rescan`}
          data-analytics="flow"
          onClick={bag.runRescan}
        >
          {t(MODERATION_I18N_KEYS.caseRescan)}
        </GatedButton>
      </Flex>
    );
  }

  function verdictForm(detail: CaseDetailDto): ReactElement {
    const draft = bag.verdict;
    const reasonOptions = detail.reports.map((report) => ({
      value: report.reason_code,
      label: policyText.reasonLabel({ code: report.reason_code }),
    }));
    const submitsSanction =
      draft.withSanction && draft.sanctionAllowed.available && draft.sanctionKind !== "";

    return (
      <Card
        size="small"
        title={t(MODERATION_I18N_KEYS.verdictTitle)}
        data-testid={`${testId}-verdict`}
      >
        <Flex vertical gap={spacing["3"]}>
          <Radio.Group
            value={draft.decision}
            aria-label={t(MODERATION_I18N_KEYS.verdictTitle)}
            data-testid={`${testId}-decision`}
            onChange={(event) => {
              draft.setDecision(event.target.value as Decision);
            }}
          >
            <Flex vertical gap={spacing["2"]}>
              {DECISIONS.map((decision) => (
                <Radio key={decision} value={decision}>
                  <Flex vertical>
                    <Typography.Text>{t(decisionKey(decision))}</Typography.Text>
                    <Typography.Text type="secondary">
                      {t(decisionHintKey(decision))}
                    </Typography.Text>
                  </Flex>
                </Radio>
              ))}
            </Flex>
          </Radio.Group>

          <Flex vertical gap={spacing["1"]}>
            <Typography.Text type="secondary">
              {t(MODERATION_I18N_KEYS.verdictReason)}
            </Typography.Text>
            <Select
              allowClear
              value={draft.reasonCode !== "" ? draft.reasonCode : undefined}
              style={{ minWidth: "12rem" }}
              aria-label={t(MODERATION_I18N_KEYS.verdictReason)}
              data-testid={`${testId}-verdict-reason`}
              options={reasonOptions}
              onChange={(value?: string) => {
                draft.setReasonCode(value ?? "");
              }}
            />
          </Flex>

          <Flex vertical gap={spacing["1"]}>
            <Typography.Text type="secondary">
              {t(MODERATION_I18N_KEYS.verdictNote)}
            </Typography.Text>
            <Input.TextArea
              value={draft.note}
              rows={3}
              aria-label={t(MODERATION_I18N_KEYS.verdictNote)}
              data-testid={`${testId}-verdict-note`}
              onChange={(event) => {
                draft.setNote(event.target.value);
              }}
            />
          </Flex>

          <GatedControl gate={draft.sanctionAllowed} testId={`${testId}-sanction-gate`}>
            {(bind) => (
              <Checkbox
                checked={draft.withSanction && draft.sanctionAllowed.available}
                disabled={bind.disabled}
                aria-describedby={bind["aria-describedby"]}
                data-testid={`${testId}-sanction-toggle`}
                onChange={(event) => {
                  draft.setWithSanction(event.target.checked);
                }}
              >
                {t(MODERATION_I18N_KEYS.verdictSanctionToggle)}
              </Checkbox>
            )}
          </GatedControl>

          {draft.withSanction && draft.sanctionAllowed.available ? (
            <Flex vertical gap={spacing["2"]} data-testid={`${testId}-sanction-fields`}>
              <Select
                value={draft.sanctionKind !== "" ? draft.sanctionKind : null}
                style={{ minWidth: "12rem" }}
                aria-label={t(MODERATION_I18N_KEYS.verdictSanctionToggle)}
                data-testid={`${testId}-sanction-kind`}
                options={SANCTION_KINDS.map((kind) => ({
                  value: kind,
                  label: t(sanctionKindKey(kind)),
                }))}
                onChange={(value: SanctionKind) => {
                  draft.setSanctionKind(value);
                }}
              />
              <Segmented
                value={draft.durationMode}
                data-testid={`${testId}-sanction-duration`}
                options={[
                  {
                    value: "ladder",
                    label: t(MODERATION_I18N_KEYS.sanctionDurationLadder),
                  },
                  {
                    value: "custom",
                    label: t(MODERATION_I18N_KEYS.sanctionDurationCustom),
                  },
                ]}
                onChange={(value) => {
                  draft.setDurationMode(value === "custom" ? "custom" : "ladder");
                }}
              />
              {draft.durationMode === "custom" ? (
                <InputNumber
                  value={draft.durationSeconds}
                  min={1}
                  aria-label={t(MODERATION_I18N_KEYS.sanctionDurationSeconds)}
                  data-testid={`${testId}-sanction-seconds`}
                  onChange={(value) => {
                    draft.setDurationSeconds(
                      typeof value === "number" ? value : DEFAULT_CUSTOM_SECONDS
                    );
                  }}
                />
              ) : null}
              <Input
                value={draft.scope}
                style={{ minWidth: "12rem" }}
                aria-label={t(MODERATION_I18N_KEYS.sanctionScope)}
                placeholder={t(MODERATION_I18N_KEYS.sanctionScopeAll)}
                data-testid={`${testId}-sanction-scope`}
                onChange={(event) => {
                  draft.setScope(event.target.value);
                }}
              />
            </Flex>
          ) : null}

          <GatedButton
            gate={draft.submit}
            type="primary"
            testId={`${testId}-verdict-submit`}
            data-analytics="flow"
            onClick={() => {
              if (submitsSanction) setConfirmingVerdict(true);
              else draft.run();
            }}
          >
            {t(MODERATION_I18N_KEYS.verdictSubmit)}
          </GatedButton>
        </Flex>

        <SkinConfirm
          open={confirmingVerdict}
          danger
          title={t(MODERATION_I18N_KEYS.verdictSanctionToggle)}
          body={
            draft.sanctionKind !== "" ? (
              <Typography.Text>
                {`${t(sanctionKindKey(draft.sanctionKind))}${
                  draft.durationMode === "custom"
                    ? ` · ${formatDuration(draft.durationSeconds, locale)}`
                    : ""
                }`}
              </Typography.Text>
            ) : null
          }
          confirmLabel={t(MODERATION_I18N_KEYS.verdictSubmit)}
          confirming={bag.state.step === "deciding"}
          data-testid={`${testId}-verdict-confirm`}
          onConfirm={() => {
            setConfirmingVerdict(false);
            draft.run();
          }}
          onCancel={() => {
            setConfirmingVerdict(false);
          }}
        />
      </Card>
    );
  }

  function reportsTab(reports: readonly Report[]): ReactElement {
    if (reports.length === 0) {
      return (
        <EmptyState
          compact
          testId={`${testId}-no-reports`}
          title={t(MODERATION_I18N_KEYS.caseNoReports)}
        />
      );
    }
    return (
      <List
        size="small"
        dataSource={[...reports]}
        rowKey={(row: Report) => row.id}
        data-testid={`${testId}-reports`}
        renderItem={(row: Report) => (
          <List.Item>
            <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
              <Flex gap={spacing["2"]} align="center" wrap>
                <Tag>{policyText.reasonLabel({ code: row.reason_code })}</Tag>
                {row.good_faith ? (
                  <Tag color="success">{t(MODERATION_I18N_KEYS.caseGoodFaith)}</Tag>
                ) : null}
                <Typography.Text type="secondary">
                  {instant(row.created_at)}
                </Typography.Text>
              </Flex>
              {row.description !== "" ? (
                <Typography.Text>{row.description}</Typography.Text>
              ) : null}
            </Flex>
          </List.Item>
        )}
      />
    );
  }

  function verdictsTab(verdicts: readonly Verdict[]): ReactElement {
    if (verdicts.length === 0) {
      return (
        <EmptyState
          compact
          testId={`${testId}-no-verdicts`}
          title={t(MODERATION_I18N_KEYS.caseNoVerdicts)}
        />
      );
    }
    return (
      <List
        size="small"
        dataSource={[...verdicts]}
        rowKey={(row: Verdict) => row.id}
        data-testid={`${testId}-verdicts`}
        renderItem={(row: Verdict) => {
          const matched = row.evidence["matched_rules"];
          const rules = Array.isArray(matched)
            ? matched.filter((value): value is string => typeof value === "string")
            : [];
          return (
            <List.Item>
              <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
                <Flex gap={spacing["2"]} align="center" wrap>
                  <Tag>{t(verdictSourceKey(row.source))}</Tag>
                  <Typography.Text strong>{t(decisionKey(row.decision))}</Typography.Text>
                  {row.confidence > 0 ? (
                    <Typography.Text type="secondary">
                      {t(MODERATION_I18N_KEYS.verdictConfidence, {
                        value: row.confidence,
                      })}
                    </Typography.Text>
                  ) : null}
                  <Typography.Text type="secondary">
                    {t(MODERATION_I18N_KEYS.verdictBy, { who: label(row.actor_id) })}
                  </Typography.Text>
                </Flex>
                {row.note !== "" ? (
                  <Typography.Text>{row.note}</Typography.Text>
                ) : null}
                {rules.length > 0 ? (
                  <Typography.Text type="secondary">
                    {`${t(MODERATION_I18N_KEYS.verdictEvidence)}: ${rules.join(", ")}`}
                  </Typography.Text>
                ) : null}
              </Flex>
            </List.Item>
          );
        }}
      />
    );
  }

  function sanctionsTab(sanctions: readonly Sanction[]): ReactElement {
    if (sanctions.length === 0) {
      return (
        <EmptyState
          compact
          testId={`${testId}-no-sanctions`}
          title={t(MODERATION_I18N_KEYS.caseNoSanctions)}
        />
      );
    }
    return (
      <>
        <List
          size="small"
          dataSource={[...sanctions]}
          rowKey={(row: Sanction) => row.id}
          data-testid={`${testId}-sanctions`}
          renderItem={(row: Sanction) => (
            <List.Item>
              <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
                <Flex gap={spacing["2"]} align="center" wrap>
                  <Tag>{t(sanctionKindKey(row.kind))}</Tag>
                  <Tag color={row.state === "active" ? "error" : "default"}>
                    {t(sanctionStateKey(row.state))}
                  </Tag>
                  <Typography.Text type="secondary">
                    {row.expires_at != null
                      ? t(MODERATION_I18N_KEYS.sanctionExpires, {
                          date: instant(row.expires_at),
                        })
                      : t(MODERATION_I18N_KEYS.sanctionIndefinite)}
                  </Typography.Text>
                </Flex>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.sanctionIssuedBy, {
                    who: label(row.issued_by),
                  })}
                </Typography.Text>
                <GatedButton
                  gate={
                    row.state === "active"
                      ? liftSanction.isPending
                        ? actionBlocked(MODERATION_I18N_KEYS.sanctionBlockedInFlight)
                        : actionAvailable()
                      : actionBlocked(MODERATION_I18N_KEYS.sanctionBlockedNotActive)
                  }
                  size="small"
                  testId={`${testId}-lift-${row.id}`}
                  data-analytics="none"
                  data-analytics-reason="opens the lift confirmation; the write happens on confirm"
                  onClick={() => {
                    setLiftNote("");
                    setLiftingId(row.id);
                  }}
                >
                  {t(MODERATION_I18N_KEYS.sanctionLift)}
                </GatedButton>
              </Flex>
            </List.Item>
          )}
        />
        {/* One confirm per LIST, keyed by the pending id — not one per row. */}
        <SkinConfirm
          open={liftingId !== null}
          title={t(MODERATION_I18N_KEYS.sanctionLiftConfirm)}
          body={
            <Input.TextArea
              value={liftNote}
              rows={2}
              aria-label={t(MODERATION_I18N_KEYS.sanctionLiftNote)}
              data-testid={`${testId}-lift-note`}
              onChange={(event) => {
                setLiftNote(event.target.value);
              }}
            />
          }
          confirmLabel={t(MODERATION_I18N_KEYS.sanctionLift)}
          confirming={liftSanction.isPending}
          data-testid={`${testId}-lift-confirm`}
          onConfirm={() => {
            const sanctionId = liftingId;
            if (sanctionId === null) return;
            liftSanction.mutate(
              {
                sanctionId,
                ...(liftNote.trim() !== "" ? { note: liftNote.trim() } : {}),
              },
              {
                onSettled: () => {
                  setLiftingId(null);
                },
              }
            );
          }}
          onCancel={() => {
            setLiftingId(null);
          }}
        />
      </>
    );
  }

  function appealsTab(appeals: readonly Appeal[]): ReactElement {
    if (appeals.length === 0) {
      return (
        <EmptyState
          compact
          testId={`${testId}-no-appeals`}
          title={t(MODERATION_I18N_KEYS.caseNoAppeals)}
        />
      );
    }
    return (
      <List
        size="small"
        dataSource={[...appeals]}
        rowKey={(row: Appeal) => row.id}
        data-testid={`${testId}-appeals`}
        renderItem={(row: Appeal) => (
          <List.Item>
            <Flex vertical gap={spacing["1"]} style={{ width: "100%" }}>
              <Flex gap={spacing["2"]} align="center" wrap>
                <Tag>{t(appealStateKey(row.state))}</Tag>
                <Typography.Text type="secondary">
                  {t(MODERATION_I18N_KEYS.appealQueueAppellant, {
                    who: label(row.appellant_id),
                  })}
                </Typography.Text>
              </Flex>
              <Typography.Text>{row.body}</Typography.Text>
            </Flex>
          </List.Item>
        )}
      />
    );
  }

  function eventsTab(): ReactElement {
    if (!bag.showEvents) {
      return (
        <GatedButton
          gate={actionAvailable()}
          testId={`${testId}-events-show`}
          data-analytics="none"
          data-analytics-reason="reveals an unbounded audit list; the read is the outcome"
          onClick={() => {
            bag.setShowEvents(true);
          }}
        >
          {t(MODERATION_I18N_KEYS.caseEventsShow)}
        </GatedButton>
      );
    }
    return matchLoad(bag.events, {
      loading: () => (
        <Typography.Text type="secondary" role="status">
          {t(MODERATION_I18N_KEYS.caseTabEvents)}
        </Typography.Text>
      ),
      failed: (error) => <ErrorAlert testId={`${testId}-events-failed`} thrown={error} />,
      ready: (events: readonly CaseEvent[]) =>
        events.length === 0 ? (
          <EmptyState
            compact
            testId={`${testId}-events-empty`}
            title={t(MODERATION_I18N_KEYS.caseEventsEmpty)}
          />
        ) : (
          <Timeline
            data-testid={`${testId}-events`}
            items={events.map((event) => ({
              key: event.id,
              children: (
                <Flex vertical>
                  <Typography.Text>{event.kind}</Typography.Text>
                  <Typography.Text type="secondary">
                    {`${label(event.actor_id)} · ${instant(event.created_at)}`}
                  </Typography.Text>
                </Flex>
              ),
            }))}
          />
        ),
    });
  }

  /**
   * What the moderator is looking at, as a person would name it — the reported
   * item's own title, with the case reference demoted to a caption under it.
   * A case id is a lookup key, never a heading: `Case 2b7f0d18` tells the
   * reader nothing about what they are about to decide.
   */
  const caseHeading: ReactElement = (
    <Flex vertical>
      <Typography.Text strong>
        {matchLoad(bag.detail, {
          loading: () => t(MODERATION_I18N_KEYS.caseUntitled),
          failed: () => t(MODERATION_I18N_KEYS.caseUntitled),
          ready: (detail) =>
            detail.content.available === true &&
            detail.content.title !== undefined &&
            detail.content.title !== ""
              ? detail.content.title
              : t(MODERATION_I18N_KEYS.caseUntitled),
        })}
      </Typography.Text>
      <Typography.Text type="secondary">
        {t(MODERATION_I18N_KEYS.caseTitle, {
          caseRef: shortId(props.caseId ?? ""),
        })}
      </Typography.Text>
    </Flex>
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <SkinDialog
        open={props.open}
        onClose={props.onClose}
        title={caseHeading}
        ariaLabel={t(MODERATION_I18N_KEYS.caseTitle, {
          caseRef: shortId(props.caseId ?? ""),
        })}
        dismissLabel={t(MODERATION_I18N_KEYS.dialogDismiss)}
        width="45rem"
        data-testid={testId}
      >
        <LoadBoundary
          state={bag.detail}
          testId={testId}
          skeletonRows={6}
          onRetry={bag.refetch}
        >
          {(detail) => (
            <Flex vertical gap={spacing["3"]}>
              {/* Pinned to the top of the sheet's own scroll box. The lease
                  acts are what the whole card is FOR, and the body below them
                  is several screens long on a phone: unpinned, every moderator
                  action sat under an invisible fold. It is `sticky` rather
                  than the dialog's `footer` slot because antd memoises that
                  slot and it would keep showing the gate the case had on the
                  first frame, before the detail landed. */}
              <div
                style={{
                  position: "sticky",
                  top: spacing["0"],
                  zIndex: 1,
                  background: cssVar("surface-overlay"),
                  paddingBlock: spacing["2"],
                }}
              >
                {actionBar()}
              </div>

              <Descriptions
                size="small"
                column={1}
                colon={false}
                data-testid={`${testId}-facts`}
                items={[
                  {
                    key: "state",
                    label: t(MODERATION_I18N_KEYS.queueColState),
                    children: <Tag>{t(caseStateKey(detail.state))}</Tag>,
                  },
                  {
                    key: "origin",
                    label: t(MODERATION_I18N_KEYS.queueColOrigin),
                    children: t(caseOriginKey(detail.origin)),
                  },
                  {
                    key: "severity",
                    label: t(MODERATION_I18N_KEYS.queueColSeverity),
                    children: String(detail.severity),
                  },
                ]}
              />

              {/* The lease is a SENTENCE, not a field: "Held by: Nobody is
                  holding this case." read as a label whose value contradicts
                  it. It stands on its own line instead. */}
              <Typography.Text type="secondary" data-testid={`${testId}-lease`}>
                {leaseLine(detail)}
              </Typography.Text>

              {bag.state.step === "screening" ? (
                <Typography.Text type="secondary" role="status">
                  {t(MODERATION_I18N_KEYS.caseRescanQueued)}
                </Typography.Text>
              ) : null}

              {stepUp ? (
                <ErrorAlert
                  testId={`${testId}-step-up`}
                  message={t(MODERATION_I18N_KEYS.stepUpNeeded)}
                />
              ) : refusal !== undefined ? (
                namedRefusal !== undefined ? (
                  <ErrorAlert testId={`${testId}-refused`} message={t(namedRefusal)} />
                ) : (
                  <ErrorAlert testId={`${testId}-refused`} error={describe(refusal)} />
                )
              ) : null}

              <Card
                size="small"
                title={t(MODERATION_I18N_KEYS.caseContent)}
                data-testid={`${testId}-content-card`}
              >
                {contentBlock(detail.content)}
              </Card>

              <Tabs
                data-testid={`${testId}-tabs`}
                items={[
                  {
                    key: "reports",
                    label: t(MODERATION_I18N_KEYS.caseTabReports),
                    children: reportsTab(detail.reports),
                  },
                  {
                    key: "verdicts",
                    label: t(MODERATION_I18N_KEYS.caseTabVerdicts),
                    children: verdictsTab(detail.verdicts),
                  },
                  {
                    key: "sanctions",
                    label: t(MODERATION_I18N_KEYS.caseTabSanctions),
                    children: sanctionsTab(detail.sanctions),
                  },
                  {
                    key: "appeals",
                    label: t(MODERATION_I18N_KEYS.caseTabAppeals),
                    children: appealsTab(detail.appeals),
                  },
                  {
                    key: "events",
                    label: t(MODERATION_I18N_KEYS.caseTabEvents),
                    children: eventsTab(),
                  },
                ]}
              />

              {verdictForm(detail)}
            </Flex>
          )}
        </LoadBoundary>
      </SkinDialog>
    </SkinTheme>
  );
}
