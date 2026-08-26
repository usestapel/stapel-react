/**
 * `ListRow` / `CardHeader` — a row and a header that cannot break their own
 * content.
 *
 * Five defects in one package were one missing thing (visual pass N4/N5/N6):
 * `Goo/gle` split mid-word, `Active se…` and `Two-factor au…` truncated by
 * their own action buttons, a header spilling over its card's border, a
 * badge floated on top of the timestamp it annotated. All of them are a flex
 * row whose text item has no `min-width: 0`, whose actions have no slot, and
 * whose badge has no cell of its own. This module is that row and that
 * header, with the rules built in:
 *
 *  - the text column is `min-width: 0` and WRAPS — `overflow-wrap:
 *    break-word` breaks a word only when it could not fit a line by itself,
 *    never `anywhere`, and `truncate` is the explicit single-line opt-in;
 *  - actions have a slot that wraps UNDER the text when the two cannot share
 *    a line, instead of squeezing it;
 *  - a badge sits in the title line as a flex item that reserves its space.
 *
 * Both are layout, not chrome: no border, no background. A `Card` or a
 * `List` provides those; these decide where the words go.
 */
import type { CSSProperties, ElementType, ReactElement, ReactNode } from "react";
import { Typography, theme as antdTheme } from "antd";
import { useDialogSurface } from "./dialog.js";
import { PHONE_CONTROL_HEIGHT } from "./theme.js";

/** A text block that wraps between words and never truncates unless told to. */
function wrapping(truncate: boolean | undefined): CSSProperties {
  return truncate === true
    ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    : { overflowWrap: "break-word", wordBreak: "normal", whiteSpace: "normal" };
}

export interface CardHeaderProps {
  readonly title: ReactNode;
  /** A muted line under the title. */
  readonly subtitle?: ReactNode;
  /** A status chip beside the title — its own cell, never floated. */
  readonly badge?: ReactNode;
  /** The header's actions; they wrap under the title when the line is short. */
  readonly actions?: ReactNode;
  /** Heading level. Default `3` (a card in a page whose title is `2`). */
  readonly level?: 1 | 2 | 3 | 4 | 5;
  /** Single-line ellipsis instead of wrapping. Off by default: a title that
   * ends in `…` is a title the person cannot read. */
  readonly truncate?: boolean;
  readonly id?: string;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * The header row of a card, a section, a page. Stamped `data-stapel-card-header`.
 *
 * ```tsx
 * <CardHeader title={t(KEYS.passkeys)} badge={<StatusTag status="success">…</StatusTag>}
 *   actions={<GatedButton gate={add}>{t(KEYS.add)}</GatedButton>} />
 * ```
 */
export function CardHeader(props: CardHeaderProps): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <div
      data-stapel-card-header=""
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        columnGap: token.padding,
        rowGap: token.paddingXS,
        minWidth: 0,
        ...props.style,
      }}
    >
      <div
        data-stapel-card-header-text=""
        style={{
          // Grows to the line; may shrink to the phone column but never
          // below a readable title, at which point the actions wrap under.
          flex: "1 1 12em",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: token.paddingXXS,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: token.paddingXS, rowGap: token.paddingXXS, minWidth: 0 }}>
          <Typography.Title
            level={props.level ?? 3}
            {...(props.id !== undefined ? { id: props.id } : {})}
            style={{ margin: 0, minWidth: 0, ...wrapping(props.truncate) }}
          >
            {props.title}
          </Typography.Title>
          {props.badge !== undefined && (
            <span data-stapel-card-header-badge="" style={{ flex: "none", display: "inline-flex" }}>
              {props.badge}
            </span>
          )}
        </div>
        {props.subtitle !== undefined && (
          <Typography.Text type="secondary" style={wrapping(false)}>
            {props.subtitle}
          </Typography.Text>
        )}
      </div>
      {props.actions !== undefined && (
        <div
          data-stapel-card-header-actions=""
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: token.paddingXS,
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          {props.actions}
        </div>
      )}
    </div>
  );
}

export interface ListRowProps {
  /** An avatar, an icon, a thumbnail. Fixed width; the text column shrinks. */
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  /** One or more muted lines under the title (a date, an address). */
  readonly meta?: ReactNode;
  /** A status chip on the title line — reserves its own space. */
  readonly badge?: ReactNode;
  /** The row's actions (`RowActions`), under the text on a phone, in their
   * own column beside it when there is room. */
  readonly actions?: ReactNode;
  /** A value or a chevron at the end of the row. */
  readonly trailing?: ReactNode;
  /** Single-line title. Off by default. */
  readonly truncate?: boolean;
  /** The element. Default `"div"`; inside a `<ul>` pass `"li"`. */
  readonly as?: ElementType;
  readonly selected?: boolean;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * One row of a list. Stamped `data-stapel-list-row`. On a phone the whole
 * row is at least the touch floor tall.
 *
 * ```tsx
 * <ListRow leading={<Avatar/>} title={key.name} badge={<StatusTag status="info">…</StatusTag>}
 *   meta={fmt.relative(key.lastUsedAt)} actions={<RowActions actions={[rename, remove]} />} />
 * ```
 */
export function ListRow(props: ListRowProps): ReactElement {
  const { token } = antdTheme.useToken();
  const phone = useDialogSurface() === "sheet";
  const Element: ElementType = props.as ?? "div";
  const columns = [
    props.leading !== undefined ? "auto" : null,
    "minmax(0, 1fr)",
    props.actions !== undefined && !phone ? "auto" : null,
    props.trailing !== undefined ? "auto" : null,
  ]
    .filter((c): c is string => c !== null)
    .join(" ");
  return (
    <Element
      data-stapel-list-row=""
      {...(props.selected === true ? { "aria-current": "true" } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        alignItems: "center",
        columnGap: token.padding,
        rowGap: token.paddingXS,
        minWidth: 0,
        minHeight: phone ? PHONE_CONTROL_HEIGHT : undefined,
        paddingBlock: token.paddingXS,
        ...(props.selected === true ? { background: token.colorPrimaryBg } : {}),
        ...props.style,
      }}
    >
      {props.leading !== undefined && (
        <div data-stapel-list-row-leading="" style={{ flex: "none", display: "flex" }}>
          {props.leading}
        </div>
      )}
      <div data-stapel-list-row-text="" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: token.paddingXXS }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: token.paddingXS, rowGap: token.paddingXXS, minWidth: 0 }}>
          <Typography.Text strong style={{ minWidth: 0, ...wrapping(props.truncate) }}>
            {props.title}
          </Typography.Text>
          {props.badge !== undefined && (
            <span data-stapel-list-row-badge="" style={{ flex: "none", display: "inline-flex" }}>
              {props.badge}
            </span>
          )}
        </div>
        {props.meta !== undefined && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, ...wrapping(false) }}>
            {props.meta}
          </Typography.Text>
        )}
        {props.actions !== undefined && phone && (
          <div data-stapel-list-row-actions="" style={{ marginTop: token.paddingXXS, minWidth: 0 }}>
            {props.actions}
          </div>
        )}
      </div>
      {props.actions !== undefined && !phone && (
        <div data-stapel-list-row-actions="" style={{ minWidth: 0 }}>
          {props.actions}
        </div>
      )}
      {props.trailing !== undefined && (
        <div data-stapel-list-row-trailing="" style={{ flex: "none", display: "flex", alignItems: "center" }}>
          {props.trailing}
        </div>
      )}
    </Element>
  );
}
