// stapel/no-silent-slot — an unfilled slot must look like an unfilled slot.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
//   {props.searchSlot}                    ← renders NOTHING when unset
//   {props.renderListings?.(category)}    ← renders NOTHING when unset
//
// A default skin that composes optional slots renders a hole when the host
// forgets one, and a hole is the one defect nobody reports: the page looks
// finished. `PublicShell` renders `{props.searchSlot}` in the header — a
// storefront that never passes it ships a header with an empty gap where the
// search box goes, and everyone who looks at it assumes search is simply not
// part of the product. Same for `{props.gallerySlot}` in the listing composer
// (a composer with no image picker) and `{props.renderLoginPanel?.(…)}` on the
// invite-accept page (an invite page with no way to sign in — an accept flow
// that cannot be completed, rendered as a blank column).
//
// Every other absence in this codebase is designed: `matchList` demands an
// empty arm, `ActionAvailability` cannot spell "disabled for unknown reasons",
// `LoadState` refuses to collapse "failed" into "empty". A slot is the last
// place where nothing is still allowed to mean nothing.
//
// ── WHAT TO WRITE INSTEAD ───────────────────────────────────────────────────
//
//   {props.searchSlot ?? <SlotPlaceholder name="searchSlot" />}
//   {props.renderListings?.(c) ?? <SlotPlaceholder name="renderListings" />}
//   {props.searchSlot ?? null}   ← deliberate: says "empty is correct here"
//
// `SlotPlaceholder` (`@stapel/core`) renders a labelled, dashed
// region in development and nothing in production, so the hole is loud where
// it can be fixed and invisible where it cannot. `?? null` is accepted as the
// explicit opt-out: the point of this rule is that the decision gets WRITTEN,
// not that every slot must be filled.
//
// ── HOW A SLOT IS RECOGNISED ────────────────────────────────────────────────
//
// By name, in a JSX CHILD position only: an expression ending in `Slot`
// (`searchSlot`, `props.gallerySlot`) or a call of a `render<X>` prop
// (`props.renderAuthor?.(…)`). Naming conventions are what this codebase
// already uses to mark a slot, and a rule that tried to infer "optional
// ReactNode prop" from types would need type information, would be wrong on
// generics, and would fire on ordinary children. A slot in an ATTRIBUTE
// position (`title={props.titleSlot}`) is not covered: there the consumer of
// the prop decides what an absent value renders as, and it is usually a
// component that already has an empty state.
import {
  isDefaultSkin,
  normalizedFilename,
} from "../lib/jsx.js";

const SLOT_NAME_RE = /Slot$/;
const RENDER_PROP_RE = /^render[A-Z]/;

/** The name a slot expression is addressed by, or null. */
function slotName(expression) {
  // `searchSlot` / `props.searchSlot` / `props?.searchSlot`
  if (expression.type === "Identifier") {
    return SLOT_NAME_RE.test(expression.name) ? expression.name : null;
  }
  if (
    expression.type === "MemberExpression" ||
    expression.type === "ChainExpression"
  ) {
    const member =
      expression.type === "ChainExpression" ? expression.expression : expression;
    if (member.type !== "MemberExpression" || member.computed) return null;
    if (member.property.type !== "Identifier") return null;
    return SLOT_NAME_RE.test(member.property.name) ? member.property.name : null;
  }
  return null;
}

/**
 * The name of a `render<X>` PROP being called, or null.
 *
 * A prop, not a helper: the callee must be a member access (`props.renderRow`)
 * or an optional call (`renderRow?.(…)`, the shape an optional prop is always
 * called with). A plain `renderCategoryLabel(entry.label, t)` is a local
 * formatting helper that happens to be named after what it does, and reporting
 * it would make the rule fire on ordinary code — which is how a rule gets
 * switched off.
 */
function renderPropName(expression) {
  const optional = expression.type === "ChainExpression";
  const call = optional ? expression.expression : expression;
  if (call.type !== "CallExpression") return null;
  const callee = call.callee;
  if (callee.type === "Identifier") {
    if (!optional && !call.optional) return null;
    return RENDER_PROP_RE.test(callee.name) ? callee.name : null;
  }
  if (callee.type === "MemberExpression" && !callee.computed) {
    if (callee.property.type !== "Identifier") return null;
    return RENDER_PROP_RE.test(callee.property.name) ? callee.property.name : null;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an explicit fallback (SlotPlaceholder, or `?? null`) for an optional slot or render prop rendered as a JSX child in a default skin.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Regex source for slot-shaped names (default `Slot$`). */
          slotNamePattern: { type: "string" },
          /** Regex source for render-prop names (default `^render[A-Z]`). */
          renderPropPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      silentSlot:
        '`{{name}}` renders nothing when the host does not pass it, and a hole looks like a finished page — the one defect nobody reports. Write the decision down: `{{name}} ?? <SlotPlaceholder name="{{name}}" />` (from "@stapel/core": a labelled dashed region with role="note" in dev, null in production), or `?? null` if empty really is correct here. Everything else in this codebase already refuses to let absence be silent — matchList\'s required empty arm, ActionAvailability with no "disabled for unknown reasons", LoadState refusing to fold failed into empty. A slot is the last place it still can be.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const slotRe = options.slotNamePattern
      ? new RegExp(options.slotNamePattern)
      : SLOT_NAME_RE;
    const renderRe = options.renderPropPattern
      ? new RegExp(options.renderPropPattern)
      : RENDER_PROP_RE;

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** Is this node under a conditional whose test mentions `name`? */
    function isGuardedBy(node, name) {
      let current = node;
      for (let depth = 0; current && depth < 14; depth += 1) {
        const parent = current.parent;
        if (!parent) return false;
        const test =
          parent.type === "IfStatement" || parent.type === "ConditionalExpression"
            ? parent.test
            : parent.type === "LogicalExpression"
              ? parent.left
              : null;
        if (test && sourceCode.getText(test).includes(name)) return true;
        current = parent;
      }
      return false;
    }

    function nameOf(expression) {
      const slot = slotName(expression);
      if (slot && slotRe.test(slot)) return slot;
      const render = renderPropName(expression);
      if (render && renderRe.test(render)) return render;
      return null;
    }

    return {
      JSXExpressionContainer(node) {
        // CHILD position only — an attribute value is the callee's business.
        const parent = node.parent;
        if (parent?.type !== "JSXElement" && parent?.type !== "JSXFragment") return;
        const expression = node.expression;
        if (expression.type === "JSXEmptyExpression") return;
        // `x ?? fallback` / `x && …` / a ternary IS the written decision.
        if (
          expression.type === "LogicalExpression" ||
          expression.type === "ConditionalExpression"
        ) {
          return;
        }
        const name = nameOf(expression);
        if (!name) return;
        // A guard above the JSX is the decision, written earlier:
        //   if (props.renderRow) return <div>{props.renderRow(row)}</div>;
        //   return <FeatureRow {...row}/>;      ← the fallback
        // The absent case is handled; it just is not handled inline.
        if (isGuardedBy(node, name)) return;
        context.report({ node, messageId: "silentSlot", data: { name } });
      },
    };
  },
};
