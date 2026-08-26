import { describe, it, expect } from "vitest";
import rule from "../rules/no-raw-dimensions.js";
import { tokensModuleFor } from "../lib/jsx.js";
import { tsxTester, SCALE_SETTINGS } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/auth-react/src/default/AuthPanel.tsx";
const HEADLESS = "/repo/packages/auth-react/src/headless/AuthProvider.tsx";
const HOST = "/repo/apps/storefront/src/Header.tsx";

const s = SCALE_SETTINGS;

tester.run("no-raw-dimensions", rule, {
  valid: [
    // The sanctioned shape.
    {
      filename: SKIN,
      settings: s,
      code: "const A = () => <div style={{ padding: spacing[4] }}/>;",
    },
    {
      filename: SKIN,
      settings: s,
      code: "const A = () => <div style={{ fontSize: fontSize.xs.fontSize }}/>;",
    },
    // ZERO is a reset — the absence of a dimension, not a bad one.
    {
      filename: SKIN,
      settings: s,
      code: "const A = () => <Title style={{ margin: 0 }}/>;",
    },
    { filename: SKIN, settings: s, code: "const style = { minWidth: 0 };" },
    // A string value is not a raw number (and carries its own unit).
    {
      filename: SKIN,
      settings: s,
      code: 'const A = () => <div style={{ width: "100%" }}/>;',
    },
    // NOT a style context: a media descriptor, a grid span, a heading level.
    { filename: SKIN, settings: s, code: "const img = { width: 96, height: 96 };" },
    { filename: SKIN, settings: s, code: "const A = () => <Col span={12}/>;" },
    { filename: SKIN, settings: s, code: "const A = () => <Typography.Title level={4}/>;" },
    { filename: SKIN, settings: s, code: "const A = () => <Input.TextArea rows={4}/>;" },
    // `lineHeight` as a NUMBER is a unitless multiplier in React, not px —
    // neither a spacing value nor safely fixable, so it is never touched.
    {
      filename: SKIN,
      settings: s,
      code: "const A = () => <div style={{ lineHeight: 20 }}/>;",
    },
    // Out of scope: headless renders no chrome, a host app is the host's.
    { filename: HEADLESS, settings: s, code: "const style = { padding: 16 };" },
    { filename: HOST, settings: s, code: "const A = () => <div style={{ padding: 15 }}/>;" },
    // No catalog configured → no-op, never a crash (§2.1).
    {
      filename: SKIN,
      settings: { stapel: { scales: {} } },
      code: "const A = () => <div style={{ padding: 15 }}/>;",
    },
  ],
  invalid: [
    {
      // The autofix, with the import written too — an autofix that leaves an
      // undefined identifier turns a warning into a build error.
      filename: SKIN,
      settings: s,
      code: "const A = () => <div style={{ padding: 16 }}/>;",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const A = () => <div style={{ padding: spacing[4] }}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // An existing import of the file's token module is EXTENDED, not duplicated.
      filename: SKIN,
      settings: s,
      code:
        'import { cssVar } from "@stapel/tokens-antd";\n' +
        "const A = () => <div style={{ gap: 8 }}/>;",
      output:
        'import { cssVar, spacing } from "@stapel/tokens-antd";\n' +
        "const A = () => <div style={{ gap: spacing[2] }}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // A skin that still imports the LEGACY module gets a tokens-antd import
      // of its own — the whole point of the module split. Extending the
      // `@stapel/tokens` line instead would deepen a dependency the pair
      // does not declare.
      filename: SKIN,
      settings: s,
      code:
        'import { cssVar } from "@stapel/tokens";\n' +
        "const A = () => <div style={{ gap: 8 }}/>;",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        'import { cssVar } from "@stapel/tokens";\n' +
        "const A = () => <div style={{ gap: spacing[2] }}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // …but a binding the legacy module ALREADY provides is not imported a
      // second time: two `spacing` declarations is a syntax error, produced
      // by an autofix, which is the worst way to learn about a module split.
      filename: SKIN,
      settings: s,
      code:
        'import { spacing } from "@stapel/tokens";\n' +
        "const A = () => <div style={{ gap: 8 }}/>;",
      output:
        'import { spacing } from "@stapel/tokens";\n' +
        "const A = () => <div style={{ gap: spacing[2] }}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // Already imported → the value is rewritten and the import left alone.
      filename: SKIN,
      settings: s,
      code:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const A = () => <div style={{ marginTop: 24 }}/>;",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const A = () => <div style={{ marginTop: spacing[5] }}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // Corners come from `radii`, not from `spacing` — 8 is on both scales
      // and the KEY is what decides.
      filename: SKIN,
      settings: s,
      code: 'import { spacing } from "@stapel/tokens-antd";\nconst cardStyle = { borderRadius: 8 };',
      output:
        'import { spacing, radii } from "@stapel/tokens-antd";\nconst cardStyle = { borderRadius: radii.md };',
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // A type step is `{fontSize, lineHeight}`; the length is the inner field.
      filename: SKIN,
      settings: s,
      code: "const textStyle = { fontSize: 12 };",
      output:
        'import { fontSize } from "@stapel/tokens-antd";\n' +
        "const textStyle = { fontSize: fontSize.xs.fontSize };",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // A step name that is not an identifier is written as a subscript.
      filename: SKIN,
      settings: s,
      code: "const headingStyle = { fontSize: 28 };",
      output:
        'import { fontSize } from "@stapel/tokens-antd";\n' +
        'const headingStyle = { fontSize: fontSize["2xl"].fontSize };',
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // A px-valued JSX prop: `size` has no style-key classification of its
      // own, so it is read as a length.
      filename: SKIN,
      settings: s,
      code: "const A = () => <Space size={12}/>;",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const A = () => <Space size={spacing[3]}/>;",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // Nested style objects (`styles.root`) are still style objects.
      filename: SKIN,
      settings: s,
      code: "const styles = { root: { padding: 32 } };",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const styles = { root: { padding: spacing[6] } };",
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // NOT fixed: 15 is on no step. 15 is not "nearly 16" — it was picked by
      // eye, which is the finding.
      filename: SKIN,
      settings: s,
      code: "const A = () => <div style={{ padding: 15 }}/>;",
      output: null,
      errors: [{ messageId: "offScale" }],
    },
    {
      // The real site: a QR code side. Off every scale, and a genuine one-off
      // geometry — the message says to name it rather than to bend the scale.
      filename: SKIN,
      settings: s,
      code: "const A = () => <QRCode size={240}/>;",
      output: null,
      errors: [{ messageId: "offScale" }],
    },
    {
      // NOT fixed: `spacing` already means something else in this module, and
      // a rewrite would silently change what the line says.
      filename: SKIN,
      settings: s,
      code: "const spacing = compute();\nconst A = () => <div style={{ padding: 16 }}/>;",
      output: null,
      errors: [{ messageId: "rawDimension" }],
    },
    {
      // A CSSProperties-annotated object is a style object by declaration.
      filename: "/repo/packages/auth-react/src/default/OtpField.tsx",
      settings: s,
      code: "const shell: CSSProperties = { paddingInline: 4 };",
      output:
        'import { spacing } from "@stapel/tokens-antd";\n' +
        "const shell: CSSProperties = { paddingInline: spacing[1] };",
      errors: [{ messageId: "rawDimension" }],
    },
  ],
});

