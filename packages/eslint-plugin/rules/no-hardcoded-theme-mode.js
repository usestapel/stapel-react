// stapel/no-hardcoded-theme-mode — the theme has one source, and it is the
// document.
//
// ── THE DEFECT THIS RULE ENCODES (coordinator finding CF-1, 2026-08-24) ─────
//
//   packages/auth-react/src/default/AuthPanel.tsx:172
//     const { mode = "light", … } = props;
//
// Three lines like that (AuthPanel + FirstLoginPanels ×2) mean the auth skin
// renders LIGHT inputs, LIGHT buttons and near-invisible headings inside
// `<html data-theme="dark">`. It is not a race and not a viewer artefact: it
// was reproduced with `data-theme` set BEFORE first render. The default IS the
// bug — a component that has to guess a theme has already lost, because the
// answer is not the component's to give. The document declares the mode
// (`data-theme`, the attribute `tokens.css` keys its dark block on) and every
// skin reads it.
//
// A literal in `toAntdThemeConfig("light")` is the same defect one call deeper:
// the antd bridge then emits a full light token set into a dark page, which is
// how a heading ended up at 1.00:1 against its own background.
//
// ── WHAT TO WRITE INSTEAD ───────────────────────────────────────────────────
//
//   const mode = useThemeMode();                     // reactive, from the document
//   <SkinTheme mode={props.mode}>{children}</SkinTheme>   // mode OPTIONAL
//
// `useThemeMode()` (`@stapel/tokens-antd/skin`) subscribes to `data-theme`
// through `useSyncExternalStore` + a `MutationObserver`, so a runtime theme
// toggle repaints already-mounted skins — the second half of CF-1, where
// `resolveThemeMode()` is read once per render and never again. `props.mode`
// stays supported for a host that wants to PIN a side; it just cannot have a
// hardcoded fallback, because a fallback is a decision and the document has
// already made it.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
//
// `src/default/**` — the skins. A host app pinning its own theme is the host's
// business, and the shared layer (`@stapel/tokens-antd`) is where the literals
// legitimately live (it is the code that maps a mode to a token set); neither
// is under a pair's `src/default/`.
import { isDefaultSkin, normalizedFilename } from "../lib/jsx.js";

const DEFAULT_PROP_NAMES = ["mode", "themeMode", "colorMode", "theme"];
const DEFAULT_MODE_VALUES = ["light", "dark"];
const DEFAULT_THEME_CALLS = ["toAntdThemeConfig", "toAntdTheme", "toMuiTheme"];
/**
 * The NON-REACTIVE read. `resolveThemeMode()` answers "what does the document
 * say right now" once, at render time, and never again — so a host that flips
 * `data-theme` at runtime (shell-react's ThemeModeControl does exactly that)
 * leaves every already-mounted skin on the old side until something unrelated
 * re-renders it. That is the second half of CF-1, and the reason the showcase's
 * dark toggle is a paper feature. `useThemeMode()` is the same answer through
 * `useSyncExternalStore` + a `MutationObserver`, which is a subscription.
 */
const DEFAULT_STALE_CALLS = ["resolveThemeMode"];

