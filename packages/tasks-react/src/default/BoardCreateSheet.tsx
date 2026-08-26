/**
 * `<BoardCreateSheet>` — the board-creation form, as a bottom sheet on a phone
 * and a modal above 768px (`SkinDialog` owns that rule for the whole fleet).
 *
 * ── Presets are DISCOVERED, not guessed ───────────────────────────────────
 *
 * Until stapel-tasks 0.3.0 the only way to know a preset key was to read the
 * server's Python: the registry is one a host merges into at runtime, and a
 * client that hard-coded `"simple"` would break the moment a deployment added
 * its own. `GET boards/presets` now serves the list, so the `Shape` select is
 * the server's own vocabulary plus one option the server cannot have — "custom
 * columns", which switches the form to an explicit column list.
 *
 * ── The refusal this form actually has to render ──────────────────────────
 *
 * `error.503.tasks_scope_unresolved` is not a fault: it is the deployment
 * saying it cannot work out which workspace the board would belong to, and the
 * fix is for the person to pick a workspace. Rendering it through the generic
 * error dialect would show core's `stapel.http.503` sentence ("try again
 * later"), which is advice that cannot work. So this one code gets the pair's
 * own sentence; everything else is folded by `ErrorAlert thrown=`.
 */
import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Flex,
  Input,
  InputNumber,
  Select,
  Typography,
} from "antd";
import {
  actionAvailable,
  actionBlocked,
  errorCode,
  firstBlock,
  loadStateFromQuery,
  mapLoad,
  isLoadLoading,
  matchLoad,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { BoardCreateBody, BoardCreateColumnSpec } from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import { useVocabularyQuery } from "../model/queries.js";
import { CloseGlyph } from "./icons.js";
import { CATEGORY_ORDER, categoryLabel, slugify } from "./labels.js";
import { CREATE_SHEET_WIDTH } from "./types.js";
import type { ThemeModeProp } from "./types.js";

/** The `preset` select's stand-in for "I will list the columns myself". */
const CUSTOM = "__custom__";

export interface BoardCreateSheetProps extends ThemeModeProp {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Runs the create. Rejects with the server's error, which is rendered here. */
  readonly onCreate: (body: BoardCreateBody) => Promise<unknown>;
  readonly creating?: boolean;
  /** The last create failure, if there was one. */
  readonly error?: unknown;
  readonly "data-testid"?: string;
}

interface DraftColumn {
  readonly id: number;
  readonly name: string;
  readonly key: string;
  readonly category: string;
  readonly wipLimit: number | null;
}

let nextDraftId = 1;

function emptyColumn(): DraftColumn {
  nextDraftId += 1;
  return {
    id: nextDraftId,
    name: "",
    key: "",
    category: "backlog",
    wipLimit: null,
  };
}

export function BoardCreateSheet(props: BoardCreateSheetProps): ReactElement {
  const t = useT();
  const vocabulary = useVocabularyQuery();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<string>("simple");
  const [columns, setColumns] = useState<readonly DraftColumn[]>(() => [
    emptyColumn(),
  ]);

  // The served presets are a LOAD with three answers, and the Select says
  // which one it is: `loading` spins, `failed` shows the refusal above the
  // field, and only a successful read produces an empty list. Custom columns
  // are always offered — they need no server vocabulary at all, which is what
  // keeps this form usable when the vocabulary read is the thing that broke.
  const presetsState = mapLoad(
    loadStateFromQuery(vocabulary),
    (served) => served.presets ?? []
  );
  const presetOptions = useMemo(
    () => [
      ...matchLoad(presetsState, {
        loading: () => [],
        failed: () => [],
        ready: (served) =>
          served.map((entry) => ({ value: entry.key, label: entry.key })),
      }),
      { value: CUSTOM, label: t(TASKS_I18N_KEYS.createPresetCustom) },
    ],
    [presetsState, t]
  );

  const custom = preset === CUSTOM;
  const readyColumns = columns.filter(
    (column) => column.name.trim() !== "" && column.key !== ""
  );

  const submit = firstBlock(
    name.trim() === ""
      ? actionBlocked(TASKS_I18N_KEYS.gateNameRequired)
      : actionAvailable(),
    custom && readyColumns.length === 0
      ? actionBlocked(TASKS_I18N_KEYS.gateColumnsRequired)
      : actionAvailable()
  );

  const setColumnAt = useCallback(
    (id: number, patch: Partial<DraftColumn>) => {
      setColumns((prev) =>
        prev.map((column) =>
          column.id === id ? { ...column, ...patch } : column
        )
      );
    },
    []
  );

  const run = useCallback(() => {
    const specs: BoardCreateColumnSpec[] = readyColumns.map((column) => ({
      key: column.key,
      name: column.name.trim(),
      category: column.category,
      ...(column.wipLimit !== null ? { wip_limit: column.wipLimit } : {}),
    }));
    const body: BoardCreateBody = custom
      ? {
          name: name.trim(),
          // The emitted schema types `columns` as a list of open dicts (the
          // serializer is a ListField(DictField()) and drf-spectacular cannot
          // see inside it); `BoardCreateColumnSpec` is the shape the view
          // actually reads, so this widening is the documented correction.
          columns: specs as unknown as NonNullable<BoardCreateBody["columns"]>,
        }
      : { name: name.trim(), preset };
    void props.onCreate(body).then(
      () => {
        setName("");
        setColumns([emptyColumn()]);
      },
      () => {
        // The failure is already in `props.error` and rendered below; a
        // rejected promise here must not become an unhandled rejection.
      }
    );
  }, [custom, name, preset, props, readyColumns]);

  const scopeBlocked =
    errorCode(props.error) === "error.503.tasks_scope_unresolved";

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <SkinDialog
        open={props.open}
        onClose={props.onClose}
        title={t(TASKS_I18N_KEYS.createTitle)}
        dismissLabel={t(TASKS_I18N_KEYS.dialogDismiss)}
        width={CREATE_SHEET_WIDTH}
        data-testid={props["data-testid"] ?? "tasks-board-create"}
        footer={
          <GatedButton
            gate={submit}
            type="primary"
            loading={props.creating === true}
            onClick={run}
            testId="tasks-board-create-submit"
            data-analytics="none"
            data-analytics-reason="board creation is measured by tasks.board.created on success, not by the click"
          >
            {t(TASKS_I18N_KEYS.createSubmit)}
          </GatedButton>
        }
      >
        <Flex vertical gap={spacing[4]}>
          {scopeBlocked ? (
            <ErrorAlert
              message={t(TASKS_I18N_KEYS.scopeUnresolved)}
              testId="tasks-board-create-scope"
            />
          ) : (
            <ErrorAlert thrown={props.error} testId="tasks-board-create-error" />
          )}
          <ErrorAlert
            thrown={matchLoad(presetsState, {
              loading: () => undefined,
              failed: (error) => error,
              ready: () => undefined,
            })}
            variant="inline"
            testId="tasks-board-create-presets-error"
          />

          <label>
            <Typography.Text>{t(TASKS_I18N_KEYS.createName)}</Typography.Text>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder={t(TASKS_I18N_KEYS.createNamePlaceholder)}
              data-testid="tasks-board-create-name"
            />
          </label>

          <label>
            <Typography.Text>{t(TASKS_I18N_KEYS.createPreset)}</Typography.Text>
            <Select
              value={preset}
              onChange={setPreset}
              options={presetOptions}
              loading={isLoadLoading(presetsState)}
              style={{ width: "100%" }}
              data-testid="tasks-board-create-preset"
            />
          </label>

          {custom ? (
            <Flex vertical gap={spacing[3]}>
              <Typography.Text strong>
                {t(TASKS_I18N_KEYS.createColumns)}
              </Typography.Text>
              {columns.map((column) => (
                <Flex key={column.id} vertical gap={spacing[2]}>
                  <Flex gap={spacing[2]} wrap>
                    <Input
                      value={column.name}
                      placeholder={t(TASKS_I18N_KEYS.createColumnName)}
                      aria-label={t(TASKS_I18N_KEYS.createColumnName)}
                      onChange={(event) => {
                        const value = event.target.value;
                        setColumnAt(column.id, {
                          name: value,
                          key: slugify(value),
                        });
                      }}
                      style={{ flex: "1 1 12ch" }}
                    />
                    <Select
                      value={column.category}
                      aria-label={t(TASKS_I18N_KEYS.createCategory)}
                      onChange={(value: string) => {
                        setColumnAt(column.id, { category: value });
                      }}
                      options={CATEGORY_ORDER.map((value) => ({
                        value,
                        label: categoryLabel(t, value),
                      }))}
                      style={{ flex: "0 0 10ch" }}
                    />
                    <InputNumber
                      value={column.wipLimit}
                      min={1}
                      placeholder={t(TASKS_I18N_KEYS.createWipLimit)}
                      aria-label={t(TASKS_I18N_KEYS.createWipLimit)}
                      onChange={(value) => {
                        setColumnAt(column.id, {
                          wipLimit: typeof value === "number" ? value : null,
                        });
                      }}
                      style={{ flex: "0 0 8ch" }}
                    />
                    <Button
                      onClick={() => {
                        setColumns((prev) =>
                          prev.filter((row) => row.id !== column.id)
                        );
                      }}
                      aria-label={t(TASKS_I18N_KEYS.createRemoveColumn, {
                        name: column.name,
                      })}
                      data-analytics="none"
                      data-analytics-reason="edits an unsubmitted draft; the create event carries the final shape"
                    >
                      <CloseGlyph />
                    </Button>
                  </Flex>
                  <Typography.Text type="secondary">
                    {`${t(TASKS_I18N_KEYS.createColumnKey)}: ${column.key}`}
                  </Typography.Text>
                </Flex>
              ))}
              <Button
                onClick={() => {
                  setColumns((prev) => [...prev, emptyColumn()]);
                }}
                data-analytics="none"
                data-analytics-reason="edits an unsubmitted draft; the create event carries the final shape"
              >
                {t(TASKS_I18N_KEYS.createAddColumn)}
              </Button>
            </Flex>
          ) : null}
        </Flex>
      </SkinDialog>
    </SkinTheme>
  );
}
