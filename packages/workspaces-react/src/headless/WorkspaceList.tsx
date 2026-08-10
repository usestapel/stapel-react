import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { Workspace, WorkspaceCreate } from "../api/types.js";
import { useWorkspaces } from "../model/queries.js";
import { useCreateWorkspace } from "../model/mutations.js";

/** Render-prop bag for {@link WorkspaceList}. */
export interface WorkspaceListBag {
  /**
   * The read, as a state a skin cannot flatten: `loading` / `ready` with the
   * rows / `failed` with the error. Render it with core's `matchList`, whose
   * four arms are all required, so "you have no workspaces" can only be said
   * about a load that actually succeeded.
   *
   * This replaced a `workspaces: readonly Workspace[]` field that was `[]` in
   * all three cases. On 2026-08-09 the list endpoint answered 404 for hours
   * and every screen built on that field said the person had no workspaces.
   * The bag carried `isError` beside it the whole time; nothing forced a skin
   * to look, so nothing did.
   */
  readonly state: LoadState<readonly Workspace[]>;
  /** Create a workspace (owner-seeded). */
  create(body: WorkspaceCreate): void;
  /** A create call is in flight. */
  readonly isCreating: boolean;
  /** The workspace created by the last `create`, else null. */
  readonly created: Workspace | null;
  /** The CREATE's failure — a write, and therefore a different question from
   * {@link state}, which is about the read. */
  readonly createError: StapelApiError | null;
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
 *   {({ state, create }) =>
 *     matchList(state, {
 *       loading: () => <Spinner />,
 *       failed: (error) => <ErrorPanel error={error} onRetry={refetch} />,
 *       empty: () => <FirstWorkspacePrompt onCreate={create} />,
 *       ready: (workspaces) => <List items={workspaces} />,
 *     })
 *   }
 * </WorkspaceList>
 * ```
 */
export function WorkspaceList(props: {
  children: (bag: WorkspaceListBag) => ReactNode;
}): ReactNode {
  const query = useWorkspaces();
  const mutation = useCreateWorkspace();
  return props.children({
    // `workspaces` is optional in the wire schema, so a SUCCESSFUL response
    // may legitimately carry none. That is an empty list, not a failed load —
    // the distinction this whole field exists for is already made above it.
    state: mapLoad(loadStateFromQuery(query), (list) => list.workspaces ?? []),
    create: (body) => {
      mutation.mutate(body);
    },
    isCreating: mutation.isPending,
    created: mutation.data ?? null,
    createError: mutation.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  });
}
