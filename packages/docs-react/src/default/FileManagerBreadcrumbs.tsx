/**
 * `<FileManagerBreadcrumbs/>` — the default skin's breadcrumb strip: the
 * `Breadcrumbs` headless trail rendered as an antd `Breadcrumb`, rooted at a
 * clickable "All documents" item (the workspace root).
 *
 * Replaceable without a fork: `FileManager` resolves this strip through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.breadcrumbs", …)`).
 */
import type { ReactElement } from "react";
import { Breadcrumb } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { Breadcrumbs } from "../headless/Breadcrumbs.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

export interface FileManagerBreadcrumbsProps {
  readonly workspaceId: string;
  /** The current folder, `null` at the workspace root. */
  readonly folderId: string | null;
  onSelectFolder(folderId: string | null): void;
}

export function FileManagerBreadcrumbs(
  props: FileManagerBreadcrumbsProps
): ReactElement {
  const t = useT();
  return (
    <Breadcrumbs workspaceId={props.workspaceId} folderId={props.folderId}>
      {({ state }) => {
        // Navigation chrome: while the folder read loads (or if it failed,
        // which the tree pane already surfaces loudly), the root crumb alone
        // is the honest render — never a fabricated trail.
        const trail = matchLoad(state, {
          loading: () => [],
          failed: () => [],
          ready: (crumb) => crumb.trail,
        });
        return (
        <Breadcrumb
          data-testid="docs-breadcrumbs"
          items={[
            {
              title: (
                <a
                  onClick={(event) => {
                    event.preventDefault();
                    props.onSelectFolder(null);
                  }}
                  data-analytics="none"
                  data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {t(DOCS_I18N_KEYS.treeRoot)}
                </a>
              ),
            },
            ...trail.map((folder) => ({
              title: (
                <a
                  onClick={(event) => {
                    event.preventDefault();
                    props.onSelectFolder(folder.id);
                  }}
                  data-analytics="none"
                  data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                >
                  {folder.name}
                </a>
              ),
            })),
          ]}
        />
        );
      }}
    </Breadcrumbs>
  );
}