function isModeLiteral(node, values) {
  return node?.type === "Literal" && values.has(node.value);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow hardcoded theme-mode defaults (`mode = "light"`) and literal mode arguments in default skins; the mode comes from the document via useThemeMode()/SkinTheme.',
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Prop/variable names that carry a theme mode. */
          propNames: { type: "array", items: { type: "string" } },
          /** Literal values that ARE a theme mode. */
          modeValues: { type: "array", items: { type: "string" } },
          /** Theme-bridge calls whose first argument is a mode. */
          themeFunctions: { type: "array", items: { type: "string" } },
          /** Non-reactive document reads (default `["resolveThemeMode"]`). */
          staleModeFunctions: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcodedDefault:
        'Hardcoded theme mode: `{{name}} = "{{value}}"`. A skin that defaults to a side renders that side inside the other one — this exact line rendered light inputs and an invisible heading under <html data-theme="dark"> (CF-1). The document owns the mode: `const {{name}} = props.{{name}} ?? useThemeMode();` from "@stapel/tokens-antd/skin", or drop the prop entirely and wrap in <SkinTheme>. useThemeMode() is reactive (useSyncExternalStore over a MutationObserver on data-theme), so a runtime toggle repaints an already-mounted skin — which resolveThemeMode(), read once per render, does not.',
      hardcodedFallback:
        'Hardcoded theme-mode fallback `?? "{{value}}"`. Same defect as a destructuring default: the fallback is a decision, and the document has already made it. Use `?? useThemeMode()` (@stapel/tokens-antd/skin).',
      staleModeRead:
        '`{{name}}()` reads the document mode ONCE, at render time. A host that flips `data-theme` at runtime — shell-react ships a control that does — leaves this skin on the old side until something unrelated re-renders it, which is why the showcase\'s dark toggle looks like a paper feature. Use `useThemeMode()` from "@stapel/tokens-antd/skin": same answer, delivered through useSyncExternalStore over a MutationObserver, so the component is SUBSCRIBED to the mode instead of having sampled it. (`resolveThemeMode()` stays correct outside React — in a non-hook helper or a test.)',
      literalArgument:
        '`{{name}}("{{value}}")` in a default skin pins the antd token bridge to one side, emitting a full {{value}} token set into a page that may be the other one (a heading at 1.00:1 against its own background is how this was found). Pass the mode you read from the document: `{{name}}(useThemeMode())`, or let <SkinTheme> build the ConfigProvider for you — that is the one place the literal legitimately lives.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const propNames = new Set(options.propNames ?? DEFAULT_PROP_NAMES);
    const modeValues = new Set(options.modeValues ?? DEFAULT_MODE_VALUES);
    const themeFunctions = new Set(options.themeFunctions ?? DEFAULT_THEME_CALLS);
    const staleFunctions = new Set(options.staleModeFunctions ?? DEFAULT_STALE_CALLS);

    /** `{ mode = "light" }` in a destructuring pattern or a parameter. */
    function checkPattern(node) {
      if (node.left?.type !== "Identifier") return;
      if (!propNames.has(node.left.name)) return;
      if (!isModeLiteral(node.right, modeValues)) return;
      context.report({
        node,
        messageId: "hardcodedDefault",
        data: { name: node.left.name, value: node.right.value },
      });
    }

    return {
      // `const { mode = "light" } = props` / `function X({ mode = "light" })`
      "ObjectPattern > Property > AssignmentPattern": checkPattern,
      // `function X(mode = "light")` — the same decision, positionally.
      "FunctionDeclaration > AssignmentPattern": checkPattern,
      "ArrowFunctionExpression > AssignmentPattern": checkPattern,
      "FunctionExpression > AssignmentPattern": checkPattern,
      // `props.mode ?? "light"` / `props.mode || "dark"`
      LogicalExpression(node) {
        if (node.operator !== "??" && node.operator !== "||") return;
        if (!isModeLiteral(node.right, modeValues)) return;
        // Only when the left side is plausibly the mode — otherwise every
        // `x ?? "light"` in the file would be a finding.
        const left = node.left;
        const leftName =
          left.type === "Identifier"
            ? left.name
            : left.type === "MemberExpression" && left.property.type === "Identifier"
              ? left.property.name
              : null;
        if (!leftName || !propNames.has(leftName)) return;
        context.report({
          node,
          messageId: "hardcodedFallback",
          data: { value: node.right.value },
        });
      },
      // `toAntdThemeConfig("light")`
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" && callee.property.type === "Identifier"
              ? callee.property.name
              : null;
        if (!name) return;
        if (staleFunctions.has(name)) {
          context.report({ node, messageId: "staleModeRead", data: { name } });
          return;
        }
        if (!themeFunctions.has(name)) return;
        const first = node.arguments[0];
        if (!isModeLiteral(first, modeValues)) return;
        context.report({
          node: first,
          messageId: "literalArgument",
          data: { name, value: first.value },
        });
      },
    };
  },
};
