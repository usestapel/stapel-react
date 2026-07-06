// stapel/no-double-count — frontend-guardrails §3.2 + user decision Q12а
// (hard ban; overrides open question §7). A flow machine is already
// auto-instrumented — every transition emits flow.<id>.<step>. Wrapping a
// handler that ALSO steps that machine in tracked()/trackedSubmit() double-
// counts the funnel. Exactly one channel is allowed.
//
// Two heuristics, both syntactic (§3.2):
//
//   1. tracked(event, props, handler) where the handler steps a machine — a
//      call to a run / step / submit* method inside the handler function.
//   2. an element that BOTH carries data-analytics="flow" AND wraps its handler
//      in tracked()/trackedSubmit() — the author asserted the flow channel and
//      opened a second one.
//
// The teaching message is the same in both cases: the flow step already emits
// the funnel — drop the tracked() wrapper OR the flow marker, keep one channel.
import { stapelSettings } from "../lib/data.js";

const DEFAULT_WRAPPERS = ["tracked", "trackedSubmit"];
const DEFAULT_HANDLERS = [
  "onClick",
  "onDoubleClick",
  "onSubmit",
  "onPointerDown",
  "onPointerUp",
  "onMouseDown",
  "onMouseUp",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onTouchStart",
  "onTouchEnd",
];
// Flow-machine stepping methods (frontend-guardrails §3.2 heuristic:
// "run/step/submit* methods of the machine"). `submit*` matches submit,
// submitCode, submitForm, …
const STEP_METHODS = new Set(["run", "step"]);
const STEP_PREFIX = "submit";

const LESSON =
  "the flow step already emits the funnel (flow.<id>.<step>) — remove the tracked() wrapper OR the flow marker, keep exactly one channel (Q12а). §3.2 stapel/no-double-count";

function isWrapperCall(node, wrappers) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier"
        ? callee.property.name
        : null;
  return !!name && wrappers.has(name);
}

function isStepMethodCall(node) {
  if (
    node.type !== "CallExpression" ||
    node.callee.type !== "MemberExpression" ||
    node.callee.computed ||
    node.callee.property.type !== "Identifier"
  )
    return false;
  const m = node.callee.property.name;
  return STEP_METHODS.has(m) || m.startsWith(STEP_PREFIX);
}

/** Walk `root`'s descendants for a flow-stepping method call. */
function containsStep(root) {
  const seen = new Set();
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (typeof node.type === "string" && isStepMethodCall(node)) return true;
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) if (c && typeof c === "object") stack.push(c);
      } else if (child && typeof child === "object" && typeof child.type === "string") {
        stack.push(child);
      }
    }
  }
  return false;
}

function attrName(attr) {
  return attr.type === "JSXAttribute" && attr.name && attr.name.type === "JSXIdentifier"
    ? attr.name.name
    : null;
}

function attrLiteral(attr) {
  const v = attr.value;
  if (v == null) return true;
  if (v.type === "Literal") return v.value;
  if (v.type === "JSXExpressionContainer" && v.expression.type === "Literal")
    return v.expression.value;
  return undefined;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow tracked()/trackedSubmit() on a handler that also steps a flow machine (double-counting the funnel).",
    },
    schema: [
      {
        type: "object",
        properties: {
          wrappers: { type: "array", items: { type: "string" } },
          handlers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      trackedStepsFlow: "Double count: tracked() wraps a handler that steps a flow machine — " + LESSON,
      flowMarkerAndTracked:
        'Double count: element is marked data-analytics="flow" AND its handler is wrapped in tracked() — ' + LESSON,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const wrappers = new Set(
      context.options[0]?.wrappers ?? settings.trackedWrappers ?? DEFAULT_WRAPPERS
    );
    const handlers = new Set(
      context.options[0]?.handlers ?? settings.clickHandlers ?? DEFAULT_HANDLERS
    );

    // tracked() calls already reported via the flow-marker heuristic — skip
    // them in the CallExpression pass so an element that both marks flow and
    // steps a machine reports once. JSXOpeningElement is visited before the
    // CallExpression nested in its attribute (top-down traversal).
    const reportedViaMarker = new Set();

    return {
      JSXOpeningElement(node) {
        let isFlow = false;
        const wrapperCalls = [];
        for (const attr of node.attributes) {
          const name = attrName(attr);
          if (name === "data-analytics" && attrLiteral(attr) === "flow") isFlow = true;
          else if (name && handlers.has(name)) {
            const v = attr.value;
            const expr = v && v.type === "JSXExpressionContainer" ? v.expression : null;
            if (isWrapperCall(expr, wrappers)) wrapperCalls.push(expr);
          }
        }
        if (isFlow && wrapperCalls.length) {
          for (const call of wrapperCalls) {
            reportedViaMarker.add(call);
            context.report({ node: call, messageId: "flowMarkerAndTracked" });
          }
        }
      },

      CallExpression(node) {
        if (!isWrapperCall(node, wrappers)) return;
        if (reportedViaMarker.has(node)) return;
        const handler = node.arguments[2];
        if (!handler) return;
        if (
          (handler.type === "ArrowFunctionExpression" ||
            handler.type === "FunctionExpression") &&
          containsStep(handler.body)
        ) {
          context.report({ node, messageId: "trackedStepsFlow" });
        }
      },
    };
  },
};
