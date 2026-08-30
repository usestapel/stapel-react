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
// TWO scopes, because the defect has two shapes and they do not live in the
// same files.
//
// 1. The DECLARATION shapes — a prop default, a `??` fallback, a literal
//    argument to the antd/MUI bridge, a sampled `resolveThemeMode()` — stay
//    scoped to `src/default/**`, the skins. The shared layer
//    (`@stapel/tokens-antd`) is where those literals legitimately live (it is
//    the code that maps a mode to a token set), and a headless module renders
//    no chrome at all.
//
// 2. The CALL-SITE shape — `<PublicShell mode="light"/>` — is an error
//    EVERYWHERE (0.13.0). It was not, and that is how a storefront shipped a
//    dark theme nobody could reach: a client storefront's shell component pinned
//    `mode="light"` on the shell, in a host app, outside every grid this rule
//    scanned. A skin that reads the document correctly and a host that
//    overrides it with a literal render exactly the same wrong page, so the
//    guardrail cannot stop at the library boundary. Pinning a side is still
//    legitimate in the places that EXIST to show both sides — demos, stories,
//    tests — and those are carved out here in the rule (not only in the
//    preset), so a consumer who never spreads our config still gets the same
//    answer.
import { isDefaultSkin, isTestPath, normalizedFilename, attrName, attrStringValue } from "../lib/jsx.js";

const DEFAULT_PROP_NAMES = ["mode", "themeMode", "colorMode", "theme"];
/**
 * The JSX attributes that carry a theme mode at a CALL SITE. Deliberately
 * WITHOUT `theme`: antd's own `<Menu theme="dark">`/`<Layout.Sider theme>` is a
 * vendor API with the same name and a different meaning, and a rule that
 * flagged it would be switched off in the files that render chrome.
 */
const DEFAULT_JSX_MODE_ATTRS = ["mode", "themeMode", "colorMode"];
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

/**
 * Files whose JOB is to pin a side: a demo shows light beside dark, a story is
 * a demo the viewer renders, a test asserts on both. `isTestPath` covers the
 * third; these two patterns cover the first two.
 */
function isDemoOrStory(path) {
  return (
    /\/demos?\//.test(path) ||
    /\.demo\.[cm]?[jt]sx?$/.test(path) ||
    /\.stories\.[cm]?[jt]sx?$/.test(path)
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow hardcoded theme-mode defaults (`mode = "light"`) and literal mode arguments in default skins, and a literal `mode="light"`/`themeMode`/`colorMode` JSX attribute in ANY source file; the mode comes from the document via useThemeMode()/SkinTheme.',
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Prop/variable names that carry a theme mode. */
          propNames: { type: "array", items: { type: "string" } },
          /** JSX attribute names that carry a theme mode at a call site. */
          jsxModeAttributes: { type: "array", items: { type: "string" } },
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
      literalJsxMode:
        '`<{{element}} {{name}}="{{value}}"/>` pins this subtree to one side of the theme. A skin that reads the document correctly and a call site that overrides it with a literal render the same wrong page — a storefront shipped with `mode="light"` on its shell had a dark theme in every token file and no way to reach it. Drop the attribute and let <SkinTheme> follow `data-theme`, or pass the mode down (`{{name}}={props.{{name}}}` / `{{name}}={useThemeMode()}` from "@stapel/tokens-antd/skin"). Demos, stories and tests legitimately pin a side and are exempt.',
      literalArgument:
        '`{{name}}("{{value}}")` in a default skin pins the antd token bridge to one side, emitting a full {{value}} token set into a page that may be the other one (a heading at 1.00:1 against its own background is how this was found). Pass the mode you read from the document: `{{name}}(useThemeMode())`, or let <SkinTheme> build the ConfigProvider for you — that is the one place the literal legitimately lives.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);

    const options = context.options[0] ?? {};
    const propNames = new Set(options.propNames ?? DEFAULT_PROP_NAMES);
    const modeValues = new Set(options.modeValues ?? DEFAULT_MODE_VALUES);
    const themeFunctions = new Set(options.themeFunctions ?? DEFAULT_THEME_CALLS);
    const staleFunctions = new Set(options.staleModeFunctions ?? DEFAULT_STALE_CALLS);
    const jsxModeAttributes = new Set(
      options.jsxModeAttributes ?? DEFAULT_JSX_MODE_ATTRS,
    );

    // The CALL-SITE half: every file, minus the ones whose job is to pin a
    // side. `<Foo mode="light"/>` in a host app is the same rendered defect as
    // a skin's own default, which is why this half is not scoped to the skins.
    const callSiteVisitors =
      isTestPath(path) || isDemoOrStory(path)
        ? {}
        : {
            JSXAttribute(node) {
              const name = attrName(node);
              if (!name || !jsxModeAttributes.has(name)) return;
              const value = attrStringValue(node);
              if (typeof value !== "string" || !modeValues.has(value)) return;
              const element = node.parent?.name;
              const elementName =
                element?.type === "JSXIdentifier" ? element.name : "element";
              context.report({
                node,
                messageId: "literalJsxMode",
                data: { element: elementName, name, value },
              });
            },
          };

    if (!isDefaultSkin(path)) return callSiteVisitors;

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
      ...callSiteVisitors,
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
