/**
 * The skin-slot registry — the SECOND override lever of `/default`, beside
 * the field-widget registry (`widgets/registry.ts`) and plain props.
 *
 * "A default the customer cannot swap is a decision, not a default"
 * (spec §7.3). The widget registry lets a host replace how one FIELD KIND
 * draws; this lets a host replace a piece of the SKIN — the row that wraps a
 * field, the submit bar, the confirmation panel, a response cell — without
 * forking the skin to get at it.
 *
 * ```tsx
 * registerFormsSkinComponent("fill.submitBar", MySubmitBar);
 * ```
 *
 * Slot names are a closed union on purpose: a typo in a string key would
 * register a component that silently never renders, and "my override did
 * nothing and nothing said so" is the exact failure this fleet keeps closing.
 */
import type { ComponentType } from "react";

/**
 * The slots `/default` renders through. Each name is `<surface>.<part>`.
 *
 * Adding a slot is additive; REMOVING one is a breaking change for any host
 * that registered it, so a slot is only added where the default is genuinely
 * a judgement call somebody might reasonably disagree with.
 */
export type FormsSkinSlot =
  /** Wraps one field: label, control, error, required marker. */
  | "fill.fieldRow"
  /** The submit button and everything beside it (captcha, blocked reason). */
  | "fill.submitBar"
  /** What replaces the form once the server accepts it. */
  | "fill.confirmation"
  /** The notice shown in place of a field whose kind nothing can draw. */
  | "fill.unsupportedField"
  /** One cell of the responses grid. */
  | "responses.cell"
  /** The responses toolbar: version filter, export, paging. */
  | "responses.toolbar"
  /** One row of the builder's field list. */
  | "builder.fieldRow"
  /** The builder's save/publish/state controls. */
  | "builder.toolbar";

const slots = new Map<FormsSkinSlot, ComponentType<never>>();

/**
 * Replace a slot's component. Call at startup, before the first render.
 *
 * The props a slot receives are the ones the skin passes it — each slot's
 * prop type is exported beside the component that renders it, so an override
 * is written against a real type rather than by reading the skin's source.
 */
export function registerFormsSkinComponent<P>(
  slot: FormsSkinSlot,
  component: ComponentType<P>
): void {
  slots.set(slot, component as ComponentType<never>);
}

/** Remove an override, restoring the skin's own component. */
export function unregisterFormsSkinComponent(slot: FormsSkinSlot): void {
  slots.delete(slot);
}

/** The host's override for a slot, or `null` — the skin falls back to its
 * own component. */
export function resolveFormsSkinComponent<P>(
  slot: FormsSkinSlot
): ComponentType<P> | null {
  return (slots.get(slot) as ComponentType<P> | undefined) ?? null;
}

/** Every slot with an override, sorted. */
export function registeredFormsSkinSlots(): readonly FormsSkinSlot[] {
  return [...slots.keys()].sort();
}
