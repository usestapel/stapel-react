/**
 * The `{slug: {type, value}}` envelope — in and out.
 *
 * A composer holds plain values keyed by slug (that is what an editor's
 * `onChange` produces); the wire wants each one tagged with its type, because
 * the server resolves the type handler from the DTO's `type` discriminator.
 * The tag comes from the FEATURE's config, never from the editor: the engine
 * itself overrides whatever the client sent (`dto_data = {**dto_data, 'type':
 * config.type}` — `validation.py`), so a client that guessed differently
 * would be sending a field the server throws away.
 */
import type { FeatureDef, FeaturesDto, FeatureValueDto } from "./types.js";
import { featureType } from "./types.js";
import { isBlank } from "./validate.js";

/**
 * Values keyed by slug → the `features_draft` payload.
 *
 * Three deliberate behaviours:
 *
 *  - A feature with no declared type is DROPPED. It could not be edited (no
 *    editor resolves) and it cannot be tagged, so sending it would produce a
 *    row the server cannot route. `unsupportedTypes` is what tells a person
 *    it exists; silently sending a broken row would not.
 *  - `header` is DROPPED. The engine regenerates a header's DAO from its
 *    config and rejects an answer to one outright.
 *  - A blank value is DROPPED rather than sent as `null`. "Not answered" and
 *    "answered with nothing" are the same thing to the engine's empty check,
 *    and omitting the key keeps a draft's payload the size of what was
 *    actually filled in.
 *
 * `convertible_unit` is the one type whose editor emits an OBJECT rather than
 * a scalar (`{value, unit}`), because its DTO genuinely carries the unit the
 * number was typed in. Extra keys on that object ride along beside `value`.
 */
export function toFeaturesDto(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>>
): FeaturesDto {
  const out: Record<string, FeatureValueDto> = {};
  for (const feature of features) {
    const type = featureType(feature);
    if (type === undefined || type === "header") continue;
    const value = values[feature.slug];
    if (isBlank(value)) continue;
    if (type === "convertible_unit" && value !== null && typeof value === "object") {
      const entry = value as { value?: unknown; unit?: unknown };
      out[feature.slug] = {
        type,
        value: entry.value,
        ...(entry.unit === undefined || entry.unit === null ? {} : { unit: entry.unit }),
      };
      continue;
    }
    out[feature.slug] = { type, value };
  }
  return out;
}

/**
 * The reverse: a `features_draft` payload → the plain `{slug: value}` map a
 * composer's editors read. Round-trips `convertible_unit` back into the
 * `{value, unit}` object its editor holds.
 */
export function fromFeaturesDto(dto: FeaturesDto): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [slug, entry] of Object.entries(dto)) {
    if (entry.type === "convertible_unit") {
      out[slug] = {
        value: entry.value,
        ...(entry["unit"] === undefined ? {} : { unit: entry["unit"] }),
      };
      continue;
    }
    out[slug] = entry.value;
  }
  return out;
}
