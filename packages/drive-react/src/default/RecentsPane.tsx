/**
 * `<RecentsPane/>` — the Recent tab.
 *
 * Documents only, newest access first, in the server's order — the ordering IS
 * the meaning of this list, so nothing here re-sorts it. Folders are absent by
 * contract (the backend writes a recent on content read, download-URL issuance
 * and accepted save; a folder is not "opened" in that sense), which is why
 * this pane draws one list and not two.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("recentsPane", …)`.
 */
import type { ReactElement } from "react";
import { Flex, List } from "antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { Recents } from "../headless/Recents.js";
import type { DriveRow } from "../headless/rows.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { DriveListRow } from "./DriveRow.js";

export interface RecentsPaneProps {
  readonly workspaceId: string;
  onOpen(row: DriveRow): void;
  onActions(row: DriveRow): void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function RecentsPane(props: RecentsPaneProps): ReactElement {
  const t = useT();
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Recents workspaceId={props.workspaceId}>
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="drive-recents-pane">
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId="drive-recents"
            >
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState
                    title={t(DRIVE_I18N_KEYS.recentsEmpty)}
                    hint={t(DRIVE_I18N_KEYS.recentsEmptyHint)}
                    testId="drive-recents-empty"
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
      </Recents>
    </SkinTheme>
  );
}
