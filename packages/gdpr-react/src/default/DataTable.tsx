/**
 * `<DataTable>` — one table that survives a 390px phone.
 *
 * ── The defect this replaces ──────────────────────────────────────────────
 *
 * Three staff/account screens here drew an antd `<Table scroll={{x:true}}/>`.
 * A horizontal scroller keeps every column REACHABLE and makes none of them
 * READABLE: at 390px the browser shrinks each column to its minimum content
 * width and then breaks words to fit it, so a subject list rendered one to
 * three characters per line for eleven consecutive lines, "Workspace" came
 * out as `Works/pace`, and an email was cut mid-address. A person cannot read
 * a column they have to reassemble.
 *
 * Below the tablet breakpoint each row is drawn as a stacked definition card
 * instead: the row's identity as the card's title, then label-above-value for
 * every other column, each value with the full width of the card. Nothing is
 * clipped, nothing is scrolled sideways, and no word is broken to fit a column
 * that no longer exists.
 *
 * ── ELEMENT width, not viewport width ─────────────────────────────────────
 *
 * The question is "how much room does this table have", not "how big is the
 * screen": these tables are also mounted inside a 340px settings column on a
 * 1280px desktop, where a viewport media query would confidently draw the wide
 * arm into a space a third of its size. So the decision is made from a
 * `ResizeObserver` on the table's own box (the house rule's element-width
 * geometry), and `undefined` — before the first observation, on a server
 * render, in an environment with no observer — answers WIDE, because a first
 * paint that settles from wide to narrow is a reflow while the reverse is a
 * visible jump on every desktop load.
 *
 * This belongs in `@stapel/tokens-antd/skin` beside `SkinDialog`: the same
 * defect is open in `moderation-react` (content rules, queue), and
 * `billing-react` and `calendar-react` and `docs-react` each carry their own
 * copy of the measurement hook. It lives here until that lands — see
 * `SCRATCH/wave-visual3/REQUESTS-gdpr.md`.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { Button, Flex, Table, Typography, theme as antdTheme } from "antd";
import { breakpoints, fontSize, spacing } from "@stapel/tokens";

/** Room enough for a real table. The same number `SkinDialog` splits a sheet
 * from a modal on, read here as an ELEMENT width rather than a viewport one. */
export const TABLE_MIN_WIDTH: number = breakpoints.tablet;

/** One column. `render` returns the cell; `primary` marks the row's identity. */
export interface DataColumn<Row> {
  readonly key: string;
  /** The column header, and the field label in the narrow arm. */
  readonly title: string;
  readonly render: (row: Row) => ReactNode;
  /**
   * At most one column is the row's IDENTITY. In the narrow arm it becomes the
   * card's title with no label above it — a card whose first line is
   * "Item / Stand-up, 12 August" spends a line saying what the next line
   * already says.
   */
  readonly primary?: boolean;
}

/** A per-row detail panel, opened on demand. */
export interface DataTableExpand<Row> {
  readonly render: (row: Row) => ReactNode;
  /**
   * The accessible name AND the visible label of the per-row control. Never a
   * column header: "Show which systems have confirmed" as the heading of a
   * column of `+` buttons is a sentence pretending to be a label.
   */
  readonly label: string;
}

export interface DataTableProps<Row> {
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string | number;
  readonly columns: readonly DataColumn<Row>[];
  readonly expand?: DataTableExpand<Row>;
  readonly testId?: string | undefined;
}

/** What {@link useElementWidth} hands back. */
interface ElementWidth<T extends HTMLElement> {
  readonly ref: RefObject<T | null>;
  /** Content-box width in CSS pixels, or `undefined` before the first read. */
  readonly width: number | undefined;
}

/**
 * Measure one element's width, live. The observer is the only source: a window
 * resize that does not change THIS element is not a layout change for it, and
 * an element that changes without the window (a sider collapsing, a drawer
 * opening) is exactly the case a window listener misses.
 */
