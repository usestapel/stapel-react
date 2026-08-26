/**
 * `<ColumnManager>` — reorder a board's columns, and add one.
 *
 * ── What this screen does NOT offer, and why it says so ───────────────────
 *
 * stapel-tasks has no column update and no column delete: `urls_v1.py` ships
 * `columns` (list/create) and `columns/reorder`, and nothing else. A manager
 * that drew a rename field and a bin icon would be drawing two controls that
 * cannot work, so it draws neither and puts one sentence where they would have
 * been. A missing capability that is EXPLAINED is a smaller defect than a dead
 * control, and it is the honest description of the API this pair is a face for.
 *
 * ── The duplicate key is a 409, and it names itself ───────────────────────
 *
 * Adding a column whose key the board already has used to be a **500** — a
 * server fault reported for ordinary typing. Backend 0.3.0 answers
 * `409 error.409.tasks_column_exists`, so this form renders the refusal's own
 * translated sentence plus the one thing the sentence cannot say: what to do
 * about it.
 */
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Flex, Input, InputNumber, Select, Typography, theme } from "antd";
import {
  actionAvailable,
  actionBlocked,
  errorCode,
  firstBlock,
  matchLoad,
  useT,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { Column, ColumnCreateBody } from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { DragGlyph } from "./icons.js";
import { CATEGORY_ORDER, categoryLabel, columnLabel, slugify } from "./labels.js";
import type { ThemeModeProp } from "./types.js";

const COLUMN_EXISTS = "error.409.tasks_column_exists";

export interface ColumnManagerProps extends ThemeModeProp {
  readonly columns: LoadState<readonly Column[]>;
  readonly onReorder: (keys: readonly string[]) => Promise<void>;
  readonly reordering?: boolean;
  readonly reorderError?: unknown;
  readonly addColumn: ActionAvailability;
  readonly onAddColumn: (body: ColumnCreateBody) => Promise<void>;
  readonly adding?: boolean;
  readonly addError?: unknown;
  readonly "data-testid"?: string;
}

export function ColumnManager(props: ColumnManagerProps): ReactElement {
  const t = useT();
  const [order, setOrder] = useState<readonly string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("backlog");
  const [wipLimit, setWipLimit] = useState<number | null>(null);

  const serverOrder = matchLoad(props.columns, {
    loading: () => [] as readonly Column[],
    failed: () => [] as readonly Column[],
    ready: (rows) => rows,
  });
  const serverKeys = serverOrder.map((column) => column.key).join("|");

  // The list is DRAGGABLE, so it needs local order — but the server is still
  // the authority: whenever the board answers with a different set of columns
  // the local order is replaced rather than merged, so a reorder that another
  // tab performed does not silently lose to a stale local array.
  useEffect(() => {
    setOrder(serverKeys === "" ? [] : serverKeys.split("|"));
  }, [serverKeys]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const over = event.over;
    if (over === null) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(event.active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0 || from === to) return prev;
      return arrayMove([...prev], from, to);
    });
  }, []);

  const dirty = order.join("|") !== serverKeys;
  const key = slugify(name);
  const addGate = firstBlock(
    props.addColumn,
    key === "" ? actionBlocked(TASKS_I18N_KEYS.gateNameRequired) : actionAvailable()
  );
  const saveGate = dirty
    ? actionAvailable()
    : actionBlocked(TASKS_I18N_KEYS.columnsReorderHint);

  const duplicate = errorCode(props.addError) === COLUMN_EXISTS;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[4]}
        data-testid={props["data-testid"] ?? "tasks-column-manager"}
      >
        <Typography.Text type="secondary">
          {t(TASKS_I18N_KEYS.columnsNoRename)}
        </Typography.Text>

        <ErrorAlert
          thrown={props.reorderError}
          testId="tasks-columns-reorder-error"
        />

        <LoadBoundary
          state={props.columns}
          skeletonRows={3}
          testId="tasks-columns"
        >
          {(columns) => (
            <Flex vertical gap={spacing[3]}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={[...order]}
                  strategy={verticalListSortingStrategy}
                >
                  <Flex vertical gap={spacing[2]}>
                    {order.map((columnKey) => {
                      const column = columns.find(
                        (row) => row.key === columnKey
                      );
                      if (column === undefined) return null;
                      return (
                        <ColumnRow key={columnKey} column={column} />
                      );
                    })}
                  </Flex>
                </SortableContext>
              </DndContext>

              <GatedButton
                gate={saveGate}
                type="primary"
                loading={props.reordering === true}
                onClick={() => {
                  void props.onReorder(order);
                }}
                testId="tasks-columns-save"
                data-analytics="none"
                data-analytics-reason="board shape maintenance; the funnel measures board_setup through its endpoints"
              >
                {t(TASKS_I18N_KEYS.columnsSaveOrder)}
              </GatedButton>
            </Flex>
          )}
        </LoadBoundary>

        <Flex vertical gap={spacing[2]}>
          <Typography.Text strong>
            {t(TASKS_I18N_KEYS.createAddColumn)}
          </Typography.Text>
          {duplicate ? (
            <ErrorAlert
              message={t(COLUMN_EXISTS)}
              detail={t(TASKS_I18N_KEYS.columnsExistsHint)}
              testId="tasks-columns-duplicate"
            />
          ) : (
            <ErrorAlert thrown={props.addError} testId="tasks-columns-add-error" />
          )}
          <Flex gap={spacing[2]} wrap>
            <Input
              value={name}
              placeholder={t(TASKS_I18N_KEYS.createColumnName)}
              aria-label={t(TASKS_I18N_KEYS.createColumnName)}
              onChange={(event) => {
                setName(event.target.value);
              }}
              style={{ flex: "1 1 12ch" }}
              data-testid="tasks-columns-add-name"
            />
            <Select
              value={category}
              aria-label={t(TASKS_I18N_KEYS.createCategory)}
              onChange={setCategory}
              options={CATEGORY_ORDER.map((value) => ({
                value,
                label: categoryLabel(t, value),
              }))}
              style={{ flex: "0 0 10ch" }}
            />
            <InputNumber
              value={wipLimit}
              min={1}
              placeholder={t(TASKS_I18N_KEYS.createWipLimit)}
              aria-label={t(TASKS_I18N_KEYS.createWipLimit)}
              onChange={(value) => {
                setWipLimit(typeof value === "number" ? value : null);
              }}
              style={{ flex: "0 0 8ch" }}
            />
            <GatedButton
              gate={addGate}
              loading={props.adding === true}
              onClick={() => {
                void props
                  .onAddColumn({
                    key,
                    name: name.trim(),
                    category,
                    ...(wipLimit !== null ? { wip_limit: wipLimit } : {}),
                  })
                  .then(
                    () => {
                      setName("");
                      setWipLimit(null);
                    },
                    () => {
                      // Rendered from `props.addError`; never an unhandled
                      // rejection.
                    }
                  );
              }}
              testId="tasks-columns-add"
              data-analytics="none"
              data-analytics-reason="board shape maintenance; the funnel measures board_setup through its endpoints"
            >
              {t(TASKS_I18N_KEYS.createAddColumn)}
            </GatedButton>
          </Flex>
          <Typography.Text type="secondary">
            {`${t(TASKS_I18N_KEYS.createColumnKey)}: ${key}`}
          </Typography.Text>
        </Flex>
      </Flex>
    </SkinTheme>
  );
}

function ColumnRow(props: { readonly column: Column }): ReactElement {
  const t = useT();
  const { token } = theme.useToken();
  const sortable = useSortable({ id: props.column.key });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition ?? undefined,
    background: token.colorBgContainer,
    color: token.colorText,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: radii.md,
    padding: spacing[2],
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
  };
  const label = columnLabel(t, props.column);
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-testid={`tasks-column-row-${props.column.key}`}
    >
      <Button
        type="text"
        size="small"
        ref={sortable.setActivatorNodeRef}
        aria-label={t(TASKS_I18N_KEYS.columnsDragHandle, { name: label })}
        data-analytics="none"
        data-analytics-reason="the reorder is saved by an explicit button; grabbing a handle is not a decision"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <DragGlyph />
      </Button>
      <Typography.Text>{label}</Typography.Text>
      <Typography.Text type="secondary">
        {categoryLabel(t, props.column.category)}
      </Typography.Text>
    </div>
  );
}
