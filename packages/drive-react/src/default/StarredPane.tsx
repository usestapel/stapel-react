/**
 * `<StarredPane/>` — the Starred tab.
 *
 * The same row component the folder listing uses, over the `/starred` read:
 * one dataset shape, one row, so a starred file cannot look different from
 * the same file in its folder.
 *
 * The empty state says what a star is FOR ("star a file to keep it one tap
 * away") rather than "nothing here" — and it is reachable only from a read
 * that actually succeeded, because the four arms of `matchList` are what keep
 * an outage from wearing the costume of an empty list.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("starredPane", …)`.
 */
import type { ReactElement } from "react";
import { Flex, List } from "antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { Starred } from "../headless/Starred.js";
import type { DriveRow } from "../headless/rows.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { DriveListRow } from "./DriveRow.js";

export interface StarredPaneProps {
  readonly workspaceId: string;
  onOpen(row: DriveRow): void;
  onActions(row: DriveRow): void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function StarredPane(props: StarredPaneProps): ReactElement {
  const t = useT();
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Starred workspaceId={props.workspaceId}>
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="drive-starred-pane">
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId="drive-starred"
            >
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState
                    title={t(DRIVE_I18N_KEYS.starredEmpty)}
                    hint={t(DRIVE_I18N_KEYS.starredEmptyHint)}
                    testId="drive-starred-empty"
                  />
                ) : (
                  <List
                    dataSource={[...rows]}
                    rowKey={(row: DriveRow) => `${row.kind}:${row.id}`}
                    renderItem={(row: DriveRow) => (
                      <DriveListRow
                        key={`${row.kind}:${row.id}`}
                        row={row}
                        onOpen={props.onOpen}
                        onActions={props.onActions}
                        onToggleStar={bag.toggleStar}
                      />
                    )}
                  />
                )
              }
            </LoadBoundary>
          </Flex>
        )}
      </Starred>
    </SkinTheme>
  );
}
