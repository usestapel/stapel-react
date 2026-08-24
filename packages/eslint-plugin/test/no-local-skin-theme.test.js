import rule from "../rules/no-local-skin-theme.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const THEME = "/repo/packages/listings-react/src/default/theme.tsx";
const PANEL = "/repo/packages/listings-react/src/default/ListingCard.tsx";
const SHARED = "/repo/packages/tokens-antd/src/skin.tsx";
const HOST_THEME = "/repo/apps/storefront/src/theme.tsx";

tester.run("no-local-skin-theme", rule, {
  valid: [
    // The sanctioned shape: the pair re-exports the shared one, or nothing.
    {
      filename: THEME,
      code: 'export { SkinTheme } from "@stapel/tokens-antd/skin";',
    },
    // A theme module that only maps tokens is not the copied provider.
    { filename: THEME, code: "export const gap = spacing[4];" },
    // A SCOPED ConfigProvider inside a panel is not this rule's business —
    // flagging it would fire on the very thing SkinTheme itself is.
    { filename: PANEL, code: 'import { ConfigProvider } from "antd";' },
    // The shared layer is where the provider legitimately lives…
    { filename: SHARED, code: 'import { ConfigProvider } from "antd";' },
    // …and a host app's theme module is the host's business.
    { filename: HOST_THEME, code: 'import { ConfigProvider } from "antd";' },
  ],
  invalid: [
    {
      // The copied file, by its import.
      filename: THEME,
      code: 'import { ConfigProvider } from "antd";',
      errors: [{ messageId: "localTheme" }],
    },
    {
      // …and by what it renders, when the provider arrives some other way.
      filename: THEME,
      code: "const T = (p) => <ConfigProvider theme={t}>{p.children}</ConfigProvider>;",
      errors: [{ messageId: "localTheme" }],
    },
    {
      // ONE report per file: the finding is "this file exists", and nine
      // reports on one 60-line module teach nothing the first did not.
      filename: THEME,
      code:
        'import { ConfigProvider } from "antd";\n' +
        "const T = (p) => <ConfigProvider theme={t}>{p.children}</ConfigProvider>;",
      errors: [{ messageId: "localTheme" }],
    },
    {
      filename: "/repo/packages/video-react/src/default/theme.ts",
      code: 'import { ConfigProvider } from "antd";',
      errors: [{ messageId: "localTheme" }],
    },
  ],
});
