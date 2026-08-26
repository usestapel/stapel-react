// stapel/antd-alert-title — antd 6 renamed `<Alert message>` to `<Alert title>`.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// This one states no doctrine. It is a MECHANICAL DEPRECATION: antd 6
// deprecates `Alert`'s `message` prop in favour of `title`, and a prop that a
// major version stops reading does not fail loudly — it renders an alert with
// no heading, which is the one component whose whole job is to be read. Every
// site is a rename, and a rename is exactly what a codemod-shaped lint rule is
// for, so this ships autofixable and at ERROR (nothing to migrate to, nothing
// to argue about, no worklist tier).
//
//   <Alert message={t("…")} type="error" />   →   <Alert title={t("…")} … />
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
//
// It fires only on an `Alert` that is IMPORTED FROM ANTD in this file (a named
// specifier, aliased or not, or a namespace import used as `antd.Alert`). A
// local `<Alert>` of your own, or one re-exported from a design system that
// still takes `message`, is not antd's and is not renamed under your feet.
//
// It reports but does NOT fix when the element already carries an explicit
// `title` — renaming there would emit the same prop twice, and React silently
// keeps the last one, so an autofix would pick the winner by source order. The
// person who wrote both is the one who knows which is the heading.
//
// A spread (`{...props}`) does not block the fix: the explicit `message` is
// unambiguous, and the alternative — leaving it — keeps a prop antd no longer
// reads.
import { jsxElementName } from "../lib/jsx.js";

const ANTD_MODULE = "antd";

/** antd components whose `message` prop became `title` in v6. */
const DEFAULT_COMPONENTS = ["Alert"];

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Rename antd Alert's deprecated `message` prop to `title` (antd 6). Autofixable — it is a rename, not a redesign.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Names imported from antd whose `message` prop is now `title`. */
          components: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      deprecatedMessage:
        "`message` on antd's `<{{name}}>` is deprecated in antd 6 — the prop is `title`. A prop a major version stops reading fails silently: the alert renders with no heading, on the one component whose entire job is to be read. This is a rename and it is autofixable.",
      deprecatedMessageWithTitle:
        "`message` on antd's `<{{name}}>` is deprecated in antd 6 (the prop is `title`), and this element already passes `title`. Not autofixed on purpose: renaming would pass the same prop twice and React would keep whichever came last — pick the heading by hand and delete the other.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const componentNames = new Set(options.components ?? DEFAULT_COMPONENTS);

    /** Local names bound to one of the antd components (`Alert`, `Alert as A`). */
    const localNames = new Set();
    /** Local names bound to antd's namespace (`import * as antd from "antd"`). */
    const namespaces = new Set();

    /** The component this element IS, or null when it is not antd's. */
    function antdComponentName(node) {
      const name = jsxElementName(node);
      if (!name) return null;
      // `<Alert>` / `<A>` — a named import, under whatever local name.
      if (localNames.has(name)) return name;
      // `<antd.Alert>` — the same component, reached through the namespace.
      // Sub-components (`Alert.ErrorBoundary`) are deliberately NOT covered:
      // they are a different props surface and this rule renames exactly the
      // prop it can name.
      const [namespace, component, ...rest] = name.split(".");
      if (component === undefined) return null;
      if (rest.length > 0) return null;
      if (!namespaces.has(namespace)) return null;
      return componentNames.has(component) ? name : null;
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== ANTD_MODULE) return;
        if (node.importKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            namespaces.add(specifier.local.name);
            continue;
          }
          if (specifier.type !== "ImportSpecifier") continue;
          if (specifier.importKind === "type") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          if (componentNames.has(name)) localNames.add(specifier.local.name);
        }
      },
      JSXOpeningElement(node) {
        const name = antdComponentName(node);
        if (!name) return;
        let messageAttr = null;
        let hasTitle = false;
        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (attr.name?.type !== "JSXIdentifier") continue;
          if (attr.name.name === "message") messageAttr = attr;
          if (attr.name.name === "title") hasTitle = true;
        }
        if (!messageAttr) return;
        if (hasTitle) {
          context.report({
            node: messageAttr.name,
            messageId: "deprecatedMessageWithTitle",
            data: { name },
          });
          return;
        }
        context.report({
          node: messageAttr.name,
          messageId: "deprecatedMessage",
          data: { name },
          fix: (fixer) => fixer.replaceText(messageAttr.name, "title"),
        });
      },
    };
  },
};
