#!/usr/bin/env node
// `stapel-tokens` — the @stapel/tokens generator, published AS the package
// (§68 Ф1 gate: "hosts don't vendor/fork the generator"; the pre-existing
// forked-generator failure mode this closes). Fans the neutral role
// dictionary (theme.json, §68) out to the STABLE CORE CSS substrate (always,
// version-independent) plus addressable Tailwind adapters — default
// `tailwind@4` (`@theme`, no RGB) and legacy `tailwind@3` (RGB triplets + a
// JS config snippet), both owned here so a future `tailwind@5` is one more
// adapter, never a rewrite.
//
// A host with its own `stapel.theme.json` runs this bin directly — no fork,
// no vendored copy of the engine:
//
//   npx stapel-tokens --theme ./stapel.theme.json --out ./src/stapel-tokens
//
// The host theme deep-merges OVER this package's own theme.default.json
// (§68 merge-contract: the host wins on every leaf it defines; everything
// else falls through to the default) — a host theme touching only `ramps.brand`
// still gets every other role.
//
// Usage:
//   stapel-tokens [options]
//     --theme <path>     host theme.json, deep-merged over the bundled default
//     --ramps <path>     override the bundled standard ramps (rare)
//     --out <dir>        output directory for the CSS/JS artifacts (default: ./stapel-tokens-out)
//     --targets <csv>    which artifacts to emit — any of: core,tailwind@4,tailwind@3
//                         (default: core,tailwind@4,tailwind@3 — all three)
//     --pkg <path>       this package's own package.json — enables the SELF
//                         artifacts (tokens.ts, raw.ts, manifest.json, llms.txt)
//                         @stapel/tokens' own build uses to regenerate its
//                         committed src/generated/*; hosts normally omit this.
//     --check            drift gate: generate in memory, diff against what's
//                         already on disk at --out (and, with --pkg, the
//                         self artifacts) — write nothing, exit 1 on any diff
//                         or missing file (frontend-guardrails "drift-gated").
//
//   node bin/stapel-tokens.mjs                 # this package's own defaults
//   pnpm gen:tokens                            # repo-root wrapper (unchanged surface)
//   pnpm gen:tokens:check                      # drift gate
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");

import {
  mergeRamps,
  mergeTheme,
  validateTheme,
  resolveTheme,
  renderCss,
  renderTokensTs,
  renderRawTs,
  renderTailwind4,
  renderTailwind3Css,
  renderTailwind3Config,
  renderManifest,
  renderLlms,
} from "../src/gen/lib.mjs";

const VALID_TARGETS = new Set(["core", "tailwind@4", "tailwind@3"]);

function parseArgs(argv) {
  const args = {
    theme: null,
    ramps: null,
    out: resolve(process.cwd(), "stapel-tokens-out"),
    pkg: null,
    targets: ["core", "tailwind@4", "tailwind@3"],
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--theme":
        args.theme = resolve(process.cwd(), argv[++i]);
        break;
      case "--ramps":
        args.ramps = resolve(process.cwd(), argv[++i]);
        break;
      case "--out":
        args.out = resolve(process.cwd(), argv[++i]);
        break;
      case "--pkg":
        args.pkg = resolve(process.cwd(), argv[++i]);
        break;
      case "--targets": {
        const list = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
        for (const t of list) {
          if (!VALID_TARGETS.has(t)) {
            throw new Error(
              `stapel-tokens: unknown --targets entry "${t}" (valid: ${[...VALID_TARGETS].join(", ")})`
            );
          }
        }
        args.targets = list;
        break;
      }
      case "--check":
        args.check = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`stapel-tokens: unknown argument "${a}" (--help for usage)`);
    }
  }
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

/** Write `content` to `path`, or (in --check mode) diff it against what's there. */
async function emit(path, content, { check, diffs }) {
  if (check) {
    const existing = await readIfExists(path);
    if (existing !== content) diffs.push(path);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "stapel-tokens [--theme <path>] [--ramps <path>] [--out <dir>] " +
        "[--targets core,tailwind@4,tailwind@3] [--pkg <path>] [--check]"
    );
    return;
  }

  const defaultTheme = await readJson(resolve(PKG_ROOT, "theme.default.json"));
  const standardRamps = await readJson(
    args.ramps ?? resolve(PKG_ROOT, "ramps.standard.json")
  );
  const hostTheme = args.theme ? await readJson(args.theme) : {};
  const theme = mergeTheme(defaultTheme, hostTheme);
  const ramps = mergeRamps(standardRamps, theme.ramps ?? {});

  const { errors, warnings } = validateTheme(theme, ramps);
  for (const w of warnings) console.error(`⚠ ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`✖ ${e}`);
    throw new Error(
      `stapel-tokens: ${errors.length} validation error(s) — see above (§68)`
    );
  }

  const resolved = resolveTheme(theme, ramps);
  const diffs = [];
  const opts = { check: args.check, diffs };

  // ── stable core: always, version-independent ──────────────────────────────
  if (args.targets.includes("core")) {
    await emit(resolve(args.out, "tokens.css"), renderCss(resolved), opts);
  }
  // ── tailwind@4: default versioned adapter ──────────────────────────────────
  if (args.targets.includes("tailwind@4")) {
    await emit(resolve(args.out, "tailwind.css"), renderTailwind4(resolved), opts);
  }
  // ── tailwind@3: legacy versioned adapter (owned here, not a host fork) ─────
  if (args.targets.includes("tailwind@3")) {
    await emit(resolve(args.out, "tailwind-v3.css"), renderTailwind3Css(resolved), opts);
    await emit(
      resolve(args.out, "tailwind-v3.config.cjs"),
      renderTailwind3Config(resolved),
      opts
    );
  }

  // ── self artifacts: only when regenerating @stapel/tokens' own package ────
  if (args.pkg) {
    const pkg = await readJson(args.pkg);
    const pkgDir = dirname(args.pkg);
    await emit(resolve(args.out, "tokens.ts"), renderTokensTs(resolved), opts);
    await emit(resolve(args.out, "raw.ts"), renderRawTs(ramps), opts);
    const manifest = renderManifest(pkg, resolved, ramps);
    await emit(
      resolve(pkgDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      opts
    );
    await emit(resolve(pkgDir, "llms.txt"), renderLlms(pkg, resolved), opts);
  }

  if (args.check) {
    if (diffs.length > 0) {
      console.error(
        `stapel-tokens --check: ${diffs.length} artifact(s) out of date:\n` +
          diffs.map((p) => `  ${p}`).join("\n")
      );
      process.exit(1);
    }
    console.error("stapel-tokens --check: all artifacts up to date");
    return;
  }

  console.error(
    `stapel-tokens: ${Object.keys(resolved.core).length} roles, ` +
      `${Object.keys(ramps).length} ramps` +
      (warnings.length ? `, ${warnings.length} warning(s)` : "") +
      `\n              → ${args.out}` +
      (args.pkg ? ` (+ self artifacts in ${dirname(args.pkg)})` : "")
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
