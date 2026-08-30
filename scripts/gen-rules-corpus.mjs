#!/usr/bin/env node
// AUTO-GEN driver for the SHARED rule corpus (attributes-v2 §1.5, decision D4).
//
// `stapel_attributes.rules.evaluate_rules` and this repo's `evaluateRules` are
// two implementations of one closed grammar, and two evaluators cannot be
// trusted to agree by review. Upstream RECORDS the expectations
// (`GOLDEN_RECORD=1 pytest tests/test_rules_golden.py`) into
// `tests/golden/rules/{cases,pipeline,avito}/*.json`; this driver copies that
// corpus into the package as a generated artefact under `gen:check`, and
// `test/rules.golden.test.ts` runs EVERY case through the TypeScript half.
//
// So a divergence is a red test on whichever side deviated, instead of a
// silent split-brain in production — and a case added upstream reaches this
// repo through a pin bump, never through someone remembering to copy a file.
//
//   RULES_CORPUS_SRC  source dir (REQUIRED, .../stapel-attributes/tests/golden/rules)
//   RULES_CORPUS_OUT  output dir (REQUIRED, packages/attributes-react/test/fixtures/rules-corpus)
//
//   pnpm gen:rules         # generate
//   pnpm gen:rules:check   # drift gate
//
// ONE FILE, not a directory of copies: `index.json` carries every case in
// filename order per set, so the vitest side needs no glob (and no
// `resolveJsonModule` per file), and a review of the diff reads as one list
// rather than 69 renames. `avito/` is optional — the generated Avito set
// (§4.7) does not exist until stapel-tools emits it, and its absence is
// recorded as an empty list rather than a missing key.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SETS = ["cases", "pipeline", "avito"];

/** Every `*.json` of one set, in filename order — the ordering the upstream
 * test parametrizes on (`sorted(directory.glob("*.json"))`). */
async function readSet(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    out.push(JSON.parse(await readFile(join(dir, name), "utf8")));
  }
  return out;
}

export function buildCorpus(sets, sourceLabel) {
  return {
    $generated:
      "by scripts/gen-rules-corpus.mjs from the pinned stapel-attributes checkout — do not edit; drift-gated (pnpm gen:rules:check)",
    source: sourceLabel,
    ...sets,
  };
}

async function main() {
  if (!process.env.RULES_CORPUS_SRC || !process.env.RULES_CORPUS_OUT) {
    console.error("gen:rules: RULES_CORPUS_SRC and RULES_CORPUS_OUT are both required.");
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const src = resolve(root, process.env.RULES_CORPUS_SRC);
  const outDir = resolve(root, process.env.RULES_CORPUS_OUT);
  const sets = {};
  for (const set of SETS) sets[set] = await readSet(join(src, set));
  const corpus = buildCorpus(sets, "stapel-attributes tests/golden/rules");
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.json"), `${JSON.stringify(corpus, null, 2)}\n`);
  console.error(
    `gen:rules: ${SETS.map((s) => `${sets[s].length} ${s}`).join(", ")} from ${src}\n` +
      `           → ${join(outDir, "index.json")}`
  );
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
