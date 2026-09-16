#!/usr/bin/env node
// AUTO-BUMP THE PROVABLY SAFE HALF OF check-contract-pins.mjs's SPLIT.
//
// `classifyWireDiff` (check-contract-pins.mjs) answers one question per
// stale pin: is `docs/schema.json` / `docs/errors.json` / `docs/flows.json`
// byte-identical between the pinned ref and the sibling's newest release
// tag? When it is, regenerating against the newer ref cannot change a
// single committed projection — that is not a heuristic, it is what
// byte-identical means for the exact three files every `gen:*` driver
// reads (CONTRIBUTING.md "Contract pins"). There is nothing left for a
// review to catch, so this script does the bump, regenerates, and commits
// with no human in the loop — a bot commit, same spirit as the fleet's
// existing "chore: version packages" commits.
//
// A pin that is behind and WIRE-MOVED is never touched here. That is
// check-contract-pins.mjs's hard-fail-with-a-named-diff, and stays a
// deliberate PR a person reads (CONTRIBUTING.md, section "Contract pins").
//
// Safety rails, because this runs unattended:
//   - contract-pins.json is patched by STRING SURGERY, never by re-serializing
//     the parsed JSON — this file's `note` fields are a hand-kept history and
//     a JSON.stringify round-trip has already been caught once (2026-09-16)
//     silently renormalizing every OTHER module's unicode escaping into a
//     30-line diff for a one-line change. Only the bumped module's `ref` and
//     `note` move; every byte of every other entry is untouched.
//   - after `pnpm gen:pinned`, only `contract-pins.json`, the two root
//     aggregates (`llms.txt`, `nav-manifest.json`) and the directories of
//     packages that declare one of the bumped modules as their
//     `manifest.backend.module` are staged. Anything else the regen or a
//     concurrent agent left in the working tree is left exactly alone — this
//     is a shared tree, and "unexpected" is not this script's to touch,
//     let alone revert (git-add-all-env-trap: never `git add -A`).
//   - if gen:pinned fails, or if a package OUTSIDE the bumped set comes back
//     dirty (the classification would have to be wrong for that to happen),
//     contract-pins.json is restored to what it was before this script ran
//     and the script exits non-zero. A half-applied bump must never be the
//     quiet failure mode.
//
//   node scripts/auto-bump-safe-pins.mjs
//   pnpm run bump:safe-pins
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { trackedPackageDirs } from "./packages-lib.mjs";
import {
  classifyPin,
  parseVersion,
  releaseTags,
  show,
} from "./check-contract-pins.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SIBLING_ROOT = process.env.SIBLING_ROOT ?? "..";
const PINS_PATH = resolve(ROOT, "contract-pins.json");

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Every pin that is behind AND wire-identical, with the newest tag's
 * resolved commit sha already in hand (classifyWireDiff, run inside
 * classifyPin, fetched it to do the diff — no second network round trip to
 * re-resolve it here).
 *
 * "Behind" here is EXACTLY `checkPinsFresh`'s definition (minor-count, via
 * the shared `classifyPin`) — a same-minor patch bump (0.7.0 -> 0.7.1) is
 * not "behind" to the freshness gate and must not be "safe to auto-bump"
 * here either. The two scripts disagreeing about what counts as stale would
 * mean this one acts on pins the gate never flagged — this script's whole
 * authority comes from bumping exactly the population check-contract-pins.mjs
 * would otherwise list or fail.
 */
function findSafePins(pins) {
  const safe = [];
  for (const [module, entry] of Object.entries(pins.modules ?? {})) {
    if (typeof entry.hold === "string" && entry.hold.trim()) continue; // a hold is a decision, not this script's to override
    const dir = resolve(ROOT, SIBLING_ROOT, module);
    if (!existsSync(resolve(dir, ".git"))) continue;
    let pinned;
    try {
      pinned = parseVersion(execFileSync("git", ["-C", dir, "show", `${entry.ref}:pyproject.toml`], { encoding: "utf8" }));
    } catch {
      continue; // an unreadable pin is check-contract-pins.mjs's finding, not this script's
    }
    const tags = releaseTags(dir);
    const newest = tags?.at(-1) ?? null;
    if (!pinned || !newest) continue;
    const { behind, wire } = classifyPin(dir, entry, pinned, newest);
    if (behind < 1) continue; // not behind BY THE GATE'S OWN DEFINITION — nothing for this script to do
    if (wire.resolvable && wire.identical) {
      safe.push({ module, oldRef: entry.ref, newRef: wire.newestRef, pinned, newest });
    }
  }
  return safe;
}

/**
 * String-surgery bump: replace exactly one `"ref": "<oldRef>"` (globally
 * unique — every pin in this file is a distinct 40-hex sha) and prepend an
 * auto-bump sentence to that SAME module's `note`, identified by the
 * `"ref": "<newRef>",\n      "note": "` anchor left behind by the ref
 * replacement. Every other module's bytes — including their unicode
 * escaping, which is NOT consistent across entries in this file — are
 * untouched. Throws if the anchor is not found, rather than silently
 * writing nothing: a bump that did not happen must not report success.
 */
