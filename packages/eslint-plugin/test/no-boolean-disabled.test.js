import rule from "../rules/no-boolean-disabled.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/workspaces-react/src/default/MembersManager.tsx";
const HEADLESS = "/repo/packages/workspaces-react/src/headless/Provider.tsx";

tester.run("no-boolean-disabled", rule, {
  valid: [
    // The sanctioned shape: the boolean comes off a gate that cannot spell
    // "disabled for unknown reasons".
    {
      filename: SKIN,
      code: "const A = () => <Button disabled={!inviteGate.available}>Invite</Button>;",
    },
    { filename: SKIN, code: "const A = () => <Button disabled={connectGate.disabled}/>;" },
    { filename: SKIN, code: "const A = () => <Button disabled={!canPublish}/>;" },
    { filename: SKIN, code: "const A = () => <Button disabled={blocked !== null}/>;" },
    // Transient state: the control comes back on its own and the spinner
    // beside it is the explanation.
    { filename: SKIN, code: "const A = () => <Button disabled={submitting}/>;" },
    { filename: SKIN, code: "const A = () => <Button disabled={busy}/>;" },
    { filename: SKIN, code: "const A = () => <Button disabled={isLoading}/>;" },
    // Pass-through: the reason belongs to whoever passed it (the shape of
    // fifteen sites in attributes-react).
    { filename: SKIN, code: "const A = () => <Button disabled={props.disabled}/>;" },
    { filename: SKIN, code: "const A = () => <Button disabled={props.disabled === true}/>;" },
    // A permanently-disabled control is a decision made in the markup.
    { filename: SKIN, code: "const A = () => <Button disabled/>;" },
    // `false` disables nothing.
    { filename: SKIN, code: "const A = () => <Button disabled={false}/>;" },
    // The declared-reason escape hatch: an invisible decision made greppable.
    {
      filename: SKIN,
      code: 'const A = () => <Button disabled={left > 0} data-disabled-reason="resend countdown is shown beside the button"/>;',
    },
    {
      filename: SKIN,
      code: "const A = () => <Button disabled={left > 0} data-disabled-reason={t(K.resendIn)}/>;",
    },
    // Not a control this rule inspects: a disabled input inside a disabled
    // form is a different shape with a different answer.
    { filename: SKIN, code: "const A = () => <Input disabled={!x}/>;" },
    // Out of scope.
    { filename: HEADLESS, code: "const A = () => <Button disabled={!x}/>;" },
    // The pattern option lets a codebase teach the rule its own vocabulary
    // rather than disable the rule when its names differ from the fleet's.
    {
      filename: SKIN,
      code: "const A = () => <Button disabled={!policy.grants.publish}/>;",
      options: [{ gatePattern: "grants" }],
    },
  ],
  invalid: [
    {
      filename: SKIN,
      code: "const A = () => <Button disabled={!x}>Invite</Button>;",
      errors: [{ messageId: "booleanDisabled" }],
    },
    {
      // Form validity: a documented FALSE POSITIVE of this heuristic. The
      // answer is cheap — either the reason is beside the control, and
      // `data-disabled-reason` says so, or the rule was right.
      filename: SKIN,
      code: "const A = () => <Button disabled={!name.trim()}/>;",
      errors: [{ messageId: "booleanDisabled" }],
    },
    {
      // auth-react/panels.tsx:104 — a resend countdown.
      filename: SKIN,
      code: "const A = () => <Button disabled={left > 0}/>;",
      errors: [{ messageId: "booleanDisabled" }],
    },
    {
      // An EMPTY reason is not a reason.
      filename: SKIN,
      code: 'const A = () => <Button disabled={!x} data-disabled-reason=""/>;',
      errors: [{ messageId: "booleanDisabled" }],
    },
    {
      filename: SKIN,
      code: "const A = () => <button disabled={index === 0}/>;",
      errors: [{ messageId: "booleanDisabled" }],
    },
    {
      // Without that option the same expression is a bare boolean.
      filename: SKIN,
      code: "const A = () => <Button disabled={!policy.grants.publish}/>;",
      errors: [{ messageId: "booleanDisabled" }],
    },
  ],
});
