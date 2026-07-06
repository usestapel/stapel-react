// Type-level consumer fixture (frontend-guardrails §1.2 — "a typo in a token
// name does not compile"). Compiled by test/fixtures/tsconfig.consumer.json via
// tokens-types.test.ts. The @ts-expect-error lines assert the typed union
// REJECTS bad names; if the union stopped catching them, tsc would flag the
// unused @ts-expect-error and the test would fail.
import { cssVar } from "../../src/index.js";
import type { CoreTokenName, ComponentTokenName } from "../../src/index.js";

// ── valid: core colour var, component var, scale var ─────────────────────────
export const a: string = cssVar("color-accent");
export const b: string = cssVar("button-primary-bg");
export const c: string = cssVar("space-4");
export const d: string = cssVar("radius-md");

// ── the union names are real, catalogued token names ─────────────────────────
export const core: CoreTokenName = "background-primary";
export const comp: ComponentTokenName = "card-border";

// ── invalid: must NOT compile ────────────────────────────────────────────────
// @ts-expect-error unknown token name
export const e: string = cssVar("color-nonexistent");
// @ts-expect-error component tokens are not prefixed with `color-`
export const f: string = cssVar("color-button-primary-bg");
// @ts-expect-error raw ramps are not addressable via cssVar
export const g: string = cssVar("gray.500");
// @ts-expect-error not a real core token
export const h: CoreTokenName = "totally-made-up";
