// stapel/icon-button-needs-label — an icon-only control must say its name.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// A Button (or an anchor, or a bare `<button>`) whose visible content is ONLY
// an icon has no accessible name. To a screen reader it is announced as
// "button" — or, on antd, as the icon component's own empty text node, which
// is nothing at all. Voice control ("click Delete") cannot address it. A
// magnifier user sees a glyph with no caption. The fix is one attribute:
// `aria-label={t(KEYS.something)}`.
//
// This is the OTHER half of the tooltip ruling. `no-tooltip-in-skin` removes
// the hover text; the deal was "icons are self-evident + aria-label", and
// removing the hover without adding the label would leave the control with no
// name at all. The two rules are a pair and were written in the same release
// on purpose.
//
// ── HOW "ICON-ONLY" IS DECIDED (syntactically, always) ──────────────────────
//
//   <Button icon={<DeleteOutlined/>} />              → icon-only (no children)
//   <Button icon={<DeleteOutlined/>}>{" "}</Button>  → icon-only (whitespace)
//   <Button icon={<DeleteOutlined/>}>Delete</Button> → NOT (has a text child)
//   <Button icon={<DeleteOutlined/>}>{t(K.del)}</Button> → NOT (expression child)
//   <button><TrashIcon/></button>                    → icon-only (only child is
//                                                      an icon-shaped element)
//   <button><TrashIcon/> Delete</button>             → NOT
//
// "Icon-shaped element" is a NAME test: `DeleteOutlined`/`CheckCircleFilled`
// (antd's suffix convention), `*Icon`/`Icon*`, or `<svg>`. A component whose
// name says nothing about icons is assumed to render content and is left
// alone — this rule reports absence, and absence is the one thing a guess
// must not be made about.
//
// ── WHAT COUNTS AS A LABEL ──────────────────────────────────────────────────
//
// `aria-label`, `aria-labelledby`, or `title` — and `title` counts here ONLY
// so this rule does not contradict itself on a file where `no-tooltip-in-skin`
// is switched off. Inside `src/default/**` the two rules together say: not a
// tooltip, and not nothing; an `aria-label`. A spread (`{...props}`) is
// treated as "might carry the label" and the element is skipped: reporting on
// an element whose attributes are unknowable would be a guess.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
//
// NOT scoped to `src/default/**`. An unnamed icon button is broken in a host
// app, in a demo, and in the shell exactly as much as it is in a skin, and
// unlike the dialog surface there is no legitimate variant of it. Tests and
// fixtures are carved out by the preset.
import {
  getAttr,
  hasSpread,
  jsxElementBaseName,
  jsxElementName,
  significantChildren,
} from "../lib/jsx.js";

const DEFAULT_COMPONENTS = ["Button", "button", "a", "IconButton", "Button.Link"];
const DEFAULT_LABEL_ATTRS = ["aria-label", "aria-labelledby", "title"];
const ICON_NAME_RE = /(?:^Icon|Icon$|Outlined$|Filled$|TwoTone$)/;

/** True when a JSX child element's NAME says it is an icon. */
function isIconElement(child, iconRe) {
  if (child.type !== "JSXElement") return false;
  const name = jsxElementName(child.openingElement);
  if (!name) return false;
  if (name === "svg" || name === "Icon") return true;
  const base = jsxElementBaseName(child.openingElement);
  return iconRe.test(base ?? "");
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an accessible name (aria-label) on a button or anchor whose only content is an icon.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Element names treated as controls (default Button/button/a/IconButton). */
          components: { type: "array", items: { type: "string" } },
          /** Attributes that count as an accessible name. */
          labelAttributes: { type: "array", items: { type: "string" } },
          /** Extra regex source matching icon component names. */
          iconNamePattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      needsLabel:
        'Icon-only `<{{name}}>` with no accessible name. A screen reader announces it as "button", voice control cannot address it, and the glyph captions nothing. Add `aria-label={t(<PAIR>_I18N_KEYS.<action>)}` — an i18n key, never a literal (stapel/no-hardcoded-text guards that half). Do NOT reach for a `title` tooltip instead: touch has no hover, and a disabled control never fires the events it needs (stapel/no-tooltip-in-skin). If the button is meant to have visible text, give it a text child and this rule goes quiet.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const components = new Set(options.components ?? DEFAULT_COMPONENTS);
    const labelAttrs = options.labelAttributes ?? DEFAULT_LABEL_ATTRS;
    const iconRe = options.iconNamePattern
      ? new RegExp(options.iconNamePattern)
      : ICON_NAME_RE;

    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const name = jsxElementName(opening);
        if (!name || !components.has(name)) return;
        // A spread might carry the label; "might" is not a finding.
        if (hasSpread(opening)) return;
        if (labelAttrs.some((a) => getAttr(opening, a) != null)) return;
        // `aria-hidden` says the element is out of the accessibility tree
        // entirely — naming it would be the contradiction.
        if (getAttr(opening, "aria-hidden") != null) return;

        const children = significantChildren(node);
        const iconProp = getAttr(opening, "icon");
        const iconOnly =
          (iconProp != null && children.length === 0) ||
          (children.length > 0 && children.every((c) => isIconElement(c, iconRe)));
        if (!iconOnly) return;

        context.report({ node: opening.name, messageId: "needsLabel", data: { name } });
      },
    };
  },
};
