#!/usr/bin/env node
/**
 * A PEER FLOOR MUST COVER THE SYMBOLS THE PACKAGE ACTUALLY IMPORTS.
 *
 * @stapel/workspaces-react 0.15.0 shipped declaring `@stapel/core >=0.12.0`
 * while importing `LoadState`, which core did not export until 0.13.0. npm
 * installed it happily; the host's typecheck then failed on a type the
 * library's own .d.ts referenced and the host could not resolve. Nothing in
 * the monorepo could catch it, because in here every package builds against
 * the workspace peer — always the newest one — so the floor is never the
 * version anything is compiled against.
 *
 * This reads each package's imports from every `@stapel/*` peer it declares,
 * asks git which release of that peer first exported each imported symbol,
 * and fails when the declared floor is older than that. The answer comes from
 * the peer's own tagged history, so it stays true without a hand-kept table.
 *
 * Three ways this check can lie, all of which it now refuses to do quietly:
 *   - a checkout with no tags (actions/checkout fetches none by default) made
 *     every lookup return "unknown" and the gate passed unconditionally;
 *   - looking only at @stapel/core missed the same defect on every other peer
 *     (docs-react and profiles-react both understated @stapel/tokens-antd);
 *   - a released version missing from the tag history (published by hand and
 *     never tagged) is invisible here, so its symbols get attributed to the
 *     next visible tag and a correct floor is reported as too low.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { trackedPackageDirs } from "./packages-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

/** Every workspace package: name -> directory. */
function workspacePackages() {
  const byName = new Map();
  for (const entry of trackedPackageDirs(ROOT)) {
    const dir = join(ROOT, "packages", entry);
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      byName.set(pkg.name, { dir, entry, pkg });
    } catch {
      /* not a package */
    }
  }
  return byName;
}

/**
 * THE RELEASE IN FLIGHT. A wave that adds a symbol to a peer AND the pairs that
 * import it lands in ONE push: the pairs must declare the floor the peer's
 * pending changeset will produce, and that version has no tag until the
 * release job cuts it — after this very gate has passed. Reading tags alone
 * therefore rejected every honest floor of the 2026-08-24 wave ("no
 * @stapel/core@0.18.0 release tag"). So the pending release counts as a
 * version: `changeset status` says what the next publish WILL tag, and the
 * working tree is what that version exports. Once published, the tag takes
 * over and answers identically.
 */
const WORKTREE = "WORKTREE";
function pendingReleases() {
  const out = new Map();
  // Are there changeset files at all? Decides below whether a failed
  // `changeset status` is benign (nothing pending) or a broken gate: on a
  // fresh CI checkout `node_modules/.cache` did not exist, the status write
  // failed, and the catch silently reported "no pending releases" — so the
  // 2026-09-01 release run rejected floors its own pending changesets
  // produced. A gate that degrades quietly proves nothing.
  let pendingFiles = false;
  try {
    pendingFiles = readdirSync(join(ROOT, ".changeset")).some(
      (f) => f.endsWith(".md") && f !== "README.md"
    );
  } catch {
    /* no .changeset directory — nothing pending */
  }
  try {
    const cacheDir = join(ROOT, "node_modules", ".cache");
    mkdirSync(cacheDir, { recursive: true });
    const tmp = join(cacheDir, "peer-floors-changeset-status.json");
    execFileSync("pnpm", ["exec", "changeset", "status", "--output", tmp], {
      cwd: ROOT,
      stdio: "ignore",
    });
    const status = JSON.parse(readFileSync(tmp, "utf8"));
    for (const r of status.releases ?? []) {
      const parts = String(r.newVersion).split(".").map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) out.set(r.name, parts);
    }
  } catch (error) {
    if (pendingFiles) {
      console.error(
        "peer-floors: changeset files are pending but `changeset status` could not be read — " +
          "refusing to answer with tags alone, which would reject every floor the pending " +
          "release produces.\n" +
          String(error)
      );
      process.exit(1);
    }
    /* no changesets pending, or changesets not installed — tags are the whole truth */
  }
  return out;
}
const PENDING = pendingReleases();

