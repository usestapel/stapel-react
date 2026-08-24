/**
 * `<SecurityList/>` / `<SecurityListRow/>` — the one shape every credential or
 * device row on the security page uses.
 *
 * ## The defect this replaces
 *
 * Both list rows (passkeys, sessions) were an ad-hoc
 * `<Flex justify="space-between" wrap>`: meta on the left, actions on the
 * right. `wrap` on a space-between row does not degrade, it TIPS — whichever
 * row's meta happens to be a few characters wider pushes its action onto a
 * second line while the row above keeps its action inline. The visual pass
 * caught exactly that on a phone: the same component at the same viewport with
 * `Remove` in a different place on each row (C5).
 *
 * The fix is not a better guess at when to wrap. It is to stop guessing: the
 * row has a DECLARED action slot, and the switch from side-by-side to stacked
 * happens at one width for every row at once. That width is the row's OWN
 * inline size (a container query), not the viewport — a settings card in a
 * narrow column on a wide screen is narrow, and a viewport media query has
 * never known that. It is the house's element-width rule, stated in the one
 * place that can enforce it for both lists.
 *
 * ## Rhythm
 *
 * `<SecurityList/>` draws a hairline between entries. Two rows of muted
 * secondary text with no separator read as one paragraph, which is how two
 * passkeys became "one block of text" in the review.
 *
 * The stylesheet is emitted once for the whole document: React 19 hoists and
 * de-duplicates a `<style href precedence>` node, so N rows cost one rule set,
 * and the class names are static rather than generated — a component that
 * needs a container query cannot express one as an inline style, and measuring
 * every row with a `ResizeObserver` to re-derive what CSS already knows is the
 * more expensive way to be less correct.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";

/**
 * Below this row width the actions stack under the meta — for every row in the
 * list at once, because the query reads the row's own inline size.
 */
const STACK_BELOW = "22rem";

const ROW = "stapel-auth-security-row";
const LIST = "stapel-auth-security-list";

const ROW_CSS = `
.${LIST} > * + * {
  border-top: 1px solid var(--auth-row-rule, currentColor);
  margin-top: ${String(spacing[3])}px;
  padding-top: ${String(spacing[3])}px;
}
.${ROW} { container-type: inline-size; width: 100%; }
.${ROW}-inner {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${String(spacing[4])}px;
  width: 100%;
}
.${ROW}-actions {
  display: flex;
  gap: ${String(spacing[2])}px;
  align-items: center;
  flex: none;
}
@container (max-width: ${STACK_BELOW}) {
  .${ROW}-inner { flex-direction: column; align-items: stretch; gap: ${String(spacing[2])}px; }
  .${ROW}-actions { justify-content: flex-start; }
}
`;

/** The hoisted rule set. Rendered by every row; the document keeps one copy. */
function RowStyles(): ReactElement {
  return (
    <style href={ROW} precedence="default">
      {ROW_CSS}
    </style>
  );
}

export interface SecurityListRowProps {
  /** The row's primary line — a device or credential name. */
  readonly title: ReactNode;
  /** Chips beside the title (kind, "this device", "unrecognized"). */
  readonly badges?: ReactNode;
  /** Muted supporting lines: what it is, when it arrived, when last used. */
  readonly meta?: ReactNode;
  /** The row's controls. A declared slot, never inferred from wrapping. */
  readonly actions?: ReactNode;
  readonly "data-testid"?: string;
}

/** One row: title + badges + meta on one side, the action slot on the other. */
export function SecurityListRow(props: SecurityListRowProps): ReactElement {
  return (
    <div
      className={ROW}
      data-stapel-security-row=""
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <RowStyles />
      <div className={`${ROW}-inner`}>
        <Flex vertical gap={spacing[1]} style={{ minWidth: 0 }}>
          <Flex align="center" gap="small" wrap>
            <Typography.Text strong>{props.title}</Typography.Text>
            {props.badges}
          </Flex>
          {props.meta}
        </Flex>
        {props.actions !== undefined && (
          <div className={`${ROW}-actions`}>{props.actions}</div>
        )}
      </div>
    </div>
  );
}

export interface SecurityListProps {
  readonly children: ReactNode;
  /**
   * The hairline colour. Callers pass antd's `colorBorderSecondary` from
   * `theme.useToken()` so the rule follows the live theme; the CSS falls back
   * to `currentColor` when nothing is passed, which is visible rather than
   * invisible — a separator that silently disappears in dark mode is how this
   * class of defect hides.
   */
  readonly ruleColor?: string;
  readonly "data-testid"?: string;
}

/** The rows, separated by one hairline each. */
export function SecurityList(props: SecurityListProps): ReactElement {
  return (
    <div
      className={LIST}
      style={
        props.ruleColor !== undefined
          ? ({
              width: "100%",
              "--auth-row-rule": props.ruleColor,
            } as CSSProperties)
          : { width: "100%" }
      }
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <RowStyles />
      {props.children}
    </div>
  );
}
