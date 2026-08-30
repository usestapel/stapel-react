import rule from "../rules/no-hardcoded-theme-mode.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/auth-react/src/default/AuthPanel.tsx";
const HEADLESS = "/repo/packages/auth-react/src/headless/AuthProvider.tsx";
const SHARED = "/repo/packages/tokens-antd/src/skin.tsx";
/** A host app — the grid this rule did not scan until 0.13.0. */
const HOST = "/app/src/shell/StorefrontShell.tsx";
const DEMO = "/repo/packages/shell-react/demo/PublicShell.demo.tsx";
const STORY = "/repo/packages/shell-react/demo/generated/PublicShell.stories.tsx";
const TEST = "/repo/packages/shell-react/test/PublicShell.test.tsx";

tester.run("no-hardcoded-theme-mode", rule, {
  valid: [
    // The sanctioned shape: the document owns the mode, read reactively.
    { filename: SKIN, code: "const mode = props.mode ?? useThemeMode();" },
    { filename: SKIN, code: "const theme = toAntdThemeConfig(useThemeMode());" },
    { filename: SKIN, code: 'const A = () => <SkinTheme mode={props.mode}>{c}</SkinTheme>;' },
    // A prop with no default is fine — the default is the whole defect.
    { filename: SKIN, code: "const { mode } = props;" },
    // Some other prop that happens to default to a string is not a theme mode.
    { filename: SKIN, code: 'const { variant = "light" } = props;' },
    // A mode-shaped default outside a skin: the shared layer is where the
    // literals legitimately live (it is the code that maps a mode to tokens),
    // and a headless module renders no chrome at all.
    { filename: SHARED, code: 'const { mode = "light" } = props;' },
    { filename: HEADLESS, code: 'const { mode = "light" } = props;' },
    // A fallback whose left side is not the mode.
    { filename: SKIN, code: 'const label = props.label ?? "light";' },
  ],
  invalid: [
    {
      // The exact line from AuthPanel.tsx:172 (CF-1).
      filename: SKIN,
      code: 'const { mode = "light", variant = "login" } = props;',
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      // Dark is not better than light — it is the same decision, mirrored.
      filename: SKIN,
      code: 'const { themeMode = "dark" } = props;',
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      // As a parameter default, destructured.
      filename: SKIN,
      code: 'function Panel({ mode = "light" }) { return mode; }',
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      // As a positional parameter default.
      filename: SKIN,
      code: 'function themeFor(mode = "light") { return mode; }',
      errors: [{ messageId: "hardcodedDefault" }],
    },
    {
      filename: SKIN,
      code: 'const mode = props.mode ?? "light";',
      errors: [{ messageId: "hardcodedFallback" }],
    },
    {
      filename: SKIN,
      code: 'const mode = mode || "dark";',
      errors: [{ messageId: "hardcodedFallback" }],
    },
    {
      // One call deeper: a full light token set emitted into a dark page.
      filename: SKIN,
      code: 'const theme = toAntdThemeConfig("light");',
      errors: [{ messageId: "literalArgument" }],
    },
    {
      filename: SKIN,
      code: 'const token = tokens.toAntdTheme("dark");',
      errors: [{ messageId: "literalArgument" }],
    },
    {
      // Both halves of the CF-1 shape in one component.
      filename: SKIN,
      code: 'const { mode = "light" } = props;\nconst t = toAntdThemeConfig("light");',
      errors: [{ messageId: "hardcodedDefault" }, { messageId: "literalArgument" }],
    },
  ],
});

// ── The CALL SITE (0.13.0) ───────────────────────────────────────────────────
//
// `<StorefrontShell mode="light"/>` in a host app: outside `src/default/**`,
// outside every grid the rule scanned, and the reason a storefront with dark
// tokens in both brand files shipped with no way to reach them.
tester.run("no-hardcoded-theme-mode — literal JSX mode", rule, {
  valid: [
    // The two sanctioned call sites: pass it down, or read the document.
    { filename: HOST, code: "const A = () => <PublicShell mode={props.mode} />;" },
    { filename: HOST, code: "const A = () => <PublicShell mode={useThemeMode()} />;" },
    // Omitting it entirely is the normal case — SkinTheme follows data-theme.
    { filename: HOST, code: "const A = () => <PublicShell nav={nav} />;" },
    // A `mode` that is not a theme mode.
    { filename: HOST, code: 'const A = () => <Editor mode="markdown" />;' },
    // antd's own `theme` prop is a vendor API with the same name and another
    // meaning — flagging it would switch this rule off in every chrome file.
    { filename: HOST, code: 'const A = () => <Layout.Sider theme="dark" />;' },
    // The files whose JOB is to pin a side. Carved out in the RULE, not only
    // in the preset, so a consumer with its own config gets the same answer.
    { filename: DEMO, code: 'const A = () => <PublicShell mode="light" />;' },
    { filename: STORY, code: 'const A = () => <PublicShell mode="dark" />;' },
    { filename: TEST, code: 'const A = () => <PublicShell mode="light" />;' },
  ],
  invalid: [
    {
      // The client-storefront line, verbatim in shape.
      filename: HOST,
      code: 'const A = () => <StorefrontShell mode="light" />;',
      errors: [{ messageId: "literalJsxMode" }],
    },
    {
      // Braced literal is the same literal.
      filename: HOST,
      code: 'const A = () => <StorefrontShell mode={"dark"} />;',
      errors: [{ messageId: "literalJsxMode" }],
    },
    {
      filename: HOST,
      code: 'const A = () => <ThemedPanel themeMode="dark" />;',
      errors: [{ messageId: "literalJsxMode" }],
    },
    {
      filename: HOST,
      code: 'const A = () => <ThemedPanel colorMode="light" />;',
      errors: [{ messageId: "literalJsxMode" }],
    },
    {
      // Inside a skin BOTH halves are live — the call-site check is added to
      // the declaration checks, not swapped for them.
      filename: SKIN,
      code: 'const { mode = "light" } = props;\nconst A = () => <SkinTheme mode="light" />;',
      errors: [{ messageId: "hardcodedDefault" }, { messageId: "literalJsxMode" }],
    },
    {
      // A pair's headless layer is a call site too.
      filename: HEADLESS,
      code: 'const A = () => <SkinTheme mode="dark">{c}</SkinTheme>;',
      errors: [{ messageId: "literalJsxMode" }],
    },
  ],
});

// ── The non-reactive read (CF-1, second half) ────────────────────────────────
tester.run("no-hardcoded-theme-mode — resolveThemeMode", rule, {
  valid: [
    { filename: SKIN, code: "const mode = useThemeMode();" },
    // Outside a skin the sampled read is still correct (a helper, a test).
    { filename: SHARED, code: "const mode = resolveThemeMode();" },
    { filename: HEADLESS, code: "const mode = resolveThemeMode();" },
  ],
  invalid: [
    {
      // Correct the day it is written, stale the moment the host toggles.
      filename: SKIN,
      code: "const mode = props.mode ?? resolveThemeMode();",
      errors: [{ messageId: "staleModeRead" }],
    },
    {
      filename: SKIN,
      code: "const theme = toAntdThemeConfig(resolveThemeMode());",
      errors: [{ messageId: "staleModeRead" }],
    },
  ],
});
