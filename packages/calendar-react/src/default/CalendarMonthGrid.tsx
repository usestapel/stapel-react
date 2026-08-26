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
 * Geometry is the BOX's, not the viewport's, and this component measures its
 * OWN box: `dense` (which `<Calendar>` can also set from its measurement)
 * drops the titles for dots when the columns get too narrow to read a title
 * anyway, and below `GRID_MIN_WIDTH` there is no grid at all — it renders
 * `<CalendarAgenda>` over the same instants instead. A month grid that
 * scrolls sideways, or whose every entry clips to `2:0…`, is not a month
 * grid. The fallback lives here rather than only in `<Calendar>` so a host
 * that mounts the part directly, or drops it into a 380px side panel, gets
 * the readable shape too.
 */
import type { CSSProperties, ReactElement } from "react";
import { Button, Typography } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useI18n, useT, useTPlural } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDayNumber, weekdayNames } from "../model/format.js";
import type { CalendarInstance } from "../model/occurrences.js";
import { groupByDay, isOutsideMonth, isSameDay } from "../model/range.js";
import { CalendarAgenda } from "./CalendarAgenda.js";
import { instanceLabel } from "./instanceLabel.js";
import { GRID_MIN_WIDTH, useElementWidth } from "./useElementWidth.js";

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
  /**
   * Pin a theme side. Omitted, the document's live mode wins — the part
   * self-themes (`SkinTheme`), because a `src/default` part is dropped into
   * host pages and into this pair's own dialogs, and an untended antd
   * `ConfigProvider` serves the compiled-in LIGHT theme: the visual pass
   * photographed this grid as black text on a black page.
   */
  readonly mode?: ThemeMode;
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
  const { ref, width } = useElementWidth<HTMLDivElement>();
  // Narrow until measured, and narrow means AGENDA: seven columns in 390px
  // clip every title to "2:0…", which is a grid that carries none of the
  // information a grid exists for. `<Calendar>` already switched at this
  // threshold; the grid itself did not, so a host that mounted this part
  // directly — or dropped it in a side panel — got the crammed version.
  // The rule belongs to the component that cannot be drawn, not to one of
  // its callers.
  const narrow = width === undefined || width < GRID_MIN_WIDTH;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <div
      ref={ref}
      data-testid={props["data-testid"]}
      data-stapel-calendar-grid={narrow ? "agenda" : "month"}
    >
      {narrow ? (
        <CalendarAgenda
          instances={props.instances}
          days={props.days}
          {...(props.onSelect !== undefined ? { onSelect: props.onSelect } : {})}
        />
      ) : (
        <MonthCells {...props} />
      )}
    </div>
    </SkinTheme>
  );
}

/** The six-week grid itself, drawn only where it fits. */
function MonthCells(props: CalendarMonthGridProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const byDay = groupByDay(props.days, props.instances);
  const todayIso = new Date().toISOString();

  return (
    <>
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
    </>
  );
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
