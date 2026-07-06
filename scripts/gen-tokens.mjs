#!/usr/bin/env node
// AUTO-GEN driver for @stapel/tokens' three-tier design tokens
// (frontend-guardrails §1). Same family as gen:api/gen:flows/gen:manifest:
// deterministic, byte-stable, drift-gated. The theme.json is the single source
// of truth; this driver resolves it and emits the committed generated
// artifacts every consumer reads:
//
//   src/generated/tokens.css      CSS custom properties (L2 :root + [data-theme=dark]; L3 var-refs)
//   src/generated/tokens.ts       typed token-name unions + typed cssVar + back-compat `colors`
//   src/generated/raw.ts          L1 raw ramps for the @stapel/tokens/raw subpath
//   src/generated/tailwind.css    Tailwind v4 @theme bridge (vanilla static utilities)
//   manifest.json / llms.txt      package self-description (F8; §6)
//
// The STRUCTURE VALIDATOR runs first (frontend-guardrails §1.3): an unpaired
// core token, a hex in the core section, a dangling ramp step, or a component
// token that references ≠1 core token fails the build with a teaching message.
//
// PARAMETRIZED BY PACKAGE (gen-manifest style knobs) so a host with its own
// stapel.theme.json can reuse the driver:
//
//   TOKENS_PKG_DIR    package dir (default packages/tokens)
//   TOKENS_THEME      theme json (default <pkg>/theme.default.json)
//   TOKENS_RAMPS      standard ramps json (default <pkg>/ramps.standard.json)
//
//   node scripts/gen-tokens.mjs        # generate
//   pnpm gen:tokens                    # generate (root script)
//   pnpm gen:tokens:check              # drift gate (fails on divergence)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_DIR = resolve(ROOT, process.env.TOKENS_PKG_DIR ?? "packages/tokens");
const THEME_PATH = process.env.TOKENS_THEME ?? resolve(PKG_DIR, "theme.default.json");
const RAMPS_PATH = process.env.TOKENS_RAMPS ?? resolve(PKG_DIR, "ramps.standard.json");

const lib = await import(resolve(PKG_DIR, "scripts/tokens-lib.mjs"));
const {
  mergeRamps,
  validateTheme,
  resolveTheme,
  renderCss,
  renderTokensTs,
  renderRawTs,
  renderTailwind,
  renderManifest,
  renderLlms,
} = lib;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const pkg = await readJson(resolve(PKG_DIR, "package.json"));
  const standardRamps = await readJson(RAMPS_PATH);
  const theme = await readJson(THEME_PATH);

  const ramps = mergeRamps(standardRamps, theme.ramps ?? {});

  const { errors, warnings } = validateTheme(theme, ramps);
  for (const w of warnings) console.error(`⚠ ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`✖ ${e}`);
    throw new Error(
      `gen:tokens: ${errors.length} validation error(s) — see above (frontend-guardrails §1.3)`
    );
  }

  const resolved = resolveTheme(theme, ramps);

  const genDir = resolve(PKG_DIR, "src/generated");
  await mkdir(genDir, { recursive: true });

  await writeFile(resolve(genDir, "tokens.css"), renderCss(resolved));
  await writeFile(resolve(genDir, "tokens.ts"), renderTokensTs(resolved));
  await writeFile(resolve(genDir, "raw.ts"), renderRawTs(ramps));
  await writeFile(resolve(genDir, "tailwind.css"), renderTailwind(resolved));

  const manifest = renderManifest(pkg, resolved, ramps);
  await writeFile(resolve(PKG_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(PKG_DIR, "llms.txt"), renderLlms(pkg, resolved));

  console.error(
    `gen:tokens: ${Object.keys(resolved.core).length} core, ` +
      `${Object.keys(resolved.component).length} component, ` +
      `${Object.keys(ramps).length} ramps` +
      (warnings.length ? `, ${warnings.length} warning(s)` : "") +
      `\n           → ${genDir}`
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