export function bumpPinText(rawText, bump) {
  const { oldRef, newRef, pinned, newest } = bump;
  const refAnchorOld = `"ref": "${oldRef}",`;
  if (!rawText.includes(refAnchorOld)) {
    throw new Error(`contract-pins.json: no "ref": "${oldRef}" to bump (already moved by someone else?)`);
  }
  const withRef = rawText.replace(refAnchorOld, `"ref": "${newRef}",`);
  const noteAnchor = `"ref": "${newRef}",\n      "note": "`;
  const idx = withRef.indexOf(noteAnchor);
  if (idx === -1) {
    throw new Error(`contract-pins.json: bumped ref for ${bump.module} but could not find its "note" to prepend (unexpected file layout)`);
  }
  const insertAt = idx + noteAnchor.length;
  const fragment =
    `release v${show(newest)} - ${today()}: auto-bumped by scripts/auto-bump-safe-pins.mjs — ` +
    `docs/schema.json, docs/errors.json and docs/flows.json are BYTE-IDENTICAL between v${show(pinned)} ` +
    `and v${show(newest)} (verified by diffing both refs at bump time), so no projection this repo ` +
    `generates changes. No review needed. `;
  return withRef.slice(0, insertAt) + fragment + withRef.slice(insertAt);
}

/** `packages/<name>` for every tracked package whose `manifest.backend.module`
 * is one of the modules just bumped — the set gen:pinned is EXPECTED to
 * touch, and the only package directories this script will stage from. */
function affectedPackageDirs(bumpedModules) {
  const affected = [];
  for (const name of trackedPackageDirs(ROOT)) {
    const manifestPath = resolve(ROOT, "packages", name, "manifest.json");
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (bumpedModules.has(manifest.backend?.module)) affected.push(name);
    } catch {
      // no manifest, or no backend — not a package gen:pinned regenerates from a module
    }
  }
  return affected;
}

function gitStatusPaths() {
  const out = execFileSync("git", ["-C", ROOT, "status", "--porcelain"], { encoding: "utf8" });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3)); // "XY path" — path starts at column 4
}

function main() {
  const originalText = readFileSync(PINS_PATH, "utf8");
  const pins = JSON.parse(originalText);
  const safe = findSafePins(pins);

  if (safe.length === 0) {
    console.log("bump:safe-pins — nothing behind is wire-identical; nothing to do.");
    return;
  }

  console.log(`bump:safe-pins — ${safe.length} pin(s) are behind and wire-identical:`);
  for (const s of safe) console.log(`  - ${s.module}: ${show(s.pinned)} -> v${show(s.newest)}`);

  let text = originalText;
  for (const bump of safe) text = bumpPinText(text, bump);
  writeFileSync(PINS_PATH, text);

  const gen = spawnSync("pnpm", ["run", "gen:pinned"], { cwd: ROOT, stdio: "inherit" });
  if (gen.status !== 0) {
    writeFileSync(PINS_PATH, originalText); // undo the pin bump — a half-applied regen commits nothing
    console.error(`bump:safe-pins — pnpm run gen:pinned failed (exit ${gen.status}); pins restored, nothing committed.`);
    process.exit(1);
  }

  const bumpedModules = new Set(safe.map((s) => s.module));
  const expectedPrefixes = [
    "contract-pins.json",
    "llms.txt", // root aggregate
    "nav-manifest.json", // root aggregate
    ...affectedPackageDirs(bumpedModules).map((name) => `packages/${name}/`),
  ];
  const changed = gitStatusPaths();
  const toAdd = changed.filter((p) => expectedPrefixes.some((prefix) => p === prefix || p.startsWith(prefix)));
  const unexpected = changed.filter((p) => !toAdd.includes(p));

  if (unexpected.length > 0) {
    writeFileSync(PINS_PATH, originalText);
    spawnSync("git", ["-C", ROOT, "checkout", "--", ...toAdd.filter((p) => p !== "contract-pins.json")], { stdio: "inherit" });
    console.error(
      `bump:safe-pins — gen:pinned touched ${unexpected.length} path(s) outside the bumped modules'\n` +
        `own packages, which a byte-identical wire diff should make impossible:\n` +
        unexpected.map((p) => `    - ${p}`).join("\n") +
        `\n  Restored contract-pins.json and every file this run staged. Not committing — this needs a\n` +
        `  human, because the wire-diff proof and the regen just disagreed with each other.`
    );
    process.exit(1);
  }

  if (toAdd.length === 0) {
    // The regen produced literally no diff at all — plausible when a
    // previous run (or a concurrent one) already committed this exact bump.
    writeFileSync(PINS_PATH, originalText);
    console.log("bump:safe-pins — pins were already fresh after regen; nothing to commit.");
    return;
  }

  execFileSync("git", ["-C", ROOT, "add", "--", ...toAdd], { stdio: "inherit" });
  const subject =
    safe.length === 1
      ? `chore(contract-pins): auto-bump ${safe[0].module} ${show(safe[0].pinned)} -> v${show(safe[0].newest)} (wire byte-identical)`
      : `chore(contract-pins): auto-bump ${safe.length} wire-identical pins`;
  const body = safe.map((s) => `${s.module}: ${show(s.pinned)} -> v${show(s.newest)}`).join("\n");
  execFileSync(
    "git",
    [
      "-C", ROOT, "commit",
      "-m", subject,
      "-m", body,
      "-m", "Wire byte-identical (docs/schema.json, docs/errors.json, docs/flows.json) at bump time — no review needed.",
      "-m", "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>",
    ],
    { stdio: "inherit" }
  );
  console.log(`bump:safe-pins — committed: ${subject}`);
}

// Only run when this file is the process entry point — importing it (a test,
// a REPL, a future caller reusing `bumpPinText`) must never bump, regenerate
// and commit as a side effect of `import`. check-contract-pins.mjs carries
// the identical guard for the identical reason.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
