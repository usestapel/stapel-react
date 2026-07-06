import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Workspace, WorkspaceCreate } from "../api/types.js";
import { useWorkspaces } from "../model/queries.js";
import { useCreateWorkspace } from "../model/mutations.js";

/** Render-prop bag for {@link WorkspaceList}. */
export interface WorkspaceListBag {
  /** The caller's workspaces once loaded (empty before load). */
  readonly workspaces: readonly Workspace[];
  /** The initial list load is in flight (no data yet). */
  readonly isLoading: boolean;
  /** Either the read or the create failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Create a workspace (owner-seeded). */
  create(body: WorkspaceCreate): void;
  /** A create call is in flight. */
  readonly isCreating: boolean;
  /** The workspace created by the last `create`, else null. */
  readonly created: Workspace | null;
  /** Refetch the list from the server. */
  refetch(): void;
}

/**
 * Headless workspace list — a renderless view + create control over the caller's
 * workspaces. Wires {@link useWorkspaces} + {@link useCreateWorkspace} and hands a
 * {@link WorkspaceListBag} to `children`; bring your own list / create form.
 * Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <WorkspaceList>
 *   {({ workspaces, create }) => ( ... )}
 * </WorkspaceList>
 * ```
 */
export function WorkspaceList(props: {
  children: (bag: WorkspaceListBag) => ReactNode;
}): ReactNode {
  const query = useWorkspaces();
  const mutation = useCreateWorkspace();
  return props.children({
    workspaces: query.data?.workspaces ?? [],
    isLoading: query.isLoading,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    create: (body) => {
      mutation.mutate(body);
    },
    isCreating: mutation.isPending,
    created: mutation.data ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
