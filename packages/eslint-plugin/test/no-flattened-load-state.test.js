import rule from "../rules/no-flattened-load-state.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

tester.run("no-flattened-load-state", rule, {
  valid: [
    // The sanctioned shape: the discriminant travels with the data.
    { code: "const state = loadStateFromQuery(query);" },
    // The sanctioned escape hatch for a consumer that genuinely does not
    // discriminate.
    { code: "const count = loadedRowsOrEmpty(state).length;" },
    // `?? null` is honest — null is not a result, and a call site still has
    // to look at it. Only manufactured EMPTY COLLECTIONS lie.
    { code: "const created = mutation.data ?? null;" },
    { code: "const n = query.data ?? 0;" },
    // A non-empty default is a real value chosen on purpose, not a stand-in
    // for "we do not know".
    { code: "const rows = query.data ?? FALLBACK_ROWS;" },
    // No `data` in the chain: an optional field of a response body that has
    // already been successfully loaded is a different question entirely.
    { code: "for (const p of batch?.profiles ?? []) {}" },
    { code: "const roles = (await api.listRoles()).roles ?? [];" },
    // Defaulting a plain parameter is not a load state.
    { code: "function f(items) { return items ?? []; }" },
  ],
  invalid: [
    {
      // The incident, verbatim.
      code: "const bag = { workspaces: query.data?.workspaces ?? [] };",
      errors: [{ messageId: "flattened" }],
    },
    {
      code: "const documents = query.data ?? [];",
      errors: [{ messageId: "flattened" }],
    },
    {
      // `||` lies exactly as well as `??`.
      code: "const list = sessions.data || [];",
      errors: [{ messageId: "flattened" }],
    },
    {
      // An empty object is the same manufactured absence.
      code: "const byId = query.data?.index ?? {};",
      errors: [{ messageId: "flattened" }],
    },
    {
      // Wrapping in a call does not launder it.
      code: "const items = query.data?.pages.flatMap((p) => p.items) ?? [];",
      errors: [{ messageId: "flattened" }],
    },
    {
      // Optional chaining through several levels.
      code: "const trail = folderTrail(treeQuery.data ?? [], id);",
      errors: [{ messageId: "flattened" }],
    },
    {
      // Destructured query result.
      code: "const { data } = useQuery(opts); const rows = data ?? [];",
      errors: [{ messageId: "flattened" }],
    },
    {
      // Straight into JSX, which is where the empty state gets rendered.
      code: "const el = <FolderList folders={foldersQuery.data ?? []} />;",
      errors: [{ messageId: "flattened" }],
    },
    {
      // A custom result property name, for a pair whose hook does not call it
      // `data`.
      code: "const rows = result.rows ?? [];",
      options: [{ dataProperties: ["rows"] }],
      errors: [{ messageId: "flattened" }],
    },
  ],
});
