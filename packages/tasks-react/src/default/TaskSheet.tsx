/**
 * `<TaskSheet>` — one card, opened over the board: a bottom sheet on a phone,
 * a 720px modal above the tablet breakpoint (`SkinDialog` owns that rule).
 *
 * ── Save on blur, per field ───────────────────────────────────────────────
 *
 * `PATCH tasks/{id}` takes only the keys it is given, so there is no form-wide
 * "Save" here and no draft to lose: each field commits when it loses focus and
 * `savingField` says which one is in flight. A failure is therefore
 * attributable — "the description did not save" rather than "something failed".
 *
 * ── Two things this sheet refuses to fake ─────────────────────────────────
 *
 * 1. **Assignees.** stapel-tasks stores opaque user ids and resolves none of
 *    them; there is no member search in the module. With no `userPicker` seam
 *    filled by the host, the sheet shows the ids it has (through `userLabel`,
 *    or as initials) and states why they cannot be changed here — instead of a
 *    "type a UUID" box nobody can use.
 * 2. **Custom fields.** `Board.feature_defs` are stapel-attributes FeatureDefs
 *    and their editors live in `@stapel/attributes-react`, an L2 pair this one
 *    does not import. `renderFeatures` is the slot; unfilled with defs present
 *    it renders a named `SlotPlaceholder` (loud in dev, nothing in prod) rather
 *    than a silent gap where the fields should be.
 */
import { useCallback, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Button,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  List,
  Select,
  Tag,
  Typography,
} from "antd";
import {
  SlotPlaceholder,
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchLoad,
  useFormat,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  GatedControl,
  LoadBoundary,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ChecklistState } from "../api/enums.js";
import type { ChecklistItem, Column, Task } from "../api/types.js";
import { useTask } from "../headless/useTask.js";
import type { TaskBag } from "../headless/useTask.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { useTasksRuntime } from "../model/context.js";
import { idInitials } from "../model/format.js";
import { MoreGlyph } from "./icons.js";
import { columnLabel } from "./labels.js";
import { SHEET_WIDTH } from "./types.js";
import type { ThemeModeProp } from "./types.js";

export interface TaskSheetProps extends ThemeModeProp {
  readonly open: boolean;
  readonly taskId?: string;
  readonly onClose: () => void;
  /** The board's columns, so the sheet can offer a move. */
  readonly columns?: readonly Column[];
  /** Runs the move. Without it the column select states why it cannot. */
  readonly onColumnChange?: (columnKey: string) => void;
  /** The board's `feature_defs`; a non-empty list opens the features slot. */
  readonly featureDefs?: readonly unknown[];
  /** The host's attributes editors — see the module note above. */
  readonly renderFeatures?: (args: {
    readonly features: Readonly<Record<string, unknown>>;
    readonly featureDefs: readonly unknown[];
    readonly disabled: boolean;
  }) => ReactNode;
  readonly "data-testid"?: string;
}

export function TaskSheet(props: TaskSheetProps): ReactElement {
  const t = useT();
  const bag = useTask(props.open ? props.taskId : undefined);
  const [archiving, setArchiving] = useState(false);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <SkinDialog
        open={props.open}
        onClose={props.onClose}
        // The card's own name, not the name of the field that holds it: the
        // header read "Title" over every card in the fleet (visual pass).
        title={matchLoad(bag.task, {
          loading: () => t(TASKS_I18N_KEYS.taskSheetTitle),
          failed: () => t(TASKS_I18N_KEYS.taskSheetTitle),
          ready: (row) =>
            row.title.trim() === "" ? t(TASKS_I18N_KEYS.taskSheetTitle) : row.title,
        })}
        dismissLabel={t(TASKS_I18N_KEYS.dialogDismiss)}
        width={SHEET_WIDTH}
        data-testid={props["data-testid"] ?? "tasks-task-sheet"}
      >
        <LoadBoundary
          state={bag.task}
          onRetry={bag.refetch}
          skeletonRows={5}
          testId="tasks-task"
        >
          {(task) => (
            <TaskBody
              task={task}
              bag={bag}
              archiving={archiving}
              onArchiving={setArchiving}
              onClose={props.onClose}
              {...(props.columns !== undefined ? { columns: props.columns } : {})}
              {...(props.onColumnChange !== undefined
                ? { onColumnChange: props.onColumnChange }
                : {})}
              {...(props.featureDefs !== undefined
                ? { featureDefs: props.featureDefs }
                : {})}
              {...(props.renderFeatures !== undefined
                ? { renderFeatures: props.renderFeatures }
                : {})}
            />
          )}
        </LoadBoundary>
      </SkinDialog>
    </SkinTheme>
  );
}

