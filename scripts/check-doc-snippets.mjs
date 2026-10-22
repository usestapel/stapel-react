#!/usr/bin/env node
// check:doc-snippets — the fleet's own lint rules over the code a pair's docs
// TEACH.
//
// A README or MODULE.md snippet is copied verbatim by whoever reads it — and
// through the advisor/KB that is a weak model writing a client page. A snippet
// that breaks `stapel/no-flattened-load-state` (`query.data?.x ?? []`) is a
// lint failure in every page written from it; a composer page generated that
// way failed exactly so. Demos are compiled and linted; docs were not.
//
// What it does: every ```tsx / ```ts / ```jsx fence in packages/*/README.md and
// MODULE.md is parsed as TSX and run through the plugin's syntactic
// correctness rules (none of them needs type information). A rule finding
// fails the run with file:line. A fence that does not parse (an excerpt with
// `…`, a props list without its element) cannot be judged and is COUNTED and
// listed, never silently passed.
//
// What it cannot see: types. A missing required option (`useUploadQueue({ max
// })`) is a tsc error, not a lint one; llms.txt now states each hook's required
// options (gen:manifest), which is the guard for that class.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { trackedPackageDirs } from "./packages-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = (await import(resolve(ROOT, "packages/eslint-plugin/index.js"))).default;

/** Correctness rules that need no type information and no project context. */
export const SNIPPET_RULES = {
  "stapel/no-flattened-load-state": "error",
  "stapel/no-raw-fetch": "error",
  "stapel/no-raw-error-shape": "error",
  "stapel/query-keys-from-factory": "error",
};

const FENCE = /^```(tsx|ts|jsx|typescript)\s*$/;

/** `[{ line, code }]` for every TS/TSX fence in a markdown text. */
export function extractSnippets(markdown) {
  const out = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!FENCE.test(lines[i].trim())) continue;
    const start = i + 1;
    let j = start;
    while (j < lines.length && lines[j].trim() !== "```") j++;
    out.push({ line: start + 1, code: lines.slice(start, j).join("\n") });
    i = j;
  }
  return out;
}

export function snippetLinter() {
  return new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { stapel: plugin },
        rules: SNIPPET_RULES,
      },
    ],
  });
}

/** Lint one snippet; `{ findings: [...], parsed: boolean }`. */
export async function lintSnippet(eslint, code, virtualPath) {
  const [result] = await eslint.lintText(code, { filePath: virtualPath });
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length > 0) return { parsed: false, findings: [], reason: fatal[0].message };
  return {
    parsed: true,
    findings: result.messages.map((m) => ({ line: m.line, rule: m.ruleId, message: m.message })),
  };
}

async function main() {
  const eslint = snippetLinter();
  let snippets = 0;
  const unparsed = [];
  const failures = [];
  for (const dir of trackedPackageDirs(ROOT, { warn: () => {} })) {
    for (const doc of ["README.md", "MODULE.md"]) {
      const path = resolve(ROOT, "packages", dir, doc);
      if (!existsSync(path)) continue;
      for (const s of extractSnippets(readFileSync(path, "utf8"))) {
        snippets += 1;
        const rel = `packages/${dir}/${doc}:${s.line}`;
        const r = await lintSnippet(eslint, s.code, resolve(ROOT, "packages", dir, "__snippet__.tsx"));
        if (!r.parsed) unparsed.push(`${rel} (${r.reason})`);
        for (const f of r.findings) {
          failures.push(`${rel.replace(/:\d+$/, "")}:${s.line + f.line - 1} ${f.rule}: ${f.message}`);
        }
      }
    }
  }
  console.log(
    `check:doc-snippets: ${snippets} snippet(s), ${snippets - unparsed.length} linted, ` +
      `${unparsed.length} not parseable (listed, not judged), ${failures.length} finding(s)`
  );
  for (const u of unparsed) console.log(`  not parseable: ${u}`);
  if (failures.length > 0) {
    console.error("✖ doc snippets teach code the fleet's lint rejects:\n" + failures.map((f) => `  ${f}`).join("\n"));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
