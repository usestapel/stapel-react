// stapel/no-tooltip-in-skin — a hover is not a place to keep an explanation.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// Owner directive: the default skins have NO tooltips. An icon is either
// self-evident (and carries an `aria-label` for the people who cannot see it —
// that is `icon-button-needs-label`'s job) or it is not an icon, it is a
// button with a word on it. Anything that needs a sentence gets that sentence
// ON THE PAGE, beside the control, where a thumb can read it.
//
// ── WHY, in the order the reasons actually bite ─────────────────────────────
//
// 1. TOUCH HAS NO HOVER. Every phone and every tablet — which is where these
//    skins are used first (mobile-first is the house rule) — simply never
//    shows the text. On antd a `Tooltip` opens on tap only if the child has no
//    other tap behaviour; on a Button it does not open at all. So the
//    explanation exists in the source, passes review, and is invisible to the
//    majority of the audience. That is worse than no explanation: it is an
//    explanation nobody will ever ask for again, because it is "already there".
// 2. IT IS WHERE DISABLED-CONTROL REASONS GO TO DIE. The recurring shape is
//    `<Tooltip title="You can't do this because…"><Button disabled/></Tooltip>`,
//    and on antd a disabled Button does not even fire the pointer events the
//    tooltip needs — the one case where the text matters most is the one case
//    it is guaranteed not to render. The reason belongs beside the control:
//    `<GatedButton gate={gate}>` (`<GatedControl gate={gate}>{bind => …}` for
//    a non-Button control) renders the block's localized reason as ordinary
//    page content and points the control's `aria-describedby` at it.
// 3. A `title=` STRING PROP IS THE SAME BUG, SPELLED SHORTER. `title="Delete"`
//    on a Button is a native browser tooltip: same hover requirement, no
//    styling, no i18n path through the pair's bundle in most cases, and
//    screen readers treat it inconsistently (some announce it, some announce
//    it INSTEAD of the label, some ignore it). If it is a label, it is
//    `aria-label`. If it is an explanation, it is page content.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
//
// `src/default/**` only — same scope, and the same reasoning, as
// no-bare-dialog: host chrome is the host's, and the headless layer renders no
// chrome. `title` is checked only on components where it IS a hover string
// (Button, Tag, Avatar, an anchor, a bare element…). It is NOT checked on the
// many antd components where `title` is CONTENT — Card, Modal, Drawer,
// SkinDialog, Collapse.Panel, Table.Column, Descriptions, List.Item.Meta,
// Result, Statistic, Alert, Tabs.TabPane, Steps.Step, Timeline.Item — because
// there `title` is the heading, not a hover, and flagging it would be a false
// positive on almost every screen in the fleet. The list is an option, so a
// codebase with its own components can extend it either way.
import { isDefaultSkin, jsxElementName, normalizedFilename } from "../lib/jsx.js";

const TOOLTIP_COMPONENTS = ["Tooltip", "Popover", "Tour"];

/**
 * Components whose `title` prop is a HOVER STRING. Deliberately a short,
 * explicit list rather than "everything except the known-content ones":
 * a rule that guesses fires on the guess.
 */
const HOVER_TITLE_COMPONENTS = [
  "Button",
  "button",
  "a",
  "Tag",
  "Avatar",
  "Badge",
  "Switch",
  "Progress",
  "Image",
  "img",
  "span",
  "div",
  "i",
  "svg",
  "Typography.Text",
  "Typography.Link",
  "Typography.Paragraph",
  "Text",
  "Link",
];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow antd Tooltip/Popover and hover-only `title` strings in default skins; an explanation belongs beside the control (GatedControl), not in a hover a touch device never shows.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Hover-surface component names (default Tooltip/Popover/Tour). */
          components: { type: "array", items: { type: "string" } },
          /** Components whose `title` prop is a hover string, not content. */
          titleComponents: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooltip:
        '`{{name}}` in a default skin. Touch has no hover: on a phone this text never appears, and on a disabled antd Button it never appears anywhere (a disabled control swallows the pointer events the tooltip listens for) — which is exactly the case where the text mattered. Put the sentence on the page beside the control: <GatedButton gate={gate}> (or <GatedControl gate={gate}>{bind => …}) from "@stapel/tokens-antd/skin" renders the block\'s localized reason as ordinary content and wires the control\'s aria-describedby to it. An icon that needs no sentence needs an `aria-label`, not a tooltip.',
      hoverTitle:
        '`title="…"` on `<{{name}}>` is a browser tooltip — the same hover-only text as an antd Tooltip, with no styling and inconsistent screen-reader behaviour (some announce it INSTEAD of the label). If it names the control, use `aria-label` (via an i18n key). If it explains why the control is the way it is, render it beside the control with <GatedButton gate={…}> / <GatedControl gate={…}>. Components where `title` is CONTENT (Card, SkinDialog, Collapse.Panel, Table columns, …) are not flagged; extend `titleComponents` if this one is a hover in your codebase.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const hoverNames = new Set(options.components ?? TOOLTIP_COMPONENTS);
    const titleNames = new Set(options.titleComponents ?? HOVER_TITLE_COMPONENTS);

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "antd") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          if (hoverNames.has(name)) {
            context.report({ node: specifier, messageId: "tooltip", data: { name } });
          }
        }
      },
      JSXOpeningElement(node) {
        const name = jsxElementName(node);
        if (!name) return;
        // The element itself is a hover surface. Reported in ADDITION to the
        // import (a re-exported or locally-defined Tooltip has no antd import
        // to catch, and the import alone does not say where it is used).
        if (hoverNames.has(name)) {
          context.report({ node: node.name, messageId: "tooltip", data: { name } });
          return;
        }
        if (!titleNames.has(name)) return;
        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (attr.name?.type !== "JSXIdentifier" || attr.name.name !== "title") continue;
          // `title` with no value is meaningless; anything else — literal or
          // expression — is a hover string this component should not have.
          if (attr.value == null) continue;
          context.report({ node: attr, messageId: "hoverTitle", data: { name } });
        }
      },
    };
  },
};
