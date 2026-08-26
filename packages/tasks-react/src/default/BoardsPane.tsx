/**
 * `<BoardsPane>` — the boards list, and the only tasks screen a person can
 * reach without already knowing an id.
 *
 * Four states, four different sentences (`LoadList` supplies the arms so they
 * cannot be collapsed into one): still asking, could not ask, asked and there
 * are genuinely none, and here they are. The empty arm carries the create
 * button, because "no boards yet" with nothing to do about it is a dead end.
 *
 * Archiving is a `SkinConfirm`, not a `Popconfirm`: exactly ONE confirm is
 * mounted for the whole list, keyed by the id awaiting an answer, so a
 * hundred-board list does not mount a hundred dialogs — and on a phone the
 * question arrives as a bottom sheet with block buttons rather than a popover
 * pinned to a control the thumb is covering.
 */
import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, List, Typography } from "antd";
import { useFormat, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { useBoards } from "../headless/useBoards.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { BoardCreateSheet } from "./BoardCreateSheet.js";
import type { ThemeModeProp } from "./types.js";

export interface BoardsPaneProps extends ThemeModeProp {
  /**
   * Open a board. The container's router owns navigation, so this pair takes
   * the intent and never a route: unfilled, the "Open board" control states
   * that this app wired no navigation instead of pretending to work.
   */
  readonly onOpenBoard?: (boardId: string) => void;
  readonly "data-testid"?: string;
}

export function BoardsPane(props: BoardsPaneProps): ReactElement {
  const t = useT();
  const format = useFormat();
  const bag = useBoards();
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const openGate =
    props.onOpenBoard === undefined
      ? actionBlocked(TASKS_I18N_KEYS.gateNoNavigation)
      : actionAvailable();

  const openBoard = useCallback(
    (boardId: string) => {
      props.onOpenBoard?.(boardId);
    },
    [props]
  );

  const createButton = (
    <GatedButton
      gate={bag.create}
      type="primary"
      onClick={() => {
        setCreating(true);
      }}
      testId="tasks-boards-create"
      data-analytics="none"
      data-analytics-reason="opens the create sheet; the created board is measured by tasks.board.created"
    >
      {t(TASKS_I18N_KEYS.boardsCreate)}
    </GatedButton>
  );

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[4]}
        style={{ padding: spacing[4] }}
        data-testid={props["data-testid"] ?? "tasks-boards"}
      >
        <Flex align="center" justify="space-between" gap={spacing[3]} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t(TASKS_I18N_KEYS.boardsTitle)}
          </Typography.Title>
          {createButton}
        </Flex>

        <ErrorAlert thrown={bag.archiveError} testId="tasks-boards-archive-error" />

        <LoadList
          state={bag.boards}
          onRetry={bag.refetch}
          testId="tasks-boards-list"
          empty={
            <EmptyState
              title={t(TASKS_I18N_KEYS.boardsEmpty)}
              hint={t(TASKS_I18N_KEYS.boardsEmptyHint)}
              action={createButton}
              testId="tasks-boards-empty"
            />
          }
        >
          {(boards) => (
            <List
              dataSource={[...boards]}
              renderItem={(board) => (
                // Not `List.Item`'s `actions` slot: that renders a
                // content-sized `<ul>` that neither wraps nor shrinks, so the
                // sentence beside a blocked "Open board" set the width of the
                // whole page — 625 CSS pixels on a 390 phone (visual pass
                // M-4). The row is a stack that owns its own width instead:
                // meta on top, controls under it, both bounded by the column.
                <List.Item key={board.id} style={{ display: "block" }}>
                  <Flex vertical gap={spacing[3]} style={{ minWidth: 0 }}>
                    <List.Item.Meta
                      title={board.name}
                      description={
                        <Flex gap={spacing[3]} wrap>
                          <Typography.Text type="secondary">
                            {t(TASKS_I18N_KEYS.boardsColumnCount, {
                              count: (board.columns ?? []).length,
                            })}
                          </Typography.Text>
                          {board.created_at != null && board.created_at !== "" ? (
                            <Typography.Text type="secondary">
                              {t(TASKS_I18N_KEYS.boardsCreated, {
                                date: format.date(board.created_at) ?? board.created_at,
                              })}
                            </Typography.Text>
                          ) : null}
                        </Flex>
                      }
                    />
                    <Flex gap={spacing[3]} wrap align="flex-start" style={{ minWidth: 0 }}>
                      <GatedButton
                        gate={openGate}
                        size="small"
                        type="primary"
                        onClick={() => {
                          openBoard(board.id);
                        }}
                        testId={`tasks-board-open-${board.id}`}
                        wrapperStyle={{ minWidth: 0, maxWidth: "100%" }}
                        data-analytics="none"
                        data-analytics-reason="navigation; the board screen reports its own events"
                      >
                        {t(TASKS_I18N_KEYS.boardsOpen)}
                      </GatedButton>
                      {/* Archiving is reversible and is not the row's headline
                          action, so it is a neutral control beside the primary
                          one rather than a red button of equal weight. */}
                      <Button
                        size="small"
                        onClick={() => {
                          setArchivingId(board.id);
                        }}
                        data-analytics="none"
                        data-analytics-reason="opens the archive confirm; the archive itself is a board-list refetch"
                      >
                        {t(TASKS_I18N_KEYS.boardsArchive)}
                      </Button>
                    </Flex>
                  </Flex>
                </List.Item>
              )}
            />
          )}
        </LoadList>
      </Flex>

      <SkinConfirm
        open={archivingId !== null}
        danger
        title={t(TASKS_I18N_KEYS.boardsArchiveQuestion)}
        body={t(TASKS_I18N_KEYS.boardsArchiveBody)}
        confirmLabel={t(TASKS_I18N_KEYS.boardsArchive)}
        confirming={bag.archiving}
        onConfirm={() => {
          const id = archivingId;
          if (id === null) return;
          void bag.archive(id).finally(() => {
            setArchivingId(null);
          });
        }}
        onCancel={() => {
          setArchivingId(null);
        }}
        data-testid="tasks-boards-archive-confirm"
      />

      <BoardCreateSheet
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        onCreate={async (body) => {
          const board = await bag.runCreate(body);
          setCreating(false);
          return board;
        }}
        creating={bag.creating}
        error={bag.createError}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      />
    </SkinTheme>
  );
}
