#!/usr/bin/env node
/**
 * Materialize every sibling backend at its PINNED ref, and print the root
 * they live under.
 *
 * CI gets this for free — `ci.yml`/`release.yml` check each sibling out at the
 * ref from `contract-pins.json`. Locally there was no equivalent, so
 * regenerating anything meant running `pnpm gen` against whatever the sibling
 * checkouts happened to be sitting on, which is normally *ahead* of the pin.
 * That is not a hypothetical: commit 3a6211a exists purely because a version
 * bump regenerated `auth-react`'s manifest from a local ahead-of-pin
 * `pyproject.toml` and emitted `contract ">=0.13 <0.14"` where the pin says
 * `>=0.12 <0.13` — caught only when CI failed the release. The knowledge that
 * you must hand-set `MANIFEST_BACKEND_PYPROJECT` to a worktree lived in a
 * person's head; now it lives here.
 *
 *   node scripts/pin-siblings.mjs            # create, print the root
 *   node scripts/pin-siblings.mjs --clean    # remove the worktrees
 *
 * Every `gen:*` script resolves its sources under `${SIBLING_ROOT:-..}`, so:
 *
 *   SIBLING_ROOT="$(node scripts/pin-siblings.mjs)" pnpm gen
 *
 * regenerates from exactly what CI will check against. `pnpm run
 * version-packages:local` wires that up for you.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PINS = JSON.parse(readFileSync(resolve(ROOT, "contract-pins.json"), "utf8"));
const WORKTREE_ROOT = process.env.SIBLING_ROOT_DIR
  ? resolve(process.env.SIBLING_ROOT_DIR)
  : resolve(tmpdir(), "stapel-react-pinned-siblings");

const clean = process.argv.includes("--clean");

/** stderr, so stdout stays a single machine-readable path. */
function say(message) {
  process.stderr.write(`pin-siblings: ${message}\n`);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

for (const [module, { ref }] of Object.entries(PINS.modules)) {
  const source = resolve(ROOT, "..", module);
  const target = resolve(WORKTREE_ROOT, module);

  if (clean) {
    if (existsSync(target) && existsSync(source)) {
      try {
        git(source, "worktree", "remove", "--force", target);
        say(`removed ${module}`);
      } catch {
        rmSync(target, { recursive: true, force: true });
      }
    }
    continue;
  }

  if (!existsSync(source)) {
    say(`SKIP ${module} — no checkout at ${source}`);
    continue;
  }
  if (existsSync(target)) {
    // Re-point an existing worktree at the pin (the pin may have moved since
    // it was created) rather than trusting whatever it holds.
    const head = git(target, "rev-parse", "HEAD");
    if (head === ref) continue;
    git(source, "worktree", "remove", "--force", target);
  }
  mkdirSync(WORKTREE_ROOT, { recursive: true });
  try {
    git(source, "worktree", "add", "--detach", "--force", target, ref);
    say(`${module} @ ${ref.slice(0, 8)}`);
  } catch (error) {
    // A pin can legitimately reference a commit that only exists in another
    // clone yet (CONTRIBUTING.md, "Transitional note"). Say so and carry on —
    // a missing sibling is already handled by the generators.
    say(`FAILED ${module} @ ${ref.slice(0, 8)}: ${error.message.split("\n")[0]}`);
  }
}

if (!clean) process.stdout.write(WORKTREE_ROOT + "\n");
