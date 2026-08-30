#!/usr/bin/env node
// FLEET GATE — does a pair's declared backend range still contain the backend?
//
// `manifest.json`'s `backend.contract` is generated from the sibling's
// pyproject version at gen time (`gen-manifest.mjs backendContract()`), so it
// is honest the day it is written and silently wrong every day after: the
// backend releases 0.4.0, nobody reruns gen:manifest, and the pair keeps
// announcing ">=0.2 <0.3" while calling a wire that moved. That is the
// integration-seam defect class in its purest form — both halves are green in
// isolation and the statement joining them is false.
//
// This reads the CURRENT sibling checkout's pyproject version and checks it
// against the range the pair publishes. No hand-maintained table: the pair set
// and the module names come from the manifests themselves.
//
// MODES (same policy as the default-skin gate — a gate nobody can go green
// against gets deleted, so it lists before it fails):
//   list   (default) report and exit 0
//   strict report and exit 1        `--strict` or CONTRACT_PINS=strict
//
//   node scripts/check-contract-pins.mjs
//   pnpm check:contract-pins
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SIBLING_ROOT = process.env.SIBLING_ROOT ?? "..";
const STRICT =
  process.argv.includes("--strict") || process.env.CONTRACT_PINS === "strict";

/** `">=0.5 <0.6"` → `{ min: [0,5], max: [0,6] }`; null when unparseable. */
export function parseRange(range) {
  const m = /^>=\s*(\d+)\.(\d+)(?:\.(\d+))?\s+<\s*(\d+)\.(\d+)(?:\.(\d+))?$/.exec(
    range ?? ""
  );
  if (!m) return null;
  return {
    min: [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)],
    max: [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)],
  };
}

const cmp = (a, b) =>
  a[0] - b[0] || a[1] - b[1] || (a[2] ?? 0) - (b[2] ?? 0);

/** Is `version` inside `[min, max)`? */
export function contains(range, version) {
  return cmp(version, range.min) >= 0 && cmp(version, range.max) < 0;
}

function parseVersion(text) {
  const m = /^version\s*=\s*"(\d+)\.(\d+)(?:\.(\d+))?"/m.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

const show = (v) => v.join(".");

/**
 * A pin is a 40-hex commit sha copied from `git rev-parse <tag>^{commit}`. Two
 * ways to write one that LOOKS right and is not: a short hash "expanded" by
 * hand (the 2026-08-26 stapel-geo pin shared 7 chars with the release commit
 * and nothing else — CI died on "not our ref"), and the sha of an annotated
 * tag OBJECT instead of the commit it points at. Both are caught here, against
 * the sibling checkout on disk, so they fail at the desk instead of on the
 * runner. Unlike a stale range this is never a listing matter: a pin nobody
 * can fetch is not a pin.
 */
function checkPinsResolve(pins) {
  const bad = [];
  for (const [module, entry] of Object.entries(pins.modules ?? {})) {
    const ref = String(entry?.ref ?? "");
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      bad.push(`${module}: ref "${ref}" is not a 40-hex commit sha`);
      continue;
    }
    const dir = resolve(ROOT, SIBLING_ROOT, module);
    if (!existsSync(resolve(dir, ".git"))) continue; // not checked out here — CI fetches it
    try {
      execFileSync("git", ["-C", dir, "cat-file", "-e", `${ref}^{commit}`], { stdio: "ignore" });
    } catch {
      bad.push(`${module}: ${ref} does not resolve to a commit in ${dir} (fabricated, or a tag object)`);
    }
  }
  if (bad.length > 0) {
    console.error(`✖ contract-pins: ${bad.length} pin(s) cannot be fetched:\n` + bad.map((b) => `    - ${b}`).join("\n") +
      `\n  A pin is the output of \`git -C <sibling> rev-parse <tag>^{commit}\`, pasted, never typed.`);
    process.exit(1);
  }
}

