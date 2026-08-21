/**
 * The field-kind CONFIG CONTRACT — what `<FormBuilder>` is data-driven off.
 *
 * ── Why this table exists in TypeScript at all ─────────────────────────────
 *
 * `stapel_attributes.config_form` declares every feature type's admin config
 * form as DATA (`FormField(name, kind, label_key, required, default, params)`)
 * precisely so a builder needs no per-type UI. Its own docstring, however,
 * records how that data reaches a client: *"Emitted server-side onto the admin
 * page via the widget (**no endpoint**)."* There is no REST surface serving
 * `form_declarations()` — not in stapel-attributes, and not among
 * stapel-forms' 13 paths (verified against `docs/schema.json`).
 *
 * So this module MIRRORS the upstream declarations rather than fetching them.
 * That is a real, named cost, not a design preference — see the spec delta
 * filed for it. What the mirror buys is the property §8 actually asked for:
 * the builder iterates a table, so a kind is configured by DATA and no kind
 * gets a bespoke hand-written form. What it costs is that the table can drift
 * from upstream until the endpoint exists; the drift is bounded by
 * `test/configForms.test.ts`, which pins every entry against the values quoted
 * from `config_form.py` here.
 *
 * Source: `stapel_attributes/config_form.py::BUILTIN_FORMS` (attributes 0.4.6).
 *
 * ── v1 scope, and the two kinds that ship builder-less ─────────────────────
 *
 * Spec §12 risk 5: *"if a kind's config form turns out unrepresentable, that
 * kind ships builder-less (authorable via draft PUT) rather than growing
 * bespoke UI."* Applying it honestly:
 *
 *  - **`convertible_unit`** declares NO config form upstream (it is absent
 *    from `BUILTIN_FORMS`). Nothing to render → builder-less.
 *  - **`hierarchical_select`** declares exactly one field, of kind
 *    `hierarchical_options` — a tree editor. Its whole form is the
 *    unrepresentable part → builder-less.
 *
 * Both remain fully RENDERABLE (they have widgets) and fully authorable
 * through `PUT /forms/<id>/draft`. The builder says so instead of pretending.
 *
 * Two individual config FIELDS are also v1-unrepresentable and are marked
 * {@link ConfigFieldSpec.unsupported}: `date.options` (`timestamp_array`) and
 * anything else using `hierarchical_options`. The builder renders the rest of
 * that kind's form and states which options it cannot edit — dropping them
 * silently would present a partial form as a complete one.
 */

/**
 * The config-widget vocabulary — `stapel_attributes.config_form.FIELD_KINDS`.
 * A kind here is a WIDGET, not a feature type: this is why the builder scales
 * to a host-registered type for free, exactly as the upstream docstring
 * promises ("a newly registered type gets an admin form with zero JS as long
 * as it uses the standard field-kinds").
 */
export type ConfigFieldKind =
  | "number"
  | "text"
  | "checkbox"
  | "translatable_text"
  | "number_options"
  | "string_options"
  | "color_options"
  | "select"
  | "select_options_with_default"
  | "max_selected_dropdown"
  | "hierarchical_options"
  | "timestamp"
  | "timestamp_array";

/** One inline choice of a `select` config widget. */
export interface ConfigSelectOption {
  readonly value: string;
  readonly label: string;
}

/** One declared config-form field (upstream `FormField.to_dict()`). */
export interface ConfigFieldSpec {
  /** The config key this field edits. Order is significant. */
  readonly name: string;
  readonly kind: ConfigFieldKind;
  /** Upstream i18n key, `admin.attributes.form.<type>.<field>`. The builder
   * renders `t(labelKey)` and falls back to a humanized `name`. */
  readonly labelKey: string;
  /** Cosmetic `*` marker only — real validation is server-side. */
  readonly required?: boolean;
  /** Applied when the config key is absent. */
  readonly default?: unknown;
  /** Inline choices, for `kind: "select"`. */
  readonly options?: readonly ConfigSelectOption[];
  /** Numeric step, for `kind: "number"`. */
  readonly step?: number;
  /** Placeholder, for the text-ish kinds. */
  readonly placeholder?: string;
  /**
   * Set when v1 has no widget for this config kind. The builder shows the row
   * disabled with an explanation rather than omitting it — a config form that
   * silently hides an option looks complete when it is not.
   */
  readonly unsupported?: true;
}

/** A field kind's full config declaration. */
export interface KindConfigForm {
  /** Upstream i18n key, `admin.attributes.type.<slug>`. */
  readonly labelKey: string;
  readonly fields: readonly ConfigFieldSpec[];
}

