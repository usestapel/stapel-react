#!/usr/bin/env node
// FLEET GATE — is a pair's generated error bundle still a superset of the
// backend's registry?
//
// `gen:errors` makes coverage total BY CONSTRUCTION on the day it runs, and
// `gen:errors:check` only proves the committed bundle matches a regen from
// whatever sibling checkout is on disk. Neither answers the question that
// actually breaks a screen: does this pair have a sentence for every refusal
// the SHIPPED backend can raise? A backend that added `error.409.seq_conflict`
// after the last regen renders through core's generic `stapel.http.409`
// fallback — the silent degraded mode, in the one place a person needs a
// specific answer.
//
// So: backend `docs/errors.json` codes ⊆ the pair's committed
// `src/i18n/generated/errors.json` codes. The pair set and the module names
// come from the manifests, not a hand list. Locale bundles are reported too —
// a code present in en and absent from ru/es is a raw English string on a
// Russian host, which is the same defect one layer down.
//
// MODES: list (default, exit 0) · strict (`--strict` / ERROR_BUNDLES=strict).
//
//   node scripts/check-error-bundles.mjs
//   pnpm check:error-bundles
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SIBLING_ROOT = process.env.SIBLING_ROOT ?? "..";
const STRICT =
  process.argv.includes("--strict") || process.env.ERROR_BUNDLES === "strict";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Codes declared in a `{code, status, …}[]` artifact. */
const codesOf = (entries) =>
  new Set(entries.map((e) => e?.code).filter((c) => typeof c === "string"));

/** Locales a pair ships bundles for, from `errors.<lang>.gen.ts` filenames. */
async function localeBundles(genDir) {
  try {
    return (await readdir(genDir))
      .map((n) => /^errors\.([A-Za-z-]+)\.gen\.ts$/.exec(n)?.[1])
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

async function main() {
  const dirs = (await readdir(resolve(ROOT, "packages"), { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const gaps = [];
  let checked = 0;

  for (const name of dirs) {
    let manifest;
    try {
      manifest = await readJson(resolve(ROOT, "packages", name, "manifest.json"));
    } catch {
      continue;
    }
    const module = manifest.backend?.module;
    if (!module) continue;

    let backendCodes;
    try {
      backendCodes = codesOf(
        await readJson(resolve(ROOT, SIBLING_ROOT, module, "docs", "errors.json"))
      );
    } catch {
      continue; // backend ships no error registry — nothing to be a superset of
    }
    if (backendCodes.size === 0) continue;

    const genDir = resolve(ROOT, "packages", name, "src/i18n/generated");
    let pairCodes;
    try {
      pairCodes = codesOf(await readJson(resolve(genDir, "errors.json")));
    } catch {
      gaps.push({
        name,
        module,
        missing: [...backendCodes].sort(),
        why: "the pair generates no errors.json at all",
      });
      continue;
    }
    checked += 1;
    const missing = [...backendCodes].filter((c) => !pairCodes.has(c)).sort();
    if (missing.length > 0) {
      gaps.push({ name, module, missing, why: "codes absent from the en bundle" });
    }

    // Locale half: a locale bundle that carries fewer codes than en.
    //
    // A bundle generated with ERRORS_LOCALE_EXEMPT_OWNERS is DELIBERATELY
    // partial — the owner (stapel_chat, stapel_cdn, stapel_attributes …) ships
    // no catalog and the pair authors those strings itself in `src/i18n/<lang>
    // .ts`. So a code the pair's own locale module carries is covered, not a
    // gap; only what neither file has renders English.
    for (const locale of await localeBundles(genDir)) {
      const src = await readFile(resolve(genDir, `errors.${locale}.gen.ts`), "utf8");
      const localeCodes = new Set(
        [...src.matchAll(/^\s+"([^"]+)":\s*"/gm)].map((m) => m[1])
      );
      const authored = await readFile(
        resolve(ROOT, "packages", name, `src/i18n/${locale}.ts`),
        "utf8"
      ).catch(() => "");
      const localeMissing = [...pairCodes]
        .filter((c) => !localeCodes.has(c) && !authored.includes(`"${c}"`))
        .sort();
      if (localeMissing.length > 0) {
        gaps.push({
          name,
          module,
          missing: localeMissing,
          why: `${localeMissing.length} code(s) have no ${locale} text (renders English on a ${locale} host)`,
        });
      }
    }
  }

  if (gaps.length === 0) {
    console.error(
      `error-bundles: ${checked} pair(s) checked, every backend registry code has a sentence`
    );
    return;
  }
  const verb = STRICT ? "✖" : "⚠";
  console.error(
    `${verb} error-bundles: ${gaps.length} gap(s) across ${checked} checked pair(s)\n` +
      gaps
        .map((g) => {
          const head = `    - ${g.name} (${g.module}): ${g.why}`;
          const list = g.missing
            .slice(0, 6)
            .map((c) => `        ${c}`)
            .join("\n");
          const more = g.missing.length > 6 ? `\n        (+${g.missing.length - 6} more)` : "";
          return `${head}\n${list}${more}`;
        })
        .join("\n") +
      `\n  Regenerate with pnpm gen:errors (and ship the locale catalog upstream, or\n` +
      `  exempt the owner with ERRORS_LOCALE_EXEMPT_OWNERS and author the strings in\n` +
      `  the pair's ./i18n/<lang> module).` +
      (STRICT ? "" : `\n  (listing mode — pass --strict or set ERROR_BUNDLES=strict to fail on this)`)
  );
  if (STRICT) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
