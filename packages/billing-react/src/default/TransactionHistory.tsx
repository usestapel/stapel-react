/**
 * `<TransactionHistory/>` — where the credits went.
 *
 * ── The endpoint nothing consumed ─────────────────────────────────────────
 *
 * `GET /wallet/transactions` had a typed client method, a query key, a
 * session-gated hook — and, grep-verified, ZERO consumers anywhere in the
 * repo. The ledger is the customer's only answer to "where did my credits
 * go", and since stapel-billing 0.11.0 that question has three new answers
 * the balance cannot show on its own: a hold captured, a debt collected off
 * the top of a purchase, a lot that expired. Without this surface, each of
 * those is a balance that changed for no visible reason.
 *
 * ── Paging is per-page queries, not an accumulator ────────────────────────
 *
 * Each cursor is its own `useTransactions(cursor)` inside its own component,
 * so each page is cached under its own key, refetches independently, and
 * carries its OWN loading and failed arms. A page that fails leaves the pages
 * above it on screen — an accumulated array in one piece of state would have
 * to choose between dropping them and pretending the failure did not happen.
 *
 * ── Nothing machine-shaped reaches the glass ──────────────────────────────
 *
 * `type` goes through the label table (never `transcription_charge`),
 * `created_at` through `Intl` (never an ISO string), and the delta through a
 * signed formatter, because a bare `120` beside a bare `500` does not say
 * which direction the credits went — which is the one thing a ledger row is
 * for.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Typography, theme as antdTheme } from "antd";
import {
  EmptyState,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { loadStateFromQuery, useI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { Transaction } from "../api/types.js";
import { useTransactions } from "../model/queries.js";
import {
  formatCreditCount,
  formatCreditDelta,
  formatTimestamp,
} from "../model/money.js";
import { transactionTypeKey } from "./labels.js";
import type { ThemeModeProp } from "./types.js";

export type TransactionHistoryProps = ThemeModeProp;

/** One ledger row: what happened, when, how many credits, and where that
 * left the balance. */
function TransactionRow(props: { entry: Transaction }): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const { entry } = props;
  const typeKey = transactionTypeKey(entry.type);
  // An unknown type from a newer backend falls back to the server's own
  // sentence about this charge, which beats any generic label we could
  // invent — and only then to "Other".
  const title =
    typeKey !== undefined
      ? t(typeKey)
      : (entry.description ?? t(BILLING_I18N_KEYS.txTypeOther));
  const credited = entry.credits_delta > 0;
  return (
    <Flex
      justify="space-between"
      align="flex-start"
      gap={spacing[2]}
      wrap="wrap"
      data-testid={`billing-tx-${entry.id}`}
      style={{
        paddingBlock: token.paddingXS,
        borderBottom: `${String(token.lineWidth)}px solid ${token.colorSplit}`,
      }}
    >
      <Flex vertical gap={spacing[0]}>
        <Typography.Text strong>{title}</Typography.Text>
        {entry.description === null || typeKey === undefined ? null : (
          <Typography.Text type="secondary">{entry.description}</Typography.Text>
        )}
        <Typography.Text type="secondary">
          {formatTimestamp(locale, entry.created_at)}
        </Typography.Text>
      </Flex>
      <Flex vertical gap={spacing[0]} align="flex-end">
        <Typography.Text
          strong
          type={credited ? "success" : "danger"}
          data-testid={`billing-tx-delta-${entry.id}`}
        >
          {formatCreditDelta(locale, entry.credits_delta)}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t(BILLING_I18N_KEYS.txBalanceAfter, {
            credits: formatCreditCount(locale, entry.balance_after),
          })}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}

/** One cursor page — its own query, its own load arms. */
function TransactionPage(props: {
  cursor: string | undefined;
  first: boolean;
  last: boolean;
  onMore: (cursor: string) => void;
}): ReactElement {
  const t = useT();
  const { cursor } = props;
  const query = useTransactions(cursor);
  const state = loadStateFromQuery(query);
  return (
    <LoadBoundary
      state={state}
      testId={`billing-tx-page-${cursor ?? "first"}`}
      onRetry={() => {
        void query.refetch();
      }}
    >
      {(page) => {
        const rows = page.transactions ?? [];
        // Empty is only reachable here, inside a read that ANSWERED — and
        // only the first page may say it: an empty later page is the end of
        // the list, not an empty ledger.
        if (rows.length === 0) {
          return props.first ? (
            <EmptyState
              testId="billing-tx-empty"
              title={t(BILLING_I18N_KEYS.txEmpty)}
              hint={t(BILLING_I18N_KEYS.txEmptyHint)}
            />
          ) : null;
        }
        const next = page.next_cursor;
        return (
          <>
            {rows.map((entry) => (
              <TransactionRow key={entry.id} entry={entry} />
            ))}
            {props.last && page.has_more === true && next !== null && next !== undefined ? (
              <Flex justify="center">
                <Button
                  size="small"
                  data-testid="billing-tx-more"
                  data-analytics="none"
                  data-analytics-reason="local paging of an already-authorized read"
                  onClick={() => {
                    props.onMore(next);
                  }}
                >
                  {t(BILLING_I18N_KEYS.txMore)}
                </Button>
              </Flex>
            ) : null}
          </>
        );
      }}
    </LoadBoundary>
  );
}

/**
 * The credit ledger, paged forward by the server's own cursors. Composed
 * into `<WalletPanel/>`; mountable on its own.
 */
export function TransactionHistory(
  props: TransactionHistoryProps = {}
): ReactElement {
  const t = useT();
  const { mode } = props;
  // The first page has no cursor; each "Show older" appends the cursor the
  // server handed back, so the rendered list is exactly the pages asked for.
  const [cursors, setCursors] = useState<readonly string[]>([]);
  const pages: readonly (string | undefined)[] = [undefined, ...cursors];

  return (
    <SkinTheme
      surface="bare"
      {...(mode !== undefined ? { mode } : {})}
      data-testid="billing-transactions"
    >
      <Card size="small" title={t(BILLING_I18N_KEYS.txHeading)}>
        <Flex vertical gap={spacing[0]}>
          {pages.map((cursor, index) => (
            <TransactionPage
              key={cursor ?? ""}
              cursor={cursor}
              first={index === 0}
              last={index === pages.length - 1}
              onMore={(next) => {
                setCursors((prev) =>
                  prev.includes(next) ? prev : [...prev, next]
                );
              }}
            />
          ))}
        </Flex>
      </Card>
    </SkinTheme>
  );
}
