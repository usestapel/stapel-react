/**
 * The balance, and the truth behind it: TWO POOLS and any debt.
 *
 * ── The finding this component exists to close ────────────────────────────
 *
 * A wallet holding 840 bought credits and 400 that die on the 1st used to
 * render as "1240 USD" — one number, in a currency the credits are not
 * denominated in, with a footnote. The customer could not tell which half
 * survives a lapsed subscription, could not see that letting it lapse
 * forfeits a pool, and — with stapel-billing 0.11.0 — could not see that the
 * next credits they buy are already spoken for.
 *
 * So: the balance is one line, and under it the two pools stand SEPARATELY,
 * each with its own fate stated in words. Nothing here prints their sum.
 * That is not a stylistic choice — the sum is the number that lets someone
 * plan around credits they are about to lose.
 *
 * ── Everything numeric comes from the server ──────────────────────────────
 *
 * The pools are grouped and totalled from `lots` (arithmetic on numbers the
 * server sent, which a screen must do to have anything to print). The
 * DEADLINE is `expiring_soon`, picked by the backend that will do the
 * expiring, and the DEBT total is `debt_outstanding`. Neither is recomputed
 * here: a client-side scan would be a second implementation of a rule that
 * already has one, and the two would drift the first time the backend
 * changed it.
 */
import type { ReactElement, ReactNode } from "react";
import { Alert, Flex, Statistic, Typography, theme as antdTheme } from "antd";
import { useI18n, useT, useTPlural } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { Wallet as WalletData } from "../api/types.js";
import {
  creditPools,
  debtOutstanding,
  heldCredits,
  openDebts,
} from "../model/credits.js";
import type { CreditPool } from "../model/credits.js";
import {
  formatCreditCount,
  formatDeadlineRelative,
  formatExpiryDate,
} from "../model/money.js";
import { debtReasonKey } from "./labels.js";

/** One pool: what it is, how much of it there is, and what happens to it. */
function PoolRow(props: {
  pool: CreditPool;
  countKey: string;
  emptyKey: string;
  hintKey: string;
  testId: string;
  deadline?: ReactNode;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const { token } = antdTheme.useToken();
  const { pool } = props;
  const empty = pool.credits === 0;
  return (
    <Flex vertical gap={spacing[1]} data-testid={props.testId}>
      <Typography.Text
        strong={!empty}
        {...(empty ? { type: "secondary" as const } : {})}
        style={{ fontSize: empty ? undefined : token.fontSizeLG }}
      >
        {empty
          ? t(props.emptyKey)
          : tPlural(props.countKey, {
              count: pool.credits,
              credits: formatCreditCount(locale, pool.credits),
            })}
      </Typography.Text>
      {/* The fate, always — an empty pool still has to explain what it WOULD
          be, or "no bought credits" reads as an error rather than a state. */}
      <Typography.Text type="secondary">{t(props.hintKey)}</Typography.Text>
      {props.deadline}
    </Flex>
  );
}

/** The debt block: what is owed, why, and what it will do to the next
 * credits that arrive. */
function DebtBlock(props: { wallet: WalletData }): ReactElement | null {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const outstanding = debtOutstanding(props.wallet);
  if (outstanding <= 0) return null;
  const debts = openDebts(props.wallet);
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="billing-wallet-debt"
      title={
        <Typography.Text strong>
          {tPlural(BILLING_I18N_KEYS.walletDebtTotal, {
            count: outstanding,
            credits: formatCreditCount(locale, outstanding),
          })}
        </Typography.Text>
      }
      description={
        <Flex vertical gap={spacing[1]}>
          <Typography.Text>
            {t(BILLING_I18N_KEYS.walletDebtExplain)}
          </Typography.Text>
          {/* Oldest first — the order the server collects them in, kept as
              sent so the list reads as the queue it is.

              Two lines, not one `·`-joined run-on: the reason is a sentence
              and the amount is a number, and gluing them with a middle dot
              produced a third line of the panel that read as neither. */}
          {debts.map((debt) => (
            <Flex
              vertical
              gap={spacing[0]}
              key={debt.id}
              data-testid={`billing-wallet-debt-${debt.id}`}
            >
              <Typography.Text>
                {t(
                  debtReasonKey(debt.reason) ??
                    BILLING_I18N_KEYS.walletDebtReasonOther
                )}
              </Typography.Text>
              <Typography.Text type="secondary">
                {t(BILLING_I18N_KEYS.walletDebtRow, {
                  credits: formatCreditCount(locale, debt.credits_outstanding),
                  initial: formatCreditCount(locale, debt.credits_initial),
                })}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
      }
    />
  );
}

export function WalletBalance(props: { wallet: WalletData }): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const { wallet } = props;
  const pools = creditPools(wallet.lots ?? []);
  const expiring = wallet.expiring_soon ?? null;
  const held = heldCredits(wallet);
  const relative =
    expiring === null ? null : formatDeadlineRelative(locale, expiring.expires_at);

  return (
    <Flex vertical gap={spacing[4]} data-testid="billing-wallet-balance">
      {/* A balance that changes after a checkout must reach a screen reader;
          the region is polite so it never interrupts. */}
      <div aria-live="polite">
        <Statistic
          title={t(BILLING_I18N_KEYS.walletBalance)}
          value={tPlural(BILLING_I18N_KEYS.walletCredits, {
            count: wallet.balance,
            credits: formatCreditCount(locale, wallet.balance),
          })}
        />
      </div>

      <Flex vertical gap={spacing[2]} data-testid="billing-wallet-pools">
        <Typography.Text strong>
          {t(BILLING_I18N_KEYS.walletPoolsHeading)}
        </Typography.Text>
        <PoolRow
          pool={pools.perpetual}
          countKey={BILLING_I18N_KEYS.walletPoolPerpetual}
          emptyKey={BILLING_I18N_KEYS.walletPoolPerpetualNone}
          hintKey={BILLING_I18N_KEYS.walletPoolPerpetualHint}
          testId="billing-wallet-pool-perpetual"
        />
        <PoolRow
          pool={pools.expiring}
          countKey={BILLING_I18N_KEYS.walletPoolExpiring}
          emptyKey={BILLING_I18N_KEYS.walletPoolExpiringNone}
          hintKey={BILLING_I18N_KEYS.walletPoolExpiringHint}
          testId="billing-wallet-pool-expiring"
          deadline={
            expiring === null ? null : (
              <Alert
                type="warning"
                showIcon
                data-testid="billing-wallet-expiring"
                title={
                  relative === null
                    ? t(BILLING_I18N_KEYS.walletExpiring, {
                        credits: formatCreditCount(locale, expiring.credits),
                        date: formatExpiryDate(locale, expiring.expires_at),
                      })
                    : t(BILLING_I18N_KEYS.walletExpiringRelative, {
                        credits: formatCreditCount(locale, expiring.credits),
                        date: formatExpiryDate(locale, expiring.expires_at),
                        relative,
                      })
                }
              />
            )
          }
        />
      </Flex>

      {held === 0 ? null : (
        <Typography.Text type="secondary" data-testid="billing-wallet-held">
          {t(BILLING_I18N_KEYS.walletHeld, {
            credits: formatCreditCount(locale, held),
          })}
        </Typography.Text>
      )}

      <DebtBlock wallet={wallet} />
    </Flex>
  );
}
