import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Button, List, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  ErrorAlert,
  SkinDialog,
  SkinTheme,
  useDialogSurface,
} from "@stapel/tokens-antd/skin";
import { CURRENCIES_I18N_KEYS } from "../i18n/keys.js";
import type { Currency } from "../api/types.js";
import type { ThemeModeProp } from "./types.js";

export interface CurrencyPickerProps extends ThemeModeProp {
  /** The selected code. */
  readonly value: string;
  readonly onChange: (code: string) => void;
  /** The catalogue, with its load states — the picker draws all four. */
  readonly options: LoadState<readonly Currency[]>;
  readonly onRetry?: () => void;
  /** Accessible name. Defaults to the pair's "Display currency". */
  readonly label?: string;
  readonly "data-testid"?: string;
}

/** `€ EUR — Euro`: the symbol to recognise, the code to be sure, the name to
 * read. `display_name` is a translation KEY off the wire, resolved here. */
function optionLabel(row: Currency, t: (key: string) => string): string {
  const name = t(row.display_name);
  const symbol = row.symbol !== undefined && row.symbol.length > 0 ? `${row.symbol} ` : "";
  return `${symbol}${row.code} — ${name}`;
}

/**
 * The currency picker.
 *
 * ── Two surfaces, one rule ─────────────────────────────────────────────────
 *
 * On tablet and desktop this is an antd `Select` with search. On a PHONE it is
 * a button that opens a `SkinDialog` bottom sheet with a scrollable list: a
 * native `Select` dropdown on a 390px screen is the desktop-surface-on-phone
 * defect — a 16-row popup anchored to a control near the bottom of the
 * viewport, with 24px hit targets. The surface decision comes from
 * `useDialogSurface()`, the same one `SkinDialog` itself reads, so the two can
 * never disagree.
 *
 * ── All four states are drawn ──────────────────────────────────────────────
 *
 * Loading: the control is disabled WITH the reason beside it, never a silent
 * grey box. Empty: a sentence saying the site has no currencies configured —
 * which is a deployment fact, not a fault. Failed: the shared `ErrorAlert`
 * with a retry. Ready: the list.
 */
export function CurrencyPicker(props: CurrencyPickerProps): ReactElement {
  const t = useT();
  const surface = useDialogSurface();
  const [open, setOpen] = useState(false);
  const label = props.label ?? t(CURRENCIES_I18N_KEYS.pickerLabel);
  const { options, value, onChange } = props;

  const rows = useMemo(
    () => (options.status === "ready" ? options.data : []),
    [options]
  );

  const pick = useCallback(
    (code: string) => {
      onChange(code);
      setOpen(false);
    },
    [onChange]
  );

  const body = (): ReactElement => {
    if (options.status === "loading") {
      return (
        <div data-stapel-load-state="loading">
          <Select
            disabled
            value={value}
            aria-label={label}
            style={{ width: "100%" }}
            options={[{ value, label: value }]}
          />
          <Typography.Text type="secondary">
            {t(CURRENCIES_I18N_KEYS.pickerLoading)}
          </Typography.Text>
        </div>
      );
    }
    if (options.status === "failed") {
      return (
        <ErrorAlert
          thrown={options.error}
          message={t(CURRENCIES_I18N_KEYS.pickerFailed)}
          retryLabel={t(CURRENCIES_I18N_KEYS.pickerRetry)}
          {...(props.onRetry !== undefined ? { onRetry: props.onRetry } : {})}
          testId="currencies-picker-failed"
        />
      );
    }
    if (rows.length === 0) {
      return (
        <Typography.Text type="secondary" data-stapel-load-state="empty">
          {t(CURRENCIES_I18N_KEYS.pickerEmpty)}
        </Typography.Text>
      );
    }

    if (surface === "sheet") {
      const current = rows.find((row) => row.code === value);
      return (
        <>
          <Button
            block
            aria-label={label}
            onClick={() => {
              setOpen(true);
            }}
            data-analytics="none"
            data-analytics-reason="opens the currency sheet; the choice itself is tracked by useDisplayCurrency"
            data-testid="currencies-picker-trigger"
          >
            {current !== undefined
              ? optionLabel(current, t)
              : t(CURRENCIES_I18N_KEYS.pickerPlaceholder)}
          </Button>
          <SkinDialog
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            title={label}
            dismissLabel={t(CURRENCIES_I18N_KEYS.dialogDismiss)}
            data-testid="currencies-picker-sheet"
          >
            <List
              dataSource={[...rows]}
              renderItem={(row) => (
                <List.Item
                  onClick={() => {
                    pick(row.code);
                  }}
                  data-analytics="none"
                  data-analytics-reason="the display-currency change is tracked once, in useDisplayCurrency"
                  aria-current={row.code === value}
                  style={{ cursor: "pointer" }}
                >
                  {optionLabel(row, t)}
                </List.Item>
              )}
            />
          </SkinDialog>
        </>
      );
    }

    return (
      <Select
        showSearch
        value={value}
        aria-label={label}
        style={{ width: "100%" }}
        placeholder={t(CURRENCIES_I18N_KEYS.pickerPlaceholder)}
        optionFilterProp="label"
        onChange={pick}
        options={rows.map((row) => ({
          value: row.code,
          label: optionLabel(row, t),
        }))}
        data-testid="currencies-picker-select"
      />
    );
  };

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      {body()}
    </SkinTheme>
  );
}
