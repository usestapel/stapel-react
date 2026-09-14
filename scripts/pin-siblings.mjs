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
 *
 * Concurrency (2026-09-14): this used to materialize every sibling under one
 * FIXED path (`<tmpdir>/stapel-react-pinned-siblings`). The shared tree runs
 * several agents at once, and two `gen:pinned*` runs racing meant one
 * agent's `--clean` could rmSync the directory out from under another
 * agent's still-running `git worktree add` — observed twice in one day as a
 * mid-run ENOENT. Fixed by giving every plain (non-`--clean`) invocation its
 * own `fs.mkdtempSync` directory, so two concurrent runs can never collide
 * on a path.
 *
 * The cost, and why it's the right trade: `gen:pinned`/`gen:pinned:check`
 * (see package.json) run this script TWICE — once bare, to produce
 * `SIBLING_ROOT`, and once with `--clean`, afterwards — as two SEPARATE
 * processes. `VAR="$(cmd)" other-cmd` only exports VAR into `other-cmd`'s
 * environment; a later `; node scripts/pin-siblings.mjs --clean` on the same
 * line never sees it (verified empirically — bash and dash also insert an
 * extra subshell fork for `$(...)` that a plain command doesn't get, so even
 * process-tree tricks like matching parent pids don't line up reliably
 * across shells). So a plain `--clean` call has no race-free way left to
 * learn which exact mkdtemp'd directory the paired create-call used — that
 * shared knowledge WAS the fixed path, and the fixed path was the bug.
 * Rather than guess, default `--clean` (no override) does only what's always
 * safe: `git worktree prune` in every sibling, dropping bookkeeping for any
 * worktree whose directory is already gone. The directory a given run just
 * created is otherwise left for the OS's own tmp reaper to reclaim — a real
 * disk-usage cost on a long-lived host, noted rather than papered over.
 * This also means the "reuse an existing worktree if it's already checked
 * out at the pinned ref" fast path below never fires in default mode: every
 * run starts from an empty directory, so it's always a fresh `git worktree
 * add`.
 *
 * Callers that want the OLD behaviour back — one stable, cache-reusing,
 * exactly-`--clean`-able directory — can set SIBLING_ROOT_DIR to a path they
 * own; both the plain and `--clean` invocations then resolve to exactly that
 * path (same as this script always worked before), and it's the caller's
 * job to not run two invocations against that same override concurrently.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PINS = JSON.parse(readFileSync(resolve(ROOT, "contract-pins.json"), "utf8"));

const DIR_PREFIX = "stapel-react-pinned-siblings-";
const override = process.env.SIBLING_ROOT_DIR ? resolve(process.env.SIBLING_ROOT_DIR) : null;
const clean = process.argv.includes("--clean");

/** stderr, so stdout stays a single machine-readable path. */
function say(message) {
  process.stderr.write(`pin-siblings: ${message}\n`);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** `git worktree prune` only drops bookkeeping for a worktree whose target
 * directory is already gone — it never touches a directory that still
 * exists, so it's always safe to run regardless of who created it. */
function pruneSibling(source) {
  try {
    git(source, "worktree", "prune");
  } catch {
    // best-effort hygiene, never fatal
  }
}

if (clean && !override) {
  // No shared state to learn which directory the paired create-call used
  // (see header) — do the part of cleanup that's always safe instead of
  // guessing at a target we might not have created.
  for (const module of Object.keys(PINS.modules)) {
    const source = resolve(ROOT, "..", module);
    if (existsSync(source)) pruneSibling(source);
  }
  say(
    "no SIBLING_ROOT_DIR set — pruned worktree bookkeeping in every sibling, " +
      "but cannot target this run's own tmp directory without shared state " +
      "(see script header); it's left for the OS tmp reaper."
  );
  process.exit(0);
}

let WORKTREE_ROOT;
if (override) {
  WORKTREE_ROOT = override;
  mkdirSync(WORKTREE_ROOT, { recursive: true });
} else {
  // clean is false here (the clean && !override case exits above).
  WORKTREE_ROOT = mkdtempSync(join(tmpdir(), DIR_PREFIX));
}

if (clean) {
  // override is set — the no-override clean path already exited above.
  for (const module of Object.keys(PINS.modules)) {
    const source = resolve(ROOT, "..", module);
    const target = resolve(WORKTREE_ROOT, module);
    if (existsSync(target) && existsSync(source)) {
      try {
        git(source, "worktree", "remove", "--force", target);
        say(`removed ${module}`);
      } catch {
        rmSync(target, { recursive: true, force: true });
      }
    }
  }
  process.exit(0);
}

// From here on this invocation OWNS WORKTREE_ROOT exactly when it is a fresh
// mkdtemp directory (not a caller-supplied override) — only that case is
// ours to remove if something goes wrong before we finish.
let succeeded = false;
function cleanupOwnDirOnFailure() {
  if (!succeeded && !override) {
    try {
      rmSync(WORKTREE_ROOT, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}
process.on("SIGINT", () => {
  cleanupOwnDirOnFailure();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanupOwnDirOnFailure();
  process.exit(143);
});

try {
  for (const [module, { ref }] of Object.entries(PINS.modules)) {
    const source = resolve(ROOT, "..", module);
    const target = resolve(WORKTREE_ROOT, module);

    if (!existsSync(source)) {
      say(`SKIP ${module} — no checkout at ${source}`);
      continue;
    }
    pruneSibling(source);
    if (existsSync(target)) {
      // Re-point an existing worktree at the pin (the pin may have moved since
      // it was created) rather than trusting whatever it holds. Only reachable
      // with SIBLING_ROOT_DIR set — a fresh mkdtemp root is always empty, so
      // default-mode runs always take the `git worktree add` branch below.
      const head = git(target, "rev-parse", "HEAD");
      if (head === ref) continue;
      git(source, "worktree", "remove", "--force", target);
    }
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
  succeeded = true;
} catch (error) {
  cleanupOwnDirOnFailure();
  throw error;
}

process.stdout.write(WORKTREE_ROOT + "\n");
