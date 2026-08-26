/**
 * Canned wire payloads for the demos.
 *
 * They are BOARD-SHAPED, not screenshot-shaped: `cards` is the exact
 * `BoardCardsResponse` stapel-tasks 0.3.0 answers (columns in order, cards
 * grouped by column key, `truncated`), so a demo exercises the same assembly
 * the product does rather than a hand-arranged picture of it. That is also what
 * makes the truncated variant honest — it sets the server's own flag instead of
 * drawing a banner.
 */
import type {
  Board,
  BoardCards,
  BoardVocabulary,
  ChecklistItem,
  Column,
  Comment,
  Task,
} from "../src/index.js";

const BOARD_ID = "5f5f1a4e-0000-4000-8000-000000000001";
const ALICE = "11111111-2222-4333-8444-555555555555";
const BOB = "66666666-7777-4888-8999-000000000000";

export const DEMO_BOARD_ID = BOARD_ID;
export const DEMO_TASK_ID = "aaaa1111-0000-4000-8000-000000000010";

export const columns: readonly Column[] = [
  {
    id: "c1",
    board_id: BOARD_ID,
    key: "todo",
    name: "To do",
    name_key: "tasks.column.todo",
    order: 0,
    category: "backlog",
    wip_limit: null,
  },
  {
    id: "c2",
    board_id: BOARD_ID,
    key: "in_progress",
    name: "In progress",
    name_key: "tasks.column.in_progress",
    order: 1,
    category: "active",
    wip_limit: 2,
  },
  {
    id: "c3",
    board_id: BOARD_ID,
    key: "done",
    name: "Done",
    name_key: "tasks.column.done",
    order: 2,
    category: "done",
    wip_limit: null,
  },
];

function card(over: Partial<Task> & Pick<Task, "id" | "column" | "title">): Task {
  return {
    board_id: BOARD_ID,
    category: "backlog",
    position: "1",
    description: "",
    creator_id: ALICE,
    assignee_ids: [],
    priority: null,
    due_at: null,
    parent_id: null,
    blocked_by_ids: [],
    features: {},
    origin_type: "local",
    origin_ref: null,
    origin_meta: {},
    completed_at: null,
    is_archived: false,
    checklist: [],
    created_at: "2026-08-10T09:00:00Z",
    ...over,
  };
}

export const checklist: readonly ChecklistItem[] = [
  { id: "s1", text: "Collect the numbers", state: "done", order: 0 },
  { id: "s2", text: "Write the summary", state: "pending", order: 1 },
  { id: "s3", text: "Ask legal", state: "failed", order: 2 },
];

export const comments: readonly Comment[] = [
  {
    id: "m1",
    task_id: DEMO_TASK_ID,
    author_id: BOB,
    body: "The numbers from July are in the shared sheet.",
    created_at: "2026-08-12T11:20:00Z",
  },
  {
    id: "m2",
    task_id: DEMO_TASK_ID,
    author_id: null,
    body: "Moved the deadline a week — the review slot changed.",
    created_at: "2026-08-13T08:05:00Z",
  },
];

export const task: Task = card({
  id: DEMO_TASK_ID,
  column: "in_progress",
  category: "active",
  title: "Draft the launch post",
  description: "Two paragraphs, one screenshot, link to the changelog.",
  priority: 3,
  due_at: "2026-09-02T00:00:00Z",
  assignee_ids: [ALICE, BOB],
  position: "2.5",
  checklist: [...checklist],
});

export const archivedTask: Task = { ...task, is_archived: true };

export const cards: BoardCards = {
  board_id: BOARD_ID,
  columns: [...columns],
  cards: {
    todo: [
      card({
        id: "t1",
        column: "todo",
        title: "Rewrite the onboarding email",
        position: "1",
        priority: 2,
        due_at: "2026-08-01T00:00:00Z",
      }),
      card({
        id: "t2",
        column: "todo",
        title: "Audit the pricing page copy",
        position: "2",
        blocked_by_ids: ["t1"],
      }),
    ],
    in_progress: [
      task,
      card({
        id: "t3",
        column: "in_progress",
        category: "active",
        title: "Ship the board endpoint",
        position: "3",
        priority: 4,
        assignee_ids: [BOB],
      }),
      card({
        id: "t4",
        column: "in_progress",
        category: "active",
        title: "Translate the refusal copy",
        position: "4",
      }),
    ],
    done: [
      card({
        id: "t5",
        column: "done",
        category: "done",
        title: "Pick a drag-and-drop library",
        position: "1",
        completed_at: "2026-08-09T16:40:00Z",
      }),
    ],
  },
  count: 6,
  truncated: false,
};

export const emptyCards: BoardCards = {
  board_id: BOARD_ID,
  columns: [...columns],
  cards: { todo: [], in_progress: [], done: [] },
  count: 0,
  truncated: false,
};

export const truncatedCards: BoardCards = { ...cards, truncated: true };

export const board: Board = {
  id: BOARD_ID,
  workspace_id: "ws-1",
  name: "Launch",
  slug: "launch",
  feature_defs: [],
  settings: {},
  columns: [...columns],
  is_archived: false,
  created_at: "2026-07-30T10:00:00Z",
};

export const boards: readonly Board[] = [
  board,
  {
    ...board,
    id: "5f5f1a4e-0000-4000-8000-000000000002",
    name: "Support rotation",
    slug: "support-rotation",
    created_at: "2026-06-11T08:30:00Z",
  },
];

export const vocabulary: BoardVocabulary = {
  presets: [
    {
      key: "simple",
      columns: [
        { key: "todo", name: "To do", category: "backlog", name_key: "tasks.column.todo" },
        {
          key: "in_progress",
          name: "In progress",
          category: "active",
          name_key: "tasks.column.in_progress",
        },
        { key: "done", name: "Done", category: "done", name_key: "tasks.column.done" },
      ],
    },
  ],
  categories: [
    { value: "backlog", label: "Backlog" },
    { value: "active", label: "Active" },
    { value: "review", label: "Review" },
    { value: "waiting", label: "Waiting" },
    { value: "done", label: "Done" },
  ],
  checklist_states: [
    { value: "pending", label: "Pending" },
    { value: "done", label: "Done" },
    { value: "failed", label: "Failed" },
  ],
  priority_scale: [
    { value: 1, label_key: "tasks.priority.low" },
    { value: 2, label_key: "tasks.priority.normal" },
    { value: 3, label_key: "tasks.priority.high" },
    { value: 4, label_key: "tasks.priority.urgent" },
  ],
};
