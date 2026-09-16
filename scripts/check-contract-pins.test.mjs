// node --test scripts/check-contract-pins.test.mjs
//
// The rule under test: `classifyWireDiff` splits "behind" into two verdicts —
// wire byte-identical (safe to auto-bump, no review) and wire moved (named,
// for a human) — and the names it prints for a moved wire are precise enough
// to act on without opening the sibling repo: which file, which operation or
// schema, which field, and whether anything became required.
//
// Proven two ways:
//   1. Against SYNTHETIC before/after documents, so the required-field and
//      error-code cases are asserted deterministically and do not depend on
//      any sibling checkout being present.
//   2. Against REAL commits from the fleet's own 2026-09-16 pin sweep —
//      stapel-gdpr 0.5.8 -> v0.7.1 (wire moved: the L-6 rate-limit budget adds
//      a 429 to three operations) and stapel-video / stapel-moderation, both
//      one minor behind and byte-identical end to end. The real-pair tests
//      skip gracefully when a sibling is not checked out at `../<module>` —
//      same convention as pin-siblings.test.mjs — rather than failing a
//      desk run that never cloned every sibling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyWireDiff,
  diffErrorsJson,
  diffFlowsJson,
  diffSchemaJson,
  diffWireFile,
} from "./check-contract-pins.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(HERE, "..", "..");

function siblingDir(module) {
  return resolve(WORKSPACE_ROOT, module);
}

// ---------------------------------------------------------------------------
// 1. Synthetic — deterministic, no sibling checkout required.
// ---------------------------------------------------------------------------

test("diffSchemaJson: a new REQUIRED field is named, not just noticed", () => {
  const before = {
    paths: {},
    components: {
      schemas: {
        RecordingDTO: {
          properties: { id: { type: "string" }, status: { type: "string" } },
          required: ["id", "status"],
        },
      },
    },
  };
  const after = {
    paths: {},
    components: {
      schemas: {
        RecordingDTO: {
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            needs_payment_reason: { type: "string", nullable: true },
          },
          required: ["id", "needs_payment_reason", "status"],
        },
      },
    },
  };
  const bullets = diffSchemaJson(before, after);
  assert.ok(
    bullets.includes("RecordingDTO.needs_payment_reason: new field"),
    `expected the new field named; got:\n${bullets.join("\n")}`
  );
  assert.ok(
    bullets.includes("RecordingDTO.needs_payment_reason: BECAME REQUIRED"),
    `expected the required-set change named; got:\n${bullets.join("\n")}`
  );
});

test("diffSchemaJson: a field leaving the required set is named the other way round", () => {
  const before = { components: { schemas: { X: { properties: { a: {} }, required: ["a"] } } } };
  const after = { components: { schemas: { X: { properties: { a: {} }, required: [] } } } };
  assert.deepEqual(diffSchemaJson(before, after), ["X.a: no longer required"]);
});

test("diffSchemaJson: an operation gaining a status code is named by operationId", () => {
  const before = { paths: { "/x": { post: { operationId: "x_create", responses: { "200": {} } } } } };
  const after = {
    paths: {
      "/x": { post: { operationId: "x_create", responses: { "200": {}, "429": {} } } },
    },
  };
  assert.deepEqual(diffSchemaJson(before, after), ["x_create: gains a 429 response"]);
});

test("diffSchemaJson: an enum rename shows as a type change on every property that referenced it — the categories 0.23.1 shape", () => {
  const before = {
    components: {
      schemas: {
        AxisRoleEnum: { enum: ["make"], type: "string" },
        Feature: { properties: { axis_role: { oneOf: [{ $ref: "#/components/schemas/AxisRoleEnum" }] } } },
      },
    },
  };
  const after = {
    components: {
      schemas: {
        AxisRoleDerivedEnum: { enum: ["make"], type: "string" },
        Feature: { properties: { axis_role: { oneOf: [{ $ref: "#/components/schemas/AxisRoleDerivedEnum" }] } } },
      },
    },
  };
  const bullets = diffSchemaJson(before, after);
  assert.ok(bullets.includes("schema AxisRoleEnum: REMOVED"));
  assert.ok(bullets.includes("schema AxisRoleDerivedEnum: new"));
  assert.ok(
    bullets.some((b) => b === "Feature.axis_role: type changed (oneOf(#/components/schemas/AxisRoleEnum) -> oneOf(#/components/schemas/AxisRoleDerivedEnum))"),
    `expected the renamed enum's effect on the property that references it; got:\n${bullets.join("\n")}`
  );
});

test("diffSchemaJson: a pure description edit is reported only when nothing structural already explains the byte diff", () => {
  const before = { components: { schemas: { X: { description: "old wording", properties: {}, required: [] } } } };
  const after = { components: { schemas: { X: { description: "new wording", properties: {}, required: [] } } } };
  assert.deepEqual(diffSchemaJson(before, after), ["schema X: description text changed"]);
});

