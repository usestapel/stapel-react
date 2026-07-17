// Type-level consumer fixture (frontend-guardrails §1.2 — "a typo in a token
// name does not compile"). Compiled by test/fixtures/tsconfig.consumer.json via
// tokens-types.test.ts. The @ts-expect-error lines assert the typed union
// REJECTS bad names; if the union stopped catching them, tsc would flag the
// unused @ts-expect-error and the test would fail.
import { cssVar } from "../../src/index.js";
import type { CoreTokenName } from "../../src/index.js";

// ── valid: role var, scale var ────────────────────────────────────────────
export const a: string = cssVar("brand");
export const b: string = cssVar("surface-raised");
export const c: string = cssVar("space-4");
export const d: string = cssVar("radius-md");

// ── the union names are real, catalogued role names ───────────────────────
export const core: CoreTokenName = "surface";

// ── invalid: must NOT compile ────────────────────────────────────────────
// @ts-expect-error unknown role name
export const e: string = cssVar("nonexistent");
// @ts-expect-error §68 dropped the old "color-" prefix — not a real role
export const f: string = cssVar("color-brand");
// @ts-expect-error raw ramps are not addressable via cssVar
export const g: string = cssVar("gray.500");
// @ts-expect-error not a real role
export const h: CoreTokenName = "totally-made-up";
