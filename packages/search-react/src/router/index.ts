/**
 * `@stapel/search-react/router` — the react-router v7 binding for the URL
 * state, and nothing else.
 *
 * A SEPARATE entry point on purpose. URL state is a router concern, and the
 * pair does not own the host's router: a Next.js app, a hash router, or a
 * server render that reads `new URL(request.url).searchParams` all satisfy
 * `SearchParamsAdapter` without this file. Keeping the binding here means the
 * main entry pulls no router at all (size-limit proves it), and a host that
 * uses react-router gets the call it cannot make wrong:
 *
 * ```tsx
 * <SearchStateProvider adapter={useRouterSearchParams()} defaultType="listing">
 * ```
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SearchParamsAdapter } from "../headless/SearchStateProvider.js";

/**
 * react-router's `useSearchParams()` as a {@link SearchParamsAdapter}.
 *
 * `replace` is forwarded rather than dropped: a facet click PUSHES, so Back
 * removes exactly that filter (the spec's §4.2 acceptance), while typing in
 * the search box replaces so one history entry per keystroke never happens.
 */
export function useRouterSearchParams(): SearchParamsAdapter {
  const [params, setParams] = useSearchParams();
  return useMemo(
    () => ({
      params,
      setParams: (next: URLSearchParams, options?: { readonly replace?: boolean }) => {
        setParams(next, { replace: options?.replace ?? false });
      },
    }),
    [params, setParams]
  );
}
