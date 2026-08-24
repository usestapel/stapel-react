import rule from "../rules/no-tooltip-in-skin.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/listings-react/src/default/ListingCard.tsx";
const HEADLESS = "/repo/packages/listings-react/src/headless/ListingProvider.tsx";
const HOST = "/repo/apps/storefront/src/Header.tsx";

tester.run("no-tooltip-in-skin", rule, {
  valid: [
    // The sanctioned shape: the reason is page content beside the control.
    {
      filename: SKIN,
      code: "const A = () => <GatedControl block={gate.block}><Button>Publish</Button></GatedControl>;",
    },
    // An icon-only control carries a NAME, not a hover explanation.
    {
      filename: SKIN,
      code: "const A = () => <Button aria-label={t(K.remove)} icon={<DeleteOutlined/>} />;",
    },
    // Everything else antd ships is untouched.
    { filename: SKIN, code: 'import { Button, Card, Flex } from "antd";' },
    // Out of scope, exactly like no-bare-dialog: headless renders no chrome…
    { filename: HEADLESS, code: 'import { Tooltip } from "antd";' },
    // …and a host app's chrome is the host's business.
    { filename: HOST, code: "const A = () => <Tooltip title='x'><b/></Tooltip>;" },
    // `title` where it is CONTENT, not a hover — the false positive this rule
    // must not produce, on the components it would produce it on most.
    { filename: SKIN, code: "const A = () => <Card title={t(K.heading)}/>;" },
    { filename: SKIN, code: "const A = () => <SkinDialog title={t(K.heading)} open/>;" },
    { filename: SKIN, code: "const A = () => <Collapse.Panel title={t(K.section)}/>;" },
    { filename: SKIN, code: "const A = () => <Table.Column title={t(K.column)}/>;" },
    // A valueless attribute says nothing at all.
    { filename: SKIN, code: "const A = () => <Button title/>;" },
  ],
  invalid: [
    {
      filename: SKIN,
      code: 'import { Card, Tooltip, Typography } from "antd";',
      errors: [{ messageId: "tooltip" }],
    },
    {
      // The element itself — a Tooltip re-exported from a local module has no
      // antd import to catch, and the import alone does not say where it is used.
      filename: SKIN,
      code: "const A = () => <Tooltip title={t(K.hint)}><Tag>PRO</Tag></Tooltip>;",
      errors: [{ messageId: "tooltip" }],
    },
    {
      // A Popover is the same surface wearing a different name.
      filename: SKIN,
      code: 'import { Popover } from "antd";',
      errors: [{ messageId: "tooltip" }],
    },
    {
      // The short spelling of the same bug: a native browser tooltip.
      filename: SKIN,
      code: 'const A = () => <Button title="Delete this listing" icon={<DeleteOutlined/>}/>;',
      errors: [{ messageId: "hoverTitle" }],
    },
    {
      // Through an i18n key it is still hover-only text.
      filename: SKIN,
      code: "const A = () => <Tag title={t(K.promotedHint)}>PRO</Tag>;",
      errors: [{ messageId: "hoverTitle" }],
    },
    {
      filename: SKIN,
      code: 'const A = () => <a title="Opens in a new tab" href={url}>docs</a>;',
      errors: [{ messageId: "hoverTitle" }],
    },
    {
      // Both halves of one line.
      filename: SKIN,
      code: 'const A = () => <Tooltip title="x"><Button title="y"/></Tooltip>;',
      errors: [{ messageId: "tooltip" }, { messageId: "hoverTitle" }],
    },
    {
      // The option makes a codebase's own component a hover surface.
      filename: SKIN,
      code: "const A = () => <Chip title={t(K.hint)}/>;",
      options: [{ titleComponents: ["Chip"] }],
      errors: [{ messageId: "hoverTitle" }],
    },
  ],
});