/**
 * A pin that RESOLVES can still lie about the world: a ref four minors behind
 * the library regenerates a pair that typechecks, looks plausible, and goes
 * silent against the wire the library actually speaks (stapel-chat 0.2-era
 * pin vs 0.6.x, 2026-08-26). Compare the pinned pyproject version with the
 * sibling's newest release tag: one minor behind is a deliberate hold and is
 * listed; two or more is an artifact nobody chose, and fails.
 *
 * A `hold: "<reason>"` records a DECISION, not a fact: the reason is a claim
 * someone must eventually verify. stapel-core was held as "not an API-contract
 * source" on 2026-08-26 while being the source of the shared error catalogue
 * every pair merges — the hold worked, the claim was false, 42 codes vanished
 * from ru/es on the runner. Re-read a hold's reason whenever the gate lists it.
 */
/**
 * The release tags of a sibling checkout, newest last — or `null` when this
 * process cannot establish them at all.
 *
 * That third answer is the whole point. Until 2026-08-31 this read
 * `git tag --list v*` and nothing else, which is a full answer at a desk (full
 * clones, every tag present) and an EMPTY one on the runner: ci.yml and
 * release.yml build each sibling with `git init` + `fetch --depth 1 <sha>`,
 * and a fetch of one sha brings down no tags. `newest` came back null, the
 * `if (!pinned || !newest) continue;` below stepped over it, and the freshness
 * gate reported nothing and exited 0 for every module, on every run, in the
 * one place it was supposed to be the last line of defence. A gate whose
 * finding is "" is indistinguishable from a gate whose finding is "clean" —
 * the same shape as the outages this file's other comments are about.
 *
 * The fix is not to fetch the tags: `fetch --tags --depth 1` drags a full tree
 * per tag for 26 siblings to answer a question about REF NAMES. `ls-remote
 * --tags` asks the server for exactly the names, costs one round trip, needs
 * no objects, and lives here rather than in two workflow files — so any
 * caller on any tagless checkout is covered, not just the two we remembered.
 *
 * Blindness is never silence again: a checkout with no local tags AND no
 * reachable origin returns null, and the caller fails loudly on it. An origin
 * that answers with zero tags is an ANSWER (an unreleased sibling), not
 * blindness, and returns [].
 */
