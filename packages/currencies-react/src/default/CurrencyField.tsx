import { useCallback, useId } from "react";
import type { ReactElement } from "react";
import { Input, Space, Typography } from "antd";
import { useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { CURRENCIES_I18N_KEYS } from "../i18n/keys.js";
import { isValidAmount } from "../model/money.js";
import { CurrencyPicker } from "./CurrencyPicker.js";
import type { Currency } from "../api/types.js";
import type { ThemeModeProp } from "./types.js";

/** An amount and the currency it is in — the shape a price row edits. */
export interface MoneyValue {
  /** A decimal STRING. It stays a string all the way to the wire; a `number`
   * here is where 1500.10 becomes 1500.0999999999999. */
  readonly amount: string;
  readonly currency: string;
}

export interface CurrencyFieldProps extends ThemeModeProp {
  readonly value: MoneyValue;
  readonly onChange: (next: MoneyValue) => void;
  readonly options: LoadState<readonly Currency[]>;
  readonly onRetry?: () => void;
  readonly disabled?: boolean;
  readonly "data-testid"?: string;
}

/**
 * The form control for a price: an amount beside the currency it is quoted in.
 *
 * A plain `Input`, not antd's `InputNumber`: `InputNumber`'s value is a
 * `number`, and the whole discipline of this package is that money never
 * becomes one. Validity is checked against the same `parseDecimal` the
 * converter uses, so a value this field accepts is a value the Money layer can
 * convert — and the message says what a good amount looks like instead of
 * "invalid".
 *
 * This is what `@stapel/listings-react`'s composer price row should adopt.
 */
export function CurrencyField(props: CurrencyFieldProps): ReactElement {
  const t = useT();
  const labelId = useId();
  const { value, onChange } = props;
  const invalid = value.amount.length > 0 && !isValidAmount(value.amount);

  const setAmount = useCallback(
    (amount: string) => {
      onChange({ amount, currency: value.currency });
    },
    [onChange, value.currency]
  );

  const setCurrency = useCallback(
    (currency: string) => {
      onChange({ amount: value.amount, currency });
    },
    [onChange, value.amount]
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        {/* A visible label, not only an aria one: a field whose name lives in
            the placeholder loses its name the moment someone types. */}
        <Typography.Text id={labelId}>
          {t(CURRENCIES_I18N_KEYS.fieldAmount)}
        </Typography.Text>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={value.amount}
            inputMode="decimal"
            aria-labelledby={labelId}
            placeholder={t(CURRENCIES_I18N_KEYS.fieldAmount)}
            status={invalid ? "error" : ""}
            {...(props.disabled === true ? { disabled: true } : {})}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            data-testid="currencies-field-amount"
          />
          <CurrencyPicker
            compact
            value={value.currency}
            onChange={setCurrency}
            options={props.options}
            {...(props.onRetry !== undefined ? { onRetry: props.onRetry } : {})}
            {...(props.mode !== undefined ? { mode: props.mode } : {})}
          />
        </Space.Compact>
        {invalid && (
          <Typography.Text type="danger" role="alert">
            {t(CURRENCIES_I18N_KEYS.fieldInvalidAmount)}
          </Typography.Text>
        )}
      </Space>
    </SkinTheme>
  );
}
