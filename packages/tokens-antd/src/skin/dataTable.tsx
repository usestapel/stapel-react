/**
 * `DataTable` — a table where there is room for one, a stack of cards where
 * there is not; decided by the ELEMENT's width, never the viewport's.
 *
 * Six blockers across four packages were one shape (visual pass VC-B3): an
 * antd `Table` at 390px, columns clipped at the card edge, a tag reading
 * `Requ`, long words broken one character per line. A table is the right
 * answer for a desktop and the wrong answer for a phone, and the switch is
 * a design-system rule — so it lives here, once, and a pair declares its
 * COLUMNS, not its layout.
 *
 * Below the tablet breakpoint of the box the table is IN, each row becomes a
 * card: the `title` column as the card's title, a `badge` column on the
 * title line, the rest as a label/value grid, the row's actions under it.
 * The width is measured with a `ResizeObserver` on the wrapper (the house
 * rule: geometry from element width), seeded from the dialog-surface rule so
 * the first client paint is already right on a phone.
 */
import { useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Table, Typography, theme as antdTheme } from "antd";
import type { TableColumnsType } from "antd";
import { breakpoints } from "@stapel/tokens";
import { useDialogSurface } from "./dialog.js";
import { useElementWidth } from "./elementWidth.js";
import { CardHeader } from "./listRow.js";
import { RowActions } from "./rowActions.js";
import type { RowAction } from "./rowActions.js";
import { EmptyState } from "./states.js";

/** Where a column's value goes on a card. `"title"`: the card's heading;
 * `"badge"`: a chip on the title line; `"field"` (default): a label/value
 * row; `"hidden"`: table only. */
export type DataTableCardRole = "title" | "badge" | "field" | "hidden";

export interface DataTableColumn<T> {
  readonly key: string;
  /** The column heading, and the label on a card. Translated by the caller. */
  readonly title: ReactNode;
  readonly render: (row: T) => ReactNode;
  readonly cardRole?: DataTableCardRole;
  /** Numbers to the trailing edge. */
  readonly align?: "start" | "end";
  readonly width?: number | string;
}

