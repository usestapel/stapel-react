/**
 * `<FileManagerBreadcrumbs/>` — the default skin's breadcrumb strip: the
 * `Breadcrumbs` headless trail rendered as an antd `Breadcrumb`, rooted at a
 * clickable "All documents" item (the workspace root).
 *
 * While the folder read is in flight the trail is UNKNOWN, and the honest
 * render of an unknown trail is a skeleton — not the finished root crumb,
 * which is what "loading" used to draw and why the `loading` and `root`
 * shots were pixel-identical in a package that already ships a skeleton for
 * the file list (visual pass M-6 / M-3). A failed read stays the root crumb
 * alone: the tree pane beside it surfaces that failure loudly, and a
 * permanent skeleton would claim something is still coming.
 *
 * Replaceable without a fork: `FileManager` resolves this strip through the
 * skin slot registry (`registerDocsSkinComponent("fileManager.breadcrumbs", …)`).
 */
import type { ReactElement } from "react";
import { Breadcrumb, Flex, Skeleton } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { CRUMB_SKELETON_WIDTHS } from "./measure.js";
import type { ThemeMode } from "@stapel/tokens-antd";
import { Breadcrumbs } from "../headless/Breadcrumbs.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

export interface FileManagerBreadcrumbsProps {
  readonly workspaceId: string;
  /** The current folder, `null` at the workspace root. */
  readonly folderId: string | null;
  onSelectFolder(folderId: string | null): void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function FileManagerBreadcrumbs(
  props: FileManagerBreadcrumbsProps
): ReactElement {
  const t = useT();
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <Breadcrumbs workspaceId={props.workspaceId} folderId={props.folderId}>
      {({ state }) => {
        if (state.status === "loading") {
          return (
            <Flex
              gap="small"
              align="center"
              role="status"
              aria-busy
              data-testid="docs-breadcrumbs"
              data-stapel-load-state="loading"
            >
              {CRUMB_SKELETON_WIDTHS.map((width) => (
                <Skeleton.Input
                  key={width}
                  active
                  size="small"
                  style={{ width }}
                />
              ))}
            </Flex>
          );
        }
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
    </SkinTheme>
  );
}
