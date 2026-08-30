#!/usr/bin/env node
// AUTO-GEN driver for the FeatureDef canon (§68: one JSON schema, several
// emitters).
//
// `stapel-attributes/docs/feature-def.schema.json` is the single source of the
// shape of a feature definition: the Python dataclass is gated against it,
// stapel-categories checks its ResolvedFeature payload against it, and this
// driver emits the TypeScript `@stapel/attributes-react` re-exports from
// `src/types.ts`. A field added upstream is therefore a red `gen:check` here
// rather than a type this package quietly does not have.
//
//   FEATURE_DEF_SCHEMA  source schema.json (REQUIRED)
//   FEATURE_DEF_OUT     output .ts         (REQUIRED)
//
//   pnpm gen:feature-def         # generate
//   pnpm gen:feature-def:check   # drift gate
//
// GENERATOR CHOICE: `json-schema-to-typescript` is not in this repo's
// node_modules and pulling a code generator in for one 200-line schema is a
// dependency nobody would otherwise carry. So the emitter below is narrow and
// deterministic — it covers exactly the constructs this canon uses (objects,
// `enum`, `const`, arrays, `$ref`, type unions incl. `null`) and throws on
// anything else rather than emitting a silently wrong `unknown`.
// `test/genFeatureDef.test.ts` in attributes-react runs it over a fixture
// schema and compares the emitted text, so the emitter itself is gated.
//
// TWO EMISSION RULES, stated because they are decisions:
//
//  1. A `$defs` entry honours its `required` list; a property outside it is
//     optional.
//  2. An INLINE object sub-schema (`FeatureDef.config`, `Rule.when`) emits
//     every property as OPTIONAL. The canon does not own those shapes — a
//     per-type `config` lives with its type plugin (the features endpoint
//     serializes `obj.config` verbatim, so a malformed row arrives with no
//     `type` at all, which this package draws as a loud notice rather than
//     crashing on), and `when`'s "exactly one of all/any" is expressed with
//     `minProperties`/`maxProperties`, which TypeScript cannot say.
//
// An object that does not set `additionalProperties: false` also gets an index
// signature: the wire carries more than the canon describes (`icon`,
// `comment`, `tn_parent` off `FeatureCompactSerializer`).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCALARS = { string: "string", integer: "number", number: "number", boolean: "boolean", null: "null" };

const literal = (value) => (typeof value === "string" ? JSON.stringify(value) : String(value));
const pascal = (name) => name.charAt(0).toUpperCase() + name.slice(1);

/** Prose → fixed-width lines under `prefix`, so a long `description` from the
 * canon does not become one 500-column comment. */
function wrap(text, prefix, width = 76) {
  const lines = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (line.length > 0 && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else line = line.length === 0 ? word : `${line} ${word}`;
  }
  if (line.length > 0) lines.push(line);
  return lines.map((one) => `${prefix}${one}`).join("\n");
}

function doc(schema, indent) {
  const parts = [];
  if (schema.description) parts.push(schema.description);
  if (schema.default !== undefined) parts.push(`@default ${JSON.stringify(schema.default)}`);
  if (parts.length === 0) return "";
  if (parts.length === 1 && parts[0].length + indent.length < 72) {
    return `${indent}/** ${parts[0]} */\n`;
  }
  const body = parts.map((p) => wrap(p, `${indent} * `, 72 - indent.length)).join("\n");
  return `${indent}/**\n${body}\n${indent} */\n`;
}

/** One sub-schema → a TypeScript type expression. `hoist` collects the named
 * interfaces an inline object sub-schema turns into. */
function tsType(schema, name, hoist) {
  if (schema.$ref) {
    const match = /^#\/\$defs\/(\w+)$/.exec(schema.$ref);
    if (!match) throw new Error(`gen:feature-def: unsupported $ref ${schema.$ref}`);
    return match[1];
  }
  if (schema.const !== undefined) return literal(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map(literal).join(" | ");
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((one) => tsType(one, name, hoist)).join(" | ");
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length === 0) return "unknown";
  return types
    .map((type) => {
      if (type === "array") return `readonly ${tsType(schema.items ?? {}, name, hoist)}[]`;
      if (type === "object") {
        if (!schema.properties) return "Readonly<Record<string, unknown>>";
        hoist.push(emitInterface(name, schema, hoist, /* inline */ true));
        return name;
      }
      const scalar = SCALARS[type];
      if (!scalar) throw new Error(`gen:feature-def: unsupported type "${type}" at ${name}`);
      return scalar;
    })
    .join(" | ");
}

/** An object sub-schema → `export interface <name> { … }`. */
function emitInterface(name, schema, hoist, inline) {
  const required = new Set(inline ? [] : (schema.required ?? []));
  const lines = [`${doc(schema, "")}export interface ${name} {`];
  for (const [property, sub] of Object.entries(schema.properties)) {
    const nested = [];
    const type = tsType(sub, `${name}${pascal(property)}`, nested);
    hoist.push(...nested);
    lines.push(`${doc(sub, "  ")}  readonly ${property}${required.has(property) ? "" : "?"}: ${type};`);
  }
  if (schema.additionalProperties !== false) {
    lines.push("  /** The wire carries more than the canon describes. */");
    lines.push("  readonly [key: string]: unknown;");
  }
  lines.push("}");
  return lines.join("\n");
}

/** The whole canon → one types-only module. */
export function emitFeatureDefTypes(schema, sourceLabel = "docs/feature-def.schema.json") {
  const blocks = [
    `// AUTO-GENERATED by scripts/gen-feature-def.mjs — do not edit by hand.\n` +
      `// Source: stapel-attributes ${sourceLabel} (§68 canon of a FeatureDef).\n` +
      `// Regenerate: pnpm gen:feature-def   ·   Drift gate: pnpm gen:feature-def:check\n` +
      `//\n${wrap(schema.description ?? "", "// ")}`,
  ];
  for (const [name, def] of Object.entries(schema.$defs ?? {})) {
    const hoist = [];
    const body = def.properties
      ? emitInterface(name, def, hoist, false)
      : `${doc(def, "")}export type ${name} = ${tsType(def, name, hoist)};`;
    blocks.push(...hoist, body);
  }
  return `${blocks.join("\n\n")}\n`;
}

async function main() {
  if (!process.env.FEATURE_DEF_SCHEMA || !process.env.FEATURE_DEF_OUT) {
    console.error("gen:feature-def: FEATURE_DEF_SCHEMA and FEATURE_DEF_OUT are both required.");
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const schemaPath = resolve(root, process.env.FEATURE_DEF_SCHEMA);
  const outPath = resolve(root, process.env.FEATURE_DEF_OUT);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, emitFeatureDefTypes(schema));
  console.error(
    `gen:feature-def: ${Object.keys(schema.$defs ?? {}).length} $defs from ${schemaPath}\n` +
      `                 → ${outPath}`
  );
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
