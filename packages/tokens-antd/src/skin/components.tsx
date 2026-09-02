/**
 * The skin COMPONENT REGISTRY — the substrate's second restyle layer.
 *
 * Layer one is tokens (§68): a host's token JSON becomes `--stapel-*` custom
 * properties, `toAntdThemeConfig` projects them onto antd, and every default
 * skin re-colours in one place. What tokens cannot restyle is ANATOMY: a host
 * that wants its own button shape, its own bottom sheet, its own text field —
 * not antd's, differently coloured — had to override skins per pair, which is
 * exactly the "full override" the design system exists to make unnecessary.
 *
 * This module is the one place a host swaps a PRIMITIVE instead:
 *
 * ```tsx
 * <SkinProvider components={{ Button: MyButton, Dialog: MySheet }}>
 *   <App />   // every pair's default skin now renders MyButton / MySheet
 * </SkinProvider>
 * ```
 *
 * It works because the substrate renders its own primitives through the
 * registry: `GatedButton`, `ErrorAlert`'s retry, `SkinConfirm`'s arms,
 * `RowActions`, `PermissionSheet`, the picker footer all draw
 * {@link SkinButton}; `SkinNumberField`, `CountedInput` and the picker's
 * search box draw {@link SkinInput}; `SkinDialog` (and through it
 * `SkinConfirm` and `SkinPickerSheet`) renders the `Dialog` slot. A pair
 * needs no wiring — consuming the substrate IS the wiring. Pairs' own direct
 * `antd` imports migrate mechanically (`import { SkinButton as Button }`)
 * as they are touched.
 *
 * ## The canon set, and why it is small
 *
 * The 2026-09 audit of what pairs actually consume: `SkinTheme` 27 pairs,
 * `ErrorAlert` 23, `EmptyState` 22, `GatedButton` 20, `SkinDialog` 17,
 * `SkinConfirm` 16 — all of which bottom out in exactly three primitives:
 * a button, a dialog surface, a text input. Those three are the registry.
 * Everything else (Select — 36 direct antd uses but no substrate control to
 * hook; TextArea; Tag; Table) stays a FUTURE slot until there is a substrate
 * render to thread it through — a slot nothing consumes is API surface with
 * no behaviour. See `docs/skin-component-registry.md`.
 *
 * ## The contract is explicit, and violations are loud
 *
 * Each slot's props type is the contract; the anatomy duties (what the
 * replacement MUST render — a focusable `button`, the forwarded
 * `data-testid`, a `role="dialog"` with an accessible name) are documented
 * on the type and CHECKED in development: a replacement that breaks one gets
 * a `console.error` naming the component and the duty, once per pair —
 * never a silently broken fleet. Production builds skip the checks and the
 * wrapper element entirely.
 *
 * ## Byte-stability
 *
 * With no provider (or an empty one) the default arm renders the antd
 * primitive with the same props as before this module existed —
 * `test/substrateBaseline.test.tsx` pins the exact markup.
 */
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ComponentType, ReactElement, ReactNode, Ref } from "react";
import { Button, Input } from "antd";
import type { ButtonProps, InputProps, InputRef } from "antd";
import { isDevBuild } from "@stapel/core";
import type { DialogSurface } from "./dialogSurface.js";

/**
 * The Button slot's contract. The prop dialect is antd's `ButtonProps` —
 * the substrate already speaks it — plus the test id every substrate button
 * carries. A replacement may ignore purely presentational props, but MUST:
 *
 *  - render a real, focusable `<button>` (or `role="button"` with keyboard
 *    activation) — the substrate's focus management and a11y depend on it;
 *  - forward every `data-*` and `aria-*` prop onto that element — pair tests
 *    find buttons by `data-testid`, and `GatedControl` links its visible
 *    reason via `aria-describedby`;
 *  - honour `disabled` (a gate's verdict) and `loading` (an in-flight
 *    confirm refuses a second click);
 *  - render `children` as the visible label and call `onClick`;
 *  - pass `ref` through to the interactive element (`SkinConfirm` places
 *    initial focus with it);
 *  - respect `danger` (a destructive arm must look destructive) and treat
 *    `type="primary"` as the emphasised variant.
 */
export type SkinButtonProps = ButtonProps & {
  readonly "data-testid"?: string;
  readonly ref?: Ref<HTMLButtonElement | HTMLAnchorElement | null>;
};

