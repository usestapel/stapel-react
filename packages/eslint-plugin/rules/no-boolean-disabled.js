// stapel/no-boolean-disabled — a greyed-out button is a question the page
// refuses to answer.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
//   <Button disabled={!canInvite}>Invite</Button>
//
// The person sees a grey button. They do not know whether they lack a
// permission, whether the workspace hit its seat limit, whether their trial
// ended, or whether the page is simply still loading — and there is nowhere to
// find out, because the boolean threw the reason away before it reached the
// component. `@stapel/core`'s `ActionAvailability` exists precisely so that it
// cannot: `{available:true} | {available:false, block:{code, params, cause}}`
// has no way to spell "disabled, reason unknown". Thirteen pairs use it (55
// call sites in listings alone); five — billing, calendar, notifications,
// recordings, video — use it nowhere, and those five are where the raw
// booleans are.
//
//   <GatedButton gate={inviteGate}>Invite</GatedButton>
//   // or, for a non-Button control:
//   <GatedControl gate={inviteGate}>{(bind) => <Upload {...bind}/>}</GatedControl>
//
// `GatedButton`/`GatedControl` (`@stapel/tokens-antd/skin`) render the block's
// localized reason beside the control and point the control's
// `aria-describedby` at it (`SignInCta` is the same idea for the sign-in
// case). Beside — not in a tooltip: a
// disabled antd Button does not fire the pointer events a tooltip listens for,
// so the hover text that "explains" a disabled control is the one string
// guaranteed never to appear (see stapel/no-tooltip-in-skin).
//
// ── THIS RULE IS A HEURISTIC. ITS LIMITS, EXPLICITLY ────────────────────────
//
// Whether an expression carries a reason is a data-flow question, and ESLint
// without type information cannot follow `const x = f(); … disabled={x}`. So
// the rule reads NAMES, and it is honest about which way it errs:
//
//   ACCEPTED (assumed gated) — the expression mentions a gate: `gate`,
//     `available`, `blocked`, `block`, `allowed`, `permission`, `can*`
//     (`connectGate.disabled`, `!addGate.available`, `!canPublish`). A name
//     that says "gate" and is not one is a lie this rule cannot detect, and
//     that is the FALSE NEGATIVE it accepts on purpose.
//   ACCEPTED (transient) — `busy`, `submitting`, `pending`, `loading`,
//     `saving`, `uploading`, `sending`. These are not gates: the control comes
//     back on its own in a moment, the spinner beside it is the explanation,
//     and demanding a written reason for "the request is in flight" is how a
//     rule earns a blanket disable.
//   ACCEPTED (pass-through) — `props.disabled` / a destructured `disabled`
//     forwarded straight down. The reason belongs to whoever passed it; this
//     component is plumbing. Fifteen sites in attributes-react are exactly
//     this shape.
//   ACCEPTED (declared) — a non-empty `data-disabled-reason="…"` on the same
//     element, mirroring the `data-analytics="none"` + reason escape hatch
//     `clickable-needs-event` already established. Not a bypass: it turns an
//     invisible decision into a greppable one.
//   REPORTED — everything else, including `disabled={left > 0}` (a resend
//     countdown, whose reason usually IS on the page next to it) and
//     `disabled={!name.trim()}` (form validity). Those are the FALSE POSITIVES
//     the shape produces, and they are cheap to answer: either the reason is
//     already beside the control, in which case say so with
//     `data-disabled-reason`, or it is not, in which case the rule was right.
//
// `disabled` with no value (`<Button disabled>`) and `disabled={false}` are
// never reported: a permanently-disabled control is a design decision made in
// the markup, and `false` disables nothing.
//
// Scope: `src/default/**`, controls only (`Button` and friends). A disabled
// INPUT inside a form the whole of which is disabled is a different shape with
// a different answer, and lumping them together would double the noise for
// none of the signal.
import {
  getAttr,
  attrStringValue,
  jsxElementName,
  normalizedFilename,
  isDefaultSkin,
} from "../lib/jsx.js";

const DEFAULT_COMPONENTS = ["Button", "button", "Button.Group", "IconButton"];
const GATE_RE =
  /(?:gate|Gate|availab|Availab|block|Block|allowed|Allowed|permission|Permission|entitle|quota|\bcan[A-Z]|Can[A-Z])/;
const TRANSIENT_RE = /(?:busy|submitting|pending|loading|saving|uploading|sending|inflight|isMutating)/i;
const PASSTHROUGH_RE = /^(?:props\.)?disabled$/;

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow a Button disabled by a bare boolean in a default skin; disable through an ActionAvailability gate and show the reason beside the control (GatedControl).",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Control component names this rule inspects. */
          components: { type: "array", items: { type: "string" } },
          /** Extra regex source for expressions that carry a reason. */
          gatePattern: { type: "string" },
          /** Extra regex source for transient/in-flight state. */
          transientPattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      booleanDisabled:
        'Bare boolean `disabled={{{source}}}` on <{{name}}>. The person sees a grey button and cannot tell whether they lack a permission, hit a limit, or the page is still loading — the reason was thrown away before it reached this component. Disable through a gate instead: `ActionAvailability` from "@stapel/core" ({available:true} | {available:false, block:{code, params, cause}}) has no way to spell "disabled for unknown reasons", and <GatedButton gate={gate}> / <GatedControl gate={gate}>{bind => …} renders that block\'s localized reason beside the control, with aria-describedby wired to it (never in a tooltip — a disabled antd Button never fires the events a tooltip needs). If the reason is already on the page next to this button, say so with `data-disabled-reason="…"`. Transient state (busy/submitting/loading) and a forwarded `props.disabled` are not reported.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const components = new Set(options.components ?? DEFAULT_COMPONENTS);
    const gateRe = options.gatePattern ? new RegExp(options.gatePattern) : GATE_RE;
    const transientRe = options.transientPattern
      ? new RegExp(options.transientPattern, "i")
      : TRANSIENT_RE;
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      JSXOpeningElement(node) {
        const name = jsxElementName(node);
        if (!name || !components.has(name)) return;

        const attr = getAttr(node, "disabled");
        if (!attr) return;
        // `<Button disabled>` — a decision made in the markup, not a boolean
        // that ate a reason.
        if (attr.value == null) return;
        if (attr.value.type !== "JSXExpressionContainer") return;
        const expression = attr.value.expression;
        if (expression.type === "JSXEmptyExpression") return;
        // `disabled={false}` disables nothing.
        if (expression.type === "Literal" && expression.value === false) return;

        // The declared-reason escape hatch.
        const reason = getAttr(node, "data-disabled-reason");
        if (reason) {
          const value = attrStringValue(reason);
          // Dynamic reason (an i18n call) counts; an EMPTY literal does not.
          if (value === undefined || (typeof value === "string" && value.trim() !== "")) {
            return;
          }
        }

        const source = sourceCode.getText(expression);
        if (gateRe.test(source)) return;
        if (transientRe.test(source)) return;
        if (PASSTHROUGH_RE.test(source.replace(/\s+/g, ""))) return;
        // `props.disabled === true` / `disabled === true` — still plumbing.
        if (/^(?:props\.)?disabled===(?:true|false)$/.test(source.replace(/\s+/g, ""))) {
          return;
        }

        context.report({
          node: attr,
          messageId: "booleanDisabled",
          data: { name, source: source.length > 40 ? `${source.slice(0, 40)}…` : source },
        });
      },
    };
  },
};
