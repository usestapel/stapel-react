/**
 * The contract test — this package's pin against stapel-attributes' own
 * registry, and this repo's stand-in for importing Python.
 *
 * stapel-attributes emits no `docs/schema.json` (it is an L1 library with no
 * HTTP surface at all), so `pnpm gen:api` has nothing to read and the usual
 * drift gate does not exist here. What it DOES emit is a pair of committed,
 * upstream-drift-gated corpora that say exactly what this package must agree
 * with:
 *
 *   tests/golden/declarations.json  keys = the builtin feature-type registry
 *   tests/golden/error_codes.json   generated from the ValidationErrorCode enum
 *
 * Both are asserted upstream from BOTH Python and TypeScript (the
 * cross-language golden bridge, MODULE.md §"Cross-language golden bridge"),
 * so they are the closest thing to machine truth reachable from here.
 *
 * Two layers, so the gate runs in CI and still cannot rot:
 *
 *  1. ALWAYS — the committed fixture is the pin, and the package's own type
 *     set and error vocabulary must equal it. This runs everywhere, including
 *     a CI that checks out no sibling.
 *  2. WHEN THE SIBLING IS PRESENT — the fixture itself is compared against the
 *     live corpora under `${SIBLING_ROOT:-..}/stapel-attributes`. A type added
 *     upstream turns this red locally, which is where the fixture gets
 *     refreshed. Skipped-with-a-reason when the checkout is absent, never
 *     silently passed.
 */
// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VALIDATION_ERROR_CODES } from "../src/errors.js";
import { FORMATTABLE_TYPES } from "../src/format.js";
import { BUILTIN_VALUE_EDITOR_TYPES } from "../src/default/editors.js";

const PKG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const pin = JSON.parse(
  readFileSync(resolve(PKG_DIR, "test/fixtures/attributes-registry.json"), "utf8")
) as { types: string[]; errorCodes: string[]; _version: string; _ref: string };

// Sibling backends live one directory up from the repo root, re-pointable
// through `SIBLING_ROOT` — the same resolution every `gen:*` driver uses.
const REPO_ROOT = resolve(PKG_DIR, "../..");
const UPSTREAM = resolve(
  REPO_ROOT,
  process.env["SIBLING_ROOT"] ?? "..",
  "stapel-attributes"
);
const hasUpstream = existsSync(resolve(UPSTREAM, "tests/golden/declarations.json"));

describe("the builtin type set is stapel-attributes' registry", () => {
  it("the skin draws every builtin type, and no type it invented", () => {
    expect([...BUILTIN_VALUE_EDITOR_TYPES]).toEqual(pin.types);
  });

  it("every type it can EDIT it can also DISPLAY — a half-shipped type is worse than a missing one", () => {
    expect([...FORMATTABLE_TYPES]).toEqual([...BUILTIN_VALUE_EDITOR_TYPES]);
  });

  it("the mirrored ValidationErrorCode vocabulary is complete", () => {
    expect([...VALIDATION_ERROR_CODES]).toEqual(pin.errorCodes);
  });
});

describe.skipIf(!hasUpstream)(
  "the pin still matches the live stapel-attributes checkout",
  () => {
    it("declarations.json's keys are the pinned type list", () => {
      const declarations = JSON.parse(
        readFileSync(resolve(UPSTREAM, "tests/golden/declarations.json"), "utf8")
      ) as Record<string, unknown>;
      expect(Object.keys(declarations).sort()).toEqual(pin.types);
    });

    it("error_codes.json is the pinned code list", () => {
      const codes = JSON.parse(
        readFileSync(resolve(UPSTREAM, "tests/golden/error_codes.json"), "utf8")
      ) as string[];
      expect([...codes].sort()).toEqual(pin.errorCodes);
    });
  }
);
