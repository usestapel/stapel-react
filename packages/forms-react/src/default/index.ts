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
 * this skin with zero code because every surface wraps itself in
 * `<FormsSkinTheme>`.
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

// ── theming ─────────────────────────────────────────────────────────────────
export { FormsSkinTheme } from "./theme.js";
export type { FormsSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
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
