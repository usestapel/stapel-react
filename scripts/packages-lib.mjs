// The ONE place a root generator or checker learns which packages exist.
//
// A `packages/<name>/` directory counts only when its `package.json` is in the
// git index (`git ls-files -- packages/*/package.json`). Enumerating the
// FILESYSTEM instead let one agent's release commit carry another agent's
// untracked, unpushed package into contract-pins.json, nav-manifest.json and
// llms.txt: the pathspec commit protected the wrong file, not the wrong content
// in the right file, and CI died on `ENOENT: packages/alerts-react/package.json`.
//
// Untracked package dirs are skipped with one named line on stderr. Outside a
// git checkout (an npm tarball, a CI job with no `.git`) the filesystem is the
// only truth there is, so the helper falls back to it and says so.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const PACKAGES = "packages";

/** `"git-index"` or `"filesystem"` — which branch enumerated `root`. */
export function packageSource(root) {
  return trackedSet(root) ? "git-index" : "filesystem";
}

/** Package dir names in `root/packages` whose `package.json` is tracked, sorted.
 * `warn` receives one line per skipped untracked package and one line naming
 * the branch that ran; pass `() => {}` to silence it. */
export function trackedPackageDirs(root, { warn = defaultWarn } = {}) {
  const tracked = trackedSet(root);
  const onDisk = packageDirsOnDisk(root);
  if (!tracked) {
    warn(`packages: ${onDisk.length} on disk (filesystem — ${root} is not a git checkout)`);
    return onDisk;
  }
  const kept = [];
  for (const name of onDisk) {
    if (tracked.has(name)) kept.push(name);
    else warn(`skipping untracked package: ${PACKAGES}/${name}`);
  }
  warn(`packages: ${kept.length} tracked (git index)`);
  return kept;
}

/** Filter an explicit list of `packages/<name>` dirs (an env list, a script
 * argument) through the same rule. Order is preserved; entries that are not
 * tracked — or not on disk at all — are dropped with a warning. */
export function filterTrackedPackages(root, dirs, { warn = defaultWarn } = {}) {
  const tracked = trackedSet(root);
  const kept = [];
  for (const dir of dirs) {
    const rel = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    const name = rel.startsWith(`${PACKAGES}/`) ? rel.slice(PACKAGES.length + 1) : null;
    const hasManifest = existsSync(resolve(root, rel, "package.json"));
    if (tracked ? name !== null && tracked.has(name) && hasManifest : hasManifest) kept.push(dir);
    else if (tracked && hasManifest) warn(`skipping untracked package: ${rel}`);
    else warn(`skipping missing package: ${rel} (no package.json on disk)`);
  }
  warn(
    tracked
      ? `packages: ${kept.length} of ${dirs.length} listed are tracked (git index)`
      : `packages: ${kept.length} of ${dirs.length} listed exist (filesystem — ${root} is not a git checkout)`
  );
  return kept;
}

function defaultWarn(line) {
  console.error(line);
}

function packageDirsOnDisk(root) {
  const base = join(root, PACKAGES);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((name) => {
      const dir = join(base, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, "package.json"));
    })
    .sort();
}

/** Set of package dir names whose package.json is in the index, or `null`
 * when `root` is not the top level of a git checkout (or git is unavailable). */
function trackedSet(root) {
  let top;
  try {
    top = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
  // A tarball unpacked INSIDE some other repo resolves to that repo's top
  // level; its index knows nothing about our packages, so that is the
  // filesystem case too, not "every package is untracked".
  if (realpathSync(top) !== realpathSync(root)) return null;
  let out;
  try {
    out = execFileSync("git", ["-C", root, "ls-files", "-z", "--", `${PACKAGES}/*/package.json`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  const names = new Set();
  for (const path of out.split("\0")) {
    const m = /^packages\/([^/]+)\/package\.json$/.exec(path);
    if (m) names.add(m[1]);
  }
  return names;
}