interface TaskBodyProps {
  readonly task: Task;
  readonly bag: TaskBag;
  readonly archiving: boolean;
  readonly onArchiving: (next: boolean) => void;
  readonly onClose: () => void;
  readonly columns?: readonly Column[];
  readonly onColumnChange?: (columnKey: string) => void;
  readonly featureDefs?: readonly unknown[];
  readonly renderFeatures?: TaskSheetProps["renderFeatures"];
}

function TaskBody(props: TaskBodyProps): ReactElement {
  const t = useT();
  const format = useFormat();
  const runtime = useTasksRuntime();
  const { bag, task } = props;
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState("");

  // A refetch (or a different card) replaces the drafts: an input that kept a
  // stale value after the server answered would show one thing and save
  // another.
  useEffect(() => {
    setTitle(task.title);
  }, [task.id, task.title]);
  useEffect(() => {
    setDescription(task.description);
  }, [task.id, task.description]);

  const canEdit = bag.canEdit;
  const columns = props.columns ?? [];
  const columnGate = firstBlock(
    canEdit,
    props.onColumnChange === undefined || columns.length === 0
      ? actionBlocked(TASKS_I18N_KEYS.gateNoColumnChange)
      : actionAvailable()
  );
  const assignGate = firstBlock(
    canEdit,
    runtime.userPicker === null
      ? actionBlocked(TASKS_I18N_KEYS.gateNoPicker)
      : actionAvailable()
  );
  const commentGate = firstBlock(
    canEdit,
    comment.trim() === ""
      ? actionBlocked(TASKS_I18N_KEYS.gateCommentEmpty)
      : actionAvailable()
  );
  const stepGate = firstBlock(
    canEdit,
    step.trim() === ""
      ? actionBlocked(TASKS_I18N_KEYS.gateTitleRequired)
      : actionAvailable()
  );

  const sendComment = useCallback(() => {
    if (comment.trim() === "") return;
    void bag.addComment(comment.trim()).then(
      () => {
        setComment("");
      },
      () => {
        // Rendered from `bag.commentError`.
      }
    );
  }, [bag, comment]);

  const assignees = task.assignee_ids ?? [];
  const features = (task.features ?? {}) as Readonly<Record<string, unknown>>;
  const featureDefs = props.featureDefs ?? [];

  return (
    <Flex vertical gap={spacing[4]} data-testid="tasks-task-body">
      {task.is_archived === true ? (
        <ErrorAlert
          message={t(TASKS_I18N_KEYS.taskArchived)}
          testId="tasks-task-archived"
        />
      ) : null}
      <ErrorAlert thrown={bag.updateError} testId="tasks-task-update-error" />

      <GatedControl gate={canEdit} testId="tasks-task-title-gate">
        {(bind) => (
          <Input
            {...bind}
            value={title}
            aria-label={t(TASKS_I18N_KEYS.taskTitle)}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            onBlur={() => {
              if (title.trim() !== "" && title !== task.title) {
                void bag.update({ title: title.trim() });
              }
            }}
            data-testid="tasks-task-title"
          />
        )}
      </GatedControl>

      <label>
        <Typography.Text>{t(TASKS_I18N_KEYS.taskDescription)}</Typography.Text>
        <GatedControl gate={canEdit} testId="tasks-task-description-gate">
          {(bind) => (
            <Input.TextArea
              {...bind}
              value={description}
              rows={3}
              placeholder={t(TASKS_I18N_KEYS.taskDescriptionPlaceholder)}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              onBlur={() => {
                if (description !== task.description) {
                  void bag.update({ description });
                }
              }}
              data-testid="tasks-task-description"
            />
          )}
        </GatedControl>
      </label>

      {/* The board's own fields are part of the CARD's content, so they sit
          with the title and the description — above the workflow controls the
          board applies to it. Below the assignees they were the last thing in
          a sheet that scrolls, which on a phone is a section nobody scrolled
          to (visual pass M-6: the variant documenting them photographed the
          same frame as the one without them). */}
      {featureDefs.length > 0 ? (
        <Flex vertical gap={spacing[2]}>
          <Typography.Text strong>
            {t(TASKS_I18N_KEYS.taskFeatures)}
          </Typography.Text>
          {props.renderFeatures?.({
            features,
            featureDefs,
            disabled: !canEdit.available,
          }) ?? <SlotPlaceholder name="renderFeatures" />}
        </Flex>
      ) : null}

      <Flex gap={spacing[3]} wrap>
        <label style={{ flex: "1 1 12ch" }}>
          <Typography.Text>{t(TASKS_I18N_KEYS.taskColumn)}</Typography.Text>
          <GatedControl gate={columnGate} testId="tasks-task-column-gate">
            {(bind) => (
              <Select
                {...bind}
                value={task.column}
                style={{ width: "100%" }}
                onChange={(value: string) => {
                  props.onColumnChange?.(value);
                }}
                options={columns.map((column) => ({
                  value: column.key,
                  label: columnLabel(t, column),
                }))}
                data-testid="tasks-task-column"
              />
            )}
          </GatedControl>
        </label>

        <label style={{ flex: "1 1 10ch" }}>
          <Typography.Text>{t(TASKS_I18N_KEYS.taskPriority)}</Typography.Text>
          <GatedControl gate={canEdit} testId="tasks-task-priority-gate">
            {(bind) => (
              <Select
                {...bind}
                allowClear
                value={task.priority ?? undefined}
                placeholder={t(TASKS_I18N_KEYS.taskPriorityNone)}
                style={{ width: "100%" }}
                onChange={(value: number | undefined) => {
                  void bag.update({ priority: value ?? null });
                }}
                options={runtime.priorityScale.map((row) => ({
                  value: row.value,
                  label: t(row.labelKey),
                }))}
                data-testid="tasks-task-priority"
              />
            )}
          </GatedControl>
        </label>

        <label style={{ flex: "1 1 12ch" }}>
          <Typography.Text>{t(TASKS_I18N_KEYS.taskDue)}</Typography.Text>
          <GatedControl gate={canEdit} testId="tasks-task-due-gate">
            {(bind) => (
              <Input
                {...bind}
                type="date"
                value={(task.due_at ?? "").slice(0, 10)}
                onChange={(event) => {
                  const value = event.target.value;
                  void bag.update({
                    due_at: value === "" ? null : `${value}T00:00:00Z`,
                  });
                }}
                data-testid="tasks-task-due"
              />
            )}
          </GatedControl>
        </label>
      </Flex>

      <Flex vertical gap={spacing[2]}>
        <Typography.Text strong>
          {t(TASKS_I18N_KEYS.taskAssignees)}
        </Typography.Text>
        {runtime.userPicker !== null ? (
          <GatedControl gate={assignGate} testId="tasks-task-assignees-gate">
            {(bind) =>
              runtime.userPicker?.render({
                value: assignees,
                onChange: (next) => {
                  void bag.assign(next);
                },
                // A host slot renders its own control, out of reach of the
                // gate's suppression — so this one stays a plain verdict.
                disabled: bind["aria-disabled"] === true || bind.disabled,
              })
            }
          </GatedControl>
        ) : (
          <Flex vertical gap={spacing[1]}>
            <Flex gap={spacing[1]} wrap>
              {assignees.length === 0 ? (
                <Typography.Text type="secondary">
                  {t(TASKS_I18N_KEYS.taskAssigneesEmpty)}
                </Typography.Text>
              ) : (
                assignees.map((userId) => (
                  <Tag key={userId}>
                    {runtime.userLabel === null
                      ? idInitials(userId)
                      : runtime.userLabel(userId)}
                  </Tag>
                ))
              )}
            </Flex>
            <Typography.Text type="secondary" data-testid="tasks-task-no-picker">
              {t(TASKS_I18N_KEYS.taskAssigneesReadOnly)}
            </Typography.Text>
          </Flex>
        )}
        <ErrorAlert
          thrown={bag.assignError}
          variant="inline"
          testId="tasks-task-assign-error"
        />
      </Flex>

      <ChecklistSection
        bag={bag}
        step={step}
        onStep={setStep}
        gate={stepGate}
        editGate={canEdit}
      />

      <CommentsSection
        bag={bag}
        comment={comment}
        onComment={setComment}
        gate={commentGate}
        editGate={canEdit}
        onSend={sendComment}
      />

      <Flex vertical gap={spacing[1]}>
        {task.created_at != null && task.created_at !== "" ? (
          <Typography.Text type="secondary">
            {t(TASKS_I18N_KEYS.taskCreated, {
              date: format.dateTime(task.created_at) ?? task.created_at,
            })}
          </Typography.Text>
        ) : null}
        {task.completed_at != null && task.completed_at !== "" ? (
          <Typography.Text type="secondary">
            {t(TASKS_I18N_KEYS.taskCompleted, {
              date: format.dateTime(task.completed_at) ?? task.completed_at,
            })}
          </Typography.Text>
        ) : null}
      </Flex>

      <Flex justify="flex-end">
        <GatedButton
          gate={canEdit}
          danger
          onClick={() => {
            props.onArchiving(true);
          }}
          testId="tasks-task-archive"
          data-analytics="none"
          data-analytics-reason="opens the archive confirm; the archive itself is a board refetch"
        >
          {t(TASKS_I18N_KEYS.taskArchive)}
        </GatedButton>
      </Flex>

      <SkinConfirm
        open={props.archiving}
        danger
        title={t(TASKS_I18N_KEYS.taskArchiveQuestion)}
        confirmLabel={t(TASKS_I18N_KEYS.taskArchive)}
        confirming={bag.archiving}
        onConfirm={() => {
          void bag.archive().finally(() => {
            props.onArchiving(false);
            props.onClose();
          });
        }}
        onCancel={() => {
          props.onArchiving(false);
        }}
        data-testid="tasks-task-archive-confirm"
      />
    </Flex>
  );
}

