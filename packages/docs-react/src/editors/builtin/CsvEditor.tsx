import { useState } from "react";
import type { ReactElement } from "react";
import type { DocEditorAdapterProps } from "../registry.js";
import { parseCsv, serializeCsv } from "../csv.js";

/**
 * Builtin editor for `editor_hint: "csv"` — the text snapshot parsed into a
 * rows-of-cells model with per-cell editing, serialized back into the bag on
 * every edit (the bag still saves plain CSV text through the If-Match
 * discipline). Unstyled `<table>` + `<input>` DOM (zero visual opinion; hook
 * styling on `data-doc-editor="csv"` or replace via `registerDocEditor`).
 *
 * Rows/cells carry generated stable ids (the model, not the array index, is
 * the identity — index keys are banned repo-wide), so typing in a cell keeps
 * focus across re-renders.
 */

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

export function CsvEditor(props: DocEditorAdapterProps): ReactElement {
  const [model, setModel] = useState<readonly CsvRowModel[]>([]);
  // Adopt external value changes (initial load, reload, override) without
  // clobbering in-flight edits: re-parse only when the bag's value is not the
  // one this editor last serialized (render-phase state adjustment).
  const [parsedFrom, setParsedFrom] = useState<string | null>(null);
  if (props.bag.value !== parsedFrom) {
    setParsedFrom(props.bag.value);
    if (serializeCsv(toRows(model)) !== props.bag.value) {
      setModel(toModel(parseCsv(props.bag.value)));
    }
  }

  function setCell(rowId: string, cellId: string, value: string): void {
    const next = model.map((row) =>
      row.id === rowId
        ? {
            ...row,
            cells: row.cells.map((cell) =>
              cell.id === cellId ? { ...cell, value } : cell
            ),
          }
        : row
    );
    setModel(next);
    const serialized = serializeCsv(toRows(next));
    setParsedFrom(serialized); // our own emission — do not re-parse it back
    props.bag.setValue(serialized);
  }

  return (
    <table data-doc-editor="csv">
      <tbody>
        {model.map((row) => (
          <tr key={row.id}>
            {row.cells.map((cell) => (
              <td key={cell.id}>
                <input
                  value={cell.value}
                  readOnly={props.readOnly ?? false}
                  disabled={props.bag.isLoading}
                  onChange={(event) => {
                    setCell(row.id, cell.id, event.target.value);
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
