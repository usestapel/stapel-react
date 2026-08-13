#!/usr/bin/env node
/**
 * A PEER FLOOR MUST COVER THE SYMBOLS THE PACKAGE ACTUALLY IMPORTS.
 *
 * @stapel/workspaces-react 0.15.0 shipped declaring `@stapel/core >=0.12.0`
 * while importing `LoadState`, which core did not export until 0.13.0. npm
 * installed it happily; the host's typecheck then failed on a type the
 * library's own .d.ts referenced and the host could not resolve. Nothing in
 * the monorepo could catch it, because in here every package builds against
 * the workspace core — always the newest one — so the floor is never the
 * version anything is compiled against. Seven of eight packages were wrong.
 *
 * This reads each package's imports from "@stapel/core", asks git which core
 * release first exported each imported symbol, and fails when the declared
 * floor is older than that. The answer comes from core's own tagged history,
 * so it stays true without a hand-kept table anyone must remember to update.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_SRC = "packages/core/src";

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

/** Core release tags, oldest first. Changesets tags per package: `@stapel/core@<version>`. */
function coreVersionsAscending() {
  const tags = git("tag", "--list", "@stapel/core@*")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags
    .map((t) => ({ tag: t, parts: t.slice("@stapel/core@".length).split(".").map(Number) }))
    .filter((t) => t.parts.length === 3 && t.parts.every((n) => Number.isFinite(n)))
    .sort((a, b) => a.parts[0] - b.parts[0] || a.parts[1] - b.parts[1] || a.parts[2] - b.parts[2]);
}

/** Exported names of core at a tag — good enough: we only need presence. */
function coreExportsAt(tag) {
  let listing;
  try {
    listing = git("ls-tree", "-r", "--name-only", tag, CORE_SRC).split("\n");
  } catch {
    return null; // tag predates the package
  }
  const names = new Set();
  for (const file of listing) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    let body;
    try {
      body = git("show", `${tag}:${file}`);
    } catch {
      continue;
    }
    for (const m of body.matchAll(
      /export\s+(?:declare\s+)?(?:async\s+)?(?:type|interface|class|const|function|enum)\s+([A-Za-z0-9_$]+)/g
    )) names.add(m[1]);
    for (const m of body.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const piece of m[1].split(",")) {
        const name = piece.split(/\s+as\s+/).pop().trim().replace(/^type\s+/, "");
        if (name) names.add(name);
      }
    }
  }
  return names;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) out.push(p);
  }
  return out;
}

/** Names imported from "@stapel/core" across a package's sources. */
function importedCoreSymbols(pkgDir) {
  const found = new Set();
  const src = join(pkgDir, "src");
  let files;
  try {
    files = walk(src);
  } catch {
    return found;
  }
  for (const f of files) {
    const body = readFileSync(f, "utf8");
    for (const m of body.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@stapel\/core["']/g
    )) {
      for (const piece of m[1].split(",")) {
        const name = piece.split(/\s+as\s+/)[0].trim().replace(/^type\s+/, "");
        if (name) found.add(name);
      }
    }
  }
  return found;
}

function floorOf(range) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(range ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const versions = coreVersionsAscending();
const exportsByTag = new Map();
/** First core version that exported `name`, or null if it never did. */
function firstVersionExporting(name) {
  for (const v of versions) {
    if (!exportsByTag.has(v.tag)) exportsByTag.set(v.tag, coreExportsAt(v.tag));
    const names = exportsByTag.get(v.tag);
    if (names?.has(name)) return v;
  }
  return null;
}

const problems = [];
for (const entry of readdirSync(join(ROOT, "packages"))) {
  const pkgDir = join(ROOT, "packages", entry);
  if (entry === "core" || !statSync(pkgDir).isDirectory()) continue;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const range = pkg.peerDependencies?.["@stapel/core"];
  if (!range) continue;
  const declared = floorOf(range);
  if (!declared) continue;

  for (const symbol of importedCoreSymbols(pkgDir)) {
    const since = firstVersionExporting(symbol);
    if (!since) continue; // not resolvable from tags — say nothing rather than guess
    if (cmp(declared, since.parts) < 0) {
      problems.push(
        `${pkg.name}: imports \`${symbol}\` from @stapel/core, which first shipped in ` +
          `${since.tag}, but declares a peer floor of ${range}. Raise it to >=${since.parts.join(".")}.`
      );
    }
  }
}

if (problems.length) {
  console.error("peer-floors: a declared floor does not cover an imported symbol\n");
  for (const p of problems) console.error("  - " + p);
  console.error(
    "\nThe monorepo cannot catch this by building: in here every package compiles\n" +
      "against the workspace core, never against its own floor. Only a consumer\n" +
      "installing at the floor would have found it — after the release."
  );
  process.exit(1);
}
console.error(`peer-floors: OK — every @stapel/core import is covered by its package's floor`);
