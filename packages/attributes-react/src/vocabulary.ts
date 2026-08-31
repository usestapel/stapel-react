/**
 * The VOCABULARY seam — how a `ref_select` reaches fourteen thousand phone
 * models without any of them being in the category schema.
 *
 * `stapel-attributes` 0.5.0 added two vocabulary-backed value types whose
 * config carries a POINTER (`optionsRef {vocabulary, level, parentFeature?}`)
 * rather than an options list, because the lists are the wrong size to inline:
 * Avito's phone catalogue is 529 vendors → 14 962 models, and its car
 * catalogue is 107 049 modifications. `GET /categories/{id}/features` sends
 * the pointer as-is and never inlines a vocabulary.
 *
 * So the terms arrive over a SECOND wire, and this file is the shape of it.
 *
 * ── Why the interface lives here and the implementation does not ───────────
 *
 * `@stapel/vocabularies-react` implements this interface **structurally** —
 * it does not import it, and this package does not import that one. L2 pairs
 * never depend on each other, and an L0 vocabulary of types is exactly what
 * makes the two independently releasable: the container (a storefront) calls
 * `createVocabularyClient({baseUrl})` from the pair and hands the result to
 * {@link VocabularyClientProvider} here.
 *
 * A host with no vocabularies module at all supplies its own two functions —
 * an in-memory table, an existing search endpoint — and every ref editor
 * works. That is the whole reason this is two methods and not a client.
 *
 * ── No provider is a LOUD state, not a quiet one ───────────────────────────
 *
 * `useVocabularyClient()` returns `null` rather than throwing, and the ref
 * editors draw the same unsupported notice a missing editor draws, with the
 * submit blocked through the SAME channel (`unsupportedTypes` /
 * `unsupportedTypeGate`). A ref field drawn as an empty dropdown would be a
 * mandatory attribute a person cannot answer and is not told about.
 */
import { createContext, useContext } from "react";
import type { Context, Provider } from "react";

/** One term of a vocabulary level — the row `GET /vocabularies/{slug}/terms/`
 * returns. `has_children` is snake_case because it is the wire's spelling. */
export interface VocabularyTerm {
  readonly code: string;
  readonly label: string;
  readonly has_children?: boolean;
}

/**
 * The two reads a ref editor needs. Both are `async` and neither is a query:
 * caching, retries and deduplication belong to whatever implements this
 * (vocabularies-react uses the fleet's query layer), not to the seam.
 */
export interface VocabularyClient {
  /**
   * Terms of one level, narrowed by a search string and — when the feature
   * declares a `parentFeature` that currently holds a value — by the parent
   * term's code. An empty `query` means "the first page of this level", which
   * is what a dropdown opens on.
   *
   * `signal` is honoured: the editors supersede an in-flight search when a
   * person keeps typing, and an implementation that abandons the request early
   * saves the round trip.
   *
   * It is a COURTESY, not the correctness boundary. The editors tag every
   * request with its query and drop an answer whose query is no longer the one
   * in the box, so a client that ignores `signal` costs bandwidth and cannot
   * put the wrong list under somebody's finger.
   */
  search(
    vocabulary: string,
    level: string,
    query: string,
    parent?: string,
    signal?: AbortSignal
  ): Promise<readonly VocabularyTerm[]>;
  /** `{code: label}` for codes already stored on a listing — the labels a
   * reopened draft shows before anything is searched. Unknown codes are
   * omitted, so a caller falls back to the code itself. */
  resolve(
    vocabulary: string,
    level: string,
    codes: readonly string[]
  ): Promise<Readonly<Record<string, string>>>;
}

const VocabularyClientContext: Context<VocabularyClient | null> =
  createContext<VocabularyClient | null>(null);

/**
 * Put a client in scope for every ref editor below it.
 *
 * ```tsx
 * <VocabularyClientProvider value={createVocabularyClient({ baseUrl })}>
 *   <ListingComposerPage … />
 * </VocabularyClientProvider>
 * ```
 */
export const VocabularyClientProvider: Provider<VocabularyClient | null> =
  VocabularyClientContext.Provider;

/** The client in scope, or `null` — see this module's header on why the
 * absence is a state and not an exception. */
export function useVocabularyClient(): VocabularyClient | null {
  return useContext(VocabularyClientContext);
}

/** The value types that cannot be drawn without a client, sorted. Exported so
 * the renderability helpers and the editors read ONE list. */
export const VOCABULARY_BACKED_TYPES: readonly string[] = [
  "ref_hierarchical_select",
  "ref_select",
];

/** The `optionsRef` a `ref_select` config carries, or `undefined` when the
 * config is malformed — the pointer is the whole config, so a missing one is
 * an undrawable field rather than an empty list. */
export function optionsRefOf(
  config: Readonly<Record<string, unknown>>
): { vocabulary: string; level: string; parentFeature?: string } | undefined {
  const raw = config["optionsRef"];
  if (typeof raw !== "object" || raw === null) return undefined;
  const entry = raw as { vocabulary?: unknown; level?: unknown; parentFeature?: unknown };
  if (typeof entry.vocabulary !== "string" || entry.vocabulary.length === 0) return undefined;
  if (typeof entry.level !== "string" || entry.level.length === 0) return undefined;
  return {
    vocabulary: entry.vocabulary,
    level: entry.level,
    ...(typeof entry.parentFeature === "string" && entry.parentFeature.length > 0
      ? { parentFeature: entry.parentFeature }
      : {}),
  };
}

/** The first code a sibling's answer carries, canonicalized — a `ref_select`'s
 * value is a LIST, and a parent narrows by one term. */
export function firstCode(value: unknown): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const code = firstCode(item);
      if (code !== undefined) return code;
    }
  }
  return undefined;
}
