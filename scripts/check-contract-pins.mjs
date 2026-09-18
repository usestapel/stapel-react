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
import { readFile } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { trackedPackageDirs } from "./packages-lib.mjs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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

export const cmp = (a, b) =>
  a[0] - b[0] || a[1] - b[1] || (a[2] ?? 0) - (b[2] ?? 0);

/** Is `version` inside `[min, max)`? */
export function contains(range, version) {
  return cmp(version, range.min) >= 0 && cmp(version, range.max) < 0;
}

export function parseVersion(text) {
  const m = /^version\s*=\s*"(\d+)\.(\d+)(?:\.(\d+))?"/m.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

export const show = (v) => v.join(".");

/**
 * WHAT KIND OF OBJECT a sha names in a checkout — `"commit"`, `"tag"`,
 * `"tree"`, `"blob"` — or `null` when the repository has no such object at all.
 *
 * ASKED WITHOUT A PEELING SUFFIX, AND THAT IS THE WHOLE POINT. This check used
 * to probe `git cat-file -e <ref>^{commit}`, which asks a different question
 * than the one it was written for: `^{commit}` DEREFERENCES, so an annotated
 * tag's own sha peels to the commit it points at and the probe answers "yes"
 * — the exact class the comment below says it catches walked straight through
 * it. `git cat-file -t <ref>` reports the object AS STORED and cannot peel, so
 * a tag object comes back `tag` and is refused.
 *
 * (`v0.8.6` in stapel-chat is an annotated tag: `rev-parse v0.8.6` gives
 * 13ad78be…, `rev-parse 'v0.8.6^{commit}'` gives e6486cd9…, and only the second
 * is a pin. Under the old probe both passed.)
 */
export function refObjectType(dir, ref) {
  try {
    return execFileSync("git", ["-C", dir, "cat-file", "-t", ref], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * A pin is a 40-hex commit sha copied from `git rev-parse <tag>^{commit}`. Two
 * ways to write one that LOOKS right and is not: a short hash "expanded" by
 * hand (the 2026-08-26 stapel-geo pin shared 7 chars with the release commit
 * and nothing else — CI died on "not our ref"), and the sha of an annotated
 * tag OBJECT instead of the commit it points at. Both are caught here, against
 * the sibling checkout on disk, so they fail at the desk instead of on the
 * runner. Unlike a stale range this is never a listing matter: a pin nobody
 * can fetch is not a pin.
 *
 * The two are DIFFERENT findings and are reported apart: a fabricated sha is
 * nothing in this repository, while a tag object is a real object of the wrong
 * kind — one is a typo, the other is one missing `^{commit}` in the command
 * whose output was pasted, and telling a person which they did is the whole
 * value of the message.
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
    const type = refObjectType(dir, ref);
    if (type === null) {
      bad.push(`${module}: ${ref} is no object at all in ${dir} — fabricated, or a short hash expanded by hand`);
    } else if (type !== "commit") {
      bad.push(`${module}: ${ref} is a ${type} object in ${dir}, not a commit — this is what \`git rev-parse <tag>\` prints for an ANNOTATED tag; \`git rev-parse '<tag>^{commit}'\` is the pin`);
    }
  }
  if (bad.length > 0) {
    console.error(`✖ contract-pins: ${bad.length} pin(s) cannot be fetched:\n` + bad.map((b) => `    - ${b}`).join("\n") +
      `\n  A pin is the output of \`git -C <sibling> rev-parse <tag>^{commit}\`, pasted, never typed.`);
    process.exit(1);
  }
}

/**
 * THE GATE PROVING IT CAN STILL CATCH THE THING IT IS FOR — run before the
 * pins are read, on every invocation.
 *
 * This exists because the tag-object case above was *documented* as caught and
 * was not, for as long as the probe peeled. A comment claiming a finding is
 * not a finding; the only thing that establishes one is a fixture the check is
 * actually pointed at. So a throwaway repository is built here with one commit
 * and one ANNOTATED tag over it, and {@link refObjectType} is asked about all
 * three shas: the commit (must be `commit`), the tag object (must NOT be —
 * this is the regression), and a sha of nothing (must be `null`).
 *
 * A fixture that cannot be BUILT is not a finding either way: a sandbox with
 * no writable temp dir or no usable `git` says so on one line and the real
 * check carries on. Every git invocation carries its own identity and skips
 * hooks, so a runner with no `user.email` and a host with a global
 * `core.hooksPath` both build it.
 */
function selfCheckRefProbe() {
  const dir = mkdtempSync(resolve(tmpdir(), "contract-pins-selfcheck-"));
  const ABSENT = "0".repeat(39) + "1"; // a well-formed sha of nothing
  const git = (...args) =>
    execFileSync(
      "git",
      ["-C", dir, "-c", "user.email=gate@stapel.dev", "-c", "user.name=gate",
       "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", "-c", "core.hooksPath=", ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  let commitSha;
  let tagSha;
  try {
    execFileSync("git", ["init", "-q", dir], { stdio: "ignore" });
    writeFileSync(resolve(dir, "pyproject.toml"), 'version = "0.0.1"\n');
    git("add", "pyproject.toml");
    git("commit", "-q", "--no-verify", "-m", "fixture");
    git("tag", "-a", "v0.0.1", "-m", "annotated, like every release tag in this fleet");
    commitSha = git("rev-parse", "v0.0.1^{commit}");
    tagSha = git("rev-parse", "v0.0.1");
  } catch (error) {
    console.error(
      `  ? contract-pins: the pin probe's own self-check could not build its fixture ` +
        `(${String(error).split("\n")[0]}) — the probe below ran unverified`
    );
    rmSync(dir, { recursive: true, force: true });
    return;
  }

  const failures = [];
  if (commitSha === tagSha) {
    // Nothing to prove against: `git tag -a` produced a lightweight tag, so
    // the fixture has no tag object and the case is untested here.
    failures.push("the fixture's annotated tag has no tag object of its own");
  }
  if (refObjectType(dir, commitSha) !== "commit") failures.push("a commit sha is not read as a commit");
  if (refObjectType(dir, tagSha) === "commit")
    failures.push(
      "AN ANNOTATED TAG'S OWN SHA IS ACCEPTED AS A COMMIT — the probe is peeling " +
        "(`<ref>^{commit}` or `rev-parse --verify <ref>^{commit}`), and every tag-object pin passes it"
    );
  if (refObjectType(dir, ABSENT) !== null) failures.push("a sha of nothing is not reported as absent");
  rmSync(dir, { recursive: true, force: true });

  if (failures.length > 0) {
    console.error(
      `✖ contract-pins: the pin probe fails its own self-check:\n` +
        failures.map((f) => `    - ${f}`).join("\n") +
        `\n  Every pin below was checked by a probe that does not work. Fix \`refObjectType\`` +
        `\n  before reading its verdict on anything.`
    );
    process.exit(1);
  }
}

/**
 * WIRE DIFF — the piece that lets the freshness check tell "behind" apart
 * from "behind on something that changed the wire".
 *
 * Before this, "two or more minors behind" failed unconditionally, whether
 * the span behind the pin was a required field landing on a response body or
 * three deployment-side patches that never touched `docs/*.json` at all. Both
 * read as the identical one-line finding, so every trivial release anywhere
 * in the fleet — a docstring fix, a management command, a test-only retag —
 * became a same-day fire drill for whoever was at the keyboard when the
 * two-minors threshold tripped (core, billing, notifications and gdpr all
 * tripped it the same night of 2026-09-16; core and billing turned out to be
 * BYTE-IDENTICAL on the wire).
 *
 * `docs/schema.json`, `docs/errors.json` and `docs/flows.json` are exactly
 * the three files this repo's generators read (CONTRIBUTING.md "Contract
 * pins") — so byte-identical across all three, between the pinned ref and the
 * newest tag, is not a heuristic for "safe": it is a proof that regenerating
 * against the newer ref cannot change a single committed projection. That
 * case is auto-bumped by `scripts/auto-bump-safe-pins.mjs`, no review needed.
 * Any other byte, on any of the three files, means a human reads the
 * itemized diff below and decides — the same reading this file's own history
 * shows happening by hand, released as a deliberate PR each time.
 *
 * WHAT THIS CANNOT SEE: a behaviour change behind an unchanged schema — a bug
 * fix, a changed default, a new validation rule that reuses an existing
 * field and an existing status code. `docs/schema.json` describes the SHAPE
 * of a contract, not what a given input does under it, so a byte-identical
 * verdict here is a claim about the wire's shape only. Catching a behavioural
 * drift that leaves the shape alone is what each backend's OWN contract/
 * behaviour tests are for, not this gate.
 */

/** The three files every `gen:*` driver reads (CONTRIBUTING.md "Contract pins"). */
export const WIRE_FILES = ["docs/schema.json", "docs/errors.json", "docs/flows.json"];

/**
 * The newest release tag's commit sha, materialized into `dir` if it is not
 * there already. CI's sibling checkouts are `git init` + `fetch --depth 1
 * <pinned-sha>` (ci.yml) — a single commit, no tags, so the pinned ref is
 * reachable but the newest tag never is without asking origin for it by
 * name. One shallow, single-ref fetch per stale module; never `--tags`
 * (which would drag a full history download per sibling to answer a
 * question about one name). `null` when the tag cannot be fetched at all —
 * a private sibling, a network outage, a tag that is only a local
 * convention and was never pushed.
 */
export function fetchTagCommit(dir, version) {
  const tagName = `v${version.join(".")}`;
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", `${tagName}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // Not already present — the common case on a fresh CI checkout.
  }
  try {
    execFileSync(
      "git",
      ["-C", dir, "fetch", "-q", "--depth", "1", "origin", `refs/tags/${tagName}:refs/tags/${tagName}`],
      { stdio: ["ignore", "pipe", "ignore"], timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
  } catch {
    return null;
  }
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", `${tagName}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** A file's text at a ref, or `null` when the ref or the path is unreadable
 * (the file did not exist yet at that ref — not the same claim as "empty"). */
export function readAtRef(dir, ref, path) {
  try {
    // stderr silenced: "the file didn't exist yet at this ref" is a NORMAL
    // outcome here (an added or removed contract artifact), not a fault —
    // git's "fatal: path does not exist" belongs in the return value below,
    // not scrolling past a human as if the check itself were failing.
    return execFileSync("git", ["-C", dir, "show", `${ref}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** A property's declared type, coarse enough to say "this changed" without
 * caring which of `type` / `$ref` / `oneOf` / `allOf` / `anyOf` a generator
 * used to say it — an enum swapped for a `$ref` to a differently-named enum
 * (the categories 0.23.1 `AxisRoleEnum` → `AxisRoleDerivedEnum` rename,
 * 2026-09-16) is exactly the shape this must not call identical.
 *
 * Also folds in every OTHER facet that changes the TYPE openapi-typescript
 * (the generator behind `gen-api.mjs`) emits for this property — verified
 * against its own transform, not guessed:
 *   - `nullable: true`                         (OpenAPI 3.0 null)
 *   - a `"null"` member of a `type` array, or of `anyOf`   (OpenAPI 3.1 null)
 *     (dist/transform/schema-object.mjs:62,181,202-289 in openapi-typescript
 *     7.13.0 — all three add `| null` to the generated type)
 *   - `enum` membership                        (a literal union)
 *   - an array's `items`                       (the element type)
 *   - `additionalProperties`                   (an index signature, or none)
 *
 * `format`, `minimum`/`maximum`, `minLength`/`maxLength` and `pattern` are
 * deliberately left OUT: openapi-typescript never reads them (grepped absent
 * from schema-object.mjs) — they are validation-only annotations, and a
 * change to one of them must keep reading as docs-only here, not as a wire
 * move.
 *
 * The gap this closes (2026-09-18): stapel-auth 0.39.1 → 0.41.1 added
 * `nullable: true` to `SecurityStatusTOTP.backup_codes_remaining` (integer →
 * integer | null, a real generated-type change) and the old fingerprint —
 * `type` alone, "integer" on both sides — read that as identical and the
 * gate reported nothing but a description edit.
 */
function propertyType(prop) {
  if (prop == null) return "absent";
  const parts = [];
  if (prop.$ref) parts.push(prop.$ref);
  if (prop.oneOf) parts.push(`oneOf(${prop.oneOf.map(propertyType).join("|")})`);
  if (prop.allOf) parts.push(`allOf(${prop.allOf.map(propertyType).join("&")})`);
  if (prop.anyOf) parts.push(`anyOf(${prop.anyOf.map(propertyType).join("|")})`);
  if (parts.length === 0) {
    parts.push(
      Array.isArray(prop.type) ? [...prop.type].sort().join(",") : prop.type ?? "unknown"
    );
  }
  if (prop.nullable) parts.push("nullable");
  if (Array.isArray(prop.enum)) {
    parts.push(`enum(${[...prop.enum].map((v) => JSON.stringify(v)).sort().join(",")})`);
  }
  if (prop.items) parts.push(`items(${propertyType(prop.items)})`);
  if ("additionalProperties" in prop) {
    const ap = prop.additionalProperties;
    parts.push(
      `additionalProperties(${typeof ap === "object" && ap !== null ? propertyType(ap) : String(ap)})`
    );
  }
  return parts.join(";");
}

/**
 * `docs/schema.json` structural diff: which operation gained or lost a
 * status code, which schema gained/lost/retyped a field, and — the one line
 * this whole feature exists to surface reliably — which field BECAME
 * required. A pure description-text edit (the `error_language` wording core
 * 0.62.0 fixed, echoed into every other pair afterwards) is reported too,
 * but only when nothing structural already explains the byte difference, so
 * the one-line summary a human reads first is never buried under noise.
 */
export function diffSchemaJson(before, after) {
  const out = [];
  const bPaths = before?.paths ?? {};
  const aPaths = after?.paths ?? {};
  for (const path of new Set([...Object.keys(bPaths), ...Object.keys(aPaths)])) {
    const b = bPaths[path];
    const a = aPaths[path];
    if (b === undefined) { out.push(`new path ${path}`); continue; }
    if (a === undefined) { out.push(`path ${path} REMOVED`); continue; }
    for (const method of new Set([...Object.keys(b), ...Object.keys(a)])) {
      const bm = b[method];
      const am = a[method];
      if (bm == null && am == null) continue;
      const opId = am?.operationId ?? bm?.operationId ?? `${method.toUpperCase()} ${path}`;
      if (bm == null) { out.push(`${opId}: new operation`); continue; }
      if (am == null) { out.push(`${opId}: operation REMOVED`); continue; }
      const bResp = Object.keys(bm.responses ?? {});
      const aResp = Object.keys(am.responses ?? {});
      let structural = false;
      for (const s of aResp) if (!bResp.includes(s)) { out.push(`${opId}: gains a ${s} response`); structural = true; }
      for (const s of bResp) if (!aResp.includes(s)) { out.push(`${opId}: LOSES its ${s} response`); structural = true; }
      if (!structural && bm.description !== am.description) out.push(`${opId}: description text changed`);
    }
  }
  const bSchemas = before?.components?.schemas ?? {};
  const aSchemas = after?.components?.schemas ?? {};
  for (const name of new Set([...Object.keys(bSchemas), ...Object.keys(aSchemas)])) {
    const b = bSchemas[name];
    const a = aSchemas[name];
    if (b === undefined) { out.push(`schema ${name}: new`); continue; }
    if (a === undefined) { out.push(`schema ${name}: REMOVED`); continue; }
    const bProps = Object.keys(b.properties ?? {});
    const aProps = Object.keys(a.properties ?? {});
    let structural = false;
    for (const p of aProps) if (!bProps.includes(p)) { out.push(`${name}.${p}: new field`); structural = true; }
    for (const p of bProps) if (!aProps.includes(p)) { out.push(`${name}.${p}: field REMOVED`); structural = true; }
    const bReq = new Set(b.required ?? []);
    const aReq = new Set(a.required ?? []);
    for (const f of aReq) if (!bReq.has(f)) { out.push(`${name}.${f}: BECAME REQUIRED`); structural = true; }
    for (const f of bReq) if (!aReq.has(f)) { out.push(`${name}.${f}: no longer required`); structural = true; }
    for (const p of aProps) {
      if (!bProps.includes(p)) continue; // already reported as new above
      const bType = propertyType(b.properties[p]);
      const aType = propertyType(a.properties[p]);
      if (bType !== aType) { out.push(`${name}.${p}: type changed (${bType} -> ${aType})`); structural = true; }
    }
    if (!structural && b.description !== a.description) out.push(`schema ${name}: description text changed`);
  }
  return out;
}

/** `docs/errors.json` diff, keyed on `code` — the identity a pair's i18n
 * catalogue and error-handling branches key on, not array position. */
export function diffErrorsJson(before, after) {
  const out = [];
  const bByCode = new Map((before ?? []).map((e) => [e.code, e]));
  const aByCode = new Map((after ?? []).map((e) => [e.code, e]));
  for (const code of new Set([...bByCode.keys(), ...aByCode.keys()])) {
    const b = bByCode.get(code);
    const a = aByCode.get(code);
    if (!b) { out.push(`${code}: new error code (status ${a.status})`); continue; }
    if (!a) { out.push(`${code}: error code REMOVED`); continue; }
    if (b.status !== a.status) out.push(`${code}: status ${b.status} -> ${a.status}`);
    else if (JSON.stringify(b) !== JSON.stringify(a)) out.push(`${code}: text or params changed`);
  }
  return out;
}

/** `docs/flows.json` diff, keyed on `id`. Flows are rare (most pairs declare
 * zero), so this stops at "which flow, added/removed/changed" rather than
 * walking each flow's own step list — proportionate to how often it fires. */
export function diffFlowsJson(before, after) {
  const out = [];
  const bById = new Map((before ?? []).map((f) => [f.id, f]));
  const aById = new Map((after ?? []).map((f) => [f.id, f]));
  for (const id of new Set([...bById.keys(), ...aById.keys()])) {
    const b = bById.get(id);
    const a = aById.get(id);
    if (!b) { out.push(`flow ${id}: new`); continue; }
    if (!a) { out.push(`flow ${id}: REMOVED`); continue; }
    if (JSON.stringify(b) !== JSON.stringify(a)) out.push(`flow ${id}: content changed`);
  }
  return out;
}

/** One wire file's diff, named. `null` on either side means the file did not
 * exist at that ref (an added or removed contract artifact, not a body this
 * repo can structurally diff — reported as a fact, not by pretending). */
export function diffWireFile(file, beforeText, afterText) {
  if (beforeText === afterText) return [];
  if (beforeText === null) return [`${file}: file did not exist at the pinned ref`];
  if (afterText === null) return [`${file}: file no longer exists at the newest tag`];
  let before;
  let after;
  try {
    before = JSON.parse(beforeText);
    after = JSON.parse(afterText);
  } catch {
    return [`${file}: content differs (not valid JSON on at least one side)`];
  }
  const bullets = file.endsWith("schema.json")
    ? diffSchemaJson(before, after)
    : file.endsWith("errors.json")
      ? diffErrorsJson(before, after)
      : file.endsWith("flows.json")
        ? diffFlowsJson(before, after)
        : [];
  return bullets.length > 0
    ? bullets.map((b) => `${file}: ${b}`)
    : [`${file}: text differs (no structural change detected — likely whitespace or key order)`];
}

/**
 * The verdict this whole feature exists to compute: is the sibling's newest
 * release wire-identical to the one this repo is pinned to, or did it move?
 *
 * `resolvable: false` means the newest tag could not be fetched at all — the
 * caller must NOT read that as identical (a network outage is not a wire
 * diff), so it is reported as its own finding, same severity as today's
 * "cannot see the newest tag" blindness a few lines up in this file.
 */
export function classifyWireDiff(dir, pinnedRef, newestVersion) {
  const newestRef = fetchTagCommit(dir, newestVersion);
  if (!newestRef) {
    return { resolvable: false, identical: false, bullets: [], newestRef: null };
  }
  const bullets = [];
  for (const file of WIRE_FILES) {
    bullets.push(...diffWireFile(file, readAtRef(dir, pinnedRef, file), readAtRef(dir, newestRef, file)));
  }
  return { resolvable: true, identical: bullets.length === 0, bullets, newestRef };
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
export function releaseTags(dir) {
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

/** At most this many bullets per module in the printed report — enough to
 * name every field/operation a human needs to see, never so many that the
 * one line that matters (a new required field) scrolls off screen behind a
 * schema's worth of description-text churn. */
const MAX_BULLETS_PRINTED = 12;

function formatBullets(bullets) {
  const shown = bullets.slice(0, MAX_BULLETS_PRINTED);
  const rest = bullets.length - shown.length;
  return (
    shown.map((b) => `        · ${b}`).join("\n") +
    (rest > 0 ? `\n        · …and ${rest} more (see \`pnpm check:contract-pins\` output, or diff the two refs directly)` : "")
  );
}

/**
 * THE SPLIT this whole feature exists for: `behind` used to be the entire
 * verdict — one number, two buckets (list at one minor, fail at two).
 * `checkPinsFresh` now asks a second, orthogonal question of every pin that
 * IS behind: did `docs/schema.json` / `docs/errors.json` / `docs/flows.json`
 * move between the pinned ref and the newest tag? The minors-behind
 * threshold still decides list-vs-fail exactly as before (nothing here makes
 * the gate more or less tolerant of a stale pin) — what changed is that a
 * WIRE-IDENTICAL pin, at either tier, is never reported as something a human
 * must act on: it is a freshness restamp with a machine-checkable proof of
 * safety, collected separately so `auto-bump-safe-pins.mjs` can land it
 * without review. A WIRE-MOVED pin keeps exactly today's severity (listed at
 * one minor, failed at two) but the message now names what moved, because
 * that reading is the manual work this file's own commit history shows
 * happening by hand, twice, the same night this feature was written.
 */
export function classifyPin(dir, entry, pinned, newest) {
  const behind = newest[0] - pinned[0] > 0 ? Infinity : newest[1] - pinned[1];
  const wire = classifyWireDiff(dir, entry.ref, newest);
  return { behind, wire };
}

function checkPinsFresh(pins) {
  const notes = [];
  const stale = [];
  const safe = [];
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
    const { behind, wire } = classifyPin(dir, entry, pinned, newest);
    if (behind < 1) continue; // current

    const versions = `pinned ${show(pinned)}, newest tag v${newest.join(".")}`;
    const span = behind === Infinity ? "a major" : `${behind} minors`;

    if (!wire.resolvable) {
      // Cannot prove safety — never silently treated as identical. Same
      // severity as before this feature existed, with the caveat named.
      if (behind >= 2) stale.push(`${module}: ${versions} (${span} behind) — wire diff unavailable, could not fetch v${newest.join(".")} to compare`);
      else notes.push(`${module}: ${versions} — wire diff unavailable, could not fetch v${newest.join(".")} to compare`);
      continue;
    }

    if (wire.identical) {
      // Safe at ANY tier: a pin one minor behind on a byte-identical wire is
      // exactly as bumpable as one two minors behind on the same proof.
      safe.push(`${module}: ${versions} — docs/schema.json, docs/errors.json and docs/flows.json are BYTE-IDENTICAL; safe to auto-bump (\`pnpm run bump:safe-pins\`)`);
      continue;
    }

    // Wire moved. Severity is UNCHANGED from before this feature (still
    // decided by `behind` alone) — only the message grows a named diff.
    const detail = formatBullets(wire.bullets);
    if (behind >= 2) stale.push(`${module}: ${versions} (${span} behind), WIRE MOVED:\n${detail}`);
    else notes.push(`${module}: ${versions}, wire moved:\n${detail}`);
  }
  for (const n of notes) console.error(`  ~ pin one minor behind (a deliberate hold, or the next bump): ${n}`);
  for (const s of safe) console.error(`  = pin behind, wire byte-identical (safe): ${s}`);
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
    console.error(`✖ contract-pins: ${stale.length} pin(s) are two or more minors behind the library they pin,\n` +
      `  with the wire itself moved (a byte-identical pin this stale is bumped automatically, never listed here):\n` +
      stale.map((s) => `    - ${s}`).join("\n") +
      `\n  A pair regenerated from such a pin is internally consistent and wrong about the wire. Read what moved\n` +
      `  above, bump the pin to the release the pair is built for, and regenerate it (pnpm gen:pinned) — or\n` +
      `  record the hold in the note. This cannot see a behaviour change behind an unchanged schema; that is\n` +
      `  what the backend's own contract/behaviour tests are for.`);
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
  // Before the verdict, the instrument.
  selfCheckRefProbe();
  checkPinsResolve(pins);
  checkPinsFresh(pins);
  const dirs = trackedPackageDirs(ROOT);

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

// Only run the CLI when this file is the process entry point. Without this
// guard, importing the module's exported functions for a test (as
// check-contract-pins.test.mjs now does) ran the WHOLE gate as a side effect
// of `import` — network calls, `console.error` noise, and a `process.exit(1)`
// that would kill the test runner on any real stale pin, for reasons having
// nothing to do with the test that triggered it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