test("diffSchemaJson: identical documents produce no bullets", () => {
  const doc = { paths: { "/x": { get: { operationId: "x", responses: { "200": {} } } } }, components: { schemas: {} } };
  assert.deepEqual(diffSchemaJson(doc, JSON.parse(JSON.stringify(doc))), []);
});

test("diffErrorsJson: a new error code is named with its status; a changed one is named without repeating its full body", () => {
  const before = [{ code: "error.409.a", status: 409, en: "a" }];
  const after = [
    { code: "error.409.a", status: 409, en: "a changed" },
    { code: "error.429.b", status: 429, en: "b" },
  ];
  const bullets = diffErrorsJson(before, after);
  assert.ok(bullets.includes("error.429.b: new error code (status 429)"));
  assert.ok(bullets.includes("error.409.a: text or params changed"));
});

test("diffFlowsJson: added/removed flows are named by id", () => {
  const before = [{ id: "a", title: "A" }];
  const after = [{ id: "b", title: "B" }];
  const bullets = diffFlowsJson(before, after);
  assert.ok(bullets.includes("flow a: REMOVED"));
  assert.ok(bullets.includes("flow b: new"));
});

test("diffWireFile: byte-identical text is silent even without parsing it", () => {
  assert.deepEqual(diffWireFile("docs/schema.json", "same text", "same text"), []);
});

test("diffWireFile: a file appearing for the first time is named as new, not diffed against nothing", () => {
  assert.deepEqual(diffWireFile("docs/flows.json", null, "[]"), ["docs/flows.json: file did not exist at the pinned ref"]);
});

// ---------------------------------------------------------------------------
// 2. Real pairs — the fleet's own 2026-09-16 pin sweep.
// ---------------------------------------------------------------------------

test("classifyWireDiff: stapel-gdpr 0.5.8 -> v0.7.1 is WIRE MOVED — the L-6 rate-limit budget names its 429s", { skip: !existsSync(siblingDir("stapel-gdpr")) }, () => {
  const dir = siblingDir("stapel-gdpr");
  // The pin this repo carried into 2026-09-16 (contract-pins.json history).
  const pinnedRef = "eb3eeb46419554cc37b24ddcac00a64926b70ac2";
  const result = classifyWireDiff(dir, pinnedRef, [0, 7, 1]);
  assert.equal(result.resolvable, true, "v0.7.1 must resolve in a checkout that has it");
  assert.equal(result.identical, false, "0.6.0's 429 budget is a real wire move, not a restamp");
  assert.ok(
    result.bullets.some((b) => /gains a 429 response/.test(b)),
    `expected at least one operation to gain a 429; got:\n${result.bullets.join("\n")}`
  );
  // 0.7.0/0.7.1 (the export-location fix that motivated moving the pin) is
  // internal-only — the diff must NOT invent a change for it.
  assert.ok(
    !result.bullets.some((b) => /archive_path|EXPORT_ROOT/.test(b)),
    "the export-location work never touches docs/schema.json and must not appear here"
  );
});

test("classifyWireDiff: stapel-video, one minor behind, is wire byte-identical — safe", { skip: !existsSync(siblingDir("stapel-video")) }, () => {
  const dir = siblingDir("stapel-video");
  const pinnedRef = "7962844455e88d9980228f6d35d9a04db89b3760"; // pinned at 0.11.2 through 2026-09-16
  const result = classifyWireDiff(dir, pinnedRef, [0, 12, 0]);
  assert.equal(result.resolvable, true);
  assert.deepEqual(result.bullets, []);
  assert.equal(result.identical, true);
});

test("classifyWireDiff: stapel-moderation, one minor behind, is wire byte-identical — safe", { skip: !existsSync(siblingDir("stapel-moderation")) }, () => {
  const dir = siblingDir("stapel-moderation");
  const pinnedRef = "cd50493e9521b42779d40ff7298862376d827874"; // pinned at 0.7.2 through 2026-09-16
  const result = classifyWireDiff(dir, pinnedRef, [0, 8, 0]);
  assert.equal(result.resolvable, true);
  assert.deepEqual(result.bullets, []);
  assert.equal(result.identical, true);
});

test("classifyWireDiff: an unfetchable tag is reported as unresolvable, never as identical", () => {
  // A sibling directory that exists but is not a git repo at all: fetchTagCommit
  // must fail closed (`resolvable: false`), not read "no bytes compared" as
  // "no bytes differ".
  const result = classifyWireDiff(HERE, "0".repeat(40), [99, 0, 0]);
  assert.equal(result.resolvable, false);
  assert.equal(result.identical, false);
});
