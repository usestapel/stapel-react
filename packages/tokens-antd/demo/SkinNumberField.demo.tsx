/**
 * `SkinNumberField` — a number on a phone: the numeric keypad, the unit as a
 * postfix that is not part of the value, the range as a hint, and the
 * out-of-range answer KEPT with the refusal beside it rather than clamped
 * away.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { SkinNumberField } from "../src/skin/numberField.js";
import { SkinTheme } from "../src/skin/theme.js";

const PHONE_FRAME_WIDTH = 390;

const MILEAGE_LABEL = "Mileage";
const MILEAGE_UNIT = "km";
const MILEAGE_HINT = "0-1000000";
const AREA_LABEL = "Area";
const AREA_UNIT = "m2";
const AREA_HINT = "10.5-500";
const VOLUME_LABEL = "Engine volume";
const VOLUME_UNIT = "l";
const VOLUME_HINT = "0.6-8.0";
const VOLUME_ERROR = "Between 0.6 and 8.0 litres.";
const VOLUME_HELP = "Taken from the registration document.";

function Frame(props: { readonly children: ReactElement }): ReactElement {
  return (
    <SkinTheme surface="base" style={{ padding: spacing[4], maxWidth: PHONE_FRAME_WIDTH }}>
      {props.children}
    </SkinTheme>
  );
}

function Field(props: {
  readonly integer?: boolean;
  readonly initial?: number;
  readonly unit: string;
  readonly hint: string;
  readonly label: string;
  readonly error?: string;
  readonly help?: string;
}): ReactElement {
  const [value, setValue] = useState<number | undefined>(props.initial);
  return (
    <SkinNumberField
      value={value}
      onValueChange={setValue}
      unit={props.unit}
      hintPlaceholder={props.hint}
      ariaLabel={props.label}
      {...(props.integer === true ? { integer: true } : {})}
      {...(props.error !== undefined ? { status: "error" as const, errorText: props.error } : {})}
      {...(props.help !== undefined ? { helpText: props.help } : {})}
    />
  );
}

export default defineDemo({
  id: "tokens-antd.number-field",
  title: "Number field",
  description:
    "A number typed on a phone. `integer` decides the keypad (`inputMode=numeric` vs `decimal`) so iOS raises digits instead of the alphabet; the unit is a suffix inside the box and never part of the value; `min`/`max` arrive as a preformatted placeholder — a HINT — and are never used to reject a keystroke. This is deliberately not antd's `InputNumber`, which clamps: typing 9 towards 95 in a max-50 field leaves 9, and a blurred 120 becomes 100 with no sentence anywhere saying so. Out of range is the caller's validation to display, beside the field, in words.",
  component: SkinNumberField,
  tokens: ["surface-raised", "border", "text-muted", "error"],
  variants: {
    integer: {
      description:
        "An empty integer field: the range is the placeholder, the unit sits after the value, and the keypad is numeric.",
      viewport: "phone",
      step: "empty-hint",
      render: () => (
        <Frame>
          <Field integer unit={MILEAGE_UNIT} hint={MILEAGE_HINT} label={MILEAGE_LABEL} />
        </Frame>
      ),
    },
    decimal: {
      description:
        "A decimal field with an answer. The component owns the TEXT, so a half-typed `10.` survives the keystroke that a `String(value)` round trip would have deleted.",
      viewport: "phone",
      step: "filled-decimal",
      render: () => (
        <Frame>
          <Field initial={62.5} unit={AREA_UNIT} hint={AREA_HINT} label={AREA_LABEL} />
        </Frame>
      ),
    },
    "out-of-range": {
      description:
        "9.9 in a 0.6-8.0 field: the value is KEPT, the ring is red, and the reason is a sentence under the field. The alternative — silently rewriting it to 8.0 — is a value the person never entered, in a field they have stopped looking at.",
      viewport: "phone",
      step: "error",
      render: () => (
        <Frame>
          <Field
            initial={9.9}
            unit={VOLUME_UNIT}
            hint={VOLUME_HINT}
            label={VOLUME_LABEL}
            error={VOLUME_ERROR}
            help={VOLUME_HELP}
          />
        </Frame>
      ),
    },
  },
});
