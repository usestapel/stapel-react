/**
 * The default skin's EDITORS — chrome-styled defaults for the builtin
 * `editor_hint`s, all riding the `DocEditor` bag (load `head_seq` → snapshot
 * PUT with `If-Match` → 409/412 as typed conflict state + override). The
 * shared `EditorChrome` carries what every editor surface owes the user:
 * save (also Ctrl/Cmd-S), the dirty marker, the saving state, the conflict
 * banner with the informed override, and the folded error line.
 *
 * Markdown is a SOURCE editor (a styled textarea on the same snapshot save
 * path): this package does not carry a Tiptap peer, and the zero-visual-
 * opinion canon says no new rendering dependency rides in a default — a host
 * that wants WYSIWYG registers its own component for the hint
 * (`registerDocEditor("markdown", …)`) or swaps the `"editor.markdown"` slot.
 * CSV is a table editor over the pair's own `parseCsv`/`serializeCsv`,
 * saving plain CSV text through the same discipline.
 *
 * Replaceable without a fork, twice over: per-hint via the editor registry
 * (explicit `registerDocEditor` wins in `DocSurface`), per-slot via
 * `registerDocsSkinComponent("editor.text" | "editor.markdown" | "editor.csv", …)`.
 */
import { useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { Alert, Button, Flex, Input, Skeleton, Tag, Typography } from "antd";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import type { DocEditorBag } from "../headless/DocEditor.js";
import type { DocEditorAdapterProps } from "../editors/registry.js";
import { parseCsv, serializeCsv } from "../editors/csv.js";
import { DOCS_I18N_KEYS } from "../i18n/keys.js";

/** The shared chrome every default editor renders inside. */
export function EditorChrome(props: {
  readonly bag: DocEditorBag;
  readonly children: ReactNode;
}): ReactElement {
  const t = useT();
  const { bag } = props;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      bag.save();
    }
  }

  return (
    <Flex
      vertical
      gap="small"
      data-testid="docs-editor-chrome"
      onKeyDown={onKeyDown}
      data-analytics="none"
      data-analytics-reason="keyboard save shortcut forwards to the same save action as the button — host app wraps with its own tracked()"
    >
      <Flex gap="small" align="center">
        <Button
          type="primary"
          size="small"
          loading={bag.isSaving}
          disabled={bag.isLoading || !bag.dirty}
          onClick={() => {
            bag.save();
          }}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {t(bag.isSaving ? DOCS_I18N_KEYS.editorSaving : DOCS_I18N_KEYS.editorSave)}
        </Button>
        {bag.dirty ? (
          <Tag data-testid="docs-editor-dirty">{t(DOCS_I18N_KEYS.editorDirty)}</Tag>
        ) : (
          !bag.isLoading && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: fontSize.xs.fontSize }}
            >
              {t(DOCS_I18N_KEYS.editorSaved)}
            </Typography.Text>
          )
        )}
      </Flex>

      {bag.conflict !== null && (
        <Alert
          type="warning"
          showIcon
          data-testid="docs-editor-conflict"
          message={t(DOCS_I18N_KEYS.editorConflict)}
          action={
            <Button
              size="small"
              onClick={() => {
                bag.overrideSave();
              }}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(DOCS_I18N_KEYS.editorOverride)}
            </Button>
          }
        />
      )}

      <ErrorAlert
        thrown={bag.error}
        onRetry={bag.reload}
        testId="docs-editor-error"
      />

      {bag.isLoading ? (
        <Skeleton active data-testid="docs-editor-loading" />
      ) : (
        props.children
      )}
    </Flex>
  );
}

/** Default skin for `editor_hint: "text"` — a styled textarea with the
 * chrome. */
export function DefaultTextEditor(props: DocEditorAdapterProps): ReactElement {
  return (
    <EditorChrome bag={props.bag}>
      <Input.TextArea
        data-doc-editor="text"
        autoSize={{ minRows: 10 }}
        value={props.bag.value}
        readOnly={props.readOnly ?? false}
        onChange={(event) => {
          props.bag.setValue(event.target.value);
        }}
      />
    </EditorChrome>
  );
}

/** Default skin for `editor_hint: "markdown"` — markdown SOURCE editing
 * (monospace textarea) with the chrome; no preview dependency by canon. */
