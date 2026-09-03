/**
 * `GatedControl` / `GatedButton` — a control and the sentence that explains
 * it when it is off, rendered TOGETHER, as text, on a control that is still
 * ALIVE.
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
 * ── The second half of the same defect ─────────────────────────────────────
 *
 * Moving the sentence out of the tooltip was not enough, because the control
 * itself was still html-`disabled`, and this file's own docs told 20 pairs to
 * spread that straight onto their controls. An html-disabled element fires no
 * events at all: it cannot be clicked, cannot take focus, cannot be described
 * to a screen reader that never reaches it, and cannot carry the one gesture
 * that matters — the tap that should open the sign-in door standing behind
 * the gate. Deployed symptom: an anonymous visitor taps the favourite heart
 * and NOTHING happens — no sentence, no door, no acknowledgement that the tap
 * landed (walker defects D45/D72).
 *
 * So a blocked control is now **semantically disabled and interactively
 * alive**, which is the `aria-disabled` pattern and the anatomy
 * `listings-react`'s `GateReasonPopover` already proved:
 *
 *  - `aria-disabled="true"`, never html `disabled` — assistive tech announces
 *    it as unavailable, the browser keeps delivering events;
 *  - it stays in the tab order — dropping html `disabled` is what puts it
 *    back there — so the reason is reachable by keyboard and not only by a
 *    pointer. (A control that is not natively focusable, a gated `div`, still
 *    needs its own `tabIndex={0}`; every antd control renders a real one.)
 *  - the ACTION is suppressed here, in a capture-phase wrapper, not by the
 *    browser: the caller's `onClick`, keyboard activation, typing, paste and
 *    drop never reach the control while the gate is shut. The caller writes
 *    its handler exactly as if the gate did not exist;
 *  - the activation is handed back through
 *    {@link GatedControlProps.onBlockedActivate}, so the pair can open its
 *    door on the very gesture that used to fall into a hole;
 *  - the sentence stays where it always was — visible text, `aria-describedby`
 *    — and where it is POOLED into a `PaneGate` footnote (so it is not
 *    printed once per control), the gesture brings a `role="status"` copy of
 *    it back to the control it belongs to.
 *
 * ── The readiness-signal hazard this creates, and its cure ────────────────
 *
 * A blocked control is no longer html-`disabled`, so `element.disabled` is
 * now permanently `false` on every gated control in the fleet. Any test that
 * used it as a READINESS signal — `await waitFor(() => expect(save.disabled)
 * .toBe(false))`, meaning "wait until this is allowed" — returns instantly
 * and mis-times SILENTLY: every assertion after it reads an unseeded
 * component, and the failure looks like broken product logic rather than a
 * gate that had not opened yet. One pair's suite went from green to 21
 * failures across unrelated files on exactly this.
 *
 * The cure is the stamp this component already writes, which is what such a
 * wait was always trying to ask:
 *
 * ```ts
 * await waitFor(() =>
 *   expect(screen.getByTestId("save-gate").getAttribute("data-stapel-gated"))
 *     .toBe("available")
 * );
 * ```
 *
 * `data-stapel-gated="available" | "blocked"` is on the wrapper of EVERY
 * gated control (`GatedButton` names it `<testId>-gate`), in all three
 * `whenBlocked` modes. For a point assertion on one element, read
 * `aria-disabled`. Never `disabled`.
 *
 * {@link GatedControlProps.whenBlocked} holds the two deliberate opt-outs:
 * `"inert"` for the rare control that must be genuinely switched off at the
 * browser level, and `"annotate"` for a gate that reports on the VALUE rather
 * than refusing the person. Neither is the default, because a control nobody
 * can reach cannot say why.
 *
 * Never a tooltip. Icons are self-evident plus `aria-label`; reasons are
 * sentences beside controls (house rule, `stapel/no-tooltip-in-skin`).
 */
import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import type {
  Context,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  ReactNode,
  SyntheticEvent,
} from "react";
import { ConfigProvider, Typography, theme as antdTheme } from "antd";
import { SkinButton as Button } from "./components.js";
import type { ButtonProps } from "antd";
import { useActionGate } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";

/**
 * A scope that renders each distinct reason ONCE for every gated control
 * inside it (`PaneGate` provides one). The visual pass found the same
 * sentence printed six times on one screen — once per disabled control per
 * row (VC-B1). Inside a scope a `GatedControl` registers its reason and
 * renders no text of its own; its `aria-describedby` points at the scope's
 * single copy, so assistive tech still reads the sentence with the control.
 */
export interface GateReasonScope {
  /** The id the scope's copy of this reason has — stable per reason. */
  readonly idFor: (reason: string) => string;
  /** Register a reason (with its detail) for the scope to render. Returns
   * the unregister. */
  readonly register: (reason: string, detail: string | undefined) => () => void;
}

export const GateReasonScopeContext: Context<GateReasonScope | null> =
  createContext<GateReasonScope | null>(null);

/**
 * Keys that must still reach a blocked control: leaving it, dismissing
 * whatever is around it, and the modifiers held while doing either.
 * Everything else — activation, typing, arrow keys that would open a
 * dropdown — is the action, and the action is what the gate refuses.
 */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  "Tab",
  "Escape",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
]);

