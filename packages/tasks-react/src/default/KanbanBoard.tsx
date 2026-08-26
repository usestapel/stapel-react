/**
 * `<KanbanBoard>` — the board screen.
 *
 * ── Why dnd-kit, and what the three sensors buy ───────────────────────────
 *
 * A pointer-only board is an accessibility defect, not a missing nicety: a
 * keyboard user simply cannot move a card. dnd-kit ships a `KeyboardSensor`
 * with a sortable coordinate getter, so space-arrows-space performs the same
 * move the mouse does, announced from the handle's own `aria-label`. The
 * `TouchSensor` carries a 250 ms activation delay, which is what keeps a
 * column SCROLLABLE on a phone — without it every attempt to scroll picks a
 * card up. The `PointerSensor`'s 4 px distance does the same job for a mouse:
 * a click on a card opens it, a drag moves it, and the two never fight.
 *
 * ── The phone board is NOT the desktop board scaled down ──────────────────
 *
 * Five columns squeezed into 390 px is five unusable columns. Below the tablet
 * breakpoint this renders ONE column at a time with a switcher strip on top —
 * and the strip's buttons are themselves drop targets, so a card can be moved
 * to a column that is not on screen: drag it onto that column's chip. Each
 * chip therefore does two jobs (tap to switch, drop to move) and says so with
 * an `aria-label`.
 *
 * ── Optimistic, with four honest endings ──────────────────────────────────
 *
 * The card moves the moment it is dropped. `useBoard` then keeps or rolls back
 * that placement per outcome, and the status region below the filters says
 * which of the four happened — including `applied`, so a keyboard drag is
 * announced rather than being a silent success only sighted users can see.
 */
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Flex, Input, Tag, Typography, theme } from "antd";
import { matchLoad, useBreakpoint, useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { Column, Task } from "../api/types.js";
import { useBoard } from "../headless/useBoard.js";
import { useCreateTask } from "../headless/useCreateTask.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import type { BoardMap } from "../model/board.js";
import { useTasksRuntime } from "../model/context.js";
import { outcomeOf } from "../model/move.js";
import { ColumnManager } from "./ColumnManager.js";
import { FiltersBar } from "./FiltersBar.js";
import { Notice } from "./Notice.js";
import { TaskCard } from "./TaskCard.js";
import { TaskSheet } from "./TaskSheet.js";
import { columnLabel, categoryLabel, wipOf } from "./labels.js";
import { BOARD_MIN_HEIGHT, COLUMN_WIDTH } from "./types.js";
import type { ThemeModeProp } from "./types.js";

/** dnd-kit ids of the column drop zones, namespaced away from card UUIDs. */
const COLUMN_PREFIX = "column:";

function columnDroppableId(key: string): string {
  return `${COLUMN_PREFIX}${key}`;
}

export interface KanbanBoardProps extends ThemeModeProp {
  /**
   * The board to draw. The container's route element passes the matched
   * `:boardId`; absent, the screen says "no board selected" rather than
   * rendering an empty frame.
   */
  readonly boardId?: string;
  readonly "data-testid"?: string;
}

export function KanbanBoard(props: KanbanBoardProps): ReactElement {
  const t = useT();
  const runtime = useTasksRuntime();
  const breakpoint = useBreakpoint();
  const phone = breakpoint === "phone";
  const bag = useBoard(props.boardId);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [managingColumns, setManagingColumns] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const now = Date.now();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns = matchLoad(bag.columns, {
    loading: () => [] as readonly Column[],
    failed: () => [] as readonly Column[],
    ready: (rows) => rows,
  });
  const cards = matchLoad(bag.cards, {
    loading: () => null,
    failed: () => null,
    ready: (map) => map,
  });

  const currentColumn =
    activeColumn !== null && columns.some((column) => column.key === activeColumn)
      ? activeColumn
      : (columns[0]?.key ?? null);

  const priorityLabel = useCallback(
    (value: number | null | undefined): string | null => {
      if (value === null || value === undefined) return null;
      const step = runtime.priorityScale.find((row) => row.value === value);
      return step === undefined ? String(value) : t(step.labelKey);
    },
    [runtime.priorityScale, t]
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      bag.beginDrag(String(event.active.id));
    },
    [bag]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const over = event.over;
      if (over === null || cards === null) {
        bag.cancelDrag();
        return;
      }
      const taskId = String(event.active.id);
      const overId = String(over.id);
      const target = resolveTarget(cards, taskId, overId);
      if (target === null) {
        bag.cancelDrag();
        return;
      }
      void bag.move(taskId, target.column, target.index);
    },
    [bag, cards]
  );

  const outcome = outcomeOf(bag.moveState.step);
  const movedColumnName = useMemo(() => {
    const key = bag.moveState.toColumn;
    if (key === null) return "";
    const column = columns.find((row) => row.key === key);
    return column === undefined ? key : columnLabel(t, column);
  }, [bag.moveState.toColumn, columns, t]);

  if (props.boardId === undefined || props.boardId === "") {
    return (
      <SkinTheme
        surface="base"
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      >
        <EmptyState
          title={t(TASKS_I18N_KEYS.boardNoBoard)}
          hint={t(TASKS_I18N_KEYS.boardNoBoardHint)}
          testId="tasks-board-no-board"
        />
      </SkinTheme>
    );
  }

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[3]}
        style={{ padding: spacing[3] }}
        data-testid={props["data-testid"] ?? "tasks-board"}
      >
        <Flex align="center" justify="space-between" gap={spacing[3]} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {matchLoad(bag.board, {
              loading: () => t(TASKS_I18N_KEYS.boardsLoading),
              failed: () => t(TASKS_I18N_KEYS.boardsFailed),
              ready: (board) => board.name,
            })}
          </Typography.Title>
          <Button
            onClick={() => {
              setManagingColumns(true);
            }}
            data-analytics="none"
            data-analytics-reason="opens the column manager; its own writes are board reads, not funnel steps"
          >
            {t(TASKS_I18N_KEYS.boardManageColumns)}
          </Button>
        </Flex>

        <FiltersBar
          filters={bag.filters}
          onChange={bag.setFilters}
          onClear={bag.clearFilters}
          cards={cards}
          userLabel={runtime.userLabel}
        />

        {bag.truncated ? (
          <Notice tone="warning" testId="tasks-board-truncated">
            {t(TASKS_I18N_KEYS.boardTruncated, { count: bag.count })}
          </Notice>
        ) : null}

        <MoveStatus
          outcome={outcome}
          reasonKey={bag.moveState.reasonKey}
          error={bag.moveState.error}
          columnName={movedColumnName}
          onDismiss={bag.acknowledgeMove}
        />

        <LoadBoundary
          state={bag.cards}
          onRetry={bag.refetch}
          skeletonRows={4}
          testId="tasks-board-cards"
        >
          {(map) =>
            columns.length === 0 ? (
              <EmptyState
                title={t(TASKS_I18N_KEYS.boardEmpty)}
                testId="tasks-board-empty"
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragCancel={bag.cancelDrag}
              >
                {phone ? (
                  <Flex vertical gap={spacing[3]}>
                    <ColumnSwitcher
                      columns={columns}
                      cards={map}
                      current={currentColumn}
                      onPick={setActiveColumn}
                    />
                    {columns
                      .filter((column) => column.key === currentColumn)
                      .map((column) => (
                        <ColumnPanel
                          key={column.key}
                          column={column}
                          cards={map.get(column.key) ?? []}
                          boardId={props.boardId}
                          deferredIds={bag.deferredIds}
                          onOpenTask={setOpenTaskId}
                          userLabel={runtime.userLabel}
                          now={now}
                          priorityLabel={priorityLabel}
                          full
                        />
                      ))}
                  </Flex>
                ) : (
                  <Flex
                    gap={spacing[3]}
                    align="flex-start"
                    style={{ overflowX: "auto", minHeight: BOARD_MIN_HEIGHT }}
                  >
                    {columns.map((column) => (
                      <ColumnPanel
                        key={column.key}
                        column={column}
                        cards={map.get(column.key) ?? []}
                        boardId={props.boardId}
                        deferredIds={bag.deferredIds}
                        onOpenTask={setOpenTaskId}
                        userLabel={runtime.userLabel}
                        now={now}
                        priorityLabel={priorityLabel}
                        full={false}
                      />
                    ))}
                  </Flex>
                )}
              </DndContext>
            )
          }
        </LoadBoundary>
      </Flex>

      <TaskSheet
        open={openTaskId !== null}
        {...(openTaskId !== null ? { taskId: openTaskId } : {})}
        onClose={() => {
          setOpenTaskId(null);
        }}
        columns={columns}
        onColumnChange={(columnKey) => {
          const id = openTaskId;
          if (id === null) return;
          const size = (cards?.get(columnKey) ?? []).length;
          void bag.move(id, columnKey, size);
        }}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      />

      <SkinDialog
        open={managingColumns}
        onClose={() => {
          setManagingColumns(false);
        }}
        title={t(TASKS_I18N_KEYS.columnsTitle)}
        dismissLabel={t(TASKS_I18N_KEYS.dialogDismiss)}
        data-testid="tasks-board-columns-dialog"
      >
        <ColumnManager
          columns={bag.columns}
          onReorder={bag.reorderColumns}
          reordering={bag.reorderingColumns}
          reorderError={bag.reorderError}
          addColumn={bag.addColumn}
          onAddColumn={bag.runAddColumn}
          adding={bag.addingColumn}
          addError={bag.addColumnError}
        />
      </SkinDialog>
    </SkinTheme>
  );
}