function ChecklistSection(props: {
  readonly bag: TaskBag;
  readonly step: string;
  readonly onStep: (next: string) => void;
  readonly gate: ReturnType<typeof firstBlock>;
  readonly editGate: ReturnType<typeof firstBlock>;
}): ReactElement {
  const t = useT();
  const { bag } = props;
  return (
    <Flex vertical gap={spacing[2]}>
      <Typography.Text strong>{t(TASKS_I18N_KEYS.taskChecklist)}</Typography.Text>
      <ErrorAlert
        thrown={bag.checklistError}
        variant="inline"
        testId="tasks-checklist-error"
      />
      <LoadList
        state={bag.checklist}
        testId="tasks-checklist"
        empty={
          <EmptyState
            compact
            title={t(TASKS_I18N_KEYS.checklistEmpty)}
            testId="tasks-checklist-empty"
          />
        }
      >
        {(items) => (
          <Flex vertical gap={spacing[1]}>
            {items.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                disabled={!props.editGate.available}
                onState={(state) => {
                  void bag.setItemState(item.id, state);
                }}
              />
            ))}
          </Flex>
        )}
      </LoadList>
      <Flex gap={spacing[1]}>
        <Input
          size="small"
          value={props.step}
          placeholder={t(TASKS_I18N_KEYS.checklistPlaceholder)}
          aria-label={t(TASKS_I18N_KEYS.checklistAdd)}
          onChange={(event) => {
            props.onStep(event.target.value);
          }}
          onPressEnter={() => {
            if (props.step.trim() === "") return;
            void bag.addItem(props.step.trim());
            props.onStep("");
          }}
          data-testid="tasks-checklist-input"
        />
        <GatedButton
          gate={props.gate}
          size="small"
          loading={bag.addingItem}
          onClick={() => {
            void bag.addItem(props.step.trim());
            props.onStep("");
          }}
          testId="tasks-checklist-add"
          data-analytics="none"
          data-analytics-reason="the state change is measured by tasks.checklist.stateChanged; adding a step is not a funnel event"
        >
          {t(TASKS_I18N_KEYS.checklistAdd)}
        </GatedButton>
      </Flex>
    </Flex>
  );
}

