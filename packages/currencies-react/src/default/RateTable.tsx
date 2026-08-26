import type { ReactElement } from "react";
import { Table, Typography, theme as antdTheme } from "antd";
import { useOptionalI18n, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { EmptyState, ErrorAlert, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import { CURRENCIES_I18N_KEYS } from "../i18n/keys.js";
import { formatRate } from "../model/money.js";
import type { Currency } from "../api/types.js";
import type { ThemeModeProp } from "./types.js";

export interface RateTableProps extends ThemeModeProp {
  readonly rates: LoadState<readonly Currency[]>;
  /** The base every rate is relative to. */
  readonly base: string;
  readonly onRetry?: () => void;
  readonly "data-testid"?: string;
}

/**
 * The catalogue as a table: the currency, its translated name, and its rate
 * against the base.
 *
 * No page of its own (`navEntries` is empty) — a host mounts this where it
 * belongs, usually a settings or admin surface.
 *
 * ── The rate column is the table ───────────────────────────────────────────
 *
 * The wire spells a rate as `Decimal(20, 8)`, so the catalogue answers
 * `92.59000000`. Printing that raw made the one column this table exists for
 * unscannable: eight trailing zeros of precision nobody has, left-aligned, so
 * no two decimal points lined up. It now goes through {@link formatRate} and
 * is right-aligned with tabular figures, which is how a column of numbers is
 * read. The symbol rides in the currency cell beside its code instead of
 * taking a column of its own three cells away.
 *
 * ── One voice for one failure ──────────────────────────────────────────────
 *
 * Empty and failed are the SAME sentences the picker shows for the same two
 * situations, and the failure never prints the server's own `error` string.
 *
 * The note under it is not filler. The contract serves NO update timestamp
 * (BACKEND-GAP C-2), so the honest thing to say is that these are the latest
 * values the site holds rather than letting a table of numbers imply a live
 * quote.
 */
export function RateTable(props: RateTableProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const locale = useOptionalI18n()?.locale ?? "en";

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <LoadList
        state={props.rates}
        testId="currencies-rate-table"
        {...(props.onRetry !== undefined ? { onRetry: props.onRetry } : {})}
        failed={() => (
          <ErrorAlert
            message={t(CURRENCIES_I18N_KEYS.catalogFailed)}
            retryLabel={t(CURRENCIES_I18N_KEYS.pickerRetry)}
            {...(props.onRetry !== undefined ? { onRetry: props.onRetry } : {})}
            testId="currencies-rate-table-failed"
          />
        )}
        empty={
          <EmptyState
            title={t(CURRENCIES_I18N_KEYS.catalogEmpty)}
            hint={t(CURRENCIES_I18N_KEYS.catalogEmptyHint)}
          />
        }
      >
        {(rows) => (
          <>
            <Table
              size="small"
              rowKey="code"
              pagination={false}
              dataSource={[...rows]}
              columns={[
                {
                  title: t(CURRENCIES_I18N_KEYS.tableCode),
                  dataIndex: "code",
                  render: (code: string, row: Currency) => (
                    <>
                      {code}
                      {row.symbol !== undefined && row.symbol.length > 0 && (
                        <Typography.Text
                          type="secondary"
                          style={{ marginInlineStart: token.paddingXS }}
                        >
                          {row.symbol}
                        </Typography.Text>
                      )}
                    </>
                  ),
                },
                {
                  title: t(CURRENCIES_I18N_KEYS.tableName),
                  dataIndex: "display_name",
                  render: (key: string) => t(key),
                },
                {
                  title: t(CURRENCIES_I18N_KEYS.tableRate),
                  dataIndex: "value",
                  align: "right",
                  render: (value: string | undefined) => (
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {value === undefined ? "" : formatRate(value, { locale })}
                    </span>
                  ),
                },
              ]}
            />
            <Typography.Paragraph type="secondary">
              {t(CURRENCIES_I18N_KEYS.tableBaseNote, { base: props.base })}
            </Typography.Paragraph>
          </>
        )}
      </LoadList>
    </SkinTheme>
  );
}
