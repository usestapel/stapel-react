/**
 * `useTermLabels` — `{code: label}` for codes a page already HOLDS.
 *
 * The other half of the seam. A stored answer on a listing is a list of term
 * CODES (`["apple", "iphone-15-pro"]`); the labels are not stored with it,
 * because a label is translated and a code is not. So a reopened draft, a
 * filter chip, a facet row — anything showing an answer somebody already gave
 * — has to ask for the words.
 *
 * Unlike a search this IS a cacheable resource: the same codes give the same
 * labels until the vocabulary's revision moves, and several controls on one
 * page routinely ask for the same set. So it is a TanStack query keyed through
 * the factory, and the answer is a {@link LoadState} rather than a bare map —
 * `{}` would say "these codes have no labels" in exactly the same words as
 * "nobody has asked yet" and "the request failed" (core `loadState.ts`).
 *
 * The fallback a caller wants is almost always the CODE ITSELF, which is what
 * {@link termLabel} does: the stored answer is the truth, and a blank control
 * is a worse lie than a slug.
 */
import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { VocabularyClient } from "../client.js";
import { vocabulariesQueryKeys } from "./queryKeys.js";

export interface TermLabelsOptions {
  readonly vocabulary: string;
  readonly level: string;
  readonly codes: readonly string[];
}

export type TermLabels = Readonly<Record<string, string>>;

/**
 * Labels for `codes`, as a load state. Disabled — and therefore `loading`,
 * never `ready` with an empty map — while there is no client, no pointer or
 * nothing to resolve.
 */
export function useTermLabels(
  client: VocabularyClient | null,
  options: TermLabelsOptions
): LoadState<TermLabels> {
  const { vocabulary, level, codes } = options;
  const wanted = codes.filter((code) => code.length > 0);
  const enabled =
    client !== null && vocabulary.length > 0 && level.length > 0 && wanted.length > 0;
  const query = useQuery({
    queryKey: vocabulariesQueryKeys.termLabels(vocabulary, level, wanted),
    enabled,
    queryFn: async (): Promise<TermLabels> => {
      // `enabled` already guarantees this, and the compiler does not know it.
      if (client === null) return {};
      return await client.resolve(vocabulary, level, wanted);
    },
  });
  return loadStateFromQuery(query);
}

/**
 * The one right way to READ that state for display: a resolved label, or the
 * code itself while the answer is in flight, when the load failed, or when the
 * server omitted the code because it does not know it.
 *
 * All four fall back the same way ON PURPOSE — the code is what the person's
 * answer literally is, so showing it is never wrong, only less kind. A control
 * that needs to distinguish them (an admin screen auditing dead codes) reads
 * the {@link LoadState} directly.
 */
export function termLabel(labels: LoadState<TermLabels>, code: string): string {
  return labels.status === "ready" ? (labels.data[code] ?? code) : code;
}