/**
 * The Input slot's contract (single-line text field). Dialect: antd's
 * `InputProps`. A replacement MUST:
 *
 *  - render a real `<input>`, controlled by `value`/`onChange` (the change
 *    handler reads `event.target.value`) — and never clamp, trim or
 *    transform the value (`SkinNumberField` exists because silent clamping
 *    is a defect);
 *  - forward `data-*`, `aria-*`, `id`, `inputMode` and `placeholder` onto
 *    the input element;
 *  - honour `disabled`;
 *  - render `suffix` adjacent to the value when given (a number's unit rides
 *    there and is never part of the value).
 */
export type SkinInputProps = InputProps & {
  readonly "data-testid"?: string;
  readonly ref?: Ref<InputRef | null>;
};

/**
 * The Dialog slot's contract — the SURFACE `SkinDialog` renders when a host
 * registers one (and, through `SkinDialog`, what `SkinConfirm` and
 * `SkinPickerSheet` open). The substrate keeps everything above the surface:
 * the viewport rule that resolved {@link SkinDialogSlotProps.surface}, both
 * theming wrappers, and the stamped body inside `children`. A replacement
 * MUST:
 *
 *  - render `children` whenever `open` (the stamped body inside them is what
 *    every pair test asserts on), inside an element with `role="dialog"` and
 *    an accessible name from `title` or `ariaLabel`;
 *  - call `onClose` for EVERY dismissal it offers, and label its dismiss
 *    affordance with `dismissLabel` (i18n copy the caller supplied);
 *  - when `dismissible` is `false`, draw NO dismissal affordance and refuse
 *    Esc/backdrop dismissal — a visibly offered control that does nothing is
 *    worse than its absence;
 *  - contain focus while open and restore it on close;
 *  - render `footer` when given (the action row of a confirm or a picker);
 *  - honour `destroyOnHidden`: a closed journey does not keep half-filled
 *    state alive off-screen.
 *
 * `surface` says which shape the design system resolved for this viewport
 * (`"sheet"` on a phone, `"modal"` otherwise); a replacement is free to
 * render one anatomy for both, but the phone rules (thumb-sized targets,
 * safe-area padding) are then its to keep.
 */
export interface SkinDialogSlotProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The shape the viewport rule resolved: a sheet on a phone. */
  readonly surface: DialogSurface;
  readonly title?: ReactNode;
  /** The accessible name when there is no `title`. */
  readonly ariaLabel?: string;
  /** Accessible name of the dismiss affordance — caller's i18n copy. */
  readonly dismissLabel: string;
  readonly dismissible: boolean;
  readonly destroyOnHidden: boolean;
  readonly maskClosable?: boolean;
  /** Modal width. A sheet is viewport-wide. */
  readonly width?: number | string;
  readonly footer?: ReactNode;
  readonly className?: string;
  /** The themed, stamped dialog body. Render it whenever `open`. */
  readonly children: ReactNode;
}

export type SkinButtonComponent = ComponentType<SkinButtonProps>;
export type SkinInputComponent = ComponentType<SkinInputProps>;
export type SkinDialogComponent = ComponentType<SkinDialogSlotProps>;

/**
 * What a host may swap. Every key is optional — an absent key means "the
 * substrate default" (antd's primitive with today's exact markup).
 */
export interface SkinComponents {
  readonly Button?: SkinButtonComponent;
  readonly Input?: SkinInputComponent;
  readonly Dialog?: SkinDialogComponent;
}

const SkinComponentsContext = createContext<SkinComponents>({});

export interface SkinProviderProps {
  readonly components: SkinComponents;
  readonly children: ReactNode;
}

/** Only the keys a provider actually states — an explicitly-`undefined` key
 * must not clobber an outer provider's registration. */
function statedEntries(components: SkinComponents): SkinComponents {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(components)) {
    if (value !== undefined) out[key] = value;
  }
  return out as SkinComponents;
}

/**
 * Registers replacement primitives for every substrate render below it.
 * Nesting merges: an inner provider re-states only what differs and inherits
 * the rest, so a subtree can carry a different button under the same sheet.
 */
export function SkinProvider(props: SkinProviderProps): ReactElement {
  const parent = useContext(SkinComponentsContext);
  const { components } = props;
  const value = useMemo<SkinComponents>(
    () => ({ ...parent, ...statedEntries(components) }),
    [parent, components]
  );
  return (
    <SkinComponentsContext.Provider value={value}>
      {props.children}
    </SkinComponentsContext.Provider>
  );
}

/**
 * The registrations in scope (merged across nested providers). `{}` outside
 * any provider. For the substrate's own render sites and for a host/pair
 * that needs to know whether a slot is overridden; to RENDER a primitive,
 * use {@link SkinButton} / {@link SkinInput} / `SkinDialog`.
 */