/**
 * Where a drop landed. `overId` is either a column drop zone or another card;
 * dropping onto a card means "take that card's place", which is what makes an
 * insertion between two neighbours expressible at all.
 */
function resolveTarget(
  cards: BoardMap,
  taskId: string,
  overId: string
): { readonly column: string; readonly index: number } | null {
  if (overId.startsWith(COLUMN_PREFIX)) {
    const column = overId.slice(COLUMN_PREFIX.length);
    const group = cards.get(column);
    if (group === undefined) return null;
    return { column, index: group.filter((c) => c.id !== taskId).length };
  }
  for (const [column, group] of cards) {
    const index = group.findIndex((card) => card.id === overId);
    if (index >= 0) return { column, index };
  }
  return null;
}

/** The four endings of a move, as visible text rather than a toast. */
function MoveStatus(props: {
  readonly outcome: ReturnType<typeof outcomeOf>;
  readonly reasonKey: string | null;
  readonly error: unknown;
  readonly columnName: string;
  readonly onDismiss: () => void;
}): ReactElement | null {
  const t = useT();
  if (props.outcome === null) return null;
  if (props.outcome === "failed") {
    return (
      <ErrorAlert
        thrown={props.error}
        message={t(TASKS_I18N_KEYS.moveFailed)}
        onDismiss={props.onDismiss}
        dismissLabel={t(TASKS_I18N_KEYS.dialogDismiss)}
        testId="tasks-move-failed"
      />
    );
  }
  if (props.outcome === "denied") {
    return (
      <ErrorAlert
        message={
          props.reasonKey !== null && props.reasonKey !== ""
            ? t(props.reasonKey)
            : t(TASKS_I18N_KEYS.moveDenied)
        }
        onDismiss={props.onDismiss}
        dismissLabel={t(TASKS_I18N_KEYS.dialogDismiss)}
        testId="tasks-move-denied"
      />
    );
  }
  const message =
    props.outcome === "deferred"
      ? t(TASKS_I18N_KEYS.moveDeferred)
      : t(TASKS_I18N_KEYS.moveApplied, { column: props.columnName });
  return (
    <Notice
      tone={props.outcome === "deferred" ? "warning" : "success"}
      onDismiss={props.onDismiss}
      testId={`tasks-move-${props.outcome}`}
    >
      {message}
    </Notice>
  );
}

