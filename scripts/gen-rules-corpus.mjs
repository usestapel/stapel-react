#!/usr/bin/env node
// AUTO-GEN driver for the SHARED rule corpus (attributes-v2 §1.5, decision D4).
//
// `stapel_attributes.rules.evaluate_rules` and this repo's `evaluateRules` are
// two implementations of one closed grammar, and two evaluators cannot be
// trusted to agree by review. Upstream RECORDS the expectations
// (`GOLDEN_RECORD=1 pytest tests/test_rules_golden.py`) into
// `tests/golden/rules/{cases,pipeline,imported}/*.json`; this driver copies that
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
// ── TWO SHAPES, BECAUSE UPSTREAM HAS TWO ───────────────────────────────────
//
// `cases` and `pipeline` are DIRECTORIES of hand-written cases, one file each
// (59 + 10 at stapel-attributes 0.5.1). They are inlined into a single
// `index.json` in filename order — the ordering the upstream test parametrizes
// on — so the vitest side needs no glob and a review of the diff reads as one
// list rather than 69 renames.
//
// `imported` is not that. It is the GENERATED corpus (the catalogue
// importer's `--emit-rule-cases`, §4.7): 3890 distinct rules recorded from a
// real imported catalogue and de-identified upstream, in two files that are
// single-line compact arrays of several MB, with the feature set stored once per
// polarity PAIR. Those are copied BYTE FOR BYTE — not parsed, not re-indented,
// not merged into index.json — for three reasons: re-serializing 12 MB through
// `JSON.stringify(…, null, 2)` would quadruple it and make every future diff
// unreadable; a byte copy is the only form in which "this file IS upstream's
// file" is checkable by eye; and the test reads them with `readFileSync`
// rather than a static import, so vite never has to transform a 10 MB module.
//
// `index.json` therefore records the imported file NAMES rather than their
// contents, and an absent `imported/` directory is recorded as an empty list —
// the set does not exist in a checkout of stapel-attributes older than 0.5.1,
// and its absence is a fact rather than a missing key.
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The two hand-written sets, inlined into index.json. */
const INLINE_SETS = ["cases", "pipeline"];
/** The generated set, copied verbatim into `<out>/imported/`. */
const COPY_SET = "imported";

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

/** The `*.json` filenames of one set, in filename order. */
async function listSet(dir) {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
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
  await mkdir(outDir, { recursive: true });

  const sets = {};
  for (const set of INLINE_SETS) sets[set] = await readSet(join(src, set));

  // The generated set: a byte copy, and a REPLACED directory — a file deleted
  // upstream must disappear here too, or the drift gate would go green over a
  // corpus this repo alone still carries.
  const importedSrc = join(src, COPY_SET);
  const importedOut = join(outDir, COPY_SET);
  const importedNames = await listSet(importedSrc);
  await rm(importedOut, { recursive: true, force: true });
  let importedBytes = 0;
  if (importedNames.length > 0) {
    await mkdir(importedOut, { recursive: true });
    for (const name of importedNames) {
      const bytes = await readFile(join(importedSrc, name));
      importedBytes += bytes.byteLength;
      await writeFile(join(importedOut, name), bytes);
    }
  }
  sets[COPY_SET] = importedNames;

  const corpus = buildCorpus(sets, "stapel-attributes tests/golden/rules");
  await writeFile(join(outDir, "index.json"), `${JSON.stringify(corpus, null, 2)}\n`);
  console.error(
    `gen:rules: ${INLINE_SETS.map((s) => `${sets[s].length} ${s}`).join(", ")}, ` +
      `${importedNames.length} imported file(s) copied verbatim ` +
      `(${(importedBytes / 1_048_576).toFixed(1)} MB) from ${src}\n` +
      `           → ${join(outDir, "index.json")}`
  );
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