function lk(type: string, field: string): string {
  return `admin.attributes.form.${type}.${field}`;
}

const INT_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "min", kind: "number", labelKey: lk("int", "min"), step: 1 },
  { name: "max", kind: "number", labelKey: lk("int", "max"), step: 1 },
  { name: "options", kind: "number_options", labelKey: lk("int", "options") },
  { name: "allowCustom", kind: "checkbox", labelKey: lk("int", "allowCustom"), default: true },
  { name: "prefix", kind: "translatable_text", labelKey: lk("int", "prefix"), placeholder: "$" },
  { name: "postfix", kind: "translatable_text", labelKey: lk("int", "postfix"), placeholder: "km" },
  { name: "postfix1000", kind: "translatable_text", labelKey: lk("int", "postfix1000"), placeholder: "k" },
  { name: "placeholder", kind: "translatable_text", labelKey: lk("int", "placeholder") },
];

const FLOAT_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "min", kind: "number", labelKey: lk("float", "min"), step: 0.01 },
  { name: "max", kind: "number", labelKey: lk("float", "max"), step: 0.01 },
  { name: "precision", kind: "number", labelKey: lk("float", "precision"), default: 2, step: 1 },
  { name: "options", kind: "number_options", labelKey: lk("float", "options") },
  { name: "allowCustom", kind: "checkbox", labelKey: lk("float", "allowCustom"), default: true },
  { name: "prefix", kind: "translatable_text", labelKey: lk("float", "prefix"), placeholder: "$" },
  { name: "postfix", kind: "translatable_text", labelKey: lk("float", "postfix"), placeholder: "m²" },
  { name: "postfix1000", kind: "translatable_text", labelKey: lk("float", "postfix1000"), placeholder: "k" },
  { name: "placeholder", kind: "translatable_text", labelKey: lk("float", "placeholder") },
];

const STRING_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "minLength", kind: "number", labelKey: lk("string", "minLength"), step: 1 },
  { name: "maxLength", kind: "number", labelKey: lk("string", "maxLength"), step: 1 },
  // stapel-attributes 0.4.6. Rendering metadata only — the string widget draws
  // a textarea instead of an input. Absent means false, which is what every
  // schema published against 0.4.5 (including stapel-forms 0.1.0's own tests)
  // carries, so nothing stored needs a migration.
  { name: "multiline", kind: "checkbox", labelKey: lk("string", "multiline"), default: false },
  { name: "pattern", kind: "text", labelKey: lk("string", "pattern") },
  { name: "options", kind: "string_options", labelKey: lk("string", "options") },
  { name: "allowCustom", kind: "checkbox", labelKey: lk("string", "allowCustom"), default: true },
  { name: "prefix", kind: "translatable_text", labelKey: lk("string", "prefix"), placeholder: "$" },
  { name: "postfix", kind: "translatable_text", labelKey: lk("string", "postfix"), placeholder: "m²" },
  { name: "placeholder", kind: "translatable_text", labelKey: lk("string", "placeholder") },
];

const BOOL_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "trueLabel", kind: "translatable_text", labelKey: lk("bool", "trueLabel"), placeholder: "yes" },
  { name: "falseLabel", kind: "translatable_text", labelKey: lk("bool", "falseLabel"), placeholder: "no" },
];

const HEX_COLOR_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "options", kind: "color_options", labelKey: lk("hex_color", "options") },
  // LN-B15: hex_color's allowCustom defaults FALSE, unlike int/float/string.
  { name: "allowCustom", kind: "checkbox", labelKey: lk("hex_color", "allowCustom"), default: false },
];

const SELECT_FIELDS: readonly ConfigFieldSpec[] = [
  { name: "options", kind: "select_options_with_default", labelKey: lk("select", "options") },
  {
    name: "uiStyle",
    kind: "select",
    labelKey: lk("select", "uiStyle"),
    required: true,
    // B2 canon: the untouched-form default MUST equal the engine dataclass
    // default (SelectConfig.uiStyle = "dropdown"), so a select saved without
    // touching this round-trips to what the UI displayed.
    default: "dropdown",
    options: [
      { value: "chips", label: "Chips/Tags" },
      { value: "checkboxes", label: "Checkboxes (like checklist)" },
      { value: "dropdown", label: "Dropdown" },
    ],
  },
  { name: "minSelected", kind: "number", labelKey: lk("select", "minSelected"), default: 0, step: 1 },
  // No default: SelectConfig.maxSelected is None = unlimited, and the widget
  // shows "Unlimited" for an absent value.
  { name: "maxSelected", kind: "max_selected_dropdown", labelKey: lk("select", "maxSelected") },
  { name: "lockUserInput", kind: "checkbox", labelKey: lk("select", "lockUserInput") },
];

