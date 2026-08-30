/**
 * THE GATE: for every value type, the config keys the MIRROR reads must be a
 * subset of the config keys its EDITOR reads.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * The audit found the same defect wearing three hats — `int`/`float`/`string`
 * ignoring `options`/`allowCustom` while `validate.ts` refused
 * `not_in_options`; `date` ignoring `allowFuture`/`allowPast` while the mirror
 * enforced them; `select` reading `uiStyle` on one branch of two and
 * `minSelected` on neither. Every instance is one sentence: **the control
 * offered something the mirror was already going to refuse**, which is §83's
 * "a control that means nothing in the current state" with a round trip
 * attached. Three patches would have closed three of them and left the fourth
 * to be found by a customer.
 *
 * So the invariant is asserted instead of reviewed, from the SOURCE of both
 * halves rather than from a hand-maintained list that can drift from either.
 * Add a rule to `validate.ts` that reads a new config key and this test names
 * the key, the type, and the editor that has to grow an affordance for it.
 *
 * ── What "reads" means, precisely ──────────────────────────────────────────
 *
 * A config key is READ by a function when its body contains `config["key"]`,
 * `cfg["key"]`, `num(config, "key")` or `list(config, "key")` — the four
 * spellings both files use. Helper functions are followed one level
 * ({@link HELPERS}): `SelectEditor` reaches `options` through `useChoices`,
 * and pretending otherwise would make the gate lie in the direction that
 * lets a real gap through.
 *
 * The subset runs in ONE direction on purpose. An editor may read keys the
 * mirror does not (`placeholder`, `multiline`, `date.options`, `lockInput`) —
 * those are affordances with no validation twin. The reverse is the defect.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_VALUE_EDITOR_TYPES } from "../src/default/editors.js";

/** vitest runs in jsdom here, where `import.meta.url` is a blob-ish URL — so
 * the sources are resolved from the package root (`process.cwd()`), which is
 * where both `vitest` and `turbo run test` start. */
function source(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

const MIRROR_SRC = source("src/validate.ts");
const EDITOR_SRC = source("src/default/editors.tsx");
const LABELS_SRC = source("src/default/labels.ts");

/** The body of a top-level `function NAME(…) {…}` or `const NAME … = … {…}`,
 * by brace matching from the declaration. */
function functionBody(source: string, name: string): string {
  const declaration = new RegExp(`(?:function|const)\\s+${name}\\b`).exec(source);
  if (declaration === null) throw new Error(`no declaration of ${name} found`);
  const open = source.indexOf("{", declaration.index);
  if (open === -1) throw new Error(`no body for ${name}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced body for ${name}`);
}

/** Helpers a body may reach a config key through, and the source they live
 * in. Followed one level — deeper indirection would mean a config read this
 * package cannot see, which is itself worth refusing. */
const HELPERS: Readonly<Record<string, string>> = {
  useChoices: EDITOR_SRC,
  isClosedList: EDITOR_SRC,
  uiStyleOf: EDITOR_SRC,
  toCascaderOptions: EDITOR_SRC,
  optionLabel: LABELS_SRC,
};

function keysIn(body: string): Set<string> {
  const keys = new Set<string>();
  const bracket = /(?:cfg|config)\s*\[\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\]/g;
  const call = /\b(?:num|list)\s*\(\s*config\s*,\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g;
  for (const re of [bracket, call]) {
    let match = re.exec(body);
    while (match !== null) {
      if (match[1] !== undefined) keys.add(match[1]);
      match = re.exec(body);
    }
  }
  return keys;
}

/** Config keys a function reads, following {@link HELPERS} one level. */
function configKeysRead(source: string, name: string): ReadonlySet<string> {
  const body = functionBody(source, name);
  const keys = keysIn(body);
  for (const [helper, helperSource] of Object.entries(HELPERS)) {
    if (!new RegExp(`\\b${helper}\\s*\\(`).test(body)) continue;
    for (const key of keysIn(functionBody(helperSource, helper))) keys.add(key);
  }
  return keys;
}

/** value type → the mirror rule and the editor that must offer what it checks.
 * `header` has no mirror rule at all (the batch validator skips headers). */
const HALVES: Readonly<Record<string, { mirror: string | null; editor: string }>> = {
  string: { mirror: "validateString", editor: "StringEditor" },
  int: { mirror: "validateNumber", editor: "makeNumberEditor" },
  float: { mirror: "validateNumber", editor: "makeNumberEditor" },
  bool: { mirror: "validateBool", editor: "BoolEditor" },
  select: { mirror: "validateSelect", editor: "SelectEditor" },
  date: { mirror: "validateDate", editor: "DateEditor" },
  header: { mirror: null, editor: "HeaderEditor" },
  hex_color: { mirror: "validateHexColor", editor: "HexColorEditor" },
  hierarchical_select: {
    mirror: "validateHierarchicalSelect",
    editor: "HierarchicalSelectEditor",
  },
  convertible_unit: {
    mirror: "validateConvertibleUnit",
    editor: "ConvertibleUnitEditor",
  },
  // The two vocabulary-backed types: the mirror judges SHAPE and CARDINALITY
  // only (whether a code exists is the resolver's answer, and a browser has
  // neither the table nor the authority), so the keys it reads are exactly the
  // bounds their controls have to carry.
  ref_select: { mirror: "validateRefSelect", editor: "RefSelectEditor" },
  ref_hierarchical_select: {
    mirror: "validateRefHierarchicalSelect",
    editor: "RefHierarchicalSelectEditor",
  },
};

describe("the extractor itself", () => {
  it("finds the keys it claims to find, so a green gate means something", () => {
    expect([...configKeysRead(MIRROR_SRC, "validateDate")].sort()).toEqual([
      "allowFuture",
      "allowPast",
      "maxDate",
      "minDate",
    ]);
    expect(configKeysRead(EDITOR_SRC, "SelectEditor").has("options")).toBe(true); // via useChoices
  });

  it("covers every builtin type — a type with no entry here is not gated", () => {
    expect(Object.keys(HALVES).sort()).toEqual([...BUILTIN_VALUE_EDITOR_TYPES].sort());
  });
});

describe("every config key the mirror reads reaches a control", () => {
  for (const [type, halves] of Object.entries(HALVES)) {
    it(`${type}: mirror keys ⊆ editor keys`, () => {
      const mirror =
        halves.mirror === null ? new Set<string>() : configKeysRead(MIRROR_SRC, halves.mirror);
      const editor = configKeysRead(EDITOR_SRC, halves.editor);
      const missing = [...mirror].filter((key) => !editor.has(key)).sort();
      // A failure reads: "date: allowPast is enforced by the mirror and has no
      // affordance in DateEditor" — the key, the type, and where to put it.
      expect(missing, `${type}: ${halves.editor} offers no affordance for ${missing.join(", ")}`).
        toEqual([]);
    });
  }
});
