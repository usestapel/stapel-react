/**
 * `<CalendarAgenda>` — the list view, and what a narrow box gets instead of a
 * month grid.
 *
 * ── Two sources, one shape ────────────────────────────────────────────────
 *
 * Pass `instances` and it draws them: that is how `<Calendar>` degrades on a
 * phone, where the range has already been read and DEDUPED through
 * `GET /calendar`, so a repeating stand-up still shows up on every one of its
 * days. Pass a range instead and it reads `GET /events` itself through the
 * headless `<EventList>` — the flat list, no series expansion — which is the
 * standalone "my events" surface a host mounts on its own.
 *
 * Both arms render the same rows, so a reader moving between them is looking
 * at one component, and the pair has one agenda to design rather than two.
 *
 * ── Rows carry what a row is for ──────────────────────────────────────────
 *
 * A time (formatted, never ISO), a title, and the two facts that change what
 * the row MEANS: it repeats, or it was cancelled. Cancelled rows stay — struck
 * through and labelled — because "the 14:00 was called off" is the thing a
 * person opened the agenda to find out.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import { EmptyState, LoadList } from "@stapel/tokens-antd/skin";
import { useI18n, useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { EventList } from "../headless/EventList.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDayHeading, formatTimeRange } from "../model/format.js";
import { instancesFromEvents } from "../model/occurrences.js";
import type { CalendarInstance } from "../model/occurrences.js";
import { groupByDay } from "../model/range.js";
import { instanceLabel } from "./CalendarMonthGrid.js";

export interface CalendarAgendaProps {
  /**
   * Already-read, already-deduped instants. When present the component draws
   * these and issues no request of its own.
   */
  readonly instances?: readonly CalendarInstance[];
  /** Day headings to draw, in order. Omitted, days come from the instants. */
  readonly days?: readonly string[];
  /** Range for the connected arm (`GET /events`), used when `instances` is absent. */
  readonly start?: string;
  readonly end?: string;
  /** Open an instant. */
  readonly onSelect?: (instance: CalendarInstance) => void;
  /** Offered inside the empty state — usually "New event". */
  readonly emptyAction?: ReactNode;
  readonly "data-testid"?: string;
}

export function CalendarAgenda(props: CalendarAgendaProps): ReactElement {
  if (props.instances !== undefined) {
    return (
      <AgendaRows
        instances={props.instances}
        {...(props.days !== undefined ? { days: props.days } : {})}
        {...(props.onSelect !== undefined ? { onSelect: props.onSelect } : {})}
        {...(props.emptyAction !== undefined
          ? { emptyAction: props.emptyAction }
          : {})}
        {...(props["data-testid"] !== undefined
          ? { "data-testid": props["data-testid"] }
          : {})}
      />
    );
  }
  return <ConnectedAgenda {...props} />;
}

/** The `GET /events` arm: read, then draw the same rows. */
function ConnectedAgenda(props: CalendarAgendaProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "calendar-agenda";
  return (
    <EventList
      {...(props.start !== undefined ? { start: props.start } : {})}
      {...(props.end !== undefined ? { end: props.end } : {})}
    >
      {(bag) => (
        <LoadList
          state={bag.state}
          onRetry={bag.refetch}
          testId={testId}
          empty={
            <EmptyState
              testId={`${testId}-empty`}
              title={t(CALENDAR_I18N_KEYS.agendaEmpty)}
              hint={t(CALENDAR_I18N_KEYS.agendaEmptyHint)}
              {...(props.emptyAction !== undefined
                ? { action: props.emptyAction }
                : {})}
            />
          }
        >
          {(events) => (
            <AgendaRows
              instances={instancesFromEvents(events)}
              {...(props.onSelect !== undefined
                ? { onSelect: props.onSelect }
                : {})}
              data-testid={testId}
            />
          )}
        </LoadList>
      )}
    </EventList>
  );
}

