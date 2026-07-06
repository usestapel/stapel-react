#!/usr/bin/env node
// AUTO-GEN driver for a pair's typed analytics registry (frontend-guardrails
// §3.1). Same family as gen:api/gen:flows/gen:manifest/gen:tokens: static,
// deterministic, byte-stable, drift-gated. Emits ONE committed artifact:
//
//   src/analytics/generated/events.json   the package's event registry —
//     `defined` (defineEvent call sites, AST-extracted) + `flows`
//     (auto-instrumented funnels projected from flows.json).
//
// events.json is the single source the lint (G4 clickable-needs-event /
// event-literal-meta) and the report (G5) read, and it is embedded into
// manifest.json (`events`) + llms.txt by gen-manifest — so the description,
// the enforcement, and the runtime can't drift from the declarations.
//
// PARAMETRIZED BY PACKAGE (gen-flows/gen-manifest style knobs):
//
//   EVENTS_PKG_DIR   package dir (default packages/auth-react)
//   EVENTS_FLOWS     flows.json path (default <pkg>/src/flows/generated/flows.json)
//   EVENTS_OUT       output dir (default <pkg>/src/analytics/generated)
//
//   node scripts/gen-events.mjs        # generate
//   pnpm gen:events                    # generate (root script)
//   pnpm gen:events:check              # drift gate (fails on divergence)
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractDefinedEvents,
  flowFunnels,
  buildEventsJson,
} from "./events-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.EVENTS_PKG_DIR ?? "packages/auth-react");
const FLOWS_PATH =
  process.env.EVENTS_FLOWS ??
  resolve(PKG_DIR, "src/flows/generated/flows.json");
const OUT_DIR =
  process.env.EVENTS_OUT ?? resolve(PKG_DIR, "src/analytics/generated");
const OUT_JSON = resolve(OUT_DIR, "events.json");

const SRC_DIR = resolve(PKG_DIR, "src");
const SKIP_DIR = /(^|\/)generated(\/|$)/;
const SKIP_FILE = /\.(test|spec|d)\.tsx?$/;

/** Recursively collect .ts/.tsx source files, skipping generated + tests. */
async function collectSources(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.test(`/${e.name}/`)) continue;
      out.push(...(await collectSources(full)));
    } else if (/\.tsx?$/.test(e.name) && !SKIP_FILE.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const pkg = JSON.parse(await readFile(resolve(PKG_DIR, "package.json"), "utf8"));
  const flows = JSON.parse(await readFile(FLOWS_PATH, "utf8"));

  const files = (await collectSources(SRC_DIR)).sort();
  const defined = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    if (!src.includes("defineEvent")) continue;
    const rel = relative(PKG_DIR, file);
    defined.push(...extractDefinedEvents(src, rel));
  }
  defined.sort((a, b) => a.name.localeCompare(b.name));

  const eventsJson = buildEventsJson({
    pkg,
    defined,
    funnels: flowFunnels(flows),
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_JSON, `${JSON.stringify(eventsJson, null, 2)}\n`);

  console.error(
    `gen:events: ${defined.length} defined event(s), ` +
      `${eventsJson.flows.length} flow funnel(s)\n           → ${OUT_JSON}`
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