export interface DataTableProps<T> {
  readonly rows: readonly T[];
  readonly columns: readonly DataTableColumn<T>[];
  readonly rowKey: (row: T) => string;
  /** The row's actions: a trailing column on the table, a `RowActions` row on
   * the card. */
  readonly rowActions?: (row: T) => readonly RowAction[];
  /** The table's accessible name. */
  readonly ariaLabel?: string;
  /** What to render for zero rows. Default: the floor's `EmptyState`. */
  readonly empty?: ReactNode;
  /** Force a layout (tests, a host that measured already). Default `"auto"`. */
  readonly layout?: "auto" | "table" | "cards";
  /** The width below which cards are used. Default: the tablet breakpoint. */
  readonly cardsBelow?: number;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * Stamped `data-stapel-datatable="table|cards"`. Cards are `<article>`s
 * stamped `data-stapel-datatable-card`; each field is a `<dt>`/`<dd>` pair.
 *
 * ```tsx
 * <DataTable rows={keys} rowKey={(k) => k.id} ariaLabel={t(K.keys)}
 *   columns={[
 *     { key: "name", title: t(K.name), render: (k) => k.name, cardRole: "title" },
 *     { key: "status", title: t(K.status), render: (k) => <StatusTag status={k.tone}>{k.label}</StatusTag>, cardRole: "badge" },
 *     { key: "used", title: t(K.lastUsed), render: (k) => fmt.relative(k.lastUsedAt) },
 *   ]}
 *   rowActions={(k) => [{ key: "revoke", label: t(K.revoke), danger: true, onClick: () => revoke(k) }]} />
 * ```
 */
export function DataTable<T>(props: DataTableProps<T>): ReactElement {
  const { token } = antdTheme.useToken();
  const ref = useRef<HTMLDivElement | null>(null);
  const { below } = useElementWidth(ref, {
    thresholds: { cards: props.cardsBelow ?? breakpoints.tablet },
  });
  const phone = useDialogSurface() === "sheet";
  // Unmeasured (first paint, a server render, no observer) is seeded from the
  // dialog-surface rule, so a phone never paints a table for one frame.
  const cards = below.cards ?? phone;
  const layout =
    props.layout !== undefined && props.layout !== "auto"
      ? props.layout
      : cards
        ? "cards"
        : "table";

  const attrs = {
    ...(props.className !== undefined ? { className: props.className } : {}),
    ...(props.testId !== undefined ? { "data-testid": props.testId } : {}),
  };

  if (props.rows.length === 0) {
    return (
      <div ref={ref} data-stapel-datatable={layout} {...attrs} style={{ minWidth: 0, ...props.style }}>
        {props.empty ?? <EmptyState {...(props.testId !== undefined ? { testId: `${props.testId}-empty` } : {})} />}
      </div>
    );
  }

  if (layout === "table") {
    const columns: TableColumnsType<T> = props.columns.map((c) => ({
        key: c.key,
        title: c.title,
        render: (_: unknown, row: T) => c.render(row),
        ...(c.align === "end" ? { align: "right" as const } : {}),
        ...(c.width !== undefined ? { width: c.width } : {}),
    }));
    if (props.rowActions !== undefined) {
      const rowActions = props.rowActions;
      columns.push({
        key: "stapel-actions",
        title: "",
        align: "right",
        render: (_: unknown, row: T) => <RowActions actions={rowActions(row)} />,
      });
    }
    return (
      <div ref={ref} data-stapel-datatable="table" {...attrs} style={{ minWidth: 0, ...props.style }}>
        <Table<T>
          dataSource={[...props.rows]}
          columns={columns}
          rowKey={props.rowKey}
          pagination={false}
          size="middle"
          tableLayout="auto"
          {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
        />
      </div>
    );
  }

  const titleColumn = props.columns.find((c) => c.cardRole === "title") ?? props.columns[0];
  const badgeColumns = props.columns.filter((c) => c.cardRole === "badge");
  const fieldColumns = props.columns.filter(
    (c) => c !== titleColumn && c.cardRole !== "badge" && c.cardRole !== "hidden"
  );
  return (
    <div
      ref={ref}
      data-stapel-datatable="cards"
      role="list"
      {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
      {...attrs}
      style={{ display: "flex", flexDirection: "column", gap: token.paddingSM, minWidth: 0, ...props.style }}
    >
      {props.rows.map((row) => (
        <article
          key={props.rowKey(row)}
          role="listitem"
          data-stapel-datatable-card=""
          style={{
            display: "flex",
            flexDirection: "column",
            gap: token.paddingXS,
            padding: token.padding,
            borderRadius: token.borderRadiusLG,
            border: `${String(token.lineWidth)}px ${token.lineType} ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            minWidth: 0,
          }}
        >
          {titleColumn !== undefined && (
            <CardHeader
              level={4}
              title={titleColumn.render(row)}
              {...(badgeColumns.length > 0
                ? {
                    badge: (
                      <span style={{ display: "inline-flex", gap: token.paddingXXS, flexWrap: "wrap" }}>
                        {badgeColumns.map((c) => (
                          <span key={c.key}>{c.render(row)}</span>
                        ))}
                      </span>
                    ),
                  }
                : {})}
            />
          )}
          {fieldColumns.length > 0 && (
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
                columnGap: token.padding,
                rowGap: token.paddingXXS,
                margin: 0,
                minWidth: 0,
              }}
            >
              {fieldColumns.map((c) => (
                <div key={c.key} style={{ display: "contents" }}>
                  <dt style={{ minWidth: 0 }}>
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {c.title}
                    </Typography.Text>
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      minWidth: 0,
                      overflowWrap: "break-word",
                      textAlign: c.align === "end" ? "end" : "start",
                    }}
                  >
                    {c.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {props.rowActions !== undefined && <RowActions actions={props.rowActions(row)} align="start" />}
        </article>
      ))}
    </div>
  );
}
