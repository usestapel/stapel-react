import rule from "../rules/icon-button-needs-label.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/docs-react/src/default/TrashPane.tsx";
const HOST = "/repo/apps/storefront/src/Header.tsx";

tester.run("icon-button-needs-label", rule, {
  valid: [
    // The sanctioned shape.
    {
      filename: SKIN,
      code: "const A = () => <Button aria-label={t(K.delete)} icon={<DeleteOutlined/>}/>;",
    },
    {
      filename: SKIN,
      code: "const A = () => <button aria-labelledby={id}><TrashIcon/></button>;",
    },
    // A button with words needs no aria-label: the words ARE the name.
    { filename: SKIN, code: "const A = () => <Button icon={<PlusOutlined/>}>Add</Button>;" },
    {
      filename: SKIN,
      code: "const A = () => <Button icon={<PlusOutlined/>}>{t(K.add)}</Button>;",
    },
    // Icon plus text, in that order — still named.
    {
      filename: SKIN,
      code: "const A = () => <button><TrashIcon/> Delete</button>;",
    },
    // A spread might carry the label; "might" is not a finding.
    { filename: SKIN, code: "const A = () => <Button {...rest} icon={<X/>}/>;" },
    // Out of the accessibility tree entirely — naming it is the contradiction.
    {
      filename: SKIN,
      code: "const A = () => <Button aria-hidden icon={<CaretDownOutlined/>}/>;",
    },
    // Not a control this rule inspects.
    { filename: SKIN, code: "const A = () => <div><SearchOutlined/></div>;" },
    // A child component whose name says nothing about icons is assumed to
    // render content — absence is the one thing a guess must not be made about.
    { filename: SKIN, code: "const A = () => <Button><Price value={x}/></Button>;" },
    // A button with no children and no icon prop is not an ICON button.
    { filename: SKIN, code: "const A = () => <Button/>;" },
  ],
  invalid: [
    {
      filename: SKIN,
      code: "const A = () => <Button icon={<DeleteOutlined/>}/>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // Whitespace is not content.
      filename: SKIN,
      code: "const A = () => <Button icon={<DeleteOutlined/>}> </Button>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // The bare-element form: the only child is icon-shaped by name.
      filename: SKIN,
      code: "const A = () => <button onClick={f}><CloseOutlined/></button>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      filename: SKIN,
      code: "const A = () => <a href={url}><ExternalLinkIcon/></a>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // A raw <svg> child is an icon by construction.
      filename: SKIN,
      code: "const A = () => <button><svg viewBox='0 0 1 1'/></button>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // NOT scoped to src/default: an unnamed icon button is broken in a host
      // app exactly as much as in a skin, and there is no legitimate variant.
      filename: HOST,
      code: "const A = () => <Button icon={<MenuOutlined/>}/>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // Two icons, still no name.
      filename: SKIN,
      code: "const A = () => <button><SortAscendingOutlined/><CaretDownOutlined/></button>;",
      errors: [{ messageId: "needsLabel" }],
    },
    {
      // A codebase's own control component, opted in.
      filename: SKIN,
      code: "const A = () => <ToolbarButton icon={<X/>}/>;",
      options: [{ components: ["ToolbarButton"] }],
      errors: [{ messageId: "needsLabel" }],
    },
  ],
});
