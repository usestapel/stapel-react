/**
 * `ChoiceChips` at 390px, which is the width the rule exists for: a handful
 * of answers is TAPPED, not unfolded out of a dropdown.
 *
 * Demos are first-class code (frontend-guardrails §4.2), so the copy here is
 * declared as constants and passed through props — the same way a pair passes
 * `t(KEYS.…)` — rather than written as JSX text, and every colour and
 * dimension comes from the token scale.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { ChoiceChips } from "../src/skin/choiceChips.js";
import type { ChoiceChipOption } from "../src/skin/choiceChips.js";
import { SkinTheme } from "../src/skin/theme.js";

/** The 390px frame every phone variant is looked at in. */
const PHONE_FRAME_WIDTH = 390;

const GROUP_LABEL = "Condition";
const BODY_LABEL = "Body type";

const CONDITIONS: readonly ChoiceChipOption[] = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "parts", label: "For parts or not working" },
];

/** Two chips blocked for the SAME reason: the sentence is printed once. */
const DELIVERY: readonly ChoiceChipOption[] = [
  { value: "pickup", label: "Pickup" },
  { value: "courier", label: "Courier" },
  {
    value: "post",
    label: "Post",
    disabled: true,
    disabledReason: "Not available for this category.",
  },
  {
    value: "freight",
    label: "Freight",
    disabled: true,
    disabledReason: "Not available for this category.",
  },
];

const BODY_TYPES: readonly ChoiceChipOption[] = [
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
  { value: "estate", label: "Estate" },
  { value: "suv", label: "SUV" },
  { value: "coupe", label: "Coupe" },
  { value: "convertible", label: "Convertible" },
];

function Frame(props: { readonly children: ReactElement }): ReactElement {
  return (
    <SkinTheme surface="base" style={{ padding: spacing[4], maxWidth: PHONE_FRAME_WIDTH }}>
      {props.children}
    </SkinTheme>
  );
}

function SingleChips(props: {
  readonly options: readonly ChoiceChipOption[];
  readonly initial?: string;
  readonly label: string;
}): ReactElement {
  const [value, setValue] = useState<string | undefined>(props.initial);
  return (
    <ChoiceChips
      mode="single"
      ariaLabel={props.label}
      options={props.options}
      value={value}
      onChange={setValue}
    />
  );
}

function MultiChips(props: {
  readonly options: readonly ChoiceChipOption[];
  readonly initial: readonly string[];
  readonly label: string;
  readonly grid?: boolean;
}): ReactElement {
  const [values, setValues] = useState<readonly string[]>(props.initial);
  return (
    <ChoiceChips
      mode="multi"
      ariaLabel={props.label}
      options={props.options}
      values={values}
      onChange={setValues}
      {...(props.grid === true ? { columns: "grid" as const } : {})}
    />
  );
}

export default defineDemo({
  id: "tokens-antd.choice-chips",
  title: "Choice chips",
  description:
    "A handful of options rendered inline as 44px chips instead of a dropdown: every answer is visible at rest, one tap away, and the labels wrap rather than being cut. Single-select tapping the chosen chip again does nothing unless `allowClear` is on — 'unanswer it' is not a state a required field should reach by fumbling. A chip that cannot be chosen states its reason as visible text under the row, once per distinct sentence, because a disabled control receives no pointer events and a tooltip on it is an explanation nobody can read.",
  component: ChoiceChips,
  tokens: ["brand", "surface-raised", "border", "text-muted"],
  variants: {
    single: {
      description:
        "One answer out of three, with the second one already given. The third label is long enough to wrap, which is the case an ellipsis would have turned into a guess.",
      viewport: "phone",
      step: "single-chosen",
      render: () => (
        <Frame>
          <SingleChips options={CONDITIONS} initial="used" label={GROUP_LABEL} />
        </Frame>
      ),
    },
    "multi-blocked": {
      description:
        "Several answers at once, two of them switched off for the same reason — printed ONCE under the row and pointed at by both chips' aria-describedby, instead of six copies of one sentence down a screen.",
      viewport: "phone",
      step: "multi-blocked",
      render: () => (
        <Frame>
          <MultiChips options={DELIVERY} initial={["pickup"]} label={GROUP_LABEL} />
        </Frame>
      ),
    },
    grid: {
      description:
        "columns=\"grid\" for a set whose labels are long enough that a ragged wrapped row reads as noise: equal columns, two across at 390px.",
      viewport: "phone",
      step: "multi-grid",
      render: () => (
        <Frame>
          <MultiChips grid options={BODY_TYPES} initial={["suv", "estate"]} label={BODY_LABEL} />
        </Frame>
      ),
    },
  },
});
