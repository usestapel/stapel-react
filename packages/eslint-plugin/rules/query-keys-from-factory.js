// stapel/query-keys-from-factory — frontend-guardrails §2.2 (core gap #8).
// TanStack Query keys come ONLY from the module's key factory (`<module>QueryKeys`
// — e.g. `authQueryKeys.sessions()`). A hand-rolled inline array (`queryKey:
// ["auth","sessions"]`) is the classic drift source: it silently stops matching
// the factory the mutations invalidate against, so a write updates the server
// but the screen keeps a stale cache. The rule is a heuristic over the query
// surface: a call to `useQuery`/`useMutation`/… or a `queryClient.*` method with
// an INLINE array key. The recommended preset turns it OFF in the factory file
// itself (`**/queryKeys.*`), where the literal arrays legitimately live.
import { stapelSettings } from "../lib/data.js";

// Hooks whose options object carries `queryKey` / `mutationKey`.
const DEFAULT_QUERY_HOOKS = [
  "useQuery",
  "useQueries",
  "useInfiniteQuery",
  "useSuspenseQuery",
  "useSuspenseQueries",
  "useSuspenseInfiniteQuery",
  "usePrefetchQuery",
  "usePrefetchInfiniteQuery",
  "useMutation",
  "useIsFetching",
  "useIsMutating",
  "useMutationState",
];

// QueryClient methods that take a key — as `{ queryKey: … }` (filters) or as a
// leading positional array (setQueryData/getQueryData/…).
const DEFAULT_CLIENT_METHODS = [
  "invalidateQueries",
  "removeQueries",
  "cancelQueries",
  "refetchQueries",
  "resetQueries",
  "isFetching",
  "prefetchQuery",
  "prefetchInfiniteQuery",
  "fetchQuery",
  "fetchInfiniteQuery",
  "ensureQueryData",
  "ensureInfiniteQueryData",
  "getQueryData",
  "getQueryState",
  "setQueryData",
  "getQueriesData",
  "setQueriesData",
];

// Methods whose FIRST positional argument is the key itself (not an options obj).
const POSITIONAL_KEY_METHODS = new Set([
  "getQueryData",
  "getQueryState",
  "setQueryData",
  "getQueriesData",
  "setQueriesData",
]);

const KEY_PROPS = new Set(["queryKey", "mutationKey"]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require react-query keys to come from the module's key factory, not an inline array literal.",
    },
    schema: [
      {
        type: "object",
        properties: {
          queryHooks: { type: "array", items: { type: "string" } },
          clientMethods: { type: "array", items: { type: "string" } },
          factorySuffix: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      inlineKey:
        'Inline {{prop}} array. Query keys come only from the module key factory ({{factory}}): {{prop}}: authQueryKeys.<resource>(…). A hand-rolled array drifts from the invalidations that target the factory — the write lands, the cache goes stale. Factory: <module>/model/queryKeys.ts. §2.2 stapel/query-keys-from-factory',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const opt = context.options[0] ?? {};
    const queryHooks = new Set(
      opt.queryHooks ?? settings.queryHooks ?? DEFAULT_QUERY_HOOKS
    );
    const clientMethods = new Set(
      opt.clientMethods ?? settings.queryClientMethods ?? DEFAULT_CLIENT_METHODS
    );
    const factory = opt.factorySuffix ?? settings.keyFactorySuffix ?? "<module>QueryKeys";

    function report(node, prop) {
      context.report({ node, messageId: "inlineKey", data: { prop, factory } });
    }

    /** Report a `queryKey`/`mutationKey: [ … ]` inline array in an options obj. */
    function checkOptionsObject(objExpr) {
      if (!objExpr || objExpr.type !== "ObjectExpression") return;
      for (const p of objExpr.properties) {
        if (
          p.type === "Property" &&
          !p.computed &&
          p.key.type === "Identifier" &&
          KEY_PROPS.has(p.key.name) &&
          p.value.type === "ArrayExpression"
        ) {
          report(p.value, p.key.name);
        }
      }
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        // useQuery({ queryKey: [...] }) — identifier hook.
        if (callee.type === "Identifier" && queryHooks.has(callee.name)) {
          for (const a of node.arguments) checkOptionsObject(a);
          return;
        }
        // queryClient.invalidateQueries({ queryKey: [...] }) / setQueryData([...], …)
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          clientMethods.has(callee.property.name)
        ) {
          const method = callee.property.name;
          if (POSITIONAL_KEY_METHODS.has(method)) {
            const first = node.arguments[0];
            if (first && first.type === "ArrayExpression") report(first, "queryKey");
            // setQueriesData/getQueriesData also accept a filters object.
            for (const a of node.arguments) checkOptionsObject(a);
          } else {
            for (const a of node.arguments) checkOptionsObject(a);
          }
        }
      },
    };
  },
};
