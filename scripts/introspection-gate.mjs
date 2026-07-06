#!/usr/bin/env node
// STAPEL_INTROSPECTION deploy gate + showcase build wrapper (frontend-guardrails
// §5). Mirrors the backend convention: swagger/ReDoc/OpenAPI/MCP/debug-toolbar
// mount through `get_dev_urls()`, which returns `[]` outside
// `DJANGO_ENV ∈ {local, dev}`. The frontend introspection surfaces (the design-
// system showcase, future report artifacts) are already OUT of every prod bundle
// by construction — separate entry points, never imported by a pair. This gate
// is the *deploy* layer: it decides whether the showcase artifact is even built
// and served for a given environment, using the same signal as the backend.
//
// Resolution order (first that applies wins):
//   1. STAPEL_INTROSPECTION explicit — "1|true|on|yes" → on, "0|false|off|no" → off
//   2. else mirror DJANGO_ENV — on when it is "local" or "dev", off otherwise
//   3. else off (production-safe default; matches get_dev_urls() returning [])
//
// As a library: `import { introspectionEnabled } from "./introspection-gate.mjs"`.
// As a CLI (`node scripts/introspection-gate.mjs [-- <cmd...>]`):
//   - no command:  exit 0 if enabled, 1 if disabled (usable in shell `&&`)
//   - with command: run <cmd> only when enabled; when disabled, print a notice
//     and exit 0 (a CI showcase-build job no-ops cleanly in prod, not red)
import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const TRUE = new Set(["1", "true", "on", "yes"]);
const FALSE = new Set(["0", "false", "off", "no"]);
const DEV_ENVS = new Set(["local", "dev"]);

/**
 * Resolve whether introspection surfaces are enabled for this environment.
 * @param {Record<string,string|undefined>} [env=process.env]
 * @returns {{ enabled: boolean, reason: string }}
 */
export function introspectionEnabled(env = process.env) {
  const flag = env.STAPEL_INTROSPECTION?.trim().toLowerCase();
  if (flag && TRUE.has(flag))
    return { enabled: true, reason: `STAPEL_INTROSPECTION=${flag}` };
  if (flag && FALSE.has(flag))
    return { enabled: false, reason: `STAPEL_INTROSPECTION=${flag}` };
  const djangoEnv = env.DJANGO_ENV?.trim().toLowerCase();
  if (djangoEnv)
    return {
      enabled: DEV_ENVS.has(djangoEnv),
      reason: `DJANGO_ENV=${djangoEnv}`,
    };
  return { enabled: false, reason: "no STAPEL_INTROSPECTION / DJANGO_ENV (prod default)" };
}

// --- Static precompression (zero-dep, Node built-in zlib) ---------------------
// nginx `brotli_static on` / `gzip_static on` serve a sibling `.br` / `.gz` for
// a request when present, so we precompress the built showcase once at build
// time instead of on every request. Only text-ish assets benefit.
const COMPRESSIBLE = new Set([
  ".js", ".mjs", ".css", ".html", ".json", ".svg", ".map", ".txt", ".xml", ".wasm",
]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function precompress(dir) {
  let files = 0;
  let saved = 0;
  for await (const file of walk(dir)) {
    if (!COMPRESSIBLE.has(extname(file))) continue;
    if (file.endsWith(".br") || file.endsWith(".gz")) continue;
    const buf = await readFile(file);
    if (buf.length < 1024) continue; // not worth a second request-time stat
    const br = brotliCompressSync(buf, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
      },
    });
    const gz = gzipSync(buf, { level: 9 });
    await writeFile(`${file}.br`, br);
    await writeFile(`${file}.gz`, gz);
    files += 1;
    saved += buf.length - br.length;
  }
  return { files, saved };
}

async function main() {
  const { enabled, reason } = introspectionEnabled();
  const args = process.argv.slice(2);
  const sep = args.indexOf("--");
  const cmd = sep >= 0 ? args.slice(sep + 1) : args;

  if (cmd.length === 0) {
    // Predicate mode for shell `&&` composition.
    console.error(
      `STAPEL_INTROSPECTION: ${enabled ? "ON" : "OFF"} (${reason})`
    );
    process.exit(enabled ? 0 : 1);
  }

  if (!enabled) {
    console.error(
      `STAPEL_INTROSPECTION OFF (${reason}) — skipping showcase build; ` +
        `introspection artifacts are not deployed to this environment (§5). ` +
        `Force with STAPEL_INTROSPECTION=1.`
    );
    process.exit(0);
  }

  console.error(`STAPEL_INTROSPECTION ON (${reason}) — building showcase.`);
  const run = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", shell: false });
  if (run.status !== 0) process.exit(run.status ?? 1);

  // Precompress the Ladle build output for nginx brotli_static / gzip_static.
  const buildDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "packages/showcase-viewer/build"
  );
  try {
    const { files, saved } = await precompress(buildDir);
    console.error(
      `showcase: precompressed ${files} asset(s) (.br + .gz), ~${Math.round(
        saved / 1024
      )} KB saved on brotli — serve with nginx brotli_static/gzip_static (docs/deploy-introspection.md).`
    );
  } catch (e) {
    console.error(`showcase: precompression skipped (${e.code ?? e.message}).`);
  }
}

// Run as CLI only (not when imported for tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
