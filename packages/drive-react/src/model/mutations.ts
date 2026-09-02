import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { DocDocument, DocFolder } from "@stapel/docs-react";
import type { StarTarget, StarredListing } from "../api/types.js";
import { useDriveApi } from "./context.js";
import { driveQueryKeys } from "./queryKeys.js";

/** Variables of {@link useToggleStar}: what to star, and to what value. */
export interface ToggleStarVariables {
  readonly target: StarTarget;
  /** The state the user is asking for — the verb, not the current state. */
  readonly starred: boolean;
}

/**
 * What `onMutate` snapshots so `onError` can put the cache back exactly as it
 * was — every drive query entry that existed at mutate time, with its data.
 */
interface StarRollback {
  readonly entries: readonly (readonly [readonly unknown[], unknown])[];
}

/** Flip `is_starred` on the row with this id, leaving every other row alone. */
function flipRow<T extends DocFolder | DocDocument>(
  rows: readonly T[],
  id: string,
  starred: boolean
): T[] {
  return rows.map((row) => (row.id === id ? { ...row, is_starred: starred } : row));
}

/**
 * Apply the requested star state across every cached drive read, in place.
 *
 * The starred LISTING is the interesting one: a star has to add a row that is
 * not in it yet, and the row body has to come from somewhere. It comes from
 * the children/recents caches — the lists the click happened in — and when it
 * is in none of them (a star fired from a search hit, whose DTO is not a full
 * document) the listing is left untouched and the invalidation on settle
 * fills it in. An optimistic update that INVENTS a row would draw a file with
 * no size, no type and no timestamp for as long as the request takes.
 */
function applyStar(
  queryClient: QueryClient,
  target: StarTarget,
  starred: boolean
): void {
  const isFolder = target.kind === "folder";

  // Children rungs + recents: flip the row where it is already drawn.
  for (const [key, data] of queryClient.getQueriesData<DocFolder[]>({
    queryKey: driveQueryKeys.allChildren,
  })) {
    if (!Array.isArray(data)) continue;
    if (!isFolder) continue;
    queryClient.setQueryData(key, flipRow(data, target.id, starred));
  }
  for (const [key, data] of queryClient.getQueriesData<DocDocument[]>({
    queryKey: driveQueryKeys.allRecents,
  })) {
    if (!Array.isArray(data)) continue;
    if (isFolder) continue;
    queryClient.setQueryData(key, flipRow(data, target.id, starred));
  }

  // The starred listing: remove on unstar (always possible), add on star only
  // when a full row is already cached somewhere (see the doc comment).
  for (const [key, listing] of queryClient.getQueriesData<StarredListing>({
    queryKey: driveQueryKeys.allStarred,
  })) {
    if (listing === undefined || listing === null) continue;
    if (!starred) {
      queryClient.setQueryData(key, {
        folders: listing.folders.filter((f) => !isFolder || f.id !== target.id),
        documents: listing.documents.filter(
          (d) => isFolder || d.id !== target.id
        ),
      } satisfies StarredListing);
      continue;
    }
    const known = isFolder
      ? queryClient
          .getQueriesData<DocFolder[]>({
            queryKey: driveQueryKeys.allChildren,
          })
          .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []))
          .find((row) => row.id === target.id)
      : queryClient
          .getQueriesData<DocDocument[]>({
            queryKey: driveQueryKeys.allRecents,
          })
          .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []))
          .find((row) => row.id === target.id);
    if (known === undefined) continue;
    const already =
      listing.folders.some((f) => f.id === target.id) ||
      listing.documents.some((d) => d.id === target.id);
    if (already) continue;
    queryClient.setQueryData(
      key,
      isFolder
        ? ({
            folders: [...listing.folders, { ...(known as DocFolder), is_starred: true }],
            documents: listing.documents,
          } satisfies StarredListing)
        : ({
            folders: listing.folders,
            documents: [
              ...listing.documents,
              { ...(known as DocDocument), is_starred: true },
            ],
          } satisfies StarredListing)
    );
  }
}

/**
 * Star / unstar a folder or a document, optimistically.
 *
 * A star is a bookmark: the backend takes `docs.view` for it, answers 204 for
 * both verbs whatever the previous state was, and the whole round trip is
 * invisible to the user IF the icon flips at once. So the cache is written
 * before the request, snapshotted first, and restored on failure — the star
 * springs back and the caller renders the error, rather than the UI keeping a
 * state the server refused.
 *
 * On settle the drive namespace is invalidated: `is_starred` also rides
 * folder/document/search envelopes this pair does not write by hand, and the
 * server is the one that decides what the starred listing contains after a
 * concurrent change elsewhere.
 */
export function useToggleStar(): UseMutationResult<
  void,
  StapelApiError,
  ToggleStarVariables,
  StarRollback
> {
  const api = useDriveApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    void,
    StapelApiError,
    ToggleStarVariables,
    StarRollback
  > = {
    mutationFn: (vars) => api.setStar(vars.target, vars.starred),
    onMutate: async (vars): Promise<StarRollback> => {
      // Cancel first: an in-flight read that lands after the optimistic write
      // would overwrite it with the pre-star server state.
      await queryClient.cancelQueries({ queryKey: driveQueryKeys.all });
      const entries = queryClient
        .getQueriesData({ queryKey: driveQueryKeys.all })
        .map(([key, data]) => [key, data] as const);
      applyStar(queryClient, vars.target, vars.starred);
      return { entries };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.entries ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: driveQueryKeys.all });
    },
  };
  return useMutation(options);
}
