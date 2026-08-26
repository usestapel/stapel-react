/**
 * The fixed vocabularies of stapel-tasks.
 *
 * The backend serves all three from `GET boards/presets`
 * (`BoardVocabularyResponse`), and that is the source a form should prefer:
 * presets are an open merge registry a host adds to, and the priority scale is
 * deployment-configured. The constants below are the compile-time twin — the
 * two enums that are `models.TextChoices` on the server and therefore cannot
 * grow at runtime, so a `switch` over them is exhaustive and a column category
 * can be rendered before the vocabulary read lands.
 *
 * `column`/`category` still arrive as bare `string` on the wire (drf-spectacular
 * describes a `TextChoices` CharField as a plain string here), so the guards
 * are how a value crosses into the narrowed type — never a cast.
 */

/** A column's fixed machine semantic (`ColumnCategory` on the server). */
export const COLUMN_CATEGORIES = [
  "backlog",
  "active",
  "review",
  "waiting",
  "done",
] as const;

export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

/** A checklist step's state (`ChecklistState` on the server). */
export const CHECKLIST_STATES = ["pending", "done", "failed"] as const;

export type ChecklistState = (typeof CHECKLIST_STATES)[number];

/**
 * The three answers `POST tasks/{id}/move` can give. They are NOT three HTTP
 * statuses a client should read: the body carries the word, and the 409 arm
 * carries it in a `MoveResponse` rather than in the error envelope (see
 * `api/extensions.ts`).
 */
export const MOVE_RESULTS = ["applied", "deferred", "denied"] as const;

export type MoveResult = (typeof MOVE_RESULTS)[number];

export function isColumnCategory(value: string): value is ColumnCategory {
  return (COLUMN_CATEGORIES as readonly string[]).includes(value);
}

export function isChecklistState(value: string): value is ChecklistState {
  return (CHECKLIST_STATES as readonly string[]).includes(value);
}

export function isMoveResult(value: string): value is MoveResult {
  return (MOVE_RESULTS as readonly string[]).includes(value);
}
