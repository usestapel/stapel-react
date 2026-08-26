import rule from "../rules/antd-alert-title.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const FILE = "/repo/packages/auth-react/src/default/AuthPanel.tsx";
// Not a skin path: a vendor deprecation is not a doctrine rule, so it is in
// scope wherever antd is imported.
const HOST = "/repo/apps/storefront/src/Header.tsx";

const importAlert = 'import { Alert } from "antd";\n';

tester.run("antd-alert-title", rule, {
  valid: [
    // The antd 6 shape.
    {
      filename: FILE,
      code: importAlert + 'const A = () => <Alert title={t("e")} type="error"/>;',
    },
    // No antd import → not antd's Alert. A local or design-system component
    // that still takes `message` is not renamed under its author's feet.
    { filename: FILE, code: 'const A = () => <Alert message="x"/>;' },
    {
      filename: FILE,
      code:
        'import { Alert } from "./ui/Alert";\n' + 'const A = () => <Alert message="x"/>;',
    },
    // A different antd component that happens to take `message`.
    {
      filename: FILE,
      code: 'import { Result } from "antd";\nconst A = () => <Result message="x"/>;',
    },
    // Type-only import binds no value.
    {
      filename: FILE,
      code:
        'import type { Alert } from "antd";\nconst A = (p: Alert) => <Alert message="x"/>;',
    },
    // Sub-components are a different props surface and out of scope.
    {
      filename: FILE,
      code: importAlert + 'const A = () => <Alert.ErrorBoundary message="x"/>;',
    },
    // No `message` at all.
    { filename: FILE, code: importAlert + "const A = () => <Alert {...props}/>;" },
  ],
  invalid: [
    {
      filename: FILE,
      code: importAlert + 'const A = () => <Alert message="Something broke" type="error"/>;',
      output: importAlert + 'const A = () => <Alert title="Something broke" type="error"/>;',
      errors: [{ messageId: "deprecatedMessage" }],
    },
    {
      // An expression value is the same rename.
      filename: HOST,
      code: importAlert + 'const A = () => <Alert message={t("error.generic")}/>;',
      output: importAlert + 'const A = () => <Alert title={t("error.generic")}/>;',
      errors: [{ messageId: "deprecatedMessage" }],
    },
    {
      // Aliased import — the LOCAL name is what appears in the JSX.
      filename: FILE,
      code: 'import { Alert as Banner } from "antd";\nconst A = () => <Banner message="x"/>;',
      output: 'import { Alert as Banner } from "antd";\nconst A = () => <Banner title="x"/>;',
      errors: [{ messageId: "deprecatedMessage", data: { name: "Banner" } }],
    },
    {
      // Through the namespace import.
      filename: FILE,
      code: 'import * as antd from "antd";\nconst A = () => <antd.Alert message="x"/>;',
      output: 'import * as antd from "antd";\nconst A = () => <antd.Alert title="x"/>;',
      errors: [{ messageId: "deprecatedMessage" }],
    },
    {
      // A spread does not block the fix: the explicit `message` is
      // unambiguous, and leaving it keeps a prop antd no longer reads.
      filename: FILE,
      code: importAlert + 'const A = () => <Alert {...rest} message="x"/>;',
      output: importAlert + 'const A = () => <Alert {...rest} title="x"/>;',
      errors: [{ messageId: "deprecatedMessage" }],
    },
    {
      // Both props present → reported, NOT fixed. Renaming would pass the
      // same prop twice and let source order pick the heading.
      filename: FILE,
      code: importAlert + 'const A = () => <Alert message="a" title="b"/>;',
      output: null,
      errors: [{ messageId: "deprecatedMessageWithTitle" }],
    },
    {
      // Two alerts, two reports.
      filename: FILE,
      code: importAlert + 'const A = () => <><Alert message="a"/><Alert message="b"/></>;',
      output: importAlert + 'const A = () => <><Alert title="a"/><Alert title="b"/></>;',
      errors: [
        { messageId: "deprecatedMessage" },
        { messageId: "deprecatedMessage" },
      ],
    },
  ],
});
