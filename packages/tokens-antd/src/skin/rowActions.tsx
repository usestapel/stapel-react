/**
 * `RowActions` — a row's actions, as buttons that wrap between themselves
 * and never inside a word, with the overflow in a sheet on a phone.
 *
 * The visual pass measured the two failure shapes: on a phone, four
 * `Rename Remove Sign out Switch off` links jammed into a 390px row until a
 * label broke mid-word; on a desktop, the same actions split across 560px
 * with a gated reason stranded between them. Neither is a per-pair layout
 * problem. A row has N actions; a phone shows the one that matters and
 * puts the rest one tap away in a sheet (44px rows, reasons beside the ones
 * that are off); a desktop shows them all, each label on one line, wrapping
 * as a group.
 *
 * Gated actions carry their `ActionAvailability`: inline they render through
 * `GatedButton` (reason beside), in the sheet as a block button with the
 * reason under it. A `PaneGate` above collects identical reasons once.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Typography, theme as antdTheme } from "antd";
import { STAPEL_UI_KEYS } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { SkinDialog, useDialogSurface } from "./dialog.js";
import { useSubstrateI18n } from "./floor.js";
import { GatedButton } from "./gated.js";

export interface RowAction {
  /** Stable key; also the default test id suffix. */
  readonly key: string;
  /** The label — translated by the caller. */
  readonly label: ReactNode;
  readonly onClick?: () => void;
  /** Navigate instead of act. */
  readonly href?: string;
  /** A destructive action: red, and never the one a phone shows first
   * unless it is the only one. */
  readonly danger?: boolean;
  /** The row's main action: filled, and the one a phone keeps inline. */
  readonly primary?: boolean;
  readonly icon?: ReactNode;
  /** Switched off with a stated reason. */
  readonly gate?: ActionAvailability;
  readonly testId?: string;
  /** Accessible name for an icon-only action. */
  readonly ariaLabel?: string;
}

export interface RowActionsProps {
  readonly actions: readonly RowAction[];
  /**
   * How many actions a PHONE keeps inline before the rest go to the sheet.
   * Default `1`. A desktop always shows them all. The primary action (or
   * the first non-danger one) is the one kept.
   */
  readonly inline?: number;
  /** `"end"` (default) aligns to the trailing edge; `"start"` to the leading one. */
  readonly align?: "start" | "end";
  /** Title of the overflow sheet. Default: the floor's "Actions". */
  readonly sheetTitle?: ReactNode;
  /** Label of the overflow control. Default: the floor's "More". */
  readonly moreLabel?: string;
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/** Order for a phone: primary first, then the rest in declared order, danger last. */
function phoneOrder(actions: readonly RowAction[]): readonly RowAction[] {
  const primary = actions.filter((a) => a.primary === true);
  const plain = actions.filter((a) => a.primary !== true && a.danger !== true);
  const danger = actions.filter((a) => a.primary !== true && a.danger === true);
  return [...primary, ...plain, ...danger];
}

function ActionButton(props: {
  readonly action: RowAction;
  readonly block: boolean;
  readonly size: "small" | "middle";
  readonly afterClick?: () => void;
}): ReactElement {
  const { action, block, size } = props;
  const onClick = (): void => {
    action.onClick?.();
    props.afterClick?.();
  };
  const common = {
    size,
    block,
    ...(action.href !== undefined ? { href: action.href } : {}),
    ...(action.icon !== undefined ? { icon: action.icon } : {}),
    ...(action.ariaLabel !== undefined ? { "aria-label": action.ariaLabel } : {}),
    ...(action.danger === true ? { danger: true } : {}),
    type: action.primary === true ? ("primary" as const) : ("default" as const),
    style: { whiteSpace: "nowrap" as const, ...(block ? { justifyContent: "flex-start" } : {}) },
    onClick,
  };
  const testId = action.testId ?? action.key;
  if (action.gate !== undefined) {
    return (
      <GatedButton gate={action.gate} layout={block ? "stack" : "inline"} testId={testId} {...common}>
        {action.label}
      </GatedButton>
    );
  }
  return (
    <Button
      data-testid={testId}
      data-analytics="none"
      data-analytics-reason="passthrough — the caller's onClick carries the tracked action"
      {...common}
    >
      {action.label}
    </Button>
  );
}

/**
 * Stamped `data-stapel-row-actions="inline|overflow"` (the latter when a
 * phone has folded some into the sheet). The sheet's body is stamped
 * `data-stapel-row-actions-sheet`.
 *
 * ```tsx
 * <RowActions actions={[
 *   { key: "rename", label: t(K.rename), onClick: rename },
 *   { key: "remove", label: t(K.remove), onClick: remove, danger: true, gate: gates.remove },
 * ]} />
 * ```
 */
export function RowActions(props: RowActionsProps): ReactElement | null {
  const { t } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const phone = useDialogSurface() === "sheet";
  const [open, setOpen] = useState(false);
  if (props.actions.length === 0) return null;

  const keep = Math.max(1, props.inline ?? 1);
  const ordered = phone ? phoneOrder(props.actions) : props.actions;
  const folded = phone && ordered.length > keep;
  const shown = folded ? ordered.slice(0, keep) : ordered;
  const rest = folded ? ordered.slice(keep) : [];
  const size = phone ? "middle" : "small";
  const moreLabel = props.moreLabel ?? t(STAPEL_UI_KEYS.more);
  const dismissLabel = t(STAPEL_UI_KEYS.dismiss);

  return (
    <div
      data-stapel-row-actions={folded ? "overflow" : "inline"}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: props.align === "start" ? "flex-start" : "flex-end",
        gap: token.paddingXS,
        minWidth: 0,
        ...props.style,
      }}
    >
      {shown.map((action) => (
        <ActionButton key={action.key} action={action} block={false} size={size} />
      ))}
      {folded && (
        <>
          <Button
            size={size}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            data-analytics="none"
            data-analytics-reason="local-ui-open-actions-sheet"
            {...(props.testId !== undefined ? { "data-testid": `${props.testId}-more` } : {})}
            style={{ whiteSpace: "nowrap" }}
          >
            {moreLabel}
          </Button>
          <SkinDialog
            open={open}
            onClose={() => setOpen(false)}
            title={
              <Typography.Text strong>{props.sheetTitle ?? t(STAPEL_UI_KEYS.actions)}</Typography.Text>
            }
            dismissLabel={dismissLabel}
            {...(props.testId !== undefined ? { "data-testid": `${props.testId}-sheet` } : {})}
          >
            <div
              data-stapel-row-actions-sheet=""
              style={{ display: "flex", flexDirection: "column", gap: token.paddingXS }}
            >
              {rest.map((action) => (
                <ActionButton
                  key={action.key}
                  action={action}
                  block
                  size="middle"
                  afterClick={() => setOpen(false)}
                />
              ))}
            </div>
          </SkinDialog>
        </>
      )}
    </div>
  );
}
