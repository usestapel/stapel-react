/**
 * Wire types for the stapel-vocabularies HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-vocabularies's OWN `docs/schema.json` — the §17-native
 * per-module contract). Alias the schemas this pair uses under local names
 * here; do NOT write parallel response bodies.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/** A vocabulary as the catalogue endpoints render it. */
export type Vocabulary = Schemas["Vocabulary"];

/** One level of a vocabulary — `parent` names the level above, null at the root. */
export type Level = Schemas["Level"];

/** One term of one level. `has_children` is what tells a cascading control
 * whether there is another column to ask for. */
export type Term = Schemas["Term"];

/** One page of terms plus the size of the whole filtered set (`total` counts
 * before `limit`/`offset`, so a control can say "50 of 14 962"). */
export type TermPage = Schemas["TermPage"];
