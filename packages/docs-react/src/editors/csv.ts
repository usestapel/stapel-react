/**
 * Hand-rolled CSV codec for the builtin `"csv"` editor — RFC-4180-shaped
 * (quoted fields, `""` escapes, embedded commas/newlines, CRLF tolerance),
 * zero dependencies by design (repo canon: no new deps for builtin editors).
 * Pure functions; the rows model the editor edits lives in `CsvEditor`.
 */

/** Parse CSV text into rows of cells. `""` → one empty row is NOT emitted —
 * an empty document is an empty grid. A trailing newline does not produce a
 * phantom empty row. */
export function parseCsv(text: string): string[][] {
  if (text.length === 0) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const push = (): void => {
    row.push(cell);
    cell = "";
  };
  const pushRow = (): void => {
    push();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell.length === 0) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      push();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // CRLF or bare CR — both end the row; skip the LF of a CRLF pair.
      pushRow();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Final cell/row unless the text ended exactly on a row terminator.
  const endedOnNewline = /(\r\n|\n|\r)$/.test(text);
  if (!endedOnNewline) pushRow();
  return rows;
}

function needsQuoting(value: string): boolean {
  return /[",\r\n]/.test(value);
}

/** Serialize rows back to CSV text (LF row terminator, no trailing newline —
 * a `parseCsv` round-trip is identity for the rows model). */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) =>
          needsQuoting(value) ? `"${value.replaceAll('"', '""')}"` : value
        )
        .join(",")
    )
    .join("\n");
}
