/**
 * `<WorkspaceSwitcher/>` — which workspace this app is about, in the top bar.
 *
 * It is the pair's `workspaces.switcher` embed (`src/nav/manifest.ts`): a
 * shell mounts it in `topbar.start`, right after the brand, with no props.
 * It reads and writes the one selection every workspace-scoped screen reads
 * (`WorkspaceSelection`), so switching here moves the members, settings and
 * audit screens with it — the switcher holds no state of its own.
 *
 * The four answers it can draw:
 *
 *  - no `<WorkspaceSelectionProvider>` above it → nothing. The scaffold mounts
 *    the provider around the member shell whenever it mounts this embed; a
 *    host that mounts the switcher by hand mounts the provider too.
 *  - the list is loading → a disabled select that says so (no layout jump).
 *  - the list FAILED → a retry control naming the failure, never an empty
 *    select that reads as "you have no workspaces".
 *  - the person belongs to none → nothing to switch between, so nothing; the
 *    workspace screens themselves say "you are not in a workspace yet".
 */
import type { ReactElement } from "react";
import { Button, Select } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { matchLoad, useT } from "@stapel/core";
import type { Workspace } from "../api/types.js";
import { useOptionalWorkspaceSelection } from "../model/selection.js";
import { WORKSPACES_I18N_KEYS } from "../i18n/keys.js";

export interface WorkspaceSwitcherProps {
  /** Called after a switch, with the workspace now active. */
  readonly onSwitched?: ((workspace: Workspace) => void) | undefined;
  /** Pin the theme side (a demo showing both). Defaults to the live mode. */
  readonly mode?: "light" | "dark";
}

/** Wide enough for a typical workspace name, narrow enough for a phone bar. */
const MIN_WIDTH = 140;
const MAX_WIDTH = 240;

export function WorkspaceSwitcher(props: WorkspaceSwitcherProps): ReactElement | null {
  const selection = useOptionalWorkspaceSelection();
  if (selection === null) return null;
  const empty =
    selection.state.status === "ready" && selection.state.data.length === 0;
  if (empty) return null;
  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
      style={{ display: "inline-flex", minWidth: 0 }}
    >
      <SwitcherControl {...props} />
    </SkinTheme>
  );
}

function SwitcherControl(props: WorkspaceSwitcherProps): ReactElement | null {
  const t = useT();
  const selection = useOptionalWorkspaceSelection();
  if (selection === null) return null;
  const label = t(WORKSPACES_I18N_KEYS.switcherLabel);
  const style = { minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH };

  return matchLoad(selection.state, {
    loading: () => (
      <Select<string>
        aria-label={label}
        loading
        disabled
        open={false}
        style={style}
        data-testid="workspace-switcher"
        data-state="loading"
        data-disabled-reason="the workspace list is still loading"
      />
    ),
    failed: () => (
      <Button
        type="text"
        danger
        onClick={() => {
          void selection.refetch();
        }}
        data-testid="workspace-switcher-retry"
        data-analytics="none"
        data-analytics-reason="retries a failed read — no product outcome of its own"
      >
        {t(WORKSPACES_I18N_KEYS.switcherFailed)}
      </Button>
    ),
    ready: (workspaces) => (
      <Select<string>
        aria-label={label}
        value={selection.current?.id ?? null}
        options={workspaces.map((ws) => ({ value: ws.id, label: ws.name }))}
        onChange={(id) => {
          selection.switchTo(id);
          const next = workspaces.find((ws) => ws.id === id);
          if (next !== undefined) props.onSwitched?.(next);
        }}
        popupMatchSelectWidth={false}
        style={style}
        data-testid="workspace-switcher"
        data-state="ready"
        data-analytics="none"
        data-analytics-reason="the switch's outcome is the selection change every workspace screen refetches on; the host tracks navigation"
      />
    ),
  });
}
