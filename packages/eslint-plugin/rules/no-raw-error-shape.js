// stapel/no-raw-error-shape — the error-dialect guardrail.
//
// Direct precedent: `no-raw-fetch` ("raw access is forbidden, go through the
// layer"). Same channel, one layer up — a thrown value reaches a call site in
// one of TWO dialects:
//
//   1. `StapelApiError` (what `@stapel/core`'s client throws) — has `.status`,
//      `.code`, `.params`;
//   2. the RAW envelope `{localizable_error, error, params}` — the parsed
//      response BODY, rethrown by any second transport (`if (error) throw
//      error` over an openapi-fetch-style `{ data, error }` result). It has
//      NO `.status`.
//
// So `(e as { status?: number })?.status === 404` is not a typing nicety: on
// dialect 2 it is `undefined === 404`, a branch that can never be true, and
// the cast is what silences the only check that would have caught it. That is
// how "the AI found nothing" got said about a meeting nobody had analysed —
// and, in `@stapel/core`'s own query client, how doomed 4xx requests were
// retried three times.
//
// This rule bans, OUTSIDE the transport/error layer:
//   - `as`-casting a caught value (any target type);
//   - `as`-casting anything to a hand-written error shape
//     (`{ status?: number }`, `{ localizable_error?: string }`, …) — this
//     catches the defect even where the value is not catch-bound (a
//     `retry(failureCount, error)` predicate, an `onError` handler, …);
//   - reading `.status` / `.code` / `.localizable_error` off a caught value
//     that has not been narrowed.
//
// Narrowing is allowed ONLY through `instanceof StapelApiError` or an
// IMPORTED predicate (`isStapelApiError`, `hasErrorCode`, a named
// `errorCodePredicate(…)` export) — through the layer, never through a shape
// the call site invented for itself.
//
// The api/error layer (`**/api/**`, `**/*client.*`, `**/errors.*`, core's
// `errors.ts`/`client.ts`) is carved out in the `recommended` preset: someone
// has to touch the raw shape to fold it into the typed one, and that someone
// is the layer. Scoping by path is deliberate — an unscoped rule gets
// blanket-disabled, and then it guards nothing.

const HINT =
  'A caught value has two dialects (StapelApiError | the raw {localizable_error, …} envelope, which has no .status). Narrow with isStapelApiError(e) / hasErrorCode(e, "error.404.…") from @stapel/core, or fold once at the transport: throw toStapelApiError(body, response.status).';

/** Members that mark an inline type literal as a hand-written error shape. */
const ERROR_SHAPE_MEMBERS = new Set([
  "status",
  "code",
  "localizable_error",
  "params",
]);

const DEFAULT_PROPERTIES = ["status", "code", "localizable_error"];
const DEFAULT_ERROR_CLASSES = ["StapelApiError"];

function memberName(member) {
  const key = member.key;
  if (!key) return null;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
}