export function useSkinComponents(): SkinComponents {
  return useContext(SkinComponentsContext);
}

// ─── Dev contract checks ────────────────────────────────────────────────────

/** One line per (slot, component, duty) for the life of the process: the
 * warning is a defect report, not a render log. */
const reported = new Set<string>();

/** The name-bearing surface of any component (function or class) — enough to
 * report on, without dragging in prop-type variance. */
export interface NamedComponent {
  readonly displayName?: string | undefined;
  readonly name?: string | undefined;
}

function componentName(component: NamedComponent): string {
  return (
    component.displayName ??
    (component.name !== undefined && component.name !== "" ? component.name : "anonymous")
  );
}

/** @internal exported for `SkinDialog`'s own check. */
export function reportContractViolation(
  slot: string,
  component: NamedComponent,
  duty: string
): void {
  const name = componentName(component);
  const key = `${slot}:${name}:${duty}`;
  if (reported.has(key)) return;
  reported.add(key);
  console.error(
    `[stapel skin] ${slot} override <${name}> breaks its contract: ${duty} ` +
      `(see SkinDialogSlotProps/SkinButtonProps/SkinInputProps in @stapel/tokens-antd/skin).`
  );
}

interface SlotCheckProps {
  readonly slot: string;
  readonly component: NamedComponent;
  /** CSS selector the rendered anatomy must contain. */
  readonly anatomy: string;
  /** What the anatomy duty is, in a sentence, for the report. */
  readonly anatomyDuty: string;
  /** A `data-testid` that must be forwarded, when the caller passed one. */
  readonly expectTestId?: string | undefined;
  readonly children: ReactNode;
}

/**
 * The development-only wrapper around an OVERRIDDEN slot render: a
 * `display: contents` element (no box, no layout) whose ref inspects what
 * the replacement actually mounted. Never rendered in production, and never
 * rendered for the default arm — the no-provider path stays byte-identical.
 */
function SlotCheck(props: SlotCheckProps): ReactElement {
  const host = useRef<HTMLSpanElement>(null);
  const { slot, component, anatomy, anatomyDuty, expectTestId } = props;
  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    if (el.querySelector(anatomy) === null) {
      reportContractViolation(slot, component, anatomyDuty);
    }
    if (expectTestId !== undefined && el.querySelector(`[data-testid="${expectTestId}"]`) === null) {
      reportContractViolation(
        slot,
        component,
        `the data-testid prop ("${expectTestId}") must be forwarded onto the rendered element — pair tests find the control by it`
      );
    }
  }, [slot, component, anatomy, anatomyDuty, expectTestId]);
  return (
    <span style={{ display: "contents" }} data-stapel-skin-slot={slot} ref={host}>
      {props.children}
    </span>
  );
}

// ─── The resolved primitives ────────────────────────────────────────────────

/**
 * The registry-resolved button: the host's registration when there is one,
 * antd's `Button` (unchanged markup) when there is none. The substrate draws
 * every button through this; a pair's default skin migrates mechanically —
 * `import { SkinButton as Button } from "@stapel/tokens-antd/skin"`.
 */
export function SkinButton(props: SkinButtonProps): ReactElement {
  const Override = useContext(SkinComponentsContext).Button;
  if (Override === undefined) return <Button {...props} />;
  const rendered = <Override {...props} />;
  if (!isDevBuild()) return rendered;
  return (
    <SlotCheck
      slot="Button"
      component={Override}
      anatomy='button, [role="button"], a[href]'
      anatomyDuty="it must render a focusable button (a real <button>, or role='button' with keyboard activation)"
      expectTestId={props["data-testid"]}
    >
      {rendered}
    </SlotCheck>
  );
}

/**
 * The registry-resolved single-line text field: the host's registration or
 * antd's `Input`, unchanged. The multiline arm (`Input.TextArea`) is a
 * future slot and stays antd everywhere for now.
 */
export function SkinInput(props: SkinInputProps): ReactElement {
  const Override = useContext(SkinComponentsContext).Input;
  if (Override === undefined) return <Input {...props} />;
  const rendered = <Override {...props} />;
  if (!isDevBuild()) return rendered;
  return (
    <SlotCheck
      slot="Input"
      component={Override}
      anatomy='input, textarea, [role="textbox"], [contenteditable="true"]'
      anatomyDuty="it must render a real text input controlled by value/onChange"
      expectTestId={props["data-testid"]}
    >
      {rendered}
    </SlotCheck>
  );
}
