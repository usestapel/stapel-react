/**
 * Board assembly — the pure half of the kanban screen.
 *
 * ── `position` is a decimal STRING and must stay one ────────────────────────
 *
 * The backend keeps a card's place in its column as a fractional
 * `DecimalField` and serializes it stringified (`task_to_dto`), precisely so a
 * drop between two neighbours needs no renumbering of the column. Parsing that
 * with `Number()` is the bug this file exists to prevent: after a few hundred
 * drops the midpoints are past IEEE-754's 17 significant digits and two
 * distinct positions compare EQUAL, which shows up as two cards that swap
 * places on every refetch. {@link scaledPosition} scales the decimal to a
 * BigInt instead, which is exact for any number of digits the server can send.
 *
 * ── The server already sorted; why sort again ──────────────────────────────
 *
 * `GET boards/{id}/cards` answers position-sorted (backend 0.3.0). This module
 * re-establishes that order anyway because the client MUTATES the map
 * optimistically on every drag: after {@link applyMove} the moved card sits at
 * an index the server has not confirmed, and the next merge of a refetch has to
 * be able to put a board back in a total order. The comparison is total —
 * `position`, then `created_at`, then `id` — so it can never return 0 for two
 * different cards and leave the sort unstable.
 */
import type { BoardCards, Column, Task } from "../api/types.js";

/** Cards by column key. Every column of the board has an entry, possibly empty. */
export type BoardMap = ReadonlyMap<string, readonly Task[]>;

/** How many fractional digits {@link scaledPosition} keeps. The backend's
 * `DecimalField` is `max_digits=30, decimal_places=15`; 18 is comfortably past
 * it and costs nothing in BigInt. */
const POSITION_SCALE = 18;

/**
 * A decimal string as an exact scaled BigInt (`"1.5"` → `1500000000000000000n`).
 *
 * Unreadable input sorts as 0 rather than throwing: a board is still a board
 * when one card carries something the server should never have sent, and a
 * screen that throws during a sort shows nothing at all.
 */
export function scaledPosition(value: string): bigint {
  const trimmed = value.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (match === null) return 0n;
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] === undefined || match[2] === "" ? "0" : match[2];
  const fractionRaw = match[3] ?? "";
  const fraction = fractionRaw
    .slice(0, POSITION_SCALE)
    .padEnd(POSITION_SCALE, "0");
  return sign * BigInt(`${whole}${fraction}`);
}

/** A total order over cards inside one column: position, then age, then id. */
export function compareCards(a: Task, b: Task): number {
  const pa = scaledPosition(a.position);
  const pb = scaledPosition(b.position);
  if (pa !== pb) return pa < pb ? -1 : 1;
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return ca < cb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Fold the board read into a {@link BoardMap}.
 *
 * Every column of `columns` gets a key even when the server sent no group for
 * it, so an empty column renders its own "nothing here" rather than vanishing
 * from the board. A group whose column is not on the board (a card left behind
 * by a column that was removed upstream) is dropped: it has nowhere to be
 * drawn and inventing a column for it would be a lie about the board's shape.
 */
export function assembleBoard(cards: BoardCards): BoardMap {
  const columns = cards.columns ?? [];
  const groups = cards.cards ?? {};
  const map = new Map<string, readonly Task[]>();
  for (const column of columns) {
    const group = groups[column.key];
    map.set(column.key, group === undefined ? [] : [...group].sort(compareCards));
  }
  return map;
}

/** The board's columns in display order (the server sends them ordered; this
 * makes the guarantee local so a re-sorted cache cannot break it). */
export function orderedColumns(cards: BoardCards): readonly Column[] {
  return [...(cards.columns ?? [])].sort((a, b) => a.order - b.order);
}

/** Total cards on the board — what the truncation banner counts. */
export function cardCount(map: BoardMap): number {
  let total = 0;
  for (const group of map.values()) total += group.length;
  return total;
}

/** The column a card currently sits in, or `null` when it is not on the board. */
export function columnOf(map: BoardMap, taskId: string): string | null {
  for (const [key, group] of map) {
    if (group.some((card) => card.id === taskId)) return key;
  }
  return null;
}

/** Find a card anywhere on the board. */
export function findCard(map: BoardMap, taskId: string): Task | null {
  for (const group of map.values()) {
    const found = group.find((card) => card.id === taskId);
    if (found !== undefined) return found;
  }
  return null;
}

/**
 * Move a card to `toColumn` at `index`, returning a NEW map. The card's
 * `column`/`category` are rewritten so the card renders as belonging where it
 * was dropped; its `position` is left alone, because only the server can mint
 * the fraction between its new neighbours — the optimistic order is carried by
 * the array, and the next refetch replaces it with the authoritative one.
 *
 * Returns the input map unchanged when the card or the target column is
 * unknown: an optimistic update that invents a column is worse than one that
 * does nothing and waits for the server's answer.
 */
export function applyMove(
  map: BoardMap,
  taskId: string,
  toColumn: string,
  index: number,
  category?: string
): BoardMap {
  if (!map.has(toColumn)) return map;
  const card = findCard(map, taskId);
  if (card === null) return map;
  const next = new Map<string, readonly Task[]>();
  for (const [key, group] of map) {
    next.set(
      key,
      group.filter((item) => item.id !== taskId)
    );
  }
  const target = [...(next.get(toColumn) ?? [])];
  const at = Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, {
    ...card,
    column: toColumn,
    ...(category !== undefined ? { category } : {}),
  });
  next.set(toColumn, target);
  return next;
}

/** Client-side title filter (the backend has no card search — MODULE.md). */
export function filterByText(map: BoardMap, text: string): BoardMap {
  const needle = text.trim().toLocaleLowerCase();
  if (needle === "") return map;
  const next = new Map<string, readonly Task[]>();
  for (const [key, group] of map) {
    next.set(
      key,
      group.filter((card) => card.title.toLocaleLowerCase().includes(needle))
    );
  }
  return next;
}

/** `x/y` for a card's checklist — `null` when the card carries no checklist,
 * so the skin renders nothing rather than a meaningless `0/0`. */
export function checklistProgress(
  task: Task
): { readonly done: number; readonly total: number } | null {
  const items = task.checklist ?? [];
  if (items.length === 0) return null;
  return {
    done: items.filter((item) => item.state === "done").length,
    total: items.length,
  };
}
