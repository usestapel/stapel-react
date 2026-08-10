// stapel/no-flattened-load-state — the "absence of a result is not a result"
// guardrail.
//
// THE DEFECT, in one line of real shipped code:
//
//     workspaces: query.data?.workspaces ?? []
//
// After that line, `workspaces.length === 0` is the only question a skin can
// ask, and it has THREE true answers behind it — "still loading", "loaded,
// genuinely none", "the request failed". On 2026-08-09 the third one was the
// live case: app.ironmemo.com's workspace endpoint answered 404 to every
// request for hours while the screen said "you have no workspaces" and greyed
// out the upload button. The outage was in the network tab the whole time;
// the UI actively argued against it.
//
// Sibling `isError`/`error` fields did NOT prevent this, which is the reason
// this is a lint rule and not a code review note: the flattened array was
// reachable WITHOUT mentioning them, so the shortest correct-looking code was
// wrong code. `@stapel/core`'s `LoadState` puts the data behind the
// discriminant and `matchList` demands four arms, so the empty branch can
// only run for a load that actually succeeded.
//
// What is banned: defaulting a query's `data` to an EMPTY COLLECTION
// (`?? []`, `|| []`, `?? {}`, `|| {}`). Not `?? null` and not `?? 0` — those
// are honestly-absent values that a call site still has to look at.
//
// The api/transport layer is carved out in the `recommended` preset: there,
// `const { data } = await client.GET(…)` is the raw openapi-fetch result and
// defaulting it is part of folding the response, not a rendering decision.

const HINT =
  "This collapses three different answers (still loading / loaded and genuinely empty / the request failed) into one empty value, and every skin downstream can then only ask `.length === 0`. Hand out `loadStateFromQuery(query)` from @stapel/core and render it with `matchList`, whose four arms are all required — the empty branch then only runs for a load that succeeded. For a genuinely non-discriminating consumer (a count badge, an analytics prop, a useMemo input) use `loadedRowsOrEmpty(state)`.";

const DEFAULT_DATA_PROPERTIES = ["data"];

/** `[]` or `{}` — an empty collection manufactured out of nothing. */
function isEmptyCollection(node) {
  if (node.type === "ArrayExpression") return node.elements.length === 0;
  if (node.type === "ObjectExpression") return node.properties.length === 0;
  return false;
}

/**
 * Does this expression read one of the watched `data` properties anywhere in
 * its chain? Walks THROUGH calls and chains so
 * `query.data?.pages.flatMap((p) => p.items) ?? []` is caught as readily as
 * `query.data ?? []` — the wrapping is incidental, the flatten is not.
 */
function readsQueryData(node, watched, depth = 0) {
  if (!node || typeof node.type !== "string" || depth > 12) return false;
  switch (node.type) {
    // A destructured result — `const { data } = useQuery(…); data ?? []`.
    // Legitimate in the api layer (where `data` is openapi-fetch's raw
    // half), which the preset carves out by path.
    case "Identifier":
      return watched.has(node.name);
    case "MemberExpression":
      if (
        !node.computed &&
        node.property.type === "Identifier" &&
        watched.has(node.property.name)
      ) {
        return true;
      }
      return readsQueryData(node.object, watched, depth + 1);
    case "ChainExpression":
    case "TSNonNullExpression":
    case "TSAsExpression":
      return readsQueryData(node.expression, watched, depth + 1);
    case "CallExpression":
      return readsQueryData(node.callee, watched, depth + 1);
    case "AwaitExpression":
      return readsQueryData(node.argument, watched, depth + 1);
    case "LogicalExpression":
      return (
        readsQueryData(node.left, watched, depth + 1) ||
        readsQueryData(node.right, watched, depth + 1)
      );
    case "ConditionalExpression":
      return (
        readsQueryData(node.consequent, watched, depth + 1) ||
        readsQueryData(node.alternate, watched, depth + 1)
      );
    case "SpreadElement":
      return readsQueryData(node.argument, watched, depth + 1);
    default:
      return false;
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow defaulting a query's data to an empty array/object, which makes a failed load indistinguishable from an empty result.",
    },
    schema: [
      {
        type: "object",
        properties: {
          dataProperties: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      flattened: "`{{source}} {{operator}} {{fallback}}` flattens a load state. " + HINT,
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const watched = new Set(options.dataProperties ?? DEFAULT_DATA_PROPERTIES);
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      LogicalExpression(node) {
        if (node.operator !== "??" && node.operator !== "||") return;
        if (!isEmptyCollection(node.right)) return;
        if (!readsQueryData(node.left, watched)) return;
        const source = sourceCode.getText(node.left);
        context.report({
          node,
          messageId: "flattened",
          data: {
            source: source.length > 48 ? `${source.slice(0, 45)}...` : source,
            operator: node.operator,
            fallback: node.right.type === "ArrayExpression" ? "[]" : "{}",
          },
        });
      },
    };
  },
};
