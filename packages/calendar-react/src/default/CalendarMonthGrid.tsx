/**
 * `<CalendarMonthGrid>` — the six-week grid, and nothing else.
 *
 * Presentational on purpose: it takes the days to draw and the already-deduped
 * instances (`model/occurrences.ts`) and owns no read of its own. The wired
 * screen is `<Calendar>`; this is exported separately because a host that
 * already has the range in hand (a dashboard widget, a booking page) should be
 * able to draw the grid without a second request.
 *
 * ── What the grid has to distinguish, and how ─────────────────────────────
 *
 *  - **virtual vs materialized** — an instant expanded from a series carries
 *    the repeat glyph; a concrete row does not. They are different objects on
 *    the backend and a person editing one needs to know which they have.
 *  - **cancelled** — struck through AND labelled, never dropped. "The stand-up
 *    was cancelled" is information; an empty cell is not.
 *  - **outside the anchored month** — the leading/trailing cells are muted.
 *    They are drawn because they are on screen and inside the queried range.
 *
 * Geometry is the BOX's, not the viewport's: `dense` (from `<Calendar>`'s
 * `useElementWidth`) drops the titles for dots when the columns get too narrow
 * to read a title anyway. Below `GRID_MIN_WIDTH` there is no grid at all —
 * `<Calendar>` renders `<CalendarAgenda>` instead. A month grid that scrolls
 * sideways is not a month grid.
 */
import type { CSSProperties, ReactElement } from "react";
import { Button, Typography } from "antd";
import { useI18n, useT, useTPlural } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDayNumber, formatTime, weekdayNames } from "../model/format.js";
import type { CalendarInstance } from "../model/occurrences.js";
import { groupByDay, isOutsideMonth, isSameDay } from "../model/range.js";

/** How many instances a cell lists before collapsing the rest into "+N more". */
const MAX_PER_CELL = 3;

export interface CalendarMonthGridProps {
  /** The days to draw, as local-midnight wire instants (`viewDays`). */
  readonly days: readonly string[];
  /** The month the grid is anchored on — days outside it are muted. */
  readonly anchor: string;
  /** Deduped drawable instants (`CalendarViewBag.state`'s `instances`). */
  readonly instances: readonly CalendarInstance[];
  /** Open an instant. Omitted, the cells are not interactive. */
  readonly onSelect?: (instance: CalendarInstance) => void;
  /** Drop titles for dots — set by the container from its measured width. */
  readonly dense?: boolean;
  readonly "data-testid"?: string;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: spacing["1"],
  width: "100%",
};

const headerCellStyle: CSSProperties = {
  fontSize: fontSize.xs.fontSize,
  color: cssVar("text-muted"),
  textAlign: "center",
  paddingBottom: spacing["1"],
};

export function CalendarMonthGrid(props: CalendarMonthGridProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const byDay = groupByDay(props.days, props.instances);
  const todayIso = new Date().toISOString();

  return (
    <div data-testid={props["data-testid"]} data-stapel-calendar-grid="month">
      <div style={gridStyle} aria-hidden="true">
        {weekdayNames(locale).map((name) => (
          <div key={name} style={headerCellStyle}>
            {name}
          </div>
        ))}
      </div>
      <div style={gridStyle} role="grid" aria-label={t(CALENDAR_I18N_KEYS.viewHeading)}>
        {byDay.map(({ day, items }) => {
          const outside = isOutsideMonth(day, props.anchor);
          const today = isSameDay(day, todayIso);
          const shown = items.slice(0, MAX_PER_CELL);
          const hidden = items.length - shown.length;
          return (
            <div
              key={day}
              role="gridcell"
              data-outside-month={outside ? "true" : undefined}
              data-today={today ? "true" : undefined}
              style={{
                minHeight: spacing["8"],
                border: `1px solid ${cssVar(today ? "brand" : "border-subtle")}`,
                borderRadius: radii.md,
                padding: spacing["1"],
                background: cssVar(outside ? "surface-sunken" : "surface-raised"),
                display: "flex",
                flexDirection: "column",
                gap: spacing["1"],
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: fontSize.xs.fontSize,
                  color: cssVar(outside ? "text-subtle" : "text-muted"),
                }}
              >
                {formatDayNumber(day, locale)}
              </span>
              {shown.map((instance) => (
                <InstanceChip
                  key={instance.key}
                  instance={instance}
                  dense={props.dense ?? false}
                  {...(props.onSelect !== undefined
                    ? { onSelect: props.onSelect }
                    : {})}
                />
              ))}
              {hidden > 0 ? (
                <span
                  style={{
                    fontSize: fontSize.xs.fontSize,
                    color: cssVar("text-muted"),
                  }}
                >
                  {tPlural(CALENDAR_I18N_KEYS.viewMoreCount, { count: hidden })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The full sentence a cell entry says, whether or not it has room to show it:
 * the title, the time, and the two facts a glyph would otherwise carry alone
 * (cancelled, repeats). It is the chip's accessible name in every density —
 * a strike-through and a dot are invisible to a screen reader.
 */
export function instanceLabel(
  instance: CalendarInstance,
  locale: string,
  t: (key: string) => string
): string {
  const title =
    instance.title.length > 0
      ? instance.title
      : t(CALENDAR_I18N_KEYS.viewUntitled);
  const parts = [formatTime(instance.start, locale), title];
  if (instance.isVirtual) parts.push(t(CALENDAR_I18N_KEYS.viewRepeats));
  if (instance.status === "cancelled") {
    parts.push(t(CALENDAR_I18N_KEYS.viewCancelled));
  }
  return parts.join(" · ");
}

/** One instant inside a cell. Cancelled is struck through AND named. */
function InstanceChip(props: {
  readonly instance: CalendarInstance;
  readonly dense: boolean;
  readonly onSelect?: (instance: CalendarInstance) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { instance, onSelect } = props;
  const cancelled = instance.status === "cancelled";
  const label = instanceLabel(instance, locale, t);

  const body = props.dense ? (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: spacing["2"],
        height: spacing["2"],
        borderRadius: radii.full,
        background: cssVar(cancelled ? "text-subtle" : "brand"),
        border: instance.isVirtual
          ? `1px solid ${cssVar("brand-active")}`
          : "none",
      }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textDecoration: cancelled ? "line-through" : "none",
        color: cssVar(cancelled ? "text-subtle" : "text"),
        fontSize: fontSize.xs.fontSize,
        textAlign: "start",
      }}
    >
      {label}
    </span>
  );

  if (onSelect === undefined) {
    return (
      <span
        data-stapel-instance={instance.key}
        data-virtual={instance.isVirtual ? "true" : undefined}
        data-status={instance.status}
      >
        <Typography.Text style={visuallyHidden}>{label}</Typography.Text>
        {body}
      </span>
    );
  }
  return (
    <Button
      type="link"
      size="small"
      aria-label={label}
      data-stapel-instance={instance.key}
      data-virtual={instance.isVirtual ? "true" : undefined}
      data-status={instance.status}
      data-analytics="none"
      data-analytics-reason="opens the event sheet; the host app wraps navigation with its own tracked()"
      onClick={() => {
        onSelect(instance);
      }}
      style={{
        display: "block",
        minWidth: 0,
        padding: spacing["0"],
        height: "auto",
        textAlign: "start",
      }}
    >
      {body}
    </Button>
  );
}

/** Off-screen but announced. Clipped rather than sized to zero, so the text
 * still exists for assistive technology. */
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: spacing["1"],
  height: spacing["1"],
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};
