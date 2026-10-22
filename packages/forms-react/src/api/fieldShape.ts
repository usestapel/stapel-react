/**
 * The field's kind on the wire vs in the pair.
 *
 * stapel-forms stores and serves each field as a `stapel_attributes`
 * `FeatureDef` dict: the kind is the `config.type` discriminator, and there is
 * no top-level `kind` key (`stapel_forms.schema` refuses a field whose
 * `config.type` is missing or not allowlisted). The pair's components key on
 * `field.kind`, so every schema that enters the pair is normalized here, and
 * every schema the pair sends is put back into the wire shape. This module is
 * the one place that knows both shapes.
 */
import type {
  FormFieldDef,
  FormRow,
  FormSchema,
  FormVersion,
  PublicForm,
} from "./types.js";

/** The kind of a field in either shape: `kind` when present, else `config.type`. */
export function fieldKindOf(field: Readonly<Record<string, unknown>>): string {
  if (typeof field["kind"] === "string" && field["kind"] !== "") {
    return field["kind"];
  }
  const config = field["config"];
  if (typeof config === "object" && config !== null) {
    const type = (config as Record<string, unknown>)["type"];
    if (typeof type === "string") return type;
  }
  return "";
}

/** Wire → pair: the field gains `kind` from `config.type`. */
export function fromWireField(field: FormFieldDef): FormFieldDef {
  const kind = fieldKindOf(field);
  return field.kind === kind ? field : { ...field, kind };
}

/** Pair → wire: `config.type` is set from the kind, and no top-level `kind` is sent. */
export function toWireField(field: FormFieldDef): FormFieldDef {
  const kind = fieldKindOf(field);
  const { kind: _dropped, ...rest } = field;
  void _dropped;
  return {
    ...rest,
    config: { ...(field.config ?? {}), ...(kind !== "" ? { type: kind } : {}) },
  } as FormFieldDef;
}

export function fromWireSchema<S extends FormSchema | null | undefined>(schema: S): S {
  if (schema === null || schema === undefined || !Array.isArray(schema.fields)) {
    return schema;
  }
  return { ...schema, fields: schema.fields.map(fromWireField) } as S;
}

export function toWireSchema<S extends FormSchema | null | undefined>(schema: S): S {
  if (schema === null || schema === undefined || !Array.isArray(schema.fields)) {
    return schema;
  }
  return { ...schema, fields: schema.fields.map(toWireField) } as S;
}

export function fromWirePublicForm(form: PublicForm): PublicForm {
  if (!Array.isArray(form?.fields)) return form;
  return { ...form, fields: form.fields.map(fromWireField) };
}

export function fromWireFormRow(row: FormRow): FormRow {
  if (row === null || typeof row !== "object") return row;
  return { ...row, draft_schema: fromWireSchema(row.draft_schema) };
}

export function fromWireVersion(version: FormVersion): FormVersion {
  if (version === null || typeof version !== "object") return version;
  return { ...version, schema: fromWireSchema(version.schema) };
}
