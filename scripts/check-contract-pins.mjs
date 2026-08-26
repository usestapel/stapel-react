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
 */
function checkPinsFresh(pins) {
  const notes = [];
  const stale = [];
  for (const [module, entry] of Object.entries(pins.modules ?? {})) {
    const dir = resolve(ROOT, SIBLING_ROOT, module);
    if (!existsSync(resolve(dir, ".git"))) continue;
    if (typeof entry.hold === "string" && entry.hold.trim()) {
      // A recorded hold is a decision, not an oversight: list it, keep going.
      notes.push(`${module}: HELD — ${entry.hold}`);
      continue;
    }
    let pinned;
    let newest;
    try {
      const py = execFileSync("git", ["-C", dir, "show", `${entry.ref}:pyproject.toml`], { encoding: "utf8" });
      pinned = parseVersion(py);
      const tags = execFileSync("git", ["-C", dir, "tag", "--list", "v*"], { encoding: "utf8" })
        .split("\n")
        .map((t) => t.trim().replace(/^v/, ""))
        .filter((t) => /^\d+\.\d+\.\d+$/.test(t))
        .map((t) => t.split(".").map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      newest = tags.at(-1) ?? null;
    } catch {
      continue;
    }
    if (!pinned || !newest) continue;
    const behind = newest[0] - pinned[0] > 0 ? Infinity : newest[1] - pinned[1];
    if (behind >= 2) stale.push(`${module}: pinned ${show(pinned)}, newest tag v${newest.join(".")} (${behind === Infinity ? "a major" : behind + " minors"} behind)`);
    else if (behind === 1) notes.push(`${module}: pinned ${show(pinned)}, newest tag v${newest.join(".")}`);
  }
  for (const n of notes) console.error(`  ~ pin one minor behind (a deliberate hold, or the next bump): ${n}`);
  if (stale.length > 0) {
    console.error(`✖ contract-pins: ${stale.length} pin(s) are two or more minors behind the library they pin:\n` +
      stale.map((s) => `    - ${s}`).join("\n") +
      `\n  A pair regenerated from such a pin is internally consistent and wrong about the wire. Bump the pin\n` +
      `  to the release the pair is built for and regenerate it (pnpm gen:pinned), or record the hold in the note.`);
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
