/**
 * `<DriveTrashPane/>` — the Trash tab.
 *
 * A THIN WRAPPER over `@stapel/docs-react/default`'s `TrashPane`, on purpose.
 * The trash is the one drive surface that was already finished: restore,
 * per-item delete-forever, and an "Empty trash" whose three off-states
 * (reading / failed / genuinely empty) each say which — that pane is the
 * fleet's reference for the gated-button rule, and re-drawing it here would
 * be a second implementation of a solved screen, diverging on the first bug
 * fix.
 *
 * What the wrapper adds is exactly the drive's frame: this pane inherits the
 * screen's measure and mode instead of being mounted as its own page. If the
 * drive later needs a trash affordance the docs pane does not have, that is
 * the moment to grow a real component — not before.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("trashPane", …)`.
 */
import type { ReactElement } from "react";
import { TrashPane } from "@stapel/docs-react/default";
import type { ThemeMode } from "@stapel/tokens-antd";

export interface DriveTrashPaneProps {
  readonly workspaceId: string;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function DriveTrashPane(props: DriveTrashPaneProps): ReactElement {
  return (
    <div data-testid="drive-trash-pane">
      <TrashPane
        workspaceId={props.workspaceId}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      />
    </div>
  );
}
