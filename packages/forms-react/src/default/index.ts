/**
 * `@stapel/forms-react/default` — the antd default skin.
 *
 * A SEPARATE entry point on purpose: the main entry is headless and carries
 * no antd, so a host that renders its own visuals over `<FormFill>` never
 * pays for this bundle (enforced by size-limit and the bundle-purity test).
 *
 * Three override levers, in increasing order of reach — none of which
 * requires forking anything:
 *
 *  1. **props** (`mode`, `showTitle`, `submitLabel`);
 *  2. **`registerFormFieldWidget(kind, …)`** — replace how one field kind
 *     draws; a host registration outranks every builtin here;
 *  3. **`registerFormsSkinComponent(slot, …)`** — replace a piece of the
 *     skin itself (a field row, the submit bar, a response cell).
 *
 * And beneath all three: retheming through the §68 token JSON, which reaches
 * this skin with zero code because every surface wraps itself in `<SkinTheme>`
 * from `@stapel/tokens-antd/skin` — the shared substrate that also owns the
 * bottom-sheet rule, the 44px phone control height, and the designed
 * loading/empty/failed arms these surfaces render through.
 */

// ── surfaces ────────────────────────────────────────────────────────────────
export { StapelForm } from "./StapelForm.js";
export type {
  StapelFormProps,
  FieldRowSlotProps,
  SubmitBarSlotProps,
  ConfirmationSlotProps,
  UnsupportedFieldSlotProps,
} from "./StapelForm.js";

export { FormBuilderPane } from "./FormBuilderPane.js";
export type {
  FormBuilderPaneProps,
  BuilderToolbarSlotProps,
  BuilderFieldRowSlotProps,
} from "./FormBuilderPane.js";

export { ResponsesPane } from "./ResponsesPane.js";
export type {
  ResponsesPaneProps,
  ResponseCellSlotProps,
  ResponsesToolbarSlotProps,
} from "./ResponsesPane.js";

export { FormsListPane } from "./FormsListPane.js";
export type { FormsListPaneProps } from "./FormsListPane.js";

export { FormSettingsPane } from "./FormSettingsPane.js";
export type { FormSettingsPaneProps } from "./FormSettingsPane.js";

// ── theming ─────────────────────────────────────────────────────────────────
// `FormsSkinTheme` and this pair's local `ErrorAlert` are GONE (0.2.0). Both
// were per-pair copies of a fleet rule; both now live once, in
// `@stapel/tokens-antd/skin` as `SkinTheme` and `ErrorAlert`. Re-exporting
// them under the old names from here would keep nine copies of a decision
// alive under an alias, so the export is dropped rather than forwarded — a
// host that wrapped a composition in `<FormsSkinTheme>` imports `<SkinTheme>`
// from the substrate instead, with the same props plus `surface`.
export type { ThemeModeProp } from "./types.js";

// ── the two override registries ─────────────────────────────────────────────
export {
  registerFormsSkinComponent,
  unregisterFormsSkinComponent,
  resolveFormsSkinComponent,
  registeredFormsSkinSlots,
} from "./slots.js";
export type { FormsSkinSlot } from "./slots.js";

/** The skin's builtin widgets, exported so a host can WRAP one instead of
 * replacing it outright (decorate the default rather than reimplement it). */
export { BUILTIN_FIELD_WIDGETS, BUILTIN_FIELD_KINDS } from "./fields.js";

/** The data-driven config-form row — exported for a host building its own
 * builder over the same declarations. */
export { ConfigField } from "./ConfigField.js";
export type { ConfigFieldProps } from "./ConfigField.js";
