/**
 * `PaneGate` — a pane-level refusal, rendered ONCE.
 *
 * A moderation queue shown to a non-moderator rendered six live `Reason`
 * inputs, twelve disabled buttons and the same refusal sentence six times
 * (visual pass NC-GATEDNOISE, VC-B1). The controls were each correctly
 * gated; what was wrong is that a screen-level answer — "you are not a
 * moderator of this item" — was being given control by control. When the
 * gate is the PANE's, the pane says so once and the controls never render.
 *
 * Two jobs, one component:
 *
 *  1. **Blocked:** render the refusal panel — the gate's reason (a sentence
 *     the pair translated), its technical detail, an optional `action` (the
 *     sign-in door, a link to settings) — and NOT the children. `preview`
 *     shows read-only content under it where the person may still look
 *     (the reviews themselves) but not act. There is no "Try again": a
 *     refusal is not a fault (audit N9).
 *  2. **Available:** render the children inside a `GateReasonScope`, so
 *     per-control gates inside the pane print each distinct reason once,
 *     in one footnote, instead of once per control.
 */
import { useCallback, useId, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Typography, theme as antdTheme } from "antd";
import { useActionGate } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { GateReasonScopeContext } from "./gated.js";
import type { GateReasonScope } from "./gated.js";

export interface PaneGateProps {
  readonly gate: ActionAvailability;
  /** The pane — rendered only when the gate is available. */
  readonly children: ReactNode;
  /** A heading for the refusal ("Moderation"). Optional: the reason is a
   * complete sentence on its own. */
  readonly title?: ReactNode;
  /** The way forward, when there is one: a sign-in door, a request-access
   * link. Never a retry. */
  readonly action?: ReactNode;
  /** Read-only content shown under the refusal (what the person may see
   * but not act on). */
  readonly preview?: ReactNode;
  /** Where the pooled per-control reasons go when the pane IS available:
   * a footnote under the children (default) or a note above them. */
  readonly reasonsPlacement?: "top" | "bottom";
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/** A short, stable, attribute-safe hash of a sentence for an element id. */
function hashReason(reason: string): string {
  let h = 5381;
  for (let i = 0; i < reason.length; i += 1) h = ((h << 5) + h + reason.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface PooledReason {
  readonly reason: string;
  readonly detail: string | undefined;
  readonly count: number;
}

/**
 * Stamped `data-stapel-pane-gate="blocked|available"`. The refusal panel is
 * `role="status"`; the pooled reasons block is `data-stapel-gate-reasons`
 * and each sentence in it `data-stapel-gated-reason` with the id the
 * controls' `aria-describedby` point at.
 *
 * ```tsx
 * <PaneGate gate={moderate} action={signInDoor} preview={<ReviewList readOnly />}>
 *   <ModerationQueue />
 * </PaneGate>
 * ```
 */
export function PaneGate(props: PaneGateProps): ReactElement {
  const view = useActionGate(props.gate);
  const { token } = antdTheme.useToken();
  const scopeId = useId();
  const [pooled, setPooled] = useState<ReadonlyMap<string, PooledReason>>(new Map());

  const idFor = useCallback(
    (reason: string): string => `${scopeId}-${hashReason(reason)}`,
    [scopeId]
  );
  const register = useCallback((reason: string, detail: string | undefined): (() => void) => {
    setPooled((prev) => {
      const next = new Map(prev);
      const had = next.get(reason);
      next.set(reason, { reason, detail: had?.detail ?? detail, count: (had?.count ?? 0) + 1 });
      return next;
    });
    return () => {
      setPooled((prev) => {
        const had = prev.get(reason);
        if (had === undefined) return prev;
        const next = new Map(prev);
        if (had.count <= 1) next.delete(reason);
        else next.set(reason, { ...had, count: had.count - 1 });
        return next;
      });
    };
  }, []);
  const scope = useMemo<GateReasonScope>(() => ({ idFor, register }), [idFor, register]);

  const attrs = {
    ...(props.className !== undefined ? { className: props.className } : {}),
    ...(props.testId !== undefined ? { "data-testid": props.testId } : {}),
  };

  if (view.disabled) {
    return (
      <div data-stapel-pane-gate="blocked" {...attrs} style={props.style}>
        <div
          role="status"
          data-stapel-pane-gate-refusal=""
          style={{
            display: "flex",
            flexDirection: "column",
            gap: token.paddingXS,
            padding: token.padding,
            borderRadius: token.borderRadiusLG,
            border: `${String(token.lineWidth)}px ${token.lineType} ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          {props.title !== undefined && <Typography.Text strong>{props.title}</Typography.Text>}
          <Typography.Text data-stapel-gated-reason="">{view.reason}</Typography.Text>
          {view.detail !== undefined && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {view.detail}
            </Typography.Text>
          )}
          {props.action !== undefined && <div>{props.action}</div>}
        </div>
        {props.preview !== undefined && (
          <div data-stapel-pane-gate-preview="" style={{ marginTop: token.padding }}>
            {props.preview}
          </div>
        )}
      </div>
    );
  }

  const reasons =
    pooled.size > 0 ? (
      <div
        data-stapel-gate-reasons=""
        style={{ display: "flex", flexDirection: "column", gap: token.paddingXXS }}
      >
        {[...pooled.values()].map((entry) => (
          <Typography.Text
            key={entry.reason}
            id={idFor(entry.reason)}
            type="secondary"
            data-stapel-gated-reason=""
            style={{ fontSize: token.fontSizeSM }}
          >
            {entry.reason}
            {entry.detail !== undefined ? ` ${entry.detail}` : ""}
          </Typography.Text>
        ))}
      </div>
    ) : null;
  const top = props.reasonsPlacement === "top";

  return (
    <GateReasonScopeContext.Provider value={scope}>
      <div
        data-stapel-pane-gate="available"
        {...attrs}
        style={{ display: "flex", flexDirection: "column", gap: token.paddingSM, ...props.style }}
      >
        {top && reasons}
        {props.children}
        {!top && reasons}
      </div>
    </GateReasonScopeContext.Provider>
  );
}
