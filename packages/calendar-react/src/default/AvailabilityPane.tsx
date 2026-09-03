/**
 * `<AvailabilityPane>` — free/busy and bookable slots, with the honesty of the
 * answer on the screen.
 *
 * ── `truncated` is rendered, in words, above the slots ────────────────────
 *
 * `AvailabilityResponse.truncated` means a series expansion hit
 * `MAX_EXPANSION_OCCURRENCES` inside the range, so **later times in this
 * answer only LOOK free**. Before this pane existed, the flag appeared nowhere
 * in the pair outside the generated schema: a "pick a time" screen would have
 * offered an already-booked slot with total confidence. A degraded answer that
 * does not say it is degraded is the §83 defect, so the warning is a visible
 * `warning` alert with the remedy in it, above the slot list — not a console
 * line, not a muted footnote under the fold.
 *
 * ── "No slots" is not "nothing free" ──────────────────────────────────────
 *
 * The contract documents one cause for an empty `slots[]`: no availability
 * windows are set. That is the question never having been configured, not the
 * week being full, and the empty state says which — otherwise a person reads
 * "no free time" off a calendar nobody ever opened for booking.
 *
 * ── `slot_minutes` is checked before it is sent ───────────────────────────
 *
 * The backend refuses a non-positive granularity (`error.400.calendar_invalid_slot_minutes`)
 * rather than clamping it, because its slot loop would not terminate. The
 * control states the same rule locally through `GatedControl`, so the reason
 * appears beside the field instead of arriving as a server error afterwards,
 * and the headless layer does not send a request it knows will be refused.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Flex, Form, InputNumber, List, Typography } from "antd";
import { EmptyState, ErrorAlert, GatedControl, SkinTheme } from "@stapel/tokens-antd/skin";
import { matchLoad, useI18n, useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { fontSize, spacing } from "@stapel/tokens";
import { Availability } from "../headless/Availability.js";
import { DEFAULT_SLOT_MINUTES } from "../model/validation.js";
import type { AvailabilityData } from "../headless/Availability.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDayHeading, formatTimeRange } from "../model/format.js";
import type { Interval } from "../api/types.js";

export interface AvailabilityPaneProps {
  readonly start?: string;
  readonly end?: string;
  readonly defaultSlotMinutes?: number;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
  /** Called with the slot the reader picked, when the host offers booking. */
  readonly onPickSlot?: (slot: Interval) => void;
  readonly "data-testid"?: string;
}

export function AvailabilityPane(props: AvailabilityPaneProps): ReactElement {
  const t = useT();
  const [slotMinutes, setSlotMinutes] = useState(
    props.defaultSlotMinutes ?? DEFAULT_SLOT_MINUTES
  );
  const testId = props["data-testid"] ?? "calendar-availability";

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid={`${testId}-root`}
    >
      <Flex vertical gap={spacing["3"]} data-testid={testId}>
        <Typography.Title level={4} style={{ marginBottom: spacing["0"] }}>
          {t(CALENDAR_I18N_KEYS.availabilityHeading)}
        </Typography.Title>

        <Availability
          {...(props.start !== undefined ? { start: props.start } : {})}
          {...(props.end !== undefined ? { end: props.end } : {})}
          slotMinutes={slotMinutes}
        >
          {(bag) => (
            <Flex vertical gap={spacing["3"]}>
              <Flex gap={spacing["2"]} align="flex-end" wrap>
                <GatedControl
                  gate={bag.slotMinutesValid}
                  // A validity verdict, not a refusal: the number stays
                  // editable, because editing it is how the reason goes away.
                  whenBlocked="annotate"
                  testId={`${testId}-slot-gate`}
                >
                  {(bind) => (
                    <Form.Item
                      label={t(CALENDAR_I18N_KEYS.availabilitySlotLength)}
                      style={{ marginBottom: spacing["0"] }}
                    >
                      <InputNumber
                        value={slotMinutes}
                        aria-label={t(CALENDAR_I18N_KEYS.availabilitySlotLength)}
                        aria-describedby={bind["aria-describedby"]}
                        aria-invalid={bind["aria-describedby"] !== undefined}
                        data-testid={`${testId}-slot-minutes`}
                        onChange={(next) => {
                          setSlotMinutes(typeof next === "number" ? next : 0);
                        }}
                      />
                    </Form.Item>
                  )}
                </GatedControl>
                <Button
                  data-testid={`${testId}-refresh`}
                  data-analytics="none"
                  data-analytics-reason="re-reads the current range; the host app wraps with its own tracked()"
                  onClick={bag.refetch}
                >
                  {t(CALENDAR_I18N_KEYS.availabilityRefresh)}
                </Button>
              </Flex>

              {matchLoad(bag.state, {
                loading: () => (
                  <Typography.Text
                    type="secondary"
                    role="status"
                    aria-busy
                    data-testid={`${testId}-loading`}
                  >
                    {t(CALENDAR_I18N_KEYS.availabilityLoading)}
                  </Typography.Text>
                ),
                failed: (error) => (
                  <ErrorAlert
                    thrown={error}
                    onRetry={bag.refetch}
                    retryLabel={t(CALENDAR_I18N_KEYS.viewRetry)}
                    testId={`${testId}-failed`}
                  />
                ),
                ready: (data) => (
                  <AvailabilityBody
                    data={data}
                    testId={testId}
                    {...(props.onPickSlot !== undefined
                      ? { onPickSlot: props.onPickSlot }
                      : {})}
                  />
                ),
              })}
            </Flex>
          )}
        </Availability>
      </Flex>
    </SkinTheme>
  );
}