/** Release tags for a package, oldest first, plus the release in flight. Changesets tags as `<name>@<version>`. */
function versionsAscending(name) {
  const prefix = `${name}@`;
  const tagged = git("tag", "--list", `${prefix}*`)
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ tag: t, parts: t.slice(prefix.length).split(".").map(Number) }))
    .filter((t) => t.parts.length === 3 && t.parts.every((n) => Number.isFinite(n)));
  // Two shapes of "in flight": a pending changeset (pre-`changeset version`)
  // names the next version; after `changeset version` the workspace
  // package.json already carries it while the tag still waits on the release
  // job. Both are the same release, read from the same worktree.
  const current = packages.get(name)?.pkg.version?.split(".").map(Number);
  const inFlight = PENDING.get(name) ?? (current && current.length === 3 && current.every(Number.isFinite) ? current : null);
  if (inFlight && !tagged.some((t) => cmp(t.parts, inFlight) === 0)) {
    tagged.push({ tag: WORKTREE, parts: inFlight });
  }
  return tagged.sort((a, b) => cmp(a.parts, b.parts));
}

/** Exported names of a package's sources at a tag — we only need presence. */
function exportsAt(tag, srcDir) {
  let listing;
  const fromWorktree = tag === WORKTREE;
  try {
    listing = fromWorktree
      ? walk(join(ROOT, srcDir)).map((f) => f.slice(ROOT.length + 1))
      : git("ls-tree", "-r", "--name-only", tag, srcDir).split("\n");
  } catch {
    return null; // tag predates the package
  }
  const names = new Set();
  for (const file of listing) {
    if (!/\.(ts|tsx)$/.test(file) || /\.test\./.test(file)) continue;
    let body;
    try {
      body = fromWorktree ? readFileSync(join(ROOT, file), "utf8") : git("show", `${tag}:${file}`);
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

/** Names a package imports from `peer` (bare specifier or any subpath of it). */
function importedSymbols(pkgDir, peer) {
  const found = new Set();
  let files;
  try {
    files = walk(join(pkgDir, "src"));
  } catch {
    return found;
  }
  const re = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*["']${peer.replace("/", "\\/")}(?:\\/[^"']+)?["']`,
    "g"
  );
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(re)) {
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

const packages = workspacePackages();
const problems = [];
const blind = [];

/** stderr, so a note never lands in a caller's stdout. */
function say(message) {
  console.error(`peer-floors: ${message}`);
}

/**
 * Does this checkout carry ANY `@stapel/<pkg>@x.y.z` release tag? That is what
 * separates "the tags were never fetched" from "this one peer is unreleased".
 */
const anyStapelTags = git("tag", "--list", "@stapel/*")
  .split("\n")
  .some((t) => /@\d+\.\d+\.\d+$/.test(t.trim()));

/** Per-peer memo of tag -> exported names. */
const exportsMemo = new Map();
function firstVersionExporting(peer, srcDir, versions, name) {
  for (const v of versions) {
    const key = `${peer} ${v.tag}`;
    if (!exportsMemo.has(key)) exportsMemo.set(key, exportsAt(v.tag, srcDir));
    if (exportsMemo.get(key)?.has(name)) return v;
  }
  return null;
}

for (const [name, { dir, pkg }] of packages) {
  if (pkg.private) continue;
  for (const [peer, range] of Object.entries(pkg.peerDependencies ?? {})) {
    if (!peer.startsWith("@stapel/")) continue;
    const target = packages.get(peer);
    if (!target) continue; // peer is not built in this workspace
    const symbols = importedSymbols(dir, peer);
    if (symbols.size === 0) continue;
    const declared = floorOf(range);
    if (!declared) continue;

    const versions = versionsAscending(peer);
    if (versions.length === 0) {
      // Two different situations look identical from one package's point of
      // view, and only one of them is a broken gate:
      //
      //   - the CHECKOUT has no tags (actions/checkout fetches none) — every
      //     lookup below answers "unknown" and the gate would pass on a
      //     package it never actually checked. That is the blind case.
      //   - the PEER has never been released, while other @stapel packages
      //     plainly have tags. Then there is no floor to check against yet:
      //     the peer's first release will BE the floor, and the honest answer
      //     is the same one `firstVersionExporting` already gives for a symbol
      //     that predates every tag — say nothing rather than guess.
      //
      // Conflating them meant the first pair to depend on a newly landed,
      // not-yet-published package reddened CI for a reason that had nothing
      // to do with its floor (@stapel/attributes-react, 2026-08-22).
      if (anyStapelTags) {
        say(
          `${peer} has no release tags yet (unreleased) — nothing to check ${name}'s floor against`
        );
        continue;
      }
      blind.push(peer);
      continue;
    }

    // THIRD WAY THIS CHECK CAN LIE: the floor names a version the peer's tag
    // history does not contain. Every "first shipped in" answer below is
    // measured against that history, so a release missing from it is invisible
    // — the check silently attributes its symbols to the next tag it CAN see
    // and demands a floor bump that is already satisfied. That is exactly what
    // happened on 2026-08-22: the seven storefront pairs were bootstrapped to
    // npm at 0.1.0 by hand (release.yml's documented "one-time manual publish
    // to create the package") and never tagged, so `>=0.1.0` looked like an
    // understated floor for eleven symbols that 0.1.0 in fact exported, and the
    // release run went red on a defect that did not exist.
    //
    // A floor is a promise about a version consumers can install. If no tag
    // records that version, either it was never released or it was published
    // untagged — and either way the answers below are not trustworthy. Say so
    // instead of computing on top of it.
    const tagged = new Set(versions.map((v) => v.parts.join(".")));
    if (!tagged.has(declared.join("."))) {
      problems.push(
        `${name}: declares a peer floor of ${range} on ${peer}, but there is no ` +
          `${peer}@${declared.join(".")} release tag and no pending changeset produces it — the ` +
          `tagged history starts at ${versions[0].tag}. Either that version was never released ` +
          `(name one that was), it was published untagged (tag the commit it shipped from), or ` +
          `the peer needs a changeset for the bump this floor assumes.`
      );
      continue;
    }

    for (const symbol of symbols) {
      const since = firstVersionExporting(
        peer,
        `packages/${target.entry}/src`,
        versions,
        symbol
      );
      if (!since) continue; // never released yet — say nothing rather than guess
      if (cmp(declared, since.parts) < 0) {
        problems.push(
          `${name}: imports \`${symbol}\` from ${peer}, which first shipped in ` +
            `${since.tag}, but declares a peer floor of ${range}. ` +
            `Raise it to >=${since.parts.join(".")}.`
        );
      }
    }
  }
}

if (blind.length) {
  console.error(
    "peer-floors: no release tags found for " +
      [...new Set(blind)].join(", ") +
      "\n\nThis check reads the peer's tagged history, so a checkout without tags\n" +
      "cannot answer anything and would pass every package unchecked. Fetch tags\n" +
      "(actions/checkout: `fetch-tags: true`, or `git fetch --tags`) and re-run."
  );
  process.exit(1);
}

if (problems.length) {
  console.error("peer-floors: a declared floor does not cover an imported symbol\n");
  for (const p of problems) console.error("  - " + p);
  console.error(
    "\nThe monorepo cannot catch this by building: in here every package compiles\n" +
      "against the workspace peer, never against its own floor. Only a consumer\n" +
      "installing at the floor would have found it — after the release."
  );
  process.exit(1);
}
console.error("peer-floors: OK — every @stapel/* peer import is covered by its package's floor");
