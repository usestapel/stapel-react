#!/usr/bin/env node
// Repo-root driver for @stapel/tokens' generator (frontend-guardrails §1) —
// now a THIN WRAPPER over the package's own published `stapel-tokens` bin
// (§68 Ф1: the generator ships inside @stapel/tokens; this script no longer
// vendors the engine, it just shells out with this repo's paths/env knobs).
//
//   node scripts/gen-tokens.mjs        # generate (writes packages/tokens/src/generated/*)
//   pnpm gen:tokens                    # generate (root script)
//   pnpm gen:tokens:check              # drift gate (fails on divergence)
//
// PARAMETRIZED BY PACKAGE (gen-manifest style knobs) so a host with its own
// stapel.theme.json can reuse this wrapper's shape for ITS OWN package:
//
//   TOKENS_PKG_DIR    package dir (default packages/tokens)
//   TOKENS_THEME      theme json (default <pkg>/theme.default.json — i.e. no
//                      host override; @stapel/tokens regenerating its own
//                      default theme merges the default over itself, a no-op)
//   TOKENS_RAMPS      standard ramps json (default <pkg>/ramps.standard.json)
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.TOKENS_PKG_DIR ?? "packages/tokens");
const THEME_PATH = process.env.TOKENS_THEME ?? resolve(PKG_DIR, "theme.default.json");
const RAMPS_PATH = process.env.TOKENS_RAMPS ?? resolve(PKG_DIR, "ramps.standard.json");
const BIN_PATH = resolve(PKG_DIR, "bin/stapel-tokens.mjs");
const OUT_DIR = resolve(PKG_DIR, "src/generated");
const PKG_JSON = resolve(PKG_DIR, "package.json");

const check = process.argv.includes("--check");

const args = [
  BIN_PATH,
  "--theme",
  THEME_PATH,
  "--ramps",
  RAMPS_PATH,
  "--out",
  OUT_DIR,
  "--pkg",
  PKG_JSON,
];
if (check) args.push("--check");

execFileSync(process.execPath, args, { stdio: "inherit" });
