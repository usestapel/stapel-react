/**
 * One card on the board — the sortable leaf of the dnd-kit tree.
 *
 * ── The drag handle is a BUTTON, and that is the a11y decision ─────────────
 *
 * dnd-kit's listeners are attached to a real `<button>` rather than to the card
 * body, for two reasons that both come from real use: on a phone the card body
 * has to stay scrollable and tappable (a whole-card drag makes a column
 * unscrollable), and a keyboard user needs one focusable element that announces
 * itself — `aria-label` "Drag {title}" — from which space/arrows/space performs
 * the move. The card body's own click opens the sheet; the two never compete.
 *
 * Not exported from `./index.ts`: it is a part of `KanbanBoard`, not a surface
 * a host mounts on its own.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flex, Tag, Typography, theme } from "antd";
import { useFormat, useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import type { Task } from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { checklistProgress } from "../model/board.js";
import { idInitials, isOverdue } from "../model/format.js";
import { DragGlyph, LockGlyph } from "./icons.js";

export interface TaskCardProps {
  readonly card: Task;
  /** True when this card's last move came back `deferred`. */
  readonly pending: boolean;
  readonly onOpen: (taskId: string) => void;
  /** The host's name for an opaque user id (`createTasksRuntime`). */
  readonly userLabel: ((userId: string) => ReactNode) | null;
  /** `Date.now()` at render — a parameter so overdue styling is testable. */
  readonly now: number;
  readonly priorityLabel: string | null;
}

export function TaskCard(props: TaskCardProps): ReactElement {
  const t = useT();
  const format = useFormat();
  const { token } = theme.useToken();
  const { card } = props;
  const sortable = useSortable({ id: card.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition ?? undefined,
    opacity: sortable.isDragging ? 0.5 : 1,
    background: token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: radii.md,
    padding: spacing[3],
    display: "flex",
    flexDirection: "column",
    gap: spacing[2],
  };

  const progress = checklistProgress(card);
  const overdue = isOverdue(card.due_at, props.now);
  const blockedCount = (card.blocked_by_ids ?? []).length;
  const assignees = card.assignee_ids ?? [];

  return (
    <div ref={sortable.setNodeRef} style={style} data-testid={`tasks-card-${card.id}`}>
      <Flex align="flex-start" gap={spacing[2]}>
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          aria-label={t(TASKS_I18N_KEYS.cardDragHandle, { title: card.title })}
          style={{
            background: "transparent",
            border: "none",
            color: token.colorTextTertiary,
            cursor: "grab",
            padding: 0,
            lineHeight: 1,
          }}
          data-testid={`tasks-card-handle-${card.id}`}
          data-analytics="none"
          data-analytics-reason="the drag's OUTCOME is measured by tasks.task.moved; grabbing a handle is not a decision"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <DragGlyph />
        </button>
        <button
          type="button"
          onClick={() => {
            props.onOpen(card.id);
          }}
          aria-label={t(TASKS_I18N_KEYS.cardOpen, { title: card.title })}
          style={{
            background: "transparent",
            border: "none",
            color: token.colorText,
            cursor: "pointer",
            padding: 0,
            textAlign: "start",
            flex: "1 1 auto",
            font: "inherit",
          }}
          data-analytics="none"
          data-analytics-reason="opens the card sheet; every edit inside it emits its own event"
        >
          {card.title}
        </button>
      </Flex>

      <Flex gap={spacing[2]} wrap align="center">
        {props.priorityLabel !== null ? (
          <Tag color="default">{props.priorityLabel}</Tag>
        ) : null}
        {card.due_at != null && card.due_at !== "" ? (
          <Typography.Text type={overdue ? "danger" : "secondary"}>
            {overdue
              ? t(TASKS_I18N_KEYS.cardOverdue, {
                  date: format.date(card.due_at) ?? card.due_at,
                })
              : t(TASKS_I18N_KEYS.cardDue, {
                  date: format.date(card.due_at) ?? card.due_at,
                })}
          </Typography.Text>
        ) : null}
        {progress !== null ? (
          <Typography.Text type="secondary">
            {t(TASKS_I18N_KEYS.cardChecklist, {
              done: progress.done,
              total: progress.total,
            })}
          </Typography.Text>
        ) : null}
        {blockedCount > 0 ? (
          <Flex
            gap={spacing[1]}
            align="center"
            aria-label={t(TASKS_I18N_KEYS.cardBlocked, { count: blockedCount })}
          >
            <LockGlyph />
            <Typography.Text type="secondary">{blockedCount}</Typography.Text>
          </Flex>
        ) : null}
        {props.pending ? (
          <Tag color="warning" data-testid={`tasks-card-pending-${card.id}`}>
            {t(TASKS_I18N_KEYS.movePendingBadge)}
          </Tag>
        ) : null}
      </Flex>

      {assignees.length > 0 ? (
        <Flex gap={spacing[1]} wrap>
          {assignees.map((userId) => (
            <Tag key={userId}>
              {props.userLabel === null ? idInitials(userId) : props.userLabel(userId)}
            </Tag>
          ))}
        </Flex>
      ) : null}
    </div>
  );
}
