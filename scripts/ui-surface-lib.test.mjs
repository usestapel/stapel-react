import { test } from "node:test";
import assert from "node:assert/strict";
import { assertShipsUiFlows, parseTestids, renderLlmsUiSurface, validateUiFlows } from "./ui-surface-lib.mjs";

const SRC = `
/** doc */
export const SHOP_TESTIDS = {
  /** The control. */
  addToCart: "add-to-cart",
  pageCart: "page-cart", // trailing
  cartLine: "cart-line",
} as const;
`;
const IDS = parseTestids(SRC);

test("parses the test-id literal, comments and all", () => {
  assert.deepEqual(IDS, { addToCart: "add-to-cart", pageCart: "page-cart", cartLine: "cart-line" });
});

test("refuses a missing literal, a non-kebab id and a shared id", () => {
  assert.throws(() => parseTestids("export const X = 1;"), /no `export const <NAME>_TESTIDS/);
  assert.throws(() => parseTestids('export const A_TESTIDS = { a: "AddToCart" } as const'), /not a kebab-case/);
  assert.throws(
    () => parseTestids('export const A_TESTIDS = { a: "x-y", b: "x-y" } as const'),
    /a and b share the test id "x-y"/
  );
});

const doc = {
  schema: "stapel.flows/1",
  needs: ["listing_id"],
  flows: [
    {
      id: "cart",
      title: "Add and see it",
      session: "any",
      steps: [
        { op: "goto", path: "/l/{listing_id}" },
        { op: "click", testid: "add-to-cart" },
        { op: "expect", testid: "cart-line" },
      ],
    },
  ],
};

test("a valid document projects to id → title, session, step count", () => {
  assert.deepEqual(validateUiFlows(doc, IDS), { cart: { title: "Add and see it", session: "any", steps: 3 } });
});

test("refuses foreign test ids, undeclared vars, bad ops and schema", () => {
  const step = (s) => ({ ...doc, flows: [{ ...doc.flows[0], steps: [s] }] });
  assert.throws(() => validateUiFlows(step({ op: "click", testid: "login-submit" }), IDS), /not one of the pair's test ids/);
  assert.throws(() => validateUiFlows(step({ op: "goto", path: "/x/{nope}" }), IDS), /\{nope\} is neither in needs nor in vars/);
  assert.throws(() => validateUiFlows(step({ op: "hover", testid: "cart-line" }), IDS), /unknown op/);
  assert.throws(() => validateUiFlows(step({ op: "goto", path: "cart" }), IDS), /absolute path/);
  assert.throws(() => validateUiFlows(step({ op: "fill", field: { name: "x" } }), IDS), /needs within/);
  assert.throws(() => validateUiFlows({ ...doc, schema: "x" }, IDS), /schema must be/);
  assert.throws(
    () => validateUiFlows({ ...doc, flows: [{ ...doc.flows[0], session: "guest" }] }, IDS),
    /session must be one of/
  );
  assert.throws(() => validateUiFlows({ ...doc, flows: [doc.flows[0], doc.flows[0]] }, IDS), /declared twice/);
});

test("flows.json must be published", () => {
  assert.throws(() => assertShipsUiFlows({ name: "p", files: [], exports: {} }), /files.*exports/);
  assert.doesNotThrow(() =>
    assertShipsUiFlows({ name: "p", files: ["flows.json"], exports: { "./flows.json": "./flows.json" } })
  );
});

test("llms lines exist only for what the pair has", () => {
  assert.deepEqual(renderLlmsUiSurface(undefined, undefined), []);
  const lines = renderLlmsUiSurface(IDS, validateUiFlows(doc, IDS));
  assert.match(lines.join("\n"), /add-to-cart · page-cart · cart-line/);
  assert.match(lines.join("\n"), /- cart \(any\): Add and see it/);
});
