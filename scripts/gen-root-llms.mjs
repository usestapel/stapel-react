#!/usr/bin/env node
// Root llms.txt for the stapel-react MONOREPO (badge-canon §3 p.5 / §4): the
// frontend twin of stapel-tools' `stapel-catalog` fleet index. A per-package
// `packages/<dir>/llms.txt` (scripts/gen-manifest.mjs, scripts/gen-tokens.mjs)
// answers "what does THIS package export"; this file answers the question
// that has to come first — "which package do I even want" — in ONE small
// read instead of 16.
//
// Same three properties as every other llms.txt in this fleet, reused rather
// than reinvented:
//   1. Deterministic — packages sorted by name, no timestamps.
//   2. Hard token budget (LLMS_TOKEN_BUDGET, shared with gen-manifest.mjs) —
//      throws, never truncates.
//   3. LOUD about partial coverage — a package counts as "described" only
//      when packages/<dir>/llms.txt actually exists; the rest are listed by
//      name under "Not yet described", never silently dropped.
//
// ── THE GROUPING LAYER (2026-08-30) ────────────────────────────────────────
//
// The flat one-line-per-package list hit the token budget at 35 packages, and
// the budget THROWS rather than truncating — correctly, because an index that
// silently drops the package you needed is worse than no index. The fix the
// error message asks for, done here:
//
//   · Packages are grouped by ROLE (backend pairs / substrate / design
//     tokens), because "which package do I even want" is answered by role
//     first and by name second.
//   · The per-line `packages/<dir>/llms.txt` path is gone. It was ~40
//     characters of the same derivable string on every line; the convention is
//     now stated ONCE in the header, and `assertDirDerivable` fails the build
//     the day a package's directory stops matching its unscoped name — so the
//     convention cannot quietly become a lie.
//
// That is ~300 tokens back, without any package losing its line.
//
//   node scripts/gen-root-llms.mjs         # generate ./llms.txt
//   pnpm gen:root-llms                     # generate (root script)
//   pnpm gen:root-llms:check               # drift gate (fails on divergence)
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PACKAGES_DIR = resolve(ROOT, "packages");
const OUT_PATH = resolve(ROOT, "llms.txt");
const LLMS_TOKEN_BUDGET = 4000; // same budget every llms.txt in this fleet fits

const approxTokens = (text) => Math.ceil(text.length / 4);

