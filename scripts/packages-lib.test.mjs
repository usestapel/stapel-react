// node --test scripts/packages-lib.test.mjs
//
// The rule under test: a package counts only when its package.json is in the
// git index; an untracked package dir is skipped by name; outside a checkout
// the filesystem is the fallback and the helper says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterTrackedPackages, packageSource, trackedPackageDirs } from "./packages-lib.mjs";

const git = (root, ...args) =>
  execFileSync(
    "git",
    ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args],
    { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }
  );

function addPackage(root, name) {
  mkdirSync(join(root, "packages", name), { recursive: true });
  writeFileSync(join(root, "packages", name, "package.json"), `{"name":"@t/${name}"}\n`);
}

/** A repo with one committed package, one staged package, one untracked
 * package dir, and one bare dir with no package.json at all. */
function makeRepo() {
  const root = mkdtempSync(join(process.env.SCRATCHPAD ?? tmpdir(), "packages-lib-"));
  git(root, "init", "-q");
  addPackage(root, "committed-react");
  git(root, "add", "packages/committed-react");
  git(root, "commit", "-q", "-m", "one");
  addPackage(root, "staged-react");
  git(root, "add", "packages/staged-react");
  addPackage(root, "untracked-react");
  mkdirSync(join(root, "packages", "not-a-package"));
  return root;
}

test("trackedPackageDirs: index only, untracked skipped by name", () => {
  const root = makeRepo();
  try {
    const warned = [];
    const dirs = trackedPackageDirs(root, { warn: (l) => warned.push(l) });
    assert.deepEqual(dirs, ["committed-react", "staged-react"]);
    assert.deepEqual(warned, [
      "skipping untracked package: packages/untracked-react",
      "packages: 2 tracked (git index)",
    ]);
    assert.equal(packageSource(root), "git-index");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("filterTrackedPackages: an explicit list obeys the same rule, order kept", () => {
  const root = makeRepo();
  try {
    const warned = [];
    const kept = filterTrackedPackages(
      root,
      ["packages/staged-react", "packages/untracked-react", "packages/committed-react", "packages/ghost-react"],
      { warn: (l) => warned.push(l) }
    );
    assert.deepEqual(kept, ["packages/staged-react", "packages/committed-react"]);
    assert.deepEqual(warned, [
      "skipping untracked package: packages/untracked-react",
      "skipping missing package: packages/ghost-react (no package.json on disk)",
      "packages: 2 of 4 listed are tracked (git index)",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("outside a git checkout the filesystem is the fallback, and it says so", () => {
  const root = mkdtempSync(join(process.env.SCRATCHPAD ?? tmpdir(), "packages-lib-nogit-"));
  try {
    addPackage(root, "a-react");
    addPackage(root, "b-react");
    mkdirSync(join(root, "packages", "not-a-package"));
    const warned = [];
    const dirs = trackedPackageDirs(root, { warn: (l) => warned.push(l) });
    assert.deepEqual(dirs, ["a-react", "b-react"]);
    assert.equal(warned.length, 1);
    assert.match(warned[0], /^packages: 2 on disk \(filesystem — .* is not a git checkout\)$/);
    assert.equal(packageSource(root), "filesystem");
    const kept = filterTrackedPackages(root, ["packages/b-react", "packages/ghost-react"], {
      warn: (l) => warned.push(l),
    });
    assert.deepEqual(kept, ["packages/b-react"]);
    assert.match(warned.at(-1), /^packages: 1 of 2 listed exist \(filesystem/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a checkout nested in a foreign repo is the filesystem case, not 'all untracked'", () => {
  const outer = mkdtempSync(join(process.env.SCRATCHPAD ?? tmpdir(), "packages-lib-outer-"));
  try {
    git(outer, "init", "-q");
    const root = join(outer, "unpacked-tarball");
    addPackage(root, "a-react");
    const warned = [];
    assert.deepEqual(trackedPackageDirs(root, { warn: (l) => warned.push(l) }), ["a-react"]);
    assert.equal(packageSource(root), "filesystem");
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});
