// node --test scripts/pin-siblings.test.mjs
//
// The rule under test: two invocations of pin-siblings must never
// materialize their siblings under the same directory. Before 2026-09-14
// every invocation shared one FIXED path
// (`<tmpdir>/stapel-react-pinned-siblings`), and two agents running
// `gen:pinned:check` at once on this shared tree raced — one's `--clean`
// rmSync'd the directory out from under the other's still-running
// `git worktree add` (observed twice as a mid-run ENOENT). Now every plain
// invocation gets its own `fs.mkdtempSync` directory, so two concurrent runs
// can never collide, and cleaning one must never disturb the other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "pin-siblings.mjs");
const REPO_ROOT = resolve(HERE, "..", "..");

const PINS = JSON.parse(readFileSync(resolve(HERE, "..", "contract-pins.json"), "utf8"));
// A sibling this environment actually has checked out at ../<module> — both
// local dev and CI (ci.yml checks every pin out before test:scripts runs)
// give us at least one, but the assertions that need it degrade gracefully
// to just proving directory-allocation if somehow none is present.
const A_REAL_MODULE = Object.keys(PINS.modules).find((m) => existsSync(join(REPO_ROOT, m)));

function run(args, env) {
  return execFileP("node", [SCRIPT, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function mkTestRoot(prefix) {
  return mkdtempSync(join(tmpdir(), `pin-siblings-test-${prefix}-`));
}

test("two concurrent default invocations get distinct directories; default --clean touches neither", async () => {
  const [a, b] = await Promise.all([run([]), run([])]);
  const dirA = a.stdout.trim();
  const dirB = b.stdout.trim();
  try {
    assert.notEqual(dirA, "");
    assert.notEqual(dirB, "");
    assert.notEqual(dirA, dirB, "two concurrent creates must not share a directory");
    assert.ok(existsSync(dirA), `${dirA} should exist`);
    assert.ok(existsSync(dirB), `${dirB} should exist`);

    // Default --clean (no SIBLING_ROOT_DIR) has no shared state that would
    // let it learn either directory's identity — it must leave BOTH alone.
    await run(["--clean"]);
    assert.ok(existsSync(dirA), "default --clean must not touch a directory it did not create (A)");
    assert.ok(existsSync(dirB), "default --clean must not touch a directory it did not create (B)");

    if (A_REAL_MODULE) {
      assert.ok(existsSync(join(dirA, A_REAL_MODULE)), `${A_REAL_MODULE} should be checked out under A`);
      assert.ok(existsSync(join(dirB, A_REAL_MODULE)), `${A_REAL_MODULE} should be checked out under B`);
    }
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
    // The directories are gone now — let every sibling drop the resulting
    // stale worktree bookkeeping (exactly what default --clean already does
    // routinely), so the test leaves nothing behind in the shared siblings.
    await run(["--clean"]).catch(() => {});
  }
});

test("cleaning one SIBLING_ROOT_DIR override leaves a concurrently-created other one intact", async () => {
  const dirA = mkTestRoot("a");
  const dirB = mkTestRoot("b");
  try {
    await Promise.all([
      run([], { SIBLING_ROOT_DIR: dirA }),
      run([], { SIBLING_ROOT_DIR: dirB }),
    ]);

    if (A_REAL_MODULE) {
      assert.ok(existsSync(join(dirA, A_REAL_MODULE)));
      assert.ok(existsSync(join(dirB, A_REAL_MODULE)));
    }

    await run(["--clean"], { SIBLING_ROOT_DIR: dirA });

    if (A_REAL_MODULE) {
      assert.ok(!existsSync(join(dirA, A_REAL_MODULE)), "the cleaned directory's worktree should be gone");
      assert.ok(existsSync(join(dirB, A_REAL_MODULE)), "the other, concurrently-created directory must survive intact");
      // Not just a directory husk left behind — still a live checkout.
      execFileSync("git", ["-C", join(dirB, A_REAL_MODULE), "rev-parse", "HEAD"], { stdio: "ignore" });
    }
  } finally {
    await run(["--clean"], { SIBLING_ROOT_DIR: dirA }).catch(() => {});
    await run(["--clean"], { SIBLING_ROOT_DIR: dirB }).catch(() => {});
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
});
