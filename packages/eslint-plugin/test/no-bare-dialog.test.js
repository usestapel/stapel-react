import rule from "../rules/no-bare-dialog.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/auth-react/src/default/security/TotpManager.tsx";
const SHELL = "/repo/packages/shell-react/src/default/AppShell.tsx";
const HEADLESS = "/repo/packages/auth-react/src/headless/Passkey.tsx";
const HOST = "/repo/apps/storefront/src/Checkout.tsx";

tester.run("no-bare-dialog", rule, {
  valid: [
    // The sanctioned shape.
    {
      filename: SKIN,
      code: 'import { SkinDialog } from "@stapel/tokens-antd/skin";',
    },
    // Everything else antd ships is untouched — this rule is about the two
    // components that ARE the dialog surface, not about using antd.
    {
      filename: SKIN,
      code: 'import { Button, Card, Flex, Typography } from "antd";',
    },
    // A pair's headless layer renders no chrome; the rule does not reach it.
    { filename: HEADLESS, code: 'import { Modal } from "antd";' },
    // A host app's dialogs are the host's business.
    { filename: HOST, code: 'import { Modal, Drawer } from "antd";' },
    // The shell's hamburger menu is NAVIGATION, not a dialog: it is a drawer
    // in shape and purpose, and turning it into a bottom sheet would be the
    // defect, not the fix.
    {
      filename: SHELL,
      code: 'import { Drawer, Layout } from "antd";',
      options: [{ allowNavigationDrawer: ["AppShell.tsx"] }],
    },
  ],
  invalid: [
    {
      filename: SKIN,
      code: 'import { Modal } from "antd";',
      errors: [{ messageId: "bareDialog" }],
    },
    {
      filename: SKIN,
      code: 'import { Drawer } from "antd";',
      errors: [{ messageId: "bareDialog" }],
    },
    {
      // The hand-rolled branch this rule exists to stop: BOTH halves flagged.
      filename: SKIN,
      code: 'import { Button, Drawer, Flex, Modal } from "antd";',
      errors: [{ messageId: "bareDialog" }, { messageId: "bareDialog" }],
    },
    {
      // Renaming on import does not change what was imported.
      filename: SKIN,
      code: 'import { Modal as AntModal } from "antd";',
      errors: [{ messageId: "bareDialog" }],
    },
    {
      // The allowlist is per-file, not per-package: a real dialog inside the
      // shell package is still a dialog.
      filename: "/repo/packages/shell-react/src/default/navMenu.tsx",
      code: 'import { Drawer } from "antd";',
      options: [{ allowNavigationDrawer: ["AppShell.tsx"] }],
      errors: [{ messageId: "bareDialog" }],
    },
  ],
});
