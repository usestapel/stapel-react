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
  defaultSkinImportNames,
  defaultSkinExports,
  defaultSkinGate,
} from "./demos-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.DEMOS_PKG_DIR ?? "packages/auth-react");
const RUN_GATE = (process.env.DEMOS_GATE ?? "1") !== "0";
// The DEFAULT-SKIN gate (§54 machine form). Three modes, because the fleet does
// not pass it yet and a gate nobody can go green against gets deleted:
//   "list"   (default) print the per-package gap report, exit 0
//   "strict" print it and exit 1 — flipped on after the pair wave
//   "off"    skip entirely
// `node scripts/gen-demos.mjs --strict` is the same switch on the command line.
const SKIN_MODE = process.argv.includes("--strict")
  ? "strict"
  : (process.env.DEMOS_SKIN_GATE ?? "list");

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

/** Read an optional JSON file; ENOENT degrades to `fallback`. */
async function readJsonOptional(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

/** Every `src/default/**\/index.ts` barrel of the package, deepest last. */
async function defaultBarrels(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await defaultBarrels(full)));
    else if (e.isFile() && /^index\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

/**
 * What the default-skin gate requires of this package: every component the
 * `/default` barrels export, plus every `component.export` its nav manifest
 * names — a screen the scaffold routes to that has never been drawn is the
 * worst gap of the set, so it is required even if the barrel spells it
 * differently.
 */
async function requiredSkinNames() {
  const names = new Set();
  for (const barrel of await defaultBarrels(resolve(PKG_DIR, "src/default"))) {
    for (const n of defaultSkinExports(await readFile(barrel, "utf8"))) names.add(n);
  }
  const nav = await readJsonOptional(resolve(PKG_DIR, "nav-manifest.json"), null);
  for (const entry of nav?.entries ?? []) {
    const name = entry?.component?.export;
    if (typeof name === "string" && /^[A-Z]/.test(name)) names.add(name);
  }
  return [...names].sort();
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
    if (fileDemos.length > 0) {
      byFile.push({
        file,
        demos: fileDemos,
        defaultImports: defaultSkinImportNames(src, rel),
      });
    }
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

  // Default-skin gate — every /default export and every nav-mounted screen must
  // be rendered by a demo that imports it FROM src/default (§54).
  if (SKIN_MODE !== "off") {
    const required = await requiredSkinNames();
    if (required.length > 0) {
      const allow = await readJsonOptional(
        resolve(PKG_DIR, "demo/skin-coverage.allow.json"),
        {}
      );
      const { missing, noPhone, unseeded, covered } = defaultSkinGate(
        required,
        byFile,
        allow
      );
      const lines = [];
      if (missing.length > 0) {
        lines.push(
          `  no demo renders the default skin (imported from src/default):\n` +
            missing.map((n) => `    - ${n}`).join("\n")
        );
      }
      if (noPhone.length > 0) {
        lines.push(
          `  demoed, but no variant declares viewport: "phone":\n` +
            noPhone.map((n) => `    - ${n}`).join("\n")
        );
      }
      if (unseeded.length > 0) {
        lines.push(
          `  multi-variant skin demos with no variant declaring the step it is\n` +
            `  seeded at (a state reached only by a click is never photographed):\n` +
            unseeded.map((id) => `    - ${id}`).join("\n")
        );
      }
      if (lines.length > 0) {
        const verb = SKIN_MODE === "strict" ? "✖" : "⚠";
        console.error(
          `${verb} default-skin demos [${GROUP}]: ${covered.length}/${required.length} covered\n` +
            lines.join("\n") +
            `\n  Add a demo importing the component from ../src/default/<Name>.js with\n` +
            `  defineDemo({ component: <Name>, variants: { default: { viewport: "phone", … } } }),\n` +
            `  or record a reason in packages/${GROUP}/demo/skin-coverage.allow.json.` +
            (SKIN_MODE === "strict"
              ? ""
              : `\n  (listing mode — set DEMOS_SKIN_GATE=strict or pass --strict to fail on this)`)
        );
        if (SKIN_MODE === "strict") process.exit(1);
      }
      gateNote += `, ${covered.length}/${required.length} skin covered`;
    }
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