function ChecklistRow(props: {
  readonly item: ChecklistItem;
  readonly disabled: boolean;
  readonly onState: (state: ChecklistState) => void;
}): ReactElement {
  const t = useT();
  const { item } = props;
  const failed = item.state === "failed";
  return (
    <Flex align="center" gap={spacing[2]} data-testid={`tasks-step-${item.id}`}>
      <Checkbox
        checked={item.state === "done"}
        disabled={props.disabled}
        aria-label={
          item.state === "done"
            ? t(TASKS_I18N_KEYS.checklistMarkPending, { text: item.text })
            : t(TASKS_I18N_KEYS.checklistMarkDone, { text: item.text })
        }
        onChange={(event) => {
          props.onState(event.target.checked ? "done" : "pending");
        }}
        data-testid={`tasks-step-check-${item.id}`}
      />
      <Typography.Text delete={item.state === "done"}>
        {item.text}
      </Typography.Text>
      {failed ? (
        <Tag color="error">{t(TASKS_I18N_KEYS.checklistStateFailed)}</Tag>
      ) : null}
      <Dropdown
        trigger={["click"]}
        disabled={props.disabled}
        menu={{
          items: [
            {
              key: "failed",
              label: t(TASKS_I18N_KEYS.checklistMarkFailed, { text: item.text }),
            },
            {
              key: "pending",
              label: t(TASKS_I18N_KEYS.checklistMarkPending, { text: item.text }),
            },
            {
              key: "done",
              label: t(TASKS_I18N_KEYS.checklistMarkDone, { text: item.text }),
            },
          ],
          onClick: (info) => {
            props.onState(info.key as ChecklistState);
          },
        }}
      >
        <Button
          type="text"
          size="small"
          aria-label={t(TASKS_I18N_KEYS.checklistMore, { text: item.text })}
          data-testid={`tasks-step-more-${item.id}`}
          data-analytics="none"
          data-analytics-reason="opens the state menu; the state change itself emits tasks.checklist.stateChanged"
        >
          <MoreGlyph />
        </Button>
      </Dropdown>
    </Flex>
  );
}