export function DefaultMarkdownEditor(
  props: DocEditorAdapterProps
): ReactElement {
  return (
    <EditorChrome bag={props.bag}>
      <Input.TextArea
        data-doc-editor="markdown"
        autoSize={{ minRows: 10 }}
        style={{ fontFamily: "monospace" }}
        value={props.bag.value}
        readOnly={props.readOnly ?? false}
        onChange={(event) => {
          props.bag.setValue(event.target.value);
        }}
      />
    </EditorChrome>
  );
}

// ── csv ──────────────────────────────────────────────────────────────────────

interface CsvCell {
  readonly id: string;
  readonly value: string;
}

interface CsvRowModel {
  readonly id: string;
  readonly cells: readonly CsvCell[];
}

let nextModelId = 0;
function modelId(prefix: string): string {
  nextModelId += 1;
  return `${prefix}-${String(nextModelId)}`;
}

function toModel(rows: readonly (readonly string[])[]): CsvRowModel[] {
  return rows.map((cells) => ({
    id: modelId("row"),
    cells: cells.map((value) => ({ id: modelId("cell"), value })),
  }));
}

function toRows(model: readonly CsvRowModel[]): string[][] {
  return model.map((row) => row.cells.map((cell) => cell.value));
}

/**
 * Default skin for `editor_hint: "csv"` — the snapshot parsed into a
 * rows-of-cells model with per-cell inputs plus add-row / add-column /
 * delete-row, serialized back into the bag on every edit (the bag still
 * saves plain CSV text through the If-Match discipline). Same stable-id
 * model as the unstyled builtin (index keys are banned repo-wide).
 */
export function DefaultCsvEditor(props: DocEditorAdapterProps): ReactElement {
  const t = useT();
  const readOnly = props.readOnly ?? false;
  const [model, setModel] = useState<readonly CsvRowModel[]>([]);
  // Adopt external value changes (initial load, reload, override) without
  // clobbering in-flight edits: re-parse only when the bag's value is not
  // the one this editor last serialized (render-phase state adjustment).
  const [parsedFrom, setParsedFrom] = useState<string | null>(null);
  if (props.bag.value !== parsedFrom) {
    setParsedFrom(props.bag.value);
    if (serializeCsv(toRows(model)) !== props.bag.value) {
      setModel(toModel(parseCsv(props.bag.value)));
    }
  }

  function commit(next: readonly CsvRowModel[]): void {
    setModel(next);
    const serialized = serializeCsv(toRows(next));
    setParsedFrom(serialized);
    props.bag.setValue(serialized);
  }

  const columnCount = model.reduce(
    (widest, row) => Math.max(widest, row.cells.length),
    0
  );

  function addRow(): void {
    const width = Math.max(columnCount, 1);
    commit([
      ...model,
      {
        id: modelId("row"),
        cells: Array.from({ length: width }, () => ({
          id: modelId("cell"),
          value: "",
        })),
      },
    ]);
  }

  function addColumn(): void {
    if (model.length === 0) {
      addRow();
      return;
    }
    commit(
      model.map((row) => ({
        ...row,
        cells: [...row.cells, { id: modelId("cell"), value: "" }],
      }))
    );
  }

  function deleteRow(rowId: string): void {
    commit(model.filter((row) => row.id !== rowId));
  }

  function setCell(rowId: string, cellId: string, value: string): void {
    commit(
      model.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: row.cells.map((cell) =>
                cell.id === cellId ? { ...cell, value } : cell
              ),
            }
          : row
      )
    );
  }

  return (
    <EditorChrome bag={props.bag}>
      <Flex vertical gap="small">
        <table data-doc-editor="csv" style={{ borderCollapse: "collapse" }}>
          <tbody>
            {model.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell) => (
                  <td key={cell.id} style={{ padding: spacing[1] }}>
                    <Input
                      size="small"
                      value={cell.value}
                      readOnly={readOnly}
                      onChange={(event) => {
                        setCell(row.id, cell.id, event.target.value);
                      }}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td style={{ padding: spacing[1] }}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      onClick={() => {
                        deleteRow(row.id);
                      }}
                      data-analytics="none"
                      data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                    >
                      {t(DOCS_I18N_KEYS.editorDeleteRow)}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <Flex gap="small">
            <Button
              size="small"
              onClick={addRow}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(DOCS_I18N_KEYS.editorAddRow)}
            </Button>
            <Button
              size="small"
              onClick={addColumn}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {t(DOCS_I18N_KEYS.editorAddColumn)}
            </Button>
          </Flex>
        )}
      </Flex>
    </EditorChrome>
  );
}
