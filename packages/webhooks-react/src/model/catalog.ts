import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery, mapLoad, useActiveSessionReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { CatalogEvent } from "../api/types.js";
import { useWebhooksApi } from "./context.js";
import { webhooksQueryKeys } from "./queryKeys.js";

/** One group of the event picker: every event a module emits. */
export interface CatalogGroup {
  /** The emitting module, e.g. `listings` — the picker's `optgroup` label. */
  readonly module: string;
  readonly events: readonly CatalogEvent[];
}

/** What {@link useEventCatalog} reports. */
export interface EventCatalogBag {
  /** Events, grouped by emitting module, both sorted. */
  readonly groups: LoadState<readonly CatalogGroup[]>;
  /** Delivery type NAMES this deployment registers, in registry order. */
  readonly deliveryTypes: readonly string[];
  /** Look one event up by name — the picker's selected option. */
  readonly eventByName: (event: string) => CatalogEvent | undefined;
  readonly refetch: () => void;
}

/**
 * What this deployment can react to.
 *
 * ── Why this is a READ and not a constant ─────────────────────────────────
 *
 * The catalogue is generated from installed packages' `schemas/emits/` on
 * every call. Two deployments of the same product emit different events
 * because they install different modules, so a picker that shipped its own
 * list would offer events nothing emits (a subscription that never fires and
 * looks fine) and hide events something does (a capability nobody can reach).
 *
 * ── Grouped by module, because a flat list of event names is unreadable ───
 *
 * A working deployment emits dozens; `module` is the only axis in the DTO
 * that a person recognises, so it is the grouping. Sorting is done here rather
 * than trusted from the wire: the scan order is a filesystem walk.
 */
export function useEventCatalog(
  options: { readonly enabled?: boolean } = {}
): EventCatalogBag {
  const api = useWebhooksApi();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery({
    queryKey: webhooksQueryKeys.catalog,
    queryFn: ({ signal }) => api.eventCatalog({ signal }),
    enabled,
    // The catalogue changes when a deployment installs a module — not while
    // somebody fills in a form. Re-reading it on every focus would be a
    // request per tab switch for an answer that cannot have moved.
    staleTime: 5 * 60_000,
  });

  const state = loadStateFromQuery(query);
  const catalog = state.status === "ready" ? state.data : undefined;
  const events = useMemo(() => catalog?.events ?? [], [catalog]);

  const groups = useMemo<readonly CatalogGroup[]>(() => {
    const byModule = new Map<string, CatalogEvent[]>();
    for (const event of events) {
      const bucket = byModule.get(event.module);
      if (bucket) bucket.push(event);
      else byModule.set(event.module, [event]);
    }
    return [...byModule.entries()]
      .map(([module, list]) => ({
        module,
        events: [...list].sort((a, b) => a.event.localeCompare(b.event)),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [events]);

  const index = useMemo(
    () => new Map(events.map((event) => [event.event, event])),
    [events]
  );

  return {
    groups: mapLoad(state, () => groups),
    deliveryTypes: catalog?.delivery_types ?? [],
    eventByName: (event) => index.get(event),
    refetch: () => {
      void query.refetch();
    },
  };
}