/** Keys a browser turns into an activation on a control in the tab order. */
const ACTIVATION_KEYS: ReadonlySet<string> = new Set(["Enter", " ", "Spacebar"]);

function joinClassNames(...parts: readonly (string | undefined | false)[]): string | undefined {
  const kept = parts.filter((part): part is string => typeof part === "string" && part !== "");
  return kept.length === 0 ? undefined : kept.join(" ");
}

/**
 * What the render prop hands the control: spread it onto the control, ALL of
 * it, and write your `onClick` as though the gate were open — the gate
 * suppresses the action itself.
 *
 * `disabled` is `false` while the gate is shut, and that is the fix, not a
 * bug: html `disabled` is what made every gated control in the fleet inert.
 * It is `true` only under `whenBlocked: "inert"`.
 */
export interface GatedControlBinding {
  /** html `disabled` — `true` ONLY under `whenBlocked: "inert"`. */
  readonly disabled: boolean;
  /** `true` exactly while the gate is shut and the control is alive. */
  readonly "aria-disabled": true | undefined;
  /** The id of the reason's visible copy, exactly when the gate is shut — so
   * assistive tech reads the sentence with the control's name. */
  readonly "aria-describedby": string | undefined;
}

export interface GatedControlProps {
  readonly gate: ActionAvailability;
  /** The control. Spread the binding onto it. */
  readonly children: (binding: GatedControlBinding) => ReactNode;
  /** `"stack"` (default): the reason under the control. `"inline"`: beside
   * it, for a toolbar row. */
  readonly layout?: "stack" | "inline";
  /**
   * The blocked control was activated — clicked, tapped, or Enter/Space'd.
   * The action itself did NOT run. This is where a sign-in door opens, or a
   * pair records that someone tried.
   */
  readonly onBlockedActivate?: (() => void) | undefined;
  /**
   * What "blocked" does to the control. Default `"live"`.
   *
   *  - `"live"` — `aria-disabled`, focusable, events still arriving; the
   *    ACTION is suppressed here and surfaces as `onBlockedActivate`. This is
   *    what lets a blocked control disclose its reason and open a door.
   *  - `"inert"` — html `disabled`. The control fires nothing at all, so it
   *    can neither disclose nor be reached. The opt-out for the rare place
   *    where a live control would be actively wrong.
   *  - `"annotate"` — the control stays fully usable and only GAINS the
   *    sentence and its `aria-describedby`. For a gate that judges the VALUE
   *    rather than refusing the person: a field that is invalid must stay
   *    editable so it can be fixed, and a sort whose one unavailable option
   *    is marked off must still pick the others.
   */
  readonly whenBlocked?: "live" | "inert" | "annotate";
  readonly style?: CSSProperties | undefined;
  readonly className?: string;
  readonly testId?: string | undefined;
}