// ── WHICH module the fix writes ──────────────────────────────────────────────
//
// The rule itself only runs inside `src/default/**` (a host app's chrome is
// the host's business), so the RuleTester cases above can only ever assert the
// skin answer. The policy has two sides, though, and the other side is what a
// future fixer outside the skin scope will read — asserted directly here so it
// cannot be quietly inverted.
describe("tokensModuleFor", () => {
  it("routes a default skin through the antd bridge it already depends on", () => {
    expect(tokensModuleFor("/repo/packages/auth-react/src/default/AuthPanel.tsx")).toBe(
      "@stapel/tokens-antd"
    );
    expect(tokensModuleFor("/repo/apps/storefront/src/default/Panel.tsx")).toBe(
      "@stapel/tokens-antd"
    );
  });

  it("keeps @stapel/tokens everywhere else — there is no antd leg to route through", () => {
    expect(tokensModuleFor("/repo/packages/auth-react/src/headless/AuthProvider.tsx")).toBe(
      "@stapel/tokens"
    );
    expect(tokensModuleFor("/repo/apps/storefront/src/Header.tsx")).toBe("@stapel/tokens");
    expect(tokensModuleFor("/repo/packages/tokens-antd/src/skin.tsx")).toBe("@stapel/tokens");
  });
});
