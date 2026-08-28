import rule from "../rules/no-bare-dialog.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/auth-react/src/default/security/TotpManager.tsx";
const SHELL = "/repo/packages/shell-react/src/default/AppShell.tsx";
const HEADLESS = "/repo/packages/auth-react/src/headless/Passkey.tsx";
const HOST = "/repo/apps/storefront/src/Checkout.tsx";
/** The empirical case: a product repo's own file, nowhere near `src/default`. */
const GATECHECK = "/repo/apps/storefront/src/__gatecheck.tsx";
const DEFAULT_SKIN_ONLY = { scope: "default-skin" };

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
    // `scope: "default-skin"` is the narrow reading, kept as an option: a
    // pair's headless layer renders no chrome, and a consumer that wants the
    // wall on the skins alone asks for it explicitly.
    {
      filename: HEADLESS,
      code: 'import { Modal } from "antd";',
      options: [DEFAULT_SKIN_ONLY],
    },
    {
      filename: HOST,
      code: 'import { Modal, Drawer } from "antd";',
      options: [DEFAULT_SKIN_ONLY],
    },
    // A fixture's job is to BE the forbidden shape — carved out in the rule
    // itself, so a consumer who never spreads the preset agrees with it.
    {
      filename: "/repo/apps/storefront/src/Checkout.test.tsx",
      code: 'import { Modal } from "antd";',
    },
    {
      filename: "/repo/apps/storefront/test/fixtures/dialogs.tsx",
      code: 'import { Drawer, Popconfirm } from "antd";',
    },
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
    // THE DEFECT THIS SCOPE CHANGE CLOSES: a product repo's own file, which
    // lints clean under the old path check and is exactly where a team's
    // dialogs get written. The owner's complaint is about THIS modal, on a
    // phone — not about the library's.
    {
      filename: GATECHECK,
      code: 'import { Modal } from "antd";',
      errors: [{ messageId: "bareDialog" }],
    },
    {
      filename: HOST,
      code: 'import { Modal, Drawer } from "antd";',
      errors: [{ messageId: "bareDialog" }, { messageId: "bareDialog" }],
    },
    // Scoped to the skins on purpose, and the file IS a skin: the option
    // narrows the rule, it does not weaken it.
    {
      filename: SKIN,
      code: 'import { Modal } from "antd";',
      options: [DEFAULT_SKIN_ONLY],
      errors: [{ messageId: "bareDialog" }],
    },
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

// ── The confirm surface (0.11.0) ─────────────────────────────────────────────
// A Popconfirm is an anchored popover: on a 390px phone it renders half
// off-screen or on top of the row being confirmed, and two of the nine sites
// sit INSIDE a bottom sheet. Same fix, different migration (okText/cancelText
// need their own i18n keys), so it gets its own messageId.
tester.run("no-bare-dialog — confirm surface", rule, {
  valid: [
    { filename: SKIN, code: 'import { SkinConfirm } from "@stapel/tokens-antd/skin";' },
    // Headless and host are out of scope under `scope: "default-skin"`,
    // exactly as for Modal/Drawer.
    {
      filename: HEADLESS,
      code: 'import { Popconfirm } from "antd";',
      options: [DEFAULT_SKIN_ONLY],
    },
    {
      filename: HOST,
      code: 'import { Popconfirm } from "antd";',
      options: [DEFAULT_SKIN_ONLY],
    },
    {
      // The migration switch `recommended` uses this release: the dialog half
      // stays at error, the confirm half is off until SkinConfirm lands.
      filename: SKIN,
      code: 'import { Popconfirm } from "antd";',
      options: [{ confirmComponents: [] }],
    },
  ],
  invalid: [
    {
      filename: SKIN,
      code: 'import { Popconfirm } from "antd";',
      errors: [{ messageId: "bareConfirm" }],
    },
    {
      // The real shape from auth-react/security/SessionsList.tsx — one import
      // line carrying both surfaces, each reported under its own message.
      filename: SKIN,
      code: 'import { Button, Modal, Popconfirm, Tag } from "antd";',
      errors: [{ messageId: "bareDialog" }, { messageId: "bareConfirm" }],
    },
    {
      filename: SKIN,
      code: 'import { Popconfirm as Confirm } from "antd";',
      errors: [{ messageId: "bareConfirm" }],
    },
  ],
});
