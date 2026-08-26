/**
 * Label resolution shared by every surface in the skin.
 *
 * The five column categories and the four fallback priority steps are FIXED
 * vocabularies, so they are resolved through explicit lookup tables rather than
 * a computed `t(\`tasks.category.${value}\`)`: a template key is invisible to
 * `stapel/i18n-key-exists`, which is exactly the check that would have caught a
 * category the backend adds and the pair has no copy for. A value outside the
 * table falls back to the machine value — honest, and never a raw key.
 */
import type { TranslateFn } from "@stapel/core";
import type { Column, Task } from "../api/types.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";

const CATEGORY_KEYS: Readonly<Record<string, string>> = {
  backlog: TASKS_I18N_KEYS.categoryBacklog,
  active: TASKS_I18N_KEYS.categoryActive,
  review: TASKS_I18N_KEYS.categoryReview,
  waiting: TASKS_I18N_KEYS.categoryWaiting,
  done: TASKS_I18N_KEYS.categoryDone,
};

/** The five fixed categories, as `<Select>` options in board order. */
export const CATEGORY_ORDER: readonly string[] = [
  "backlog",
  "active",
  "review",
  "waiting",
  "done",
];

export function categoryLabel(t: TranslateFn, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key === undefined ? category : t(key);
}

/**
 * A column's display name.
 *
 * A board created from a preset carries a `name_key` beside its `name`, and the
 * key is the translatable one: a Russian deployment should read the Russian
 * column name even though the column row stores "In progress", because that is
 * what the preset wrote at creation time. An unknown key renders the column's own `name`
 * instead of the key text — `t` returns the key when it has no copy, and a
 * board header showing `tasks.column.triage` would be worse than showing the
 * English the board was actually created with.
 */
export function columnLabel(t: TranslateFn, column: Column): string {
  if (column.name_key === "") return column.name;
  const translated = t(column.name_key);
  return translated === column.name_key ? column.name : translated;
}

/** The same, for a preset's column (no id yet, same two fields). */
export function presetColumnLabel(
  t: TranslateFn,
  column: { readonly name: string; readonly name_key?: string }
): string {
  const key = column.name_key;
  if (key === undefined || key === "") return column.name;
  const translated = t(key);
  return translated === key ? column.name : translated;
}

/**
 * A machine key from a display name: lowercase, non-alphanumerics collapsed to
 * one underscore, trimmed. `"In review!"` → `"in_review"`. Empty input yields
 * an empty string, which the create form treats as "not ready" rather than
 * inventing a key.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Cards a column holds, for the `N / limit` header. */
export function wipOf(
  cards: readonly Task[] | undefined,
  column: Column
): { readonly count: number; readonly limit: number | null; readonly over: boolean } {
  const count = cards === undefined ? 0 : cards.length;
  const limit = column.wip_limit ?? null;
  return { count, limit, over: limit !== null && count > limit };
}
