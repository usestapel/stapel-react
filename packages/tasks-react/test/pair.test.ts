// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StapelApiError, createStapelClient } from "@stapel/core";
import {
  TASKS_FLOWS,
  createTasksApi,
  deniedMove,
  flowEndpoints,
  isMoveResponseBody,
  registerTasksI18n,
  tasksI18nBundleEn,
  tasksQueryKeys,
} from "../src/index.js";

const BASE = "https://tasks.test/tasks/api/v1/";

interface Call {
  readonly method: string;
  readonly path: string;
}

/** Record what the api layer actually puts on the wire. */
function recordingClient(answer: unknown = {}, status = 200) {
  const calls: Call[] = [];
  const client = createStapelClient({
    baseUrl: BASE,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push({
        method: init?.method ?? "GET",
        path: url.replace(BASE, "").split("?")[0] ?? "",
      });
      return Promise.resolve(
        new Response(JSON.stringify(answer), {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    }) as typeof globalThis.fetch,
  });
  return { calls, api: createTasksApi(client) };
}

describe("the operation surface is the CONTRACT, path for path", () => {
  it("reaches every documented route, with no trailing slashes", async () => {
    const { calls, api } = recordingClient();
    await api.boards();
    await api.presets();
    await api.createBoard({ name: "b" });
    await api.board("B");
    await api.updateBoard("B", { name: "c" });
    await api.archiveBoard("B");
    await api.columns("B");
    await api.addColumn("B", { key: "k", name: "n", category: "backlog" });
    await api.reorderColumns("B", ["k"]);
    await api.boardCards("B");
    await api.tasks("B");
    await api.createTask("B", { title: "t" });
    await api.task("T");
    await api.updateTask("T", { title: "t" });
    await api.archiveTask("T");
    await api.moveTask("T", "done", 0);
    await api.assign("T", ["u"]);
    await api.comments("T");
    await api.addComment("T", { body: "hi" });
    await api.checklist("T");
    await api.addChecklistItem("T", { text: "s" });
    await api.setChecklistState("T", "I", "done");

    expect(calls).toEqual([
      { method: "GET", path: "boards" },
      { method: "GET", path: "boards/presets" },
      { method: "POST", path: "boards" },
      { method: "GET", path: "boards/B" },
      { method: "PATCH", path: "boards/B" },
      { method: "DELETE", path: "boards/B" },
      { method: "GET", path: "boards/B/columns" },
      { method: "POST", path: "boards/B/columns" },
      { method: "POST", path: "boards/B/columns/reorder" },
      { method: "GET", path: "boards/B/cards" },
      { method: "GET", path: "boards/B/tasks" },
      { method: "POST", path: "boards/B/tasks" },
      { method: "GET", path: "tasks/T" },
      { method: "PATCH", path: "tasks/T" },
      { method: "DELETE", path: "tasks/T" },
      { method: "POST", path: "tasks/T/move" },
      { method: "POST", path: "tasks/T/assign" },
      { method: "GET", path: "tasks/T/comments" },
      { method: "POST", path: "tasks/T/comments" },
      { method: "GET", path: "tasks/T/checklist" },
      { method: "POST", path: "tasks/T/checklist" },
      { method: "POST", path: "tasks/T/checklist/I/state" },
    ]);
    expect(calls.some((call) => call.path.endsWith("/"))).toBe(false);
  });

  it("every path it calls is one the generated manifest documents", async () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
      operations: Record<string, { method: string; path: string }>;
    };
    const documented = new Set(
      Object.values(manifest.operations).map(
        (op) => `${op.method} ${op.path.replace("/tasks/api/v1/", "")}`
      )
    );
    const { calls, api } = recordingClient();
    await api.boardCards("B");
    await api.presets();
    await api.moveTask("T", "done");
    const templated = calls.map(
      (call) =>
        `${call.method} ${call.path
          .replace(/(^|\/)B(\/|$)/, "$1{board_id}$2")
          .replace(/(^|\/)T(\/|$)/, "$1{task_id}$2")}`
    );
    for (const path of templated) expect([...documented]).toContain(path);
  });

  it("sends the board filters the server actually reads", async () => {
    const seen: string[] = [];
    const client = createStapelClient({
      baseUrl: BASE,
      fetch: ((input: RequestInfo | URL) => {
        seen.push(String(input));
        return Promise.resolve(
          new Response("{}", { headers: { "content-type": "application/json" } })
        );
      }) as typeof globalThis.fetch,
    });
    await createTasksApi(client).boardCards("B", {
      column: "todo",
      category: "active",
      assigneeId: "u1",
      includeArchived: true,
    });
    const url = seen[0] ?? "";
    expect(url).toContain("column=todo");
    expect(url).toContain("category=active");
    expect(url).toContain("assignee_id=u1");
    expect(url).toContain("include_archived=true");
  });
});

