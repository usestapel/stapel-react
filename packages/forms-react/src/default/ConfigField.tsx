/**
 * One row of a field's config form, chosen by the CONFIG-WIDGET KIND — the
 * mechanism that makes `<FormBuilderPane>` data-driven rather than a
 * hand-written form per attribute type.
 *
 * `stapel_attributes.config_form` declares each feature type's admin form as
 * a list of `FormField(name, kind, …)` where `kind` comes from a fixed
 * 13-entry vocabulary (`FIELD_KINDS`). This file implements that vocabulary
 * once. The payoff is the one the upstream docstring promises: a feature type
 * registered by a host gets a working config form here with no new UI, as
 * long as it declares itself through the standard kinds.
 *
 * Two kinds are NOT implemented in v1 and are declared so in
 * `widgets/configForms.ts` (`unsupported: true`): `hierarchical_options` (a
 * tree editor) and `timestamp_array`. Their rows render disabled with an
 * explanation rather than vanishing — a config form that hides an option
 * looks complete when it is not.
 */
import type { ReactElement } from "react";
import { Input, InputNumber, Select, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import type { ConfigFieldSpec } from "../widgets/configForms.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
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

  if (spec.unsupported === true) {
    return (
      <Typography.Text type="secondary" data-testid="forms-config-unsupported">
        {t(FORMS_I18N_KEYS.builderUnsupportedConfig, { keys: spec.name })}
      </Typography.Text>
    );
  }

  switch (spec.kind) {
    case "number":
      return (
        <InputNumber
          style={{ width: "100%" }}
          value={numberish(value) ?? null}
          disabled={disabled}
          {...(spec.step !== undefined ? { step: spec.step } : {})}
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
          {...(spec.placeholder !== undefined
            ? { placeholder: spec.placeholder }
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
          options={[...(spec.options ?? [])]}
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
      // `hierarchical_options` / `timestamp_array` reach here only if the
      // table forgot to mark them unsupported. Say so rather than render a
      // control that would write a wrong shape.
      return (
        <Typography.Text type="secondary">
          {t(FORMS_I18N_KEYS.builderUnsupportedConfig, { keys: spec.name })}
        </Typography.Text>
      );
  }
}
