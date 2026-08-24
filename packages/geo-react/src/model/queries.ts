import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useGeoApi } from "./context.js";
import { geoKeys } from "./queryKeys.js";
import type { MapConfig } from "../api/types.js";

/**
 * The bootstrap read — public, and the first thing a picker does.
 *
 * It is cached hard on purpose: a deployment's tile layer, breakpoints,
 * debounce discipline and endpoint table do not change while a person fills in
 * a form, and re-fetching them on every mount of a field would be one request
 * per address input on the page.
 */
export function useMapConfig(): { readonly state: LoadState<MapConfig>; refetch: () => void } {
  const api = useGeoApi();
  const query = useQuery({
    queryKey: geoKeys.mapConfig(),
    queryFn: ({ signal }) => api.mapConfig({ signal }),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  return {
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  };
}