/** Suppress an event outright: neither the control nor the caller sees it. */
function swallow(event: SyntheticEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * The generic form: any control (an antd `Switch`, an `Upload`, a host's own
 * button) plus its reason. Stamped `data-stapel-gated="available|blocked"`,
 * and `data-stapel-gated-live=""` while a blocked control is alive.
 *
 * ```tsx
 * <GatedControl gate={upload} onBlockedActivate={signIn.open}>
 *   {(bind) => <Upload {...bind}><Button {...bind}>{t(KEYS.upload)}</Button></Upload>}
 * </GatedControl>
 * ```
 *
 * Write `onClick` as if the gate were open. While it is shut the click never
 * arrives: it is swallowed in the capture phase, `onBlockedActivate` fires
 * instead, and the reason is disclosed at the control.
 */
export function GatedControl(props: GatedControlProps): ReactElement {
  const view = useActionGate(props.gate);
  const { token } = antdTheme.useToken();
  const ownId = useId();
  const scope = useContext(GateReasonScopeContext);
  const inline = props.layout === "inline";
  const reason = view.reason;
  const detail = view.detail;
  const [revealed, setRevealed] = useState(false);
  // Inside a scope the reason is the scope's to render, once.
  useEffect(() => {
    if (scope === null || reason === undefined) return undefined;
    return scope.register(reason, detail);
  }, [scope, reason, detail]);
  const pooled = scope !== null && reason !== undefined;
  const reasonId = pooled ? scope.idFor(reason) : ownId;
  const mode = props.whenBlocked ?? "live";
  const live = view.disabled && mode === "live";

  const onBlockedActivate = props.onBlockedActivate;
  // The disclosure only has work to do where the sentence is POOLED — where
  // it is not, the visible copy is already standing beside this control.
  const disclose = useCallback((): void => {
    if (pooled) setRevealed(true);
  }, [pooled]);
  const activate = useCallback((): void => {
    if (pooled) setRevealed(true);
    onBlockedActivate?.();
  }, [pooled, onBlockedActivate]);

  // The capture phase is the whole mechanism: these run BEFORE the control's
  // own handlers on the same event, so `stopPropagation` keeps the caller's
  // `onClick` (and antd's internal onChange) from ever seeing it — while the
  // element itself stays focusable and keeps firing focus and hover.
  const suppression = live
    ? {
        onClickCapture: (event: SyntheticEvent): void => {
          swallow(event);
          activate();
        },
        onKeyDownCapture: (event: ReactKeyboardEvent): void => {
          if (NAVIGATION_KEYS.has(event.key)) return;
          swallow(event);
          if (ACTIVATION_KEYS.has(event.key)) activate();
        },
        // Typing, IME composition, paste and drop all land as `beforeinput`
        // on a text control that is no longer html-disabled.
        onBeforeInputCapture: swallow,
        onPasteCapture: swallow,
        onCutCapture: swallow,
        onDropCapture: swallow,
        onFocusCapture: disclose,
        onMouseEnter: disclose,
      }
    : {};

  return (
    <div
      data-stapel-gated={view.disabled ? "blocked" : "available"}
      {...(live ? { "data-stapel-gated-live": "" } : {})}
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
      {/* `display: contents` — the wrapper carries the listeners and no box,
          so it cannot move a single pixel of any of the 20 pairs' layouts.
          It is rendered in BOTH states so that a gate flipping open does not
          remount the control and throw away its focus or its value. */}
      <span style={{ display: "contents" }} {...suppression}>
        {props.children({
          disabled: view.disabled && mode === "inert",
          "aria-disabled": live ? true : undefined,
          "aria-describedby": view.disabled ? reasonId : undefined,
        })}
      </span>
      {/* The pooled sentence, brought back to the control by the gesture. The
          standing copy lives in the pane's footnote and keeps the id; this
          one is announced, not addressed. */}
      {pooled && revealed && (
        <Typography.Text
          role="status"
          type="secondary"
          data-stapel-gated-reason=""
          style={{ fontSize: token.fontSizeSM }}
        >
          {reason}
          {detail !== undefined ? ` ${detail}` : ""}
        </Typography.Text>
      )}
      {view.reason !== undefined && !pooled && (
        <Typography.Text
          id={reasonId}
          type="secondary"
          data-stapel-gated-reason=""
          style={{ fontSize: token.fontSizeSM }}
        >
          {view.reason}
        </Typography.Text>
      )}
      {view.detail !== undefined && !pooled && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {view.detail}
        </Typography.Text>
      )}
    </div>
  );
}

export interface GatedButtonProps
  extends Omit<ButtonProps, "disabled" | "children" | "title">,
    Pick<
      GatedControlProps,
      "gate" | "layout" | "testId" | "onBlockedActivate" | "whenBlocked"
    > {
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
 * Write `onClick` for the open gate. A blocked button LOOKS disabled — it
 * carries antd's own `-disabled` class, so nothing about the screen changes —
 * but it is focusable and it fires; the click is swallowed and surfaces as
 * `onBlockedActivate` instead.
 *
 * The click's analytics outcome belongs to the caller: pass your own
 * `data-analytics` props, or leave the passthrough marker in place and track
 * one level up.
 */
/**
 * antd's own "looks unavailable" paint for a button, as a class name.
 *
 * antd keys that paint on `:disabled, &.<prefix>-disabled`, so the class alone
 * gives a LIVE control the exact look of a dead one — and unlike the html
 * attribute it sets no `pointer-events`, so the gesture still arrives.
 * {@link GatedButton} applies it for you; a render-prop call site that paints
 * its own button reaches for it here rather than inventing a second grey.
 *
 * ```tsx
 * const blockedLook = useBlockedButtonClassName();
 * <GatedControl gate={atMax}>
 *   {(bind) => (
 *     <Button {...bind} className={bind["aria-disabled"] === true ? blockedLook : undefined}>
 *       {t(KEYS.addRow)}
 *     </Button>
 *   )}
 * </GatedControl>
 * ```
 */
export function useBlockedButtonClassName(): string {
  const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
  return `${getPrefixCls("btn")}-disabled`;
}

export function GatedButton(props: GatedButtonProps): ReactElement {
  const {
    gate,
    layout,
    testId,
    children,
    wrapperStyle,
    onBlockedActivate,
    whenBlocked,
    ...button
  } = props;
  const disabledClass = useBlockedButtonClassName();
  return (
    <GatedControl
      gate={gate}
      {...(layout !== undefined ? { layout } : {})}
      {...(testId !== undefined ? { testId: `${testId}-gate` } : {})}
      {...(wrapperStyle !== undefined ? { style: wrapperStyle } : {})}
      {...(onBlockedActivate !== undefined ? { onBlockedActivate } : {})}
      {...(whenBlocked !== undefined ? { whenBlocked } : {})}
    >
      {(bind) => (
        <Button
          data-analytics="none"
          data-analytics-reason="passthrough — the caller's onClick carries the tracked action"
          {...(testId !== undefined ? { "data-testid": testId } : {})}
          {...button}
          {...bind}
          {...(() => {
            const className = joinClassNames(
              button.className,
              bind["aria-disabled"] === true && disabledClass
            );
            return className === undefined ? {} : { className };
          })()}
        >
          {children}
        </Button>
      )}
    </GatedControl>
  );
}
