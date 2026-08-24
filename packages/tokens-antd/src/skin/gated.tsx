/**
 * `GatedControl` / `GatedButton` — a control and the sentence that explains
 * it when it is off, rendered TOGETHER, as text.
 *
 * `@stapel/core`'s `actionGate` made "blocked, reason unknown" unspellable:
 * every switched-off control carries an i18n key saying why. The skins then
 * put that reason in a `Tooltip` — and a disabled antd button receives no
 * pointer events and is not focusable, so a tooltip on it is a reason nobody
 * can read, on any device, and on a phone there is no hover to begin with.
 * `listings-react` wrote a `GatedButton` that did exactly this six times on
 * one pane; `search-react` copied it. This is that component, with the
 * reason where a person and a screen reader both find it: visible beside the
 * control, linked by `aria-describedby`.
 *
 * Never a tooltip. Icons are self-evident plus `aria-label`; reasons are
 * sentences beside controls (house rule, `stapel/no-tooltip-in-skin`).
 */
import { useId } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Typography, theme as antdTheme } from "antd";
import type { ButtonProps } from "antd";
import { useActionGate } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";

/** What the render prop hands the control: bind both straight to it. */
export interface GatedControlBinding {
  readonly disabled: boolean;
  /** The id of the visible reason, exactly when `disabled` — so assistive
   * tech reads the sentence with the control's name. */
  readonly "aria-describedby": string | undefined;
}

export interface GatedControlProps {
  readonly gate: ActionAvailability;
  /** The control. Spread the binding onto it. */
  readonly children: (binding: GatedControlBinding) => ReactNode;
  /** `"stack"` (default): the reason under the control. `"inline"`: beside
   * it, for a toolbar row. */
  readonly layout?: "stack" | "inline";
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/**
 * The generic form: any control (an antd `Switch`, an `Upload`, a host's own
 * button) plus its reason. Stamped `data-stapel-gated="available|blocked"`.
 *
 * ```tsx
 * <GatedControl gate={upload}>
 *   {(bind) => <Upload {...bind}><Button {...bind}>{t(KEYS.upload)}</Button></Upload>}
 * </GatedControl>
 * ```
 */
export function GatedControl(props: GatedControlProps): ReactElement {
  const view = useActionGate(props.gate);
  const { token } = antdTheme.useToken();
  const reasonId = useId();
  const inline = props.layout === "inline";
  return (
    <div
      data-stapel-gated={view.disabled ? "blocked" : "available"}
      {...(props.className !== undefined ? { className: props.className } : {})}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
      style={{
        display: inline ? "inline-flex" : "flex",
        flexDirection: inline ? "row" : "column",
        flexWrap: "wrap",
        alignItems: inline ? "baseline" : "flex-start",
        gap: inline ? token.paddingXS : token.paddingXXS,
        ...props.style,
      }}
    >
      {props.children({
        disabled: view.disabled,
        "aria-describedby": view.disabled ? reasonId : undefined,
      })}
      {view.reason !== undefined && (
        <Typography.Text
          id={reasonId}
          type="secondary"
          data-stapel-gated-reason=""
          style={{ fontSize: token.fontSizeSM }}
        >
          {view.reason}
        </Typography.Text>
      )}
      {view.detail !== undefined && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {view.detail}
        </Typography.Text>
      )}
    </div>
  );
}

export interface GatedButtonProps
  extends Omit<ButtonProps, "disabled" | "children" | "title">,
    Pick<GatedControlProps, "gate" | "layout" | "testId"> {
  /** The label. An icon-only button passes `aria-label` as well. */
  readonly children: ReactNode;
  /** Layout styles for the wrapper (the button keeps antd's `style`). */
  readonly wrapperStyle?: CSSProperties;
}

/**
 * The common case: an antd `Button` gated by an `ActionAvailability`. Every
 * other `Button` prop passes through; `disabled` and `title` do not — the
 * gate decides the first, and the second was the tooltip.
 *
 * ```tsx
 * <GatedButton gate={actions.archive} danger onClick={archive} testId="archive">
 *   {t(KEYS.archive)}
 * </GatedButton>
 * ```
 *
 * The click's analytics outcome belongs to the caller: pass your own
 * `data-analytics` props, or leave the passthrough marker in place and track
 * one level up.
 */
export function GatedButton(props: GatedButtonProps): ReactElement {
  const { gate, layout, testId, children, wrapperStyle, ...button } = props;
  return (
    <GatedControl
      gate={gate}
      {...(layout !== undefined ? { layout } : {})}
      {...(testId !== undefined ? { testId: `${testId}-gate` } : {})}
      {...(wrapperStyle !== undefined ? { style: wrapperStyle } : {})}
    >
      {(bind) => (
        <Button
          data-analytics="none"
          data-analytics-reason="passthrough — the caller's onClick carries the tracked action"
          {...(testId !== undefined ? { "data-testid": testId } : {})}
          {...button}
          {...bind}
        >
          {children}
        </Button>
      )}
    </GatedControl>
  );
}
