import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { RankingResponse, Scorer } from "../api/types.js";
import { useRankingDisclosure } from "../model/queries.js";

/** The bag `<RankingDisclosure>` hands its render prop. */
export interface RankingDisclosureBag {
  /**
   * The ranking parameters. `empty` means the deployment declares none — a
   * legitimate answer for a naive backend, and a different sentence from
   * "we could not fetch the disclosure".
   */
  readonly state: LoadState<readonly Scorer[]>;
  readonly disclosure: LoadState<RankingResponse>;
  /**
   * Parameters the CONFIGURED engine cannot evaluate (`active: false`). They
   * are listed with their `inactive_reason`, not filtered out: a disclosure
   * that quietly dropped them would be disclosing a ranking the site does not
   * actually use — which is the failure mode P2B Art. 5 exists to prevent.
   */
  readonly inactive: readonly Scorer[];
  readonly docType: string | null;
  readonly backend: string | null;
  readonly notes: readonly string[];
  refetch(): void;
}

/**
 * Headless P2B Art. 5 ranking disclosure — "what determines the order of
 * these results", straight from the backend's scorer registry rather than
 * from prose somebody has to remember to update.
 *
 * Pair this with the DSA Art. 26 half: `SearchItem.promoted` marks the paid
 * placements in the list itself, and this explains the ordering of everything
 * else. Neither substitutes for the other.
 */
export function RankingDisclosure(props: {
  /** Doc type to disclose. Omitted asks for the deployment's default. */
  type?: string;
  children: (bag: RankingDisclosureBag) => ReactNode;
}): ReactNode {
  const query = useRankingDisclosure(props.type);
  const disclosure = loadStateFromQuery(query);
  const data = disclosure.status === "ready" ? disclosure.data : null;

  return props.children({
    state: mapLoad(disclosure, (d) => d.scorers as readonly Scorer[]),
    disclosure,
    inactive: data === null ? [] : data.scorers.filter((s) => !s.active),
    docType: data?.doc_type ?? null,
    backend: data?.backend ?? null,
    notes: data === null ? [] : data.notes,
    refetch: () => {
      void query.refetch();
    },
  });
}
