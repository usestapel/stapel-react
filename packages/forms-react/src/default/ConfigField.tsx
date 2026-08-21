/**
 * One row of a field's config form, chosen by the CONFIG-WIDGET KIND — the
 * mechanism that makes `<FormBuilderPane>` data-driven rather than a
 * hand-written form per attribute type.
 *
 * `stapel_attributes.config_form` declares each feature type's admin form as
 * a list of `FormField(name, kind, …)` where `kind` comes from a fixed
 * 13-entry vocabulary (`FIELD_KINDS`), and stapel-forms 0.2.0 serves those
 * declarations at `GET /field-kinds`. This file implements the WIDGET
 * vocabulary once, so a feature type registered by a host gets a working
 * config form with no new UI — and, now that the declarations are fetched
 * rather than mirrored, with no client release either.
 *
 * Two of upstream's 13 widgets are not implemented here — `hierarchical_options`
 * (a tree editor) and `timestamp_array`. Their rows render with an explanation
 * rather than vanishing: a config form that hides an option looks complete when
 * it is not. The `default:` arm catches those two AND anything a future
 * attributes release adds, so a new widget degrades loudly instead of writing a
 * wrong shape into a published schema.
 */
import type { ReactElement } from "react";
import { Input, InputNumber, Select, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import type { ConfigFieldSpec } from "../api/types.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/**
 * Widget params live under `spec.params`, not flattened onto the spec — that
 * is `FormField.to_dict()`'s real shape, which the pair only saw once the
 * declarations came off the wire instead of a hand-written mirror.
 */
function param(spec: ConfigFieldSpec, key: string): unknown {
  return (spec.params ?? {})[key];
}

function paramNumber(spec: ConfigFieldSpec, key: string): number | undefined {
  const raw = param(spec, key);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function paramString(spec: ConfigFieldSpec, key: string): string | undefined {
  const raw = param(spec, key);
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/** Inline `{value, label}` choices for a `select` config widget. */
function paramOptions(
  spec: ConfigFieldSpec
): readonly { value: string; label: string }[] {
  const raw = param(spec, "options");
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((option) => {
    if (option === null || typeof option !== "object") return [];
    const entry = option as { value?: unknown; label?: unknown };
    const value = str(entry.value);
    return [{ value, label: entry.label == null ? value : str(entry.label) }];
  });
}

/** A tag-style list editor for the `*_options` kinds. `number_options`
 * coerces back to numbers so a numeric option list does not silently become
 * a list of strings the engine will refuse. */
function OptionsList(props: {
  value: unknown;
  numeric: boolean;
  disabled: boolean;
  onChange(next: unknown): void;
}): ReactElement {
  const current = Array.isArray(props.value) ? props.value.map(str) : [];
  return (
    <Select
      mode="tags"
      style={{ width: "100%" }}
      value={current}
      disabled={props.disabled}
      open={false}
      suffixIcon={null}
      onChange={(next: string[]) => {
        if (next.length === 0) {
          props.onChange(undefined);
          return;
        }
        props.onChange(
          props.numeric
            ? next.map(Number).filter((n) => Number.isFinite(n))
            : next
        );
      }}
    />
  );
}

export interface ConfigFieldProps {
  readonly spec: ConfigFieldSpec;
  readonly value: unknown;
  readonly disabled: boolean;
  /** `undefined` REMOVES the key — an absent config key means "the engine's
   * own default", which is not the same as a stored `null`. */
  onChange(value: unknown): void;
}

export function ConfigField(props: ConfigFieldProps): ReactElement {
  const t = useT();
  const { spec, value, disabled } = props;

  switch (spec.kind) {
    case "number":
      return (
        <InputNumber
          style={{ width: "100%" }}
          value={numberish(value) ?? null}
          disabled={disabled}
          {...(paramNumber(spec, "step") !== undefined
            ? { step: paramNumber(spec, "step") as number }
            : {})}
          onChange={(next) => props.onChange(next ?? undefined)}
        />
      );

    case "max_selected_dropdown":
      // Absent = unlimited, which is `SelectConfig.maxSelected = None`. The
      // placeholder says so, and clearing the number restores it.
      return (
        <InputNumber
          style={{ width: "100%" }}
          value={numberish(value) ?? null}
          disabled={disabled}
          min={1}
          step={1}
          placeholder={t(FORMS_I18N_KEYS.fillUnlimited)}
          onChange={(next) => props.onChange(next ?? undefined)}
        />
      );

    case "text":
    case "translatable_text":
      // v1 edits the base string only. A per-locale editor is the same v2
      // fork as translated form CONTENT (spec §10) — offering one language
      // box per locale here would imply a translation pipeline that does not
      // exist yet.
      return (
        <Input
          value={str(value)}
          disabled={disabled}
          {...(paramString(spec, "placeholder") !== undefined
            ? { placeholder: paramString(spec, "placeholder") as string }
            : {})}
          onChange={(event) => props.onChange(event.target.value || undefined)}
        />
      );

    case "checkbox":
      return (
        <Switch
          checked={value === true}
          disabled={disabled}
          onChange={(checked) => props.onChange(checked)}
        />
      );

    case "select":
      return (
        <Select
          style={{ width: "100%" }}
          value={str(value) || null}
          disabled={disabled}
          options={[...paramOptions(spec)]}
          onChange={(next: string) => props.onChange(next)}
        />
      );

    case "number_options":
      return (
        <OptionsList
          value={value}
          numeric
          disabled={disabled}
          onChange={props.onChange}
        />
      );

    // `select_options_with_default` shares this editor: the per-option
    // "default" marker is not editable in v1; the option LIST — the part a
    // form actually needs — is.
    case "string_options":
    case "color_options":
    case "select_options_with_default":
      return (
        <OptionsList
          value={value}
          numeric={false}
          disabled={disabled}
          onChange={props.onChange}
        />
      );

    case "timestamp":
      return (
        <Input
          type="date"
          value={str(value)}
          disabled={disabled}
          onChange={(event) => props.onChange(event.target.value || undefined)}
        />
      );

    default:
      // `hierarchical_options` (a tree editor) and `timestamp_array` — the two
      // of upstream's 13 config widgets this skin does not implement — plus any
      // widget a future attributes release adds. Say so rather than render a
      // control that would write a wrong shape into a published schema.
      return (
        <Typography.Text type="secondary">
          {t(FORMS_I18N_KEYS.builderUnsupportedConfig, { keys: spec.name })}
        </Typography.Text>
      );
  }
}
