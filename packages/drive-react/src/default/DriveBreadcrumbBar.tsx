/**
 * `<DriveBreadcrumbBar/>` — the sticky path strip at the top of the drive.
 *
 * Sticky because the drive is one scrolling column: on a phone, a path that
 * scrolls away takes with it the only affordance for going back up, and the
 * platform back gesture does not know about folders. It stays, and it scrolls
 * HORIZONTALLY when the path is long — never wrapping into a second line that
 * pushes the list down and then springs back.
 *
 * While the trail is unknown the bar draws a skeleton, not the finished root
 * crumb: those two look identical and mean opposite things (the docs pair's
 * M-6 finding). A failed trail falls back to the root crumb alone, because the
 * listing under it already reports the failure loudly and a permanent skeleton
 * would claim something is still coming.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("breadcrumbBar", …)`.
 */
import type { ReactElement } from "react";
import { Breadcrumb, Flex, Skeleton, theme as antdTheme } from "antd";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { matchLoad, useT } from "@stapel/core";
import { DriveBreadcrumb } from "../headless/DriveBreadcrumb.js";
import type { DriveBreadcrumbNode } from "../api/types.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { CRUMB_SKELETON_WIDTHS } from "./measure.js";

export interface DriveBreadcrumbBarProps {
  readonly workspaceId: string;
  /** The folder being shown; `null` = the workspace root. */
  readonly folderId: string | null;
  /** The chain the navigation already holds — free, see `DriveBreadcrumb`. */
  readonly trail?: readonly DriveBreadcrumbNode[];
  onSelectFolder(folderId: string | null): void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function DriveBreadcrumbBar(
  props: DriveBreadcrumbBarProps
): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <DriveBreadcrumb
        workspaceId={props.workspaceId}
        folderId={props.folderId}
        {...(props.trail !== undefined ? { trail: props.trail } : {})}
      >
        {({ state }) => {
          if (state.status === "loading") {
            return (
              <Flex
                gap={spacing[2]}
                align="center"
                role="status"
                aria-busy
                data-testid="drive-breadcrumbs"
                data-stapel-load-state="loading"
              >
                {CRUMB_SKELETON_WIDTHS.map((width) => (
                  <Skeleton.Input key={width} active size="small" style={{ width }} />
                ))}
              </Flex>
            );
          }
          const trail = matchLoad(state, {
            loading: (): readonly DriveBreadcrumbNode[] => [],
            // The listing below says the read failed; a bar that invented a
            // path would be the only thing on screen claiming otherwise.
            failed: (): readonly DriveBreadcrumbNode[] => [],
            ready: (crumbs) => crumbs,
          });
          return (
            <nav
              aria-label={t(DRIVE_I18N_KEYS.breadcrumbLabel)}
              data-testid="drive-breadcrumbs"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                overflowX: "auto",
                whiteSpace: "nowrap",
                paddingBlock: spacing[2],
                background: token.colorBgContainer,
              }}
            >
              <Breadcrumb
                items={[
                  {
                    title: (
                      <a
                        onClick={(event) => {
                          event.preventDefault();
                          props.onSelectFolder(null);
                        }}
                        data-testid="drive-crumb-root"
                        data-analytics="none"
                        data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                      >
                        {t(DRIVE_I18N_KEYS.rootCrumb)}
                      </a>
                    ),
                  },
                  ...trail.map((node) => ({
                    title: (
                      <a
                        onClick={(event) => {
                          event.preventDefault();
                          props.onSelectFolder(node.id);
                        }}
                        data-testid={`drive-crumb-${node.id}`}
                        data-analytics="none"
                        data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                      >
                        {node.name}
                      </a>
                    ),
                  })),
                ]}
              />
            </nav>
          );
        }}
      </DriveBreadcrumb>
    </SkinTheme>
  );
}
