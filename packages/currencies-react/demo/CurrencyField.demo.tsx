/**
 * The composer's price row: an amount beside the currency it is quoted in.
 *
 * The amount is a plain text input, not antd's `InputNumber`, because the
 * value stays a decimal STRING the whole way to the wire — this is where
 * 1500.10 would otherwise become 1500.0999999999999.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CurrencyField } from "../src/default/CurrencyField.js";
import type { MoneyValue } from "../src/default/index.js";
import { useCurrencies } from "../src/index.js";
import { CurrenciesDemoHarness, DemoCard, HANDLERS_READY } from "./_harness.js";

function Field(props: { initial: MoneyValue }): ReactElement {
  const { state, refetch } = useCurrencies();
  const [value, setValue] = useState<MoneyValue>(props.initial);
  return (
    <CurrencyField value={value} onChange={setValue} options={state} onRetry={refetch} />
  );
}

function Framed(props: { initial: MoneyValue }): ReactElement {
  return (
    <CurrenciesDemoHarness handlers={HANDLERS_READY}>
      <DemoCard heading="CurrencyField">
        <Field initial={props.initial} />
      </DemoCard>
    </CurrenciesDemoHarness>
  );
}

export default defineDemo({
  id: "currencies.field",
  title: "Currency field (default skin)",
  description:
    "A price input the Money layer can actually convert: validity is checked with the same decimal parser the converter uses, so anything this field accepts is a value the rest of the package understands.",
  component: CurrencyField,
  variants: {
    default: {
      description: "A valid amount at 390px, with the picker sharing the control group.",
      viewport: "phone",
      step: "valid",
      render: () => <Framed initial={{ amount: "1500.00", currency: "EUR" }} />,
    },
    invalid: {
      description:
        "An amount the converter cannot read. The message says what a good one looks like instead of the word 'invalid'.",
      viewport: "desktop",
      step: "invalid",
      render: () => <Framed initial={{ amount: "1 500,00", currency: "EUR" }} />,
    },
  },
});