function AvailabilityBody(props: {
  readonly data: AvailabilityData;
  readonly testId: string;
  readonly onPickSlot?: (slot: Interval) => void;
}): ReactElement {
  const t = useT();
  const { data, testId } = props;

  return (
    <Flex vertical gap={spacing["3"]}>
      {/* The degraded-mode banner. First, above the slots, because it changes
          what every slot below it MEANS. */}
      {data.truncated ? (
        <Alert
          type="warning"
          showIcon
          role="status"
          data-testid={`${testId}-truncated`}
          title={t(CALENDAR_I18N_KEYS.availabilityTruncated)}
          description={t(CALENDAR_I18N_KEYS.availabilityTruncatedHint)}
        />
      ) : null}

      <section>
        <Typography.Text strong>
          {t(CALENDAR_I18N_KEYS.availabilitySlots)}
        </Typography.Text>
        {data.noWindows ? (
          <EmptyState
            compact
            testId={`${testId}-no-windows`}
            title={t(CALENDAR_I18N_KEYS.availabilityNoWindows)}
            hint={t(CALENDAR_I18N_KEYS.availabilityNoWindowsHint)}
          />
        ) : (
          <IntervalList
            intervals={data.slots}
            testId={`${testId}-slots`}
            {...(props.onPickSlot !== undefined
              ? { onPick: props.onPickSlot }
              : {})}
          />
        )}
      </section>

      <section>
        <Typography.Text strong>
          {t(CALENDAR_I18N_KEYS.availabilityBusy)}
        </Typography.Text>
        {data.busy.length === 0 ? (
          <Typography.Paragraph
            type="secondary"
            data-testid={`${testId}-no-busy`}
            style={{ fontSize: fontSize.sm.fontSize }}
          >
            {t(CALENDAR_I18N_KEYS.availabilityNoBusy)}
          </Typography.Paragraph>
        ) : (
          <IntervalList intervals={data.busy} testId={`${testId}-busy`} />
        )}
      </section>
    </Flex>
  );
}

/** Intervals, formatted — never an ISO string, and never a bare time without
 * the day it belongs to. */
function IntervalList(props: {
  readonly intervals: readonly Interval[];
  readonly testId: string;
  readonly onPick?: (slot: Interval) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  return (
    <List
      size="small"
      data-testid={props.testId}
      dataSource={[...props.intervals]}
      renderItem={(interval) => {
        const label = `${formatDayHeading(interval.start, locale)} · ${formatTimeRange(
          interval.start,
          interval.end,
          locale
        )}`;
        return (
          <List.Item
            {...(props.onPick !== undefined
              ? {
                  actions: [
                    <Button
                      key="pick"
                      size="small"
                      type="primary"
                      aria-label={`${t(CALENDAR_I18N_KEYS.availabilityPick)} — ${label}`}
                      data-analytics="none"
                      data-analytics-reason="hands the slot to the host's booking flow; the host wraps with its own tracked()"
                      onClick={() => {
                        props.onPick?.(interval);
                      }}
                    >
                      {t(CALENDAR_I18N_KEYS.availabilityPick)}
                    </Button>,
                  ],
                }
              : {})}
          >
            {label}
          </List.Item>
        );
      }}
    />
  );
}
