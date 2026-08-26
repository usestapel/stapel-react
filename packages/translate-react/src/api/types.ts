/**
 * Wire types for the stapel-translate HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-translate's OWN `docs/schema.json` — the §17-native
 * per-module contract the backend has emitted since 0.7.0).
 *
 * ── Two shapes this module's wire has that a reader must not smooth over ───
 *
 * A LANGUAGE BUNDLE is not in the schema table at all: `GET languages/{lang}/
 * data/` is described as a free `{[key: string]: unknown}` object because it IS
 * one — a flat `key → copy` dictionary whose keys are whatever the deployment's
 * catalogue holds. {@link LanguageBundle} names that shape as core's
 * `I18nDictionary`, which is the type the i18n engine actually takes, and the
 * loader validates it row by row rather than trusting the cast.
 *
 * `TextTranslationRequest` carries `text` XOR `texts`: two shapes over one
 * endpoint. The schema marks both optional because OpenAPI cannot spell "one
 * of these two"; the api layer takes the two forms as separate arguments so a
 * caller cannot build the body the server refuses with `text_required`.
 */
import type { components } from "./generated/schema.js";
import type { I18nDictionary } from "@stapel/core";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** `{revision}` — the catalogue's current max revision, the cache key of a bundle. */
export type LanguageRevision = Schemas["LanguageRevisionResponse"];

/** Body of `POST text/` (see the file header on `text` XOR `texts`). */
export type TextTranslationRequest = Schemas["TextTranslationRequest"];

/** Answer of `POST text/`: translations in input order, plus `cached`/`provider`. */
export type TextTranslationResult = Schemas["TextTranslationResult"];

/**
 * A whole UI bundle for one language: `{"moderation.reason.spam": "Spam", …}`.
 * The wire says `{[key: string]: unknown}`; the engine takes
 * `Record<string, string>`, and {@link isLanguageBundle} is what turns one into
 * the other without a cast.
 */
export type LanguageBundle = I18nDictionary;

/**
 * Is this parsed JSON a language bundle? A flat object of string values —
 * anything else (a DRF error body, an HTML error page parsed by a proxy, a
 * nested object from a future serializer) is refused here rather than handed
 * to the i18n engine, where a non-string value renders as `[object Object]` in
 * the middle of somebody's menu.
 */
export function isLanguageBundle(value: unknown): value is LanguageBundle {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}
