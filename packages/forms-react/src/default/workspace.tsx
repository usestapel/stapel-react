/**
 * The one place the skin answers "which workspace is this screen about?".
 *
 * The three admin surfaces are ROUTABLE (`src/nav/manifest.ts`), and a route
 * carries no workspace: a container mounts `<FormsListPane/>` with nothing but
 * the URL. `useFormsWorkspaceId` resolves the screen's own prop first and the
 * runtime's `workspaceId` second; when a host declared neither, the screen
 * must SAY so — rendering an empty list would blame the workspace for a wiring
 * mistake, and throwing would render a blank route with no explanation.
 */
import type { ReactElement } from "react";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

export { useFormsWorkspaceId } from "../model/context.js";

/** The designed "this host wired no workspace" state. */
export function MissingWorkspaceNotice(props: {
  testId: string;
}): ReactElement {
  const t = useT();
  return (
    <ErrorAlert
      testId={props.testId}
      message={t(FORMS_I18N_KEYS.noWorkspace)}
    />
  );
}
