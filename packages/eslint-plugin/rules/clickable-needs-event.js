// stapel/clickable-needs-event — frontend-guardrails §3.2 (failure mode F10:
// "analytics as an afterthought — the agent generates clickable UI with no
// events"). A JSX element carrying an interactive handler (onClick/onSubmit/
// onPointerDown/…) must statically fall into exactly ONE of three outcomes:
//
//   (a) the handler is wrapped — onClick={tracked(event, props, handler)} (or
//       trackedSubmit(...)); the wrapper name is the static marker.
//   (b) the click steps a flow machine — the element is marked
//       data-analytics="flow"; the machine is already auto-instrumented
//       (flow.<id>.<step>), so the funnel emits itself.
//   (c) the click is deliberately untracked — data-analytics="none" plus a
//       NON-EMPTY data-analytics-reason="…"; the report (G5) lists it under
//       "explicitly untracked".
//
// Everything is checked syntactically (§3.2: "syntactic checkability >
// semantic undecidability"). The check is per-element, not per-attribute — one
// outcome covers all of an element's handlers.
//
// Decorative/technical clicks are EXEMPT by policy (documented here so the
// message can teach it): a handler whose body does nothing but call
// e.stopPropagation() / e.preventDefault() is plumbing, not a user action — it
// does not represent an interaction to track. Everything else that carries an
// interactive prop (including custom components that merely forward onClick)
// must pick an outcome; a forwarding component marks itself
// data-analytics="none" reason="passthrough" and the real click point is
// tracked downstream.
import { stapelSettings } from "../lib/data.js";

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
const DEFAULT_WRAPPERS = ["tracked", "trackedSubmit"];

const DEV_HINT =
  'Choose one: wrap the handler — onClick={tracked(event, props, handler)} (events: app/analytics/events.ts); mark a flow action data-analytics="flow" (the auto-instrumented funnel emits flow.<id>.<step> itself); or justify opting out data-analytics="none" data-analytics-reason="…". Decorative clicks whose handler only calls e.stopPropagation()/preventDefault() are exempt.';

function attrName(attr) {
  return attr.type === "JSXAttribute" && attr.name && attr.name.type === "JSXIdentifier"
    ? attr.name.name
    : null;
}

/** Static string value of an attribute, or undefined if dynamic/absent. */
function attrStringValue(attr) {
  const v = attr.value;
  if (v == null) return true; // boolean shorthand `data-analytics`
  if (v.type === "Literal") return v.value;
  if (
    v.type === "JSXExpressionContainer" &&
    v.expression.type === "Literal"
  )
    return v.expression.value;
  return undefined; // dynamic expression — not statically known
}

/** The CallExpression wrapping a handler, if it is tracked()/trackedSubmit(). */
function trackedCallOf(attr, wrappers) {
  const v = attr.value;
  if (!v || v.type !== "JSXExpressionContainer") return null;
  const expr = v.expression;
  if (expr.type !== "CallExpression") return null;
  const callee = expr.callee;
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier"
        ? callee.property.name
        : null;
  return name && wrappers.has(name) ? expr : null;
}

/** True if `fn`'s body does nothing but stopPropagation()/preventDefault(). */
function isDecorativeHandler(fn) {
  if (
    !fn ||
    (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")
  )
    return false;
  const isPlumbingCall = (node) =>
    node &&
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    (node.callee.property.name === "stopPropagation" ||
      node.callee.property.name === "preventDefault");
  const body = fn.body;
  if (body.type === "CallExpression") return isPlumbingCall(body); // implicit return
  if (body.type !== "BlockStatement") return false;
  if (body.body.length === 0) return false;
  return body.body.every(
    (s) => s.type === "ExpressionStatement" && isPlumbingCall(s.expression)
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an interactive JSX element to declare an analytics outcome: tracked() wrapper, data-analytics=\"flow\", or data-analytics=\"none\" with a reason.",
    },
    schema: [
      {
        type: "object",
        properties: {
          handlers: { type: "array", items: { type: "string" } },
          wrappers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      needsEvent: "Clickable element with no analytics outcome. " + DEV_HINT + " §3.2 stapel/clickable-needs-event",
      noneNeedsReason:
        'data-analytics="none" needs a non-empty data-analytics-reason="…" — the report (G5) lists deliberate opt-outs under "explicitly untracked", so the decision stays visible on review. §3.2 stapel/clickable-needs-event',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const handlers = new Set(
      context.options[0]?.handlers ?? settings.clickHandlers ?? DEFAULT_HANDLERS
    );
    const wrappers = new Set(
      context.options[0]?.wrappers ?? settings.trackedWrappers ?? DEFAULT_WRAPPERS
    );

    return {
      JSXOpeningElement(node) {
        let interactiveAttrs = [];
        let dataAnalytics; // undefined = absent; string/true = value; null = dynamic
        let hasReason = false;
        for (const attr of node.attributes) {
          const name = attrName(attr);
          if (!name) continue; // spread attribute — can't inspect
          if (handlers.has(name) && attr.value != null) interactiveAttrs.push(attr);
          else if (name === "data-analytics") {
            const val = attrStringValue(attr);
            dataAnalytics = val === undefined ? null : val;
          } else if (name === "data-analytics-reason") {
            const val = attrStringValue(attr);
            hasReason = typeof val === "string" && val.trim().length > 0;
          }
        }

        if (interactiveAttrs.length === 0) return; // nothing to enforce

        // Dynamic data-analytics value — author took explicit control we can't
        // read statically; don't cry wolf (§3.2 syntactic-only policy).
        if (dataAnalytics === null) return;

        // (b) flow action — the machine auto-emits; satisfied.
        if (dataAnalytics === "flow") return;

        // (c) explicit opt-out — needs a reason.
        if (dataAnalytics === "none") {
          if (!hasReason) {
            context.report({ node, messageId: "noneNeedsReason" });
          }
          return;
        }

        // (a) at least one handler is a tracked()/trackedSubmit() wrapper.
        if (interactiveAttrs.some((a) => trackedCallOf(a, wrappers))) return;

        // Exempt decorative/technical handlers (stopPropagation/preventDefault
        // only) — plumbing, not an interaction.
        if (
          interactiveAttrs.every((a) => {
            const v = a.value;
            const fn = v && v.type === "JSXExpressionContainer" ? v.expression : null;
            return isDecorativeHandler(fn);
          })
        )
          return;

        context.report({ node, messageId: "needsEvent" });
      },
    };
  },
};
