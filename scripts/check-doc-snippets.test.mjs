// check:doc-snippets — the rules judge a snippet, an excerpt is counted as
// unparsed rather than passed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractSnippets, lintSnippet, snippetLinter } from "./check-doc-snippets.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AT = resolve(ROOT, "packages/listings-react/__snippet__.tsx");
const eslint = snippetLinter();

test("extracts ts/tsx fences with their first code line", () => {
  const md = "x\n```tsx\nconst a = 1;\n```\n```bash\nls\n```\n```ts\nlet b;\n```\n";
  assert.deepEqual(extractSnippets(md), [
    { line: 3, code: "const a = 1;" },
    { line: 9, code: "let b;" },
  ]);
});

test("a flattened load state in a snippet is a finding", async () => {
  const r = await lintSnippet(
    eslint,
    "const f = useCategoryFeatures(id);\n<C features={f.data?.features ?? []} />;",
    AT
  );
  assert.equal(r.parsed, true);
  assert.deepEqual(r.findings.map((x) => [x.line, x.rule]), [[2, "stapel/no-flattened-load-state"]]);
});

test("the template's mapLoad form passes", async () => {
  const r = await lintSnippet(
    eslint,
    "const f = mapLoad(loadStateFromQuery(useCategoryFeatures(id)), (r) => r.features);\n" +
      '<C features={loadedRowsOrEmpty(f)} featuresLoading={f.status === "loading"} />;',
    AT
  );
  assert.deepEqual(r, { parsed: true, findings: [] });
});

test("an excerpt that does not parse is reported, not passed", async () => {
  const r = await lintSnippet(eslint, "<C …props />", AT);
  assert.equal(r.parsed, false);
});