function CommentsSection(props: {
  readonly bag: TaskBag;
  readonly comment: string;
  readonly onComment: (next: string) => void;
  readonly gate: ReturnType<typeof firstBlock>;
  readonly editGate: ReturnType<typeof firstBlock>;
  readonly onSend: () => void;
}): ReactElement {
  const t = useT();
  const format = useFormat();
  const runtime = useTasksRuntime();
  const { bag } = props;
  return (
    <Flex vertical gap={spacing[2]}>
      <Typography.Text strong>{t(TASKS_I18N_KEYS.taskComments)}</Typography.Text>
      <ErrorAlert
        thrown={bag.commentError}
        variant="inline"
        testId="tasks-comment-error"
      />
      <LoadList
        state={bag.comments}
        testId="tasks-comments"
        empty={
          <EmptyState
            compact
            title={t(TASKS_I18N_KEYS.commentEmpty)}
            testId="tasks-comments-empty"
          />
        }
      >
        {(rows) => (
          <List
            size="small"
            dataSource={[...rows]}
            renderItem={(row) => (
              <List.Item key={row.id}>
                <List.Item.Meta
                  title={
                    row.author_id === null
                      ? t(TASKS_I18N_KEYS.taskAssigneesEmpty)
                      : runtime.userLabel === null
                        ? idInitials(row.author_id)
                        : runtime.userLabel(row.author_id)
                  }
                  description={row.body}
                />
                <Typography.Text type="secondary">
                  {format.dateTime(row.created_at) ?? row.created_at}
                </Typography.Text>
              </List.Item>
            )}
          />
        )}
      </LoadList>
      <GatedControl gate={props.editGate} testId="tasks-comment-gate">
        {(bind) => (
          <Input.TextArea
            {...bind}
            value={props.comment}
            rows={2}
            placeholder={t(TASKS_I18N_KEYS.commentPlaceholder)}
            aria-label={t(TASKS_I18N_KEYS.commentPlaceholder)}
            onChange={(event) => {
              props.onComment(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                props.onSend();
              }
            }}
            data-testid="tasks-comment-input"
            data-analytics="none"
            data-analytics-reason="Enter is a shortcut for the send button; the posted comment is measured by tasks.comment.added"
          />
        )}
      </GatedControl>
      <Flex align="center" justify="space-between" gap={spacing[2]} wrap>
        <Typography.Text type="secondary">
          {t(TASKS_I18N_KEYS.commentHint)}
        </Typography.Text>
        <GatedButton
          gate={props.gate}
          type="primary"
          size="small"
          loading={bag.addingComment}
          onClick={props.onSend}
          testId="tasks-comment-send"
          data-analytics="none"
          data-analytics-reason="the posted comment is measured by tasks.comment.added on success, not by the click"
        >
          {t(TASKS_I18N_KEYS.commentSend)}
        </GatedButton>
      </Flex>
    </Flex>
  );
}