function releaseTags(dir) {
  const parse = (names) =>
    names
      .map((t) => t.trim().replace(/^v/, ""))
      .filter((t) => /^\d+\.\d+\.\d+$/.test(t))
      .map((t) => t.split(".").map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  let local = [];
  try {
    local = parse(
      execFileSync("git", ["-C", dir, "tag", "--list", "v*"], { encoding: "utf8" }).split("\n")
    );
  } catch {
    return null; // not a readable git dir at all
  }
  if (local.length > 0) return local;

  let origin;
  try {
    origin = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null; // tagless and no origin to ask — nothing can be concluded
  }
  if (!origin) return null;
  try {
    const out = execFileSync("git", ["ls-remote", "--tags", "--refs", origin], {
      encoding: "utf8",
      timeout: 30_000,
      // Never sit at a credential prompt on a runner: a private sibling must
      // fail fast and be reported as blind, not hang the job.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return parse(
      out
        .split("\n")
        .map((line) => line.split("refs/tags/")[1] ?? "")
        .filter(Boolean)
    );
  } catch {
    return null;
  }
}

function checkPinsFresh(pins) {
  const notes = [];
  const stale = [];
  const blind = [];
  for (const [module, entry] of Object.entries(pins.modules ?? {})) {
    const dir = resolve(ROOT, SIBLING_ROOT, module);
    if (!existsSync(resolve(dir, ".git"))) continue;
    if (typeof entry.hold === "string" && entry.hold.trim()) {
      // A recorded hold is a decision, not an oversight: list it, keep going.
      notes.push(`${module}: HELD — ${entry.hold}`);
      continue;
    }
    let pinned;
    try {
      const py = execFileSync("git", ["-C", dir, "show", `${entry.ref}:pyproject.toml`], { encoding: "utf8" });
      pinned = parseVersion(py);
    } catch {
      continue; // the ref not being readable here is checkPinsResolve's finding
    }
    const tags = releaseTags(dir);
    if (tags === null) {
      blind.push(`${module}: no tags in ${dir} and \`git ls-remote --tags\` on its origin failed`);
      continue;
    }
    const newest = tags.at(-1) ?? null;
    if (!pinned || !newest) continue;
    const behind = newest[0] - pinned[0] > 0 ? Infinity : newest[1] - pinned[1];
    if (behind >= 2) stale.push(`${module}: pinned ${show(pinned)}, newest tag v${newest.join(".")} (${behind === Infinity ? "a major" : behind + " minors"} behind)`);
    else if (behind === 1) notes.push(`${module}: pinned ${show(pinned)}, newest tag v${newest.join(".")}`);
  }
  for (const n of notes) console.error(`  ~ pin one minor behind (a deliberate hold, or the next bump): ${n}`);
  if (blind.length > 0) {
    // Not a listing matter and not a warning: this is the gate reporting that
    // it could not run. Passing here is how it silently passed for months.
    console.error(`✖ contract-pins: the freshness check is BLIND for ${blind.length} sibling(s):\n` +
      blind.map((b) => `    - ${b}`).join("\n") +
      `\n  It cannot see the newest release tag, so it cannot tell a current pin from one four minors\n` +
      `  behind — and a check that answers "" must not be read as "clean". Give the checkout its tags\n` +
      `  (\`git fetch --tags\`) or network access to its origin.`);
  }
  if (stale.length > 0) {
    console.error(`✖ contract-pins: ${stale.length} pin(s) are two or more minors behind the library they pin:\n` +
      stale.map((s) => `    - ${s}`).join("\n") +
      `\n  A pair regenerated from such a pin is internally consistent and wrong about the wire. Bump the pin\n` +
      `  to the release the pair is built for and regenerate it (pnpm gen:pinned), or record the hold in the note.`);
  }
  if (blind.length > 0 || stale.length > 0) {
    // Both blocks are printed before exiting: a run that is blind for one
    // sibling still has a real finding for another, and hiding it behind the
    // first `process.exit` would cost a whole CI round trip to learn.
    process.exit(1);
  }
}

async function main() {
  const pins = JSON.parse(await readFile(resolve(ROOT, "contract-pins.json"), "utf8"));
  checkPinsResolve(pins);
  checkPinsFresh(pins);
  const dirs = (await readdir(resolve(ROOT, "packages"), { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const stale = [];
  const unreadable = [];
  let checked = 0;

  for (const name of dirs) {
    const manifestPath = resolve(ROOT, "packages", name, "manifest.json");
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch {
      continue; // no manifest (viewer, tokens bridges, …)
    }
    const backend = manifest.backend;
    if (!backend?.module) continue; // backend-less package, by design

    const pyproject = resolve(ROOT, SIBLING_ROOT, backend.module, "pyproject.toml");
    let version;
    try {
      version = parseVersion(await readFile(pyproject, "utf8"));
    } catch {
      unreadable.push({ name, module: backend.module, why: "no pyproject.toml" });
      continue;
    }
    if (!version) {
      unreadable.push({ name, module: backend.module, why: "no version in pyproject.toml" });
      continue;
    }
    const range = parseRange(backend.contract);
    if (!range) {
      unreadable.push({
        name,
        module: backend.module,
        why: `unparseable contract "${backend.contract}"`,
      });
      continue;
    }
    checked += 1;
    if (!contains(range, version)) {
      stale.push({
        name,
        module: backend.module,
        contract: backend.contract,
        version: show(version),
        ahead: cmp(version, range.max) >= 0,
      });
    }
  }

  for (const u of unreadable) {
    console.error(`  ? ${u.name}: ${u.module} — ${u.why} (not checked)`);
  }
  if (stale.length === 0) {
    console.error(`contract-pins: ${checked} pair(s) checked, every backend inside its declared range`);
    return;
  }
  const verb = STRICT ? "✖" : "⚠";
  console.error(
    `${verb} contract-pins: ${stale.length}/${checked} pair(s) declare a range that no longer\n` +
      `  contains the sibling backend — the pair announces a contract it is not built against:\n` +
      stale
        .map(
          (s) =>
            `    - ${s.name}: ${s.module} ${s.version} vs contract "${s.contract}"` +
            (s.ahead ? "  (backend moved ahead)" : "  (backend behind the range)")
        )
        .join("\n") +
      `\n  Regenerate the pair against the released contract (pnpm gen:manifest) after\n` +
      `  bumping its pin in contract-pins.json, and follow the wire changes in the pair.` +
      (STRICT ? "" : `\n  (listing mode — pass --strict or set CONTRACT_PINS=strict to fail on this)`)
  );
  if (STRICT) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
