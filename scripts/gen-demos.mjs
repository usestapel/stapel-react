#!/usr/bin/env node
// AUTO-GEN driver for a package's design-system demos (frontend-guardrails §4).
// Same family as gen:api/gen:flows/gen:events/gen:manifest/gen:tokens: static,
// deterministic, byte-stable, drift-gated. From the `demo/**/*.demo.tsx` sources
// it emits the committed artifacts every consumer reads:
//
//   demo/generated/demos.json         the package's demo registry (embedded into
//                                      manifest.json + llms.txt by gen-manifest).
//   demo/generated/*.stories.tsx      CSF stories the viewer (Ladle) renders.
//
// It also runs the COMPLETENESS GATE (§4.2): every headless component a pair
// exports must be covered by ≥1 demo, else this exits non-zero with a teaching
// message — a headless component without a demo is a red build.
//
// PARAMETRIZED BY PACKAGE (gen-events/gen-manifest style knobs):
//
//   DEMOS_PKG_DIR   package dir (default packages/auth-react)
//   DEMOS_GATE      "1" (default) to run the completeness gate; "0" to skip
//                   (packages with no headless layer, e.g. tokens)
//
//   node scripts/gen-demos.mjs         # generate + gate
//   pnpm gen:demos                     # generate (root script, all packages)
//   pnpm gen:demos:check               # drift gate (fails on divergence)
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractDemos,
  headlessExports,
  completenessGate,
  buildDemosJson,
  renderStory,
} from "./demos-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.DEMOS_PKG_DIR ?? "packages/auth-react");
const RUN_GATE = (process.env.DEMOS_GATE ?? "1") !== "0";

const DEMO_DIR = resolve(PKG_DIR, "demo");
const GEN_DIR = resolve(DEMO_DIR, "generated");
const OUT_JSON = resolve(GEN_DIR, "demos.json");

/** The package's viewer sidebar group — its dir name (e.g. "auth-react"). */
const GROUP = PKG_DIR.split("/").pop() ?? "package";

/** Collect `demo/*.demo.tsx` (skip generated + the `_harness`). */
async function collectDemoFiles() {
  let entries = [];
  try {
    entries = await readdir(DEMO_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && /\.demo\.tsx?$/.test(e.name))
    .map((e) => resolve(DEMO_DIR, e.name))
    .sort();
}

async function main() {
  const pkg = JSON.parse(await readFile(resolve(PKG_DIR, "package.json"), "utf8"));
  const files = await collectDemoFiles();

  // Extract every demo, remembering which source file each came from (for the
  // per-file story import specifier).
  const demos = [];
  const byFile = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    if (!src.includes("defineDemo")) continue;
    const rel = relative(PKG_DIR, file);
    const fileDemos = extractDemos(src, rel);
    demos.push(...fileDemos);
    if (fileDemos.length > 0) byFile.push({ file, demos: fileDemos });
  }
  demos.sort((a, b) => a.id.localeCompare(b.id));

  // Rewrite the generated dir from scratch so stale stories can't linger.
  await rm(GEN_DIR, { recursive: true, force: true });
  await mkdir(GEN_DIR, { recursive: true });

  const demosJson = buildDemosJson({ pkg, demos });
  await writeFile(OUT_JSON, `${JSON.stringify(demosJson, null, 2)}\n`);

  let storyCount = 0;
  for (const { file, demos: fileDemos } of byFile) {
    // demo/generated/<name>.stories.tsx imports demo/<name>.demo.tsx
    const stem = basename(file).replace(/\.tsx?$/, "");
    const demoImport = `../${stem}.js`;
    for (const demo of fileDemos) {
      const story = renderStory(demo, demoImport, GROUP);
      const outName = `${stem.replace(/\.demo$/, "")}.stories.tsx`;
      await writeFile(resolve(GEN_DIR, outName), story);
      storyCount += 1;
    }
  }

  // Completeness gate — every headless export must be covered by a demo.
  let gateNote = "";
  if (RUN_GATE) {
    const indexSrc = await readFile(resolve(PKG_DIR, "src/index.ts"), "utf8");
    const headless = headlessExports(indexSrc);
    const { missing } = completenessGate(headless, demos);
    if (missing.length > 0) {
      console.error(
        `✖ demos: ${missing.length} headless component(s) without a demo — a headless\n` +
          `  component of a pair must have ≥1 demo (frontend-guardrails §4.2):\n` +
          missing.map((n) => `    - ${n}`).join("\n") +
          `\n  Add packages/${GROUP}/demo/<Name>.demo.tsx with defineDemo({ component: ${missing[0]}, … }),\n` +
          `  or list it in an existing demo's \`covers: [...]\`.`
      );
      process.exit(1);
    }
    gateNote = `, ${headless.length} headless covered`;
  }

  console.error(
    `gen:demos: ${demos.length} demo(s), ${storyCount} stor${storyCount === 1 ? "y" : "ies"}${gateNote}\n` +
      `          → ${relative(ROOT, GEN_DIR)}`
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