function useElementWidth<T extends HTMLElement>(): ElementWidth<T> {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const next = entry.contentRect.width;
      // A detached or `display:none` element reports 0. That measures nothing,
      // and letting it through would collapse a hidden tab to the narrow arm
      // and leave it there.
      if (next <= 0) return;
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { ref, width };
}

/** One row as a stacked definition card — the narrow arm. */
function RowCard<Row>(props: {
  row: Row;
  columns: readonly DataColumn<Row>[];
  expand: DataTableExpand<Row> | undefined;
}): ReactElement {
  const { token } = antdTheme.useToken();
  const [open, setOpen] = useState(false);
  const { row, columns, expand } = props;
  const primary = columns.find((column) => column.primary === true);
  const rest = columns.filter((column) => column.primary !== true);
  return (
    <Flex
      vertical
      gap={spacing[2]}
      data-stapel-datatable-row=""
      style={{
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        paddingBottom: spacing[3],
        // An email, a receipt id or a long subject name has no space to break
        // at. `break-word` breaks those and ONLY those — it never chops an
        // ordinary word that would have fitted on the next line.
        overflowWrap: "break-word",
      }}
    >
      {primary !== undefined ? (
        <Typography.Text strong>{primary.render(row)}</Typography.Text>
      ) : null}
      {rest.map((column) => (
        <Flex vertical key={column.key}>
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
          >
            {column.title}
          </Typography.Text>
          {/* A block wrapper, so an inline-block cell (a `Tag`, a `Button`)
              hugs its own text instead of being stretched into a full-width
              bar by the surrounding column flex. */}
          <div>{column.render(row)}</div>
        </Flex>
      ))}
      {expand !== undefined ? (
        <>
          <div>
            <Button
              size="small"
              onClick={() => setOpen((was) => !was)}
              aria-expanded={open}
              data-analytics="none"
              data-analytics-reason="local disclosure of a detail already on the row's own read"
            >
              {expand.label}
            </Button>
          </div>
          {open ? expand.render(row) : null}
        </>
      ) : null}
    </Flex>
  );
}

/**
 * A table above {@link TABLE_MIN_WIDTH} of its OWN width, a list of stacked
 * definition cards below it.
 */
export function DataTable<Row>(props: DataTableProps<Row>): ReactElement {
  const { rows, rowKey, columns, expand, testId } = props;
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const wide = width === undefined || width >= TABLE_MIN_WIDTH;

  const testIdProp = testId !== undefined ? { "data-testid": testId } : {};

  return (
    <div ref={ref} {...testIdProp}>
      {wide ? (
        <Table
          size="small"
          rowKey={(row: Row) => rowKey(row)}
          dataSource={[...rows]}
          pagination={false}
          // Only in the wide arm: at this width the columns have room, and the
          // scroller is the escape hatch for a table that is merely tight
          // rather than unreadable.
          scroll={{ x: "max-content" }}
          columns={columns.map((column) => ({
            key: column.key,
            title: column.title,
            render: (_: unknown, row: Row): ReactNode => column.render(row),
          }))}
          {...(expand !== undefined
            ? {
                expandable: {
                  expandedRowRender: (row: Row): ReactNode =>
                    expand.render(row),
                  expandRowByClick: false,
                  // The header of an icon column is BLANK. The sentence that
                  // used to sit here ("Show which systems have confirmed") was
                  // a column heading pretending to be a label; antd's own
                  // expander already carries an accessible name and
                  // `aria-expanded`, which is where that sentence belongs.
                  columnTitle: "",
                },
              }
            : {})}
        />
      ) : (
        <Flex vertical gap={spacing[3]} data-stapel-datatable="cards">
          {rows.map((row) => (
            <RowCard
              key={rowKey(row)}
              row={row}
              columns={columns}
              {...(expand !== undefined ? { expand } : { expand: undefined })}
            />
          ))}
        </Flex>
      )}
    </div>
  );
}