const DATE_FIELDS: readonly ConfigFieldSpec[] = [
  {
    name: "precision",
    kind: "select",
    labelKey: lk("date", "precision"),
    required: true,
    default: "date",
    options: [
      { value: "year", label: "Year only" },
      { value: "month", label: "Month (year + month)" },
      { value: "date", label: "Date (year + month + day)" },
      { value: "datetime", label: "Date & Time" },
    ],
  },
  { name: "minDate", kind: "timestamp", labelKey: lk("date", "minDate") },
  { name: "maxDate", kind: "timestamp", labelKey: lk("date", "maxDate") },
  { name: "allowFuture", kind: "checkbox", labelKey: lk("date", "allowFuture"), default: true },
  { name: "allowPast", kind: "checkbox", labelKey: lk("date", "allowPast"), default: true },
  // Upstream names this field literally "default".
  { name: "default", kind: "timestamp", labelKey: lk("date", "default") },
  { name: "options", kind: "timestamp_array", labelKey: lk("date", "options"), unsupported: true },
  { name: "lockInput", kind: "checkbox", labelKey: lk("date", "lockInput") },
  { name: "placeholder", kind: "text", labelKey: lk("date", "placeholder") },
];

const HEADER_FIELDS: readonly ConfigFieldSpec[] = [
  {
    name: "style",
    kind: "select",
    labelKey: lk("header", "style"),
    required: true,
    // LN-B01, preserved deliberately: the upstream default "h2" matches
    // NEITHER option value. Mirrored rather than "fixed" — silently changing
    // it here would make the builder disagree with the engine.
    default: "h2",
    options: [
      { value: "l", label: "H1 - Large" },
      { value: "m", label: "H2 - Medium" },
    ],
  },
];

/**
 * Field kind → its config form. A kind ABSENT from this table ships
 * builder-less (see the module header): `convertible_unit` (no upstream
 * declaration) and `hierarchical_select` (its only field is a tree editor).
 */
export const FIELD_KIND_CONFIG_FORMS: Readonly<Record<string, KindConfigForm>> = {
  int: { labelKey: "admin.attributes.type.int", fields: INT_FIELDS },
  float: { labelKey: "admin.attributes.type.float", fields: FLOAT_FIELDS },
  string: { labelKey: "admin.attributes.type.string", fields: STRING_FIELDS },
  bool: { labelKey: "admin.attributes.type.bool", fields: BOOL_FIELDS },
  hex_color: { labelKey: "admin.attributes.type.hex_color", fields: HEX_COLOR_FIELDS },
  select: { labelKey: "admin.attributes.type.select", fields: SELECT_FIELDS },
  date: { labelKey: "admin.attributes.type.date", fields: DATE_FIELDS },
  header: { labelKey: "admin.attributes.type.header", fields: HEADER_FIELDS },
};

/**
 * The kinds the builder can configure, in offer order. Anything in
 * `BUILTIN_FIELD_KINDS` but not here is builder-less by the §12 risk-5 rule.
 */
export const BUILDER_KINDS: readonly string[] = [
  "string",
  "int",
  "float",
  "bool",
  "select",
  "date",
  "header",
  "hex_color",
];

/** Can `<FormBuilder>` configure this kind? */
export function isBuilderSupportedKind(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIELD_KIND_CONFIG_FORMS, kind);
}

/** The kind's config declaration, or `undefined` when it ships builder-less. */
export function configFormFor(kind: string): KindConfigForm | undefined {
  return FIELD_KIND_CONFIG_FORMS[kind];
}

/**
 * The config defaults a freshly-added field of this kind starts with — every
 * declared `default`, and nothing else. Keys with no upstream default stay
 * ABSENT rather than being written as `null`: the engine's dataclass reads an
 * absent key as "use my own default", and writing one changes behaviour.
 */
export function defaultConfigFor(kind: string): Record<string, unknown> {
  const form = configFormFor(kind);
  if (form === undefined) return {};
  const config: Record<string, unknown> = {};
  for (const field of form.fields) {
    if (field.default !== undefined) config[field.name] = field.default;
  }
  return config;
}