/** The phone's column strip: tap to switch, drop to move. */
function ColumnSwitcher(props: {
  readonly columns: readonly Column[];
  readonly cards: BoardMap;
  readonly current: string | null;
  readonly onPick: (key: string) => void;
}): ReactElement {
  const t = useT();
  return (
    <Flex
      gap={spacing[2]}
      style={{ overflowX: "auto" }}
      role="group"
      aria-label={t(TASKS_I18N_KEYS.boardColumnSwitcher)}
      data-testid="tasks-column-switcher"
    >
      {props.columns.map((column) => (
        <SwitcherChip
          key={column.key}
          column={column}
          count={(props.cards.get(column.key) ?? []).length}
          active={column.key === props.current}
          onPick={props.onPick}
        />
      ))}
    </Flex>
  );
}

function SwitcherChip(props: {
  readonly column: Column;
  readonly count: number;
  readonly active: boolean;
  readonly onPick: (key: string) => void;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  // The ACTIVE column's body is already registered under this id, so only the
  // other chips take drop targets — dnd-kit ids must be unique.
  const droppable = useDroppable({
    id: props.active ? `switcher:${props.column.key}` : columnDroppableId(props.column.key),
    disabled: props.active,
  });
  const label = columnLabel(t, props.column);
  const style: CSSProperties = {
    background: props.active ? token.colorPrimaryBg : token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${
      droppable.isOver ? token.colorPrimary : token.colorBorderSecondary
    }`,
    borderRadius: radii.full,
    padding: `${String(spacing[2])}px ${String(spacing[3])}px`,
    whiteSpace: "nowrap",
    cursor: "pointer",
  };
  return (
    <button
      type="button"
      ref={droppable.setNodeRef}
      style={style}
      aria-pressed={props.active}
      aria-label={`${label} (${String(props.count)})`}
      onClick={() => {
        props.onPick(props.column.key);
      }}
      data-testid={`tasks-switcher-${props.column.key}`}
      data-analytics="none"
      data-analytics-reason="switches which column is on screen; a move through this chip is measured by tasks.task.moved"
    >
      {`${label} (${String(props.count)})`}
    </button>
  );
}

function ColumnPanel(props: {
  readonly column: Column;
  readonly cards: readonly Task[];
  readonly boardId: string | undefined;
  readonly deferredIds: ReadonlySet<string>;
  readonly onOpenTask: (taskId: string) => void;
  readonly userLabel: ((userId: string) => ReactNode) | null;
  readonly now: number;
  readonly priorityLabel: (value: number | null | undefined) => string | null;
  readonly full: boolean;
}): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const droppable = useDroppable({ id: columnDroppableId(props.column.key) });
  const wip = wipOf(props.cards, props.column);
  const composer = useCreateTask(props.boardId, props.column.key);

  const style: CSSProperties = {
    flex: props.full ? "1 1 auto" : `0 0 ${COLUMN_WIDTH}`,
    width: props.full ? "100%" : COLUMN_WIDTH,
    background: droppable.isOver ? token.colorFillQuaternary : token.colorFillAlter,
    borderRadius: radii.lg,
    padding: spacing[2],
    display: "flex",
    flexDirection: "column",
    gap: spacing[2],
  };

  return (
    <div
      ref={droppable.setNodeRef}
      style={style}
      data-testid={`tasks-column-${props.column.key}`}
    >
      <Flex align="center" justify="space-between" gap={spacing[2]} wrap>
        <Typography.Text strong>{columnLabel(t, props.column)}</Typography.Text>
        <Flex gap={spacing[1]} align="center">
          <Tag>{categoryLabel(t, props.column.category)}</Tag>
          {wip.limit !== null ? (
            <Typography.Text
              type={wip.over ? "warning" : "secondary"}
              {...(wip.over
                ? {
                    "aria-label": t(TASKS_I18N_KEYS.boardWipExceeded, {
                      limit: wip.limit,
                    }),
                  }
                : {})}
              data-testid={`tasks-wip-${props.column.key}`}
            >
              {t(TASKS_I18N_KEYS.boardWip, {
                count: wip.count,
                limit: wip.limit,
              })}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">{wip.count}</Typography.Text>
          )}
        </Flex>
      </Flex>

      <SortableContext
        items={props.cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <Flex vertical gap={spacing[2]}>
          {props.cards.length === 0 ? (
            <Typography.Text type="secondary">
              {t(TASKS_I18N_KEYS.boardEmptyColumn)}
            </Typography.Text>
          ) : (
            props.cards.map((card) => (
              <TaskCard
                key={card.id}
                card={card}
                pending={props.deferredIds.has(card.id)}
                onOpen={props.onOpenTask}
                userLabel={props.userLabel}
                now={props.now}
                priorityLabel={props.priorityLabel(card.priority)}
              />
            ))
          )}
        </Flex>
      </SortableContext>

      <Flex gap={spacing[1]}>
        <Input
          size="small"
          value={composer.title}
          placeholder={t(TASKS_I18N_KEYS.boardAddCardPlaceholder)}
          aria-label={t(TASKS_I18N_KEYS.boardAddCard)}
          onChange={(event) => {
            composer.setTitle(event.target.value);
          }}
          onPressEnter={() => {
            void composer.run();
          }}
          data-testid={`tasks-add-card-${props.column.key}`}
        />
        <GatedButton
          gate={composer.submit}
          size="small"
          type="primary"
          loading={composer.creating}
          onClick={() => {
            void composer.run();
          }}
          testId={`tasks-add-card-submit-${props.column.key}`}
          data-analytics="none"
          data-analytics-reason="the created card is measured by tasks.task.created on success, not by the click"
        >
          {t(TASKS_I18N_KEYS.boardAddCardSubmit)}
        </GatedButton>
      </Flex>
      <ErrorAlert
        thrown={composer.error}
        variant="inline"
        testId={`tasks-add-card-error-${props.column.key}`}
      />
    </div>
  );
}
