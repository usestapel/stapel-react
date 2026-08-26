/**
 * "Which workspace is this screen about" — the seam between the NAV contract
 * and the four workspace-scoped admin screens.
 *
 * The nav contract routes a screen; it does not hand it an ambient scope, and
 * the active workspace is not a path segment of a settings URL — it is
 * RUNTIME state, the same state the container writes when a person switches
 * (`WorkspaceSelection.switchTo`). So a screen declared in nav takes NO
 * `workspaceId` from the route and reads it from
 * {@link useOptionalWorkspaceSelection} instead; a host that mounts the same
 * component itself keeps passing `workspaceId` explicitly and never touches
 * the selection at all.
 *
 * The `Optional` accessor is load-bearing. `useWorkspaceSelection()` throws
 * outside its provider, which is right for application code and wrong for a
 * screen the shell mounts from a manifest: a shell that has not wired the
 * provider would render a white page with an error in the console. Here the
 * three answers a person can actually get are drawn instead:
 *
 *  - the list is still loading / failed → the substrate's own arms (a
 *    skeleton, and the failure WITH a retry — never "you have no workspaces"),
 *  - the person belongs to none → "you are not in a workspace yet",
 *  - there is no selection at all (no provider, or nothing resolved) →
 *    "choose a workspace".
 *
 * None of them is blank, and none of them claims something the client does
 * not know.
 */
import type { ReactElement, ReactNode } from "react";
import { useT } from "@stapel/core";
import { EmptyState, LoadBoundary } from "@stapel/tokens-antd/skin";
import { useOptionalWorkspaceSelection } from "../model/selection.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";

export interface ActiveWorkspaceBoundaryProps {
  /** The workspace the HOST named. Given, the selection is never consulted. */
  readonly workspaceId?: string | undefined;
  /** Rendered once a workspace id is known. */
  readonly children: (workspaceId: string) => ReactNode;
  /** Test id of the chooser / empty arms (the ready arm has no wrapper). */
  readonly testId: string;
}

/**
 * Resolve the workspace this screen is about, or draw the reason it cannot be
 * resolved. Renders `children(workspaceId)` unchanged once there is one.
 */
export function ActiveWorkspaceBoundary(
  props: ActiveWorkspaceBoundaryProps
): ReactElement {
  const t = useT();
  // Unconditional, as a hook must be: reading the context is cheap and it
  // returns null outside a provider rather than throwing.
  const selection = useOptionalWorkspaceSelection();

  if (props.workspaceId !== undefined) {
    return <>{props.children(props.workspaceId)}</>;
  }

  const chooser = (
    <EmptyState
      title={t(WORKSPACES_I18N_KEYS.activeChooseTitle)}
      hint={t(WORKSPACES_I18N_KEYS.activeChooseHint)}
      testId={`${props.testId}-choose`}
    />
  );

  if (selection === null) return chooser;

  return (
    <LoadBoundary
      state={selection.state}
      testId={props.testId}
      onRetry={() => {
        void selection.refetch();
      }}
    >
      {(workspaces) => {
        if (selection.current !== null) {
          return <>{props.children(selection.current.id)}</>;
        }
        // The list arrived and the chain still answered nobody: either the
        // person belongs to no workspace (a different sentence from "pick
        // one"), or a host is driving the URL layer at something unresolved.
        return workspaces.length === 0 ? (
          <EmptyState
            title={t(WORKSPACES_I18N_KEYS.activeNoneTitle)}
            hint={t(WORKSPACES_I18N_KEYS.activeNoneHint)}
            testId={`${props.testId}-none`}
          />
        ) : (
          chooser
        );
      }}
    </LoadBoundary>
  );
}
