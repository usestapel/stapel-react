import type { ReactElement } from "react";
import { Table, Typography } from "antd";
import { useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { EmptyState, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import { CURRENCIES_I18N_KEYS } from "../i18n/keys.js";
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
 * The catalogue as a table: code, name, rate against the base, symbol.
 *
 * No page of its own (`navEntries` is empty) — a host mounts this where it
 * belongs, usually a settings or admin surface.
 *
 * The note under it is not filler. The contract serves NO update timestamp
 * (BACKEND-GAP C-2), so the honest thing to say is that these are the latest
 * values the site holds rather than letting a table of numbers imply a live
 * quote.
 */
export function RateTable(props: RateTableProps): ReactElement {
  const t = useT();

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
        empty={<EmptyState title={t(CURRENCIES_I18N_KEYS.tableEmpty)} />}
      >
        {(rows) => (
          <>
            <Table
              size="small"
              rowKey="code"
              pagination={false}
              dataSource={[...rows]}
              columns={[
                { title: t(CURRENCIES_I18N_KEYS.tableCode), dataIndex: "code" },
                {
                  title: t(CURRENCIES_I18N_KEYS.tableName),
                  dataIndex: "display_name",
                  render: (key: string) => t(key),
                },
                { title: t(CURRENCIES_I18N_KEYS.tableRate), dataIndex: "value" },
                { title: t(CURRENCIES_I18N_KEYS.tableSymbol), dataIndex: "symbol" },
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