/** Day headings + rows. The one place agenda rows are drawn. */
function AgendaRows(props: {
  readonly instances: readonly CalendarInstance[];
  readonly days?: readonly string[];
  readonly onSelect?: (instance: CalendarInstance) => void;
  readonly emptyAction?: ReactNode;
  readonly "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const testId = props["data-testid"] ?? "calendar-agenda";
  const days =
    props.days ??
    [...new Set(props.instances.map((i) => dayKeyOf(i.start)))].sort();

  if (props.instances.length === 0) {
    return (
      <EmptyState
        testId={`${testId}-empty`}
        title={t(CALENDAR_I18N_KEYS.agendaEmpty)}
        hint={t(CALENDAR_I18N_KEYS.agendaEmptyHint)}
        {...(props.emptyAction !== undefined ? { action: props.emptyAction } : {})}
      />
    );
  }

  const grouped = groupByDay(days, props.instances).filter(
    // Only days the caller asked for explicitly keep their empty heading; a
    // derived day list never has one, and a month of blank headings is noise.
    (group) => group.items.length > 0 || props.days !== undefined
  );

  return (
    <Flex vertical gap={spacing["4"]} data-testid={testId}>
      {grouped.map((group) => (
        <section key={group.day}>
          <Typography.Text
            strong
            style={{ fontSize: fontSize.sm.fontSize, color: cssVar("text-muted") }}
          >
            {formatDayHeading(group.day, locale)}
          </Typography.Text>
          <Flex vertical gap={spacing["1"]} style={{ marginTop: spacing["2"] }}>
            {group.items.length === 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: fontSize.sm.fontSize }}>
                {t(CALENDAR_I18N_KEYS.agendaDayEmpty)}
              </Typography.Text>
            ) : (
              group.items.map((instance) => (
                <AgendaRow
                  key={instance.key}
                  instance={instance}
                  {...(props.onSelect !== undefined
                    ? { onSelect: props.onSelect }
                    : {})}
                />
              ))
            )}
          </Flex>
        </section>
      ))}
    </Flex>
  );
}

function AgendaRow(props: {
  readonly instance: CalendarInstance;
  readonly onSelect?: (instance: CalendarInstance) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { instance, onSelect } = props;
  const cancelled = instance.status === "cancelled";
  const title =
    instance.title.length > 0
      ? instance.title
      : t(CALENDAR_I18N_KEYS.viewUntitled);

  const inner = (
    <Flex
      vertical
      gap={spacing["0"]}
      style={{
        borderInlineStart: `${spacing["1"]}px solid ${cssVar(
          cancelled ? "text-subtle" : "brand"
        )}`,
        borderRadius: radii.sm,
        paddingInlineStart: spacing["3"],
        paddingBlock: spacing["1"],
        minWidth: 0,
        width: "100%",
      }}
    >
      <Typography.Text
        style={{
          textDecoration: cancelled ? "line-through" : "none",
          color: cssVar(cancelled ? "text-subtle" : "text"),
        }}
      >
        {title}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: fontSize.sm.fontSize }}>
        {formatTimeRange(instance.start, instance.end, locale)}
      </Typography.Text>
      <Flex gap={spacing["2"]}>
        {instance.isVirtual ? (
          <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(CALENDAR_I18N_KEYS.viewRepeats)}
          </Typography.Text>
        ) : null}
        {cancelled ? (
          <Typography.Text type="danger" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(CALENDAR_I18N_KEYS.viewCancelled)}
          </Typography.Text>
        ) : null}
        {instance.start === instance.end ? (
          <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
            {t(CALENDAR_I18N_KEYS.viewMarker)}
          </Typography.Text>
        ) : null}
      </Flex>
    </Flex>
  );

  if (onSelect === undefined) {
    return (
      <div
        data-stapel-instance={instance.key}
        data-status={instance.status}
        data-virtual={instance.isVirtual ? "true" : undefined}
      >
        {inner}
      </div>
    );
  }
  return (
    <Button
      type="text"
      block
      aria-label={instanceLabel(instance, locale, t)}
      data-stapel-instance={instance.key}
      data-status={instance.status}
      data-virtual={instance.isVirtual ? "true" : undefined}
      data-analytics="none"
      data-analytics-reason="opens the event sheet; the host app wraps navigation with its own tracked()"
      onClick={() => {
        onSelect(instance);
      }}
      style={{ height: "auto", padding: spacing["1"], textAlign: "start" }}
    >
      {inner}
    </Button>
  );
}

/** The local-midnight key a wire instant groups under. */
function dayKeyOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).toISOString();
}
