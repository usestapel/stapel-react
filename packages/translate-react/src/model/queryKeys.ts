/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "keys are
 * namespaced"; frontend-guardrails §2.6 — the ONE legal home of literal key
 * arrays). Everything under the `"translate"` root so a host can invalidate the
 * whole module when a translator publishes a new revision.
 *
 * Content translation (`POST text/`) has no key here on purpose: it is not a
 * read of a named resource but a batched, deduplicated call the runtime's text
 * batcher owns (`model/textBatch.ts`), and giving it a query key would invite a
 * second, unbatched path to the same endpoint — where every miss costs money.
 */
const ROOT = "translate" as const;

export const translateQueryKeys: {
  readonly all: readonly ["translate"];
  readonly revision: () => readonly ["translate", "revision"];
  readonly bundle: (
    lang: string,
    revision: number
  ) => readonly ["translate", "bundle", string, number];
} = {
  all: [ROOT],
  /** The catalogue's max revision. No parameters: one deployment, one number. */
  revision: () => [ROOT, "revision"] as const,
  /** One language bundle AT a revision — a new revision is a new entry, which
   * is what makes the month-long cache header safe to trust. */
  bundle: (lang: string, revision: number) =>
    [ROOT, "bundle", lang.toLowerCase(), revision] as const,
};