describe("the 409 move is a MoveResponse, not the error envelope", () => {
  it("unwraps a denied move back into a value", async () => {
    const { api } = recordingClient(
      { result: "denied", reason_key: "error.409.tasks_transition_not_allowed" },
      409
    );
    const answer = await api.moveTask("T", "done", 0);
    expect(answer.result).toBe("denied");
    expect(answer.reason_key).toBe("error.409.tasks_transition_not_allowed");
  });

  it("lets an ordinary 409 envelope keep throwing", async () => {
    const { api } = recordingClient({ localizable_error: "error.409.conflict" }, 409);
    await expect(api.moveTask("T", "done", 0)).rejects.toThrow();
  });

  it("only ever unwraps a 409 whose body carries a known result word", () => {
    expect(isMoveResponseBody({ result: "applied" })).toBe(true);
    expect(isMoveResponseBody({ result: "maybe" })).toBe(false);
    expect(isMoveResponseBody(null)).toBe(false);
    expect(
      deniedMove(
        new StapelApiError({
          code: "x",
          message: "x",
          status: 404,
          body: { result: "denied" },
        })
      )
    ).toBe(null);
    expect(deniedMove(new Error("offline"))).toBe(null);
  });
});

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces everything under the module root", () => {
    expect(tasksQueryKeys.all[0]).toBe("tasks");
    expect(tasksQueryKeys.cards("b")[0]).toBe("tasks");
    expect(tasksQueryKeys.cardsPrefix("b")).toEqual(["tasks", "cards", "b"]);
  });

  it("gives two different server-filter sets two different keys", () => {
    expect(tasksQueryKeys.cards("b", { column: "todo" })).not.toEqual(
      tasksQueryKeys.cards("b", { column: "done" })
    );
    // …and the same set the same key whatever order it was written in.
    expect(tasksQueryKeys.cards("b", { column: "todo", category: "active" })).toEqual(
      tasksQueryKeys.cards("b", { category: "active", column: "todo" })
    );
  });
});

describe("flows come from the backend's own docs/flows.json", () => {
  it("carries the three flows stapel-tasks 0.3.0 annotates", () => {
    expect(Object.keys(TASKS_FLOWS).sort()).toEqual([
      "tasks.board_setup",
      "tasks.card_lifecycle",
      "tasks.card_move",
    ]);
  });

  // NOTE (filed for the backend in SCRATCH/wave-b/REQUESTS-tasks-react.md):
  // flows.json spells its paths in DJANGO converter syntax
  // (`<uuid:task_id>`) while schema.json spells the same routes as OpenAPI
  // templates (`{task_id}`). Nothing can join the two by path today, so this
  // pins the shape that actually ships rather than the one that should.
  it("the card-move flow runs through the move endpoint", () => {
    expect(flowEndpoints("tasks.card_move")).toContainEqual({
      method: "POST",
      path: "/tasks/api/v1/tasks/<uuid:task_id>/move",
    });
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(tasksI18nBundleEn["tasks.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerTasksI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["tasks.error.unknown"]).toBeTruthy();
    // Backend codes travel in the same bundle — a StapelApiError.code is a key.
    expect(seen["error.409.tasks_column_exists"]).toBeTruthy();
    expect(seen["error.503.tasks_scope_unresolved"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/tasks-react");
    expect(manifest.backend.module).toBe("stapel-tasks");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
    expect(Object.keys(manifest.operations)).toHaveLength(22);
  });

  it("the nav manifest names components this package really exports", () => {
    const nav = JSON.parse(readFileSync("nav-manifest.json", "utf8")) as {
      entries: { id: string; component: { export: string; subpath: string } }[];
    };
    const skin = readFileSync("src/default/index.ts", "utf8");
    expect(nav.entries.map((entry) => entry.id)).toEqual([
      "tasks.boards",
      "tasks.board",
    ]);
    for (const entry of nav.entries) {
      expect(entry.component.subpath).toBe("default");
      expect(skin).toContain(`export { ${entry.component.export} }`);
    }
  });
});