function errorShapeMembers(typeNode) {
  if (!typeNode || typeNode.type !== "TSTypeLiteral") return [];
  return typeNode.members
    .filter((member) => member.type === "TSPropertySignature")
    .map((member) => memberName(member))
    .filter((name) => name !== null && ERROR_SHAPE_MEMBERS.has(name));
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting a caught error or reading its envelope fields without narrowing through @stapel/core's guards.",
    },
    schema: [
      {
        type: "object",
        properties: {
          properties: { type: "array", items: { type: "string" } },
          errorClasses: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      castCaught: "`{{name}} as …` on a caught value. " + HINT,
      castErrorShape:
        "Cast to a hand-written error shape (`{{members}}`). " + HINT,
      rawErrorProp:
        "`{{name}}.{{prop}}` on an un-narrowed caught value. " + HINT,
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const watchedProps = new Set(options.properties ?? DEFAULT_PROPERTIES);
    const errorClasses = new Set(options.errorClasses ?? DEFAULT_ERROR_CLASSES);
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function findVariable(scope, name) {
      let current = scope;
      while (current) {
        const variable = current.set.get(name);
        if (variable) return variable;
        current = current.upper;
      }
      return null;
    }

    function resolvesToImport(scope, name) {
      const variable = findVariable(scope, name);
      return (
        variable !== null &&
        variable.defs.some((def) => def.type === "ImportBinding")
      );
    }

    /**
     * Is this identifier bound to a CAUGHT value — `catch (e)` or the
     * parameter of a `.catch((e) => …)` handler?
     */
    function isCaughtBinding(identifier) {
      if (identifier.type !== "Identifier") return false;
      const variable = findVariable(
        sourceCode.getScope(identifier),
        identifier.name
      );
      if (variable === null || variable.defs.length === 0) return false;
      return variable.defs.some((def) => {
        if (def.type === "CatchClause") return true;
        if (def.type !== "Parameter") return false;
        const fn = def.node;
        if (
          fn.type !== "ArrowFunctionExpression" &&
          fn.type !== "FunctionExpression"
        ) {
          return false;
        }
        if (fn.params[0] !== def.name) return false;
        const call = fn.parent;
        return (
          call !== undefined &&
          call !== null &&
          call.type === "CallExpression" &&
          call.arguments[0] === fn &&
          call.callee.type === "MemberExpression" &&
          !call.callee.computed &&
          call.callee.property.type === "Identifier" &&
          call.callee.property.name === "catch"
        );
      });
    }

    // ── guard recognition ────────────────────────────────────────────────
    function usesVar(node, name) {
      return node.type === "Identifier" && node.name === name;
    }

    /** `e instanceof StapelApiError` or `importedPredicate(e)`. */
    function isGuardExpression(node, name, scope) {
      if (
        node.type === "BinaryExpression" &&
        node.operator === "instanceof" &&
        usesVar(node.left, name) &&
        node.right.type === "Identifier" &&
        errorClasses.has(node.right.name)
      ) {
        return true;
      }
      if (node.type === "CallExpression") {
        if (!node.arguments.some((arg) => usesVar(arg, name))) return false;
        const callee = node.callee;
        if (callee.type === "Identifier") {
          return resolvesToImport(scope, callee.name);
        }
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier"
        ) {
          // `coreErrors.isStapelApiError(e)` — namespace import of the layer.
          return resolvesToImport(scope, callee.object.name);
        }
      }
      return false;
    }

    /**
     * Does `node` assert the guard (or, with `wantNegated`, its negation)?
     * Polarity flips under `!`, so `!isStapelApiError(e)` never reads as a
     * positive narrowing.
     */
    function assertsGuard(node, name, scope, wantNegated) {
      if (!node || typeof node.type !== "string") return false;
      if (node.type === "UnaryExpression" && node.operator === "!") {
        return assertsGuard(node.argument, name, scope, !wantNegated);
      }
      if (node.type === "LogicalExpression") {
        return (
          assertsGuard(node.left, name, scope, wantNegated) ||
          assertsGuard(node.right, name, scope, wantNegated)
        );
      }
      if (
        node.type === "TSNonNullExpression" ||
        node.type === "TSAsExpression"
      ) {
        return assertsGuard(node.expression, name, scope, wantNegated);
      }
      if (wantNegated) return false;
      return isGuardExpression(node, name, scope);
    }

    function exits(statement) {
      if (!statement) return false;
      if (
        statement.type === "ReturnStatement" ||
        statement.type === "ThrowStatement" ||
        statement.type === "ContinueStatement" ||
        statement.type === "BreakStatement"
      ) {
        return true;
      }
      if (statement.type === "BlockStatement") {
        return statement.body.some((inner) => exits(inner));
      }
      return false;
    }

    /** `if (!isStapelApiError(e)) return;` earlier in the same block. */
    function earlyExitGuard(block, beforeStatement, name, scope) {
      const index = block.body.indexOf(beforeStatement);
      if (index < 0) return false;
      return block.body
        .slice(0, index)
        .some(
          (statement) =>
            statement.type === "IfStatement" &&
            assertsGuard(statement.test, name, scope, true) &&
            exits(statement.consequent) &&
            !statement.alternate
        );
    }

    function isNarrowed(identifier, name) {
      const scope = sourceCode.getScope(identifier);
      let node = identifier;
      let parent = node.parent;
      while (parent) {
        if (parent.type === "IfStatement" || parent.type === "ConditionalExpression") {
          if (
            parent.consequent === node &&
            assertsGuard(parent.test, name, scope, false)
          ) {
            return true;
          }
          if (
            parent.alternate === node &&
            assertsGuard(parent.test, name, scope, true)
          ) {
            return true;
          }
        }
        if (
          parent.type === "LogicalExpression" &&
          parent.right === node &&
          assertsGuard(parent.left, name, scope, parent.operator === "||")
        ) {
          return true;
        }
        if (
          parent.type === "BlockStatement" &&
          earlyExitGuard(parent, node, name, scope)
        ) {
          return true;
        }
        node = parent;
        parent = node.parent;
      }
      return false;
    }

    function checkCast(node) {
      if (isCaughtBinding(node.expression)) {
        context.report({
          node,
          messageId: "castCaught",
          data: { name: node.expression.name },
        });
        return;
      }
      const members = errorShapeMembers(node.typeAnnotation);
      if (members.length > 0) {
        context.report({
          node,
          messageId: "castErrorShape",
          data: { members: members.join(", ") },
        });
      }
    }

    return {
      TSAsExpression: checkCast,
      TSTypeAssertion: checkCast,

      MemberExpression(node) {
        if (
          node.computed ||
          node.property.type !== "Identifier" ||
          !watchedProps.has(node.property.name) ||
          node.object.type !== "Identifier"
        ) {
          return;
        }
        if (!isCaughtBinding(node.object)) return;
        if (isNarrowed(node.object, node.object.name)) return;
        context.report({
          node,
          messageId: "rawErrorProp",
          data: { name: node.object.name, prop: node.property.name },
        });
      },
    };
  },
};