async function publicPackages() {
  const dirs = (await readdir(PACKAGES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const out = [];
  for (const dir of dirs) {
    const pkgPath = resolve(PACKAGES_DIR, dir, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    } catch (e) {
      if (e?.code === "ENOENT") continue; // not a real package dir
      throw e;
    }
    if (pkg.private) continue; // e.g. showcase-viewer — never published, never listed
    const llmsPath = resolve(PACKAGES_DIR, dir, "llms.txt");
    const hasLlms = await readFile(llmsPath, "utf8").then(
      () => true,
      (e) => {
        if (e?.code === "ENOENT") return false;
        throw e;
      }
    );
    out.push({ dir, name: pkg.name, description: pkg.description ?? "", hasLlms });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The role a package plays, which is the first thing somebody choosing one
 * needs to know. Derived from the NAME, not from a hand list, so a new package
 * lands in a group without anybody remembering to file it.
 */
function groupOf(name) {
  if (name.startsWith("@stapel/tokens")) return "Design tokens";
  if (name.endsWith("-react")) return "Backend pairs";
  return "Substrate";
}

/** Header order: pairs first (the reason this repo exists), then the layers
 * underneath them. */
const GROUP_ORDER = ["Backend pairs", "Substrate", "Design tokens"];

/**
 * The path convention this index states once instead of repeating per line.
 * It holds for every package today; the day it stops holding, this throws
 * rather than letting the header promise a path that does not exist.
 */
function assertDirDerivable(pkgs) {
  const broken = pkgs.filter((p) => p.name.split("/").pop() !== p.dir);
  if (broken.length > 0) {
    throw new Error(
      "gen-root-llms: this index states `packages/<name without @stapel/>/llms.txt` " +
        "as a convention instead of printing the path on every line, and these " +
        "packages break it:\n" +
        broken.map((p) => `    - ${p.name} lives in packages/${p.dir}`).join("\n") +
        "\n  Either rename the directory to match, or print the path for these entries."
    );
  }
}

/**
 * The OTHER string that repeats on nearly every line. Nineteen of the
 * described packages close their description with the same two facts — the
 * main entry is headless, and whether an opt-in `/default` subpath ships a
 * skin — spending ~475 tokens to say it nineteen times. Same treatment as the
 * per-line path above: state the convention ONCE in the header, and keep only
 * the bit that actually differs between packages (does a skin exist at all)
 * as a marker. The full skin prose stays where a reader who cares is already
 * being sent — the package's own llms.txt.
 */
const SKIN_TAIL = /\s*Zero visual opinion\b[\s\S]*$/;

function indexLine(p) {
  const full = p.description ?? "";
  if (!full) return `- **${p.name}**`;
  const tail = full.match(SKIN_TAIL)?.[0] ?? "";
  const head = full.replace(SKIN_TAIL, "").trim() || full;
  const marker = tail.includes("/default") ? " _(+ `/default` skin)_" : "";
  return `- **${p.name}** — ${head}${marker}`;
}

function render(pkgs) {
  assertDirDerivable(pkgs);
  const described = pkgs.filter((p) => p.hasLlms);
  const missing = pkgs.filter((p) => !p.hasLlms);
  const L = [];
  L.push("# stapel-react — llms.txt index");
  L.push("");
  L.push(
    `${described.length}/${pkgs.length} packages describe their own surface `
      + "in llms.txt as of this build."
  );
  L.push("");
  L.push(
    "Generated by `scripts/gen-root-llms.mjs` from each package's "
      + "package.json (`description`) and llms.txt presence. Do not edit by hand."
  );
  L.push("");
  L.push(
    "An agent that does not yet know which package it needs reads this ONE "
      + "file, picks a name below, then reads that package's full surface "
      + "(exports, hooks, operations, errors) at "
      + "`packages/<name without @stapel/>/llms.txt` — `@stapel/auth-react` is "
      + "`packages/auth-react/llms.txt`."
  );
  L.push("");
  L.push(
    "Every package here is headless in its main entry — a line below says "
      + "what the package does, never how it looks. "
      + "``_(+ `/default` skin)_`` marks the ones that ALSO ship an opt-in antd "
      + "skin on a `/default` subpath; which slots that skin fills, and any "
      + "further subpath, is in that package's own llms.txt."
  );
  L.push("");
  L.push(`## Described (${described.length})`);
  if (described.length > 0) {
    for (const group of GROUP_ORDER) {
      const rows = described.filter((p) => groupOf(p.name) === group);
      if (rows.length === 0) continue;
      L.push("");
      L.push(`### ${group} (${rows.length})`);
      L.push("");
      for (const p of rows) {
        L.push(indexLine(p));
      }
    }
  } else {
    L.push("");
    L.push("(none yet — no package in this build has a committed llms.txt)");
  }
  L.push("");
  L.push(`## Not yet described (${missing.length})`);
  L.push("");
  if (missing.length > 0) {
    for (const p of missing) L.push(`- ${p.name} — no llms.txt yet`);
  } else {
    L.push("(none — every public package in this build has one)");
  }
  const text = L.join("\n").replace(/\n+$/, "") + "\n";
  return { text, described: described.length, total: pkgs.length };
}

async function main() {
  const check = process.argv.includes("--check");
  const pkgs = await publicPackages();
  const { text, described, total } = render(pkgs);

  const tokens = approxTokens(text);
  if (tokens > LLMS_TOKEN_BUDGET) {
    throw new Error(
      `gen-root-llms: root llms.txt is ~${tokens} tokens, over the `
        + `${LLMS_TOKEN_BUDGET} budget. Nothing was written — this index is one `
        + "line per package by design; if it no longer fits, add a curated "
        + "grouping layer instead of truncating."
    );
  }

  if (check) {
    let committed;
    try {
      committed = await readFile(OUT_PATH, "utf8");
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
      console.error(`gen-root-llms: --check: ${OUT_PATH} does not exist — run without --check first`);
      process.exitCode = 1;
      return;
    }
    if (committed !== text) {
      console.error(`DRIFT: ${OUT_PATH} is stale — run \`pnpm gen:root-llms\` and commit it`);
      process.exitCode = 1;
      return;
    }
    console.error(`gen-root-llms: --check: ${OUT_PATH} is up to date (${described}/${total} packages describe llms.txt)`);
    return;
  }

  await writeFile(OUT_PATH, text);
  console.error(`gen-root-llms: ${described}/${total} packages describe llms.txt (~${tokens} tok) → ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
