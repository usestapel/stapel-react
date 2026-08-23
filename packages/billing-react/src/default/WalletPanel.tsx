/**
 * `<WalletPanel>` — the wallet screen: what you have, what is about to die,
 * and the two ways to get more.
 *
 * ── Why the deadline is on the SAME screen as the shop ────────────────────
 *
 * stapel-billing 0.8.0 made a balance a set of lots with expiry dates, and a
 * credit that expires without the holder ever being told is indistinguishable,
 * from the holder's side, from a credit that was taken. So the panel states
 * the nearest deadline in words — "N credits expire on <date>" — from the
 * server's own `expiring_soon`, next to the balance it will shrink.
 *
 * ── FOUR outcomes, four sentences, none collapsing into another ───────────
 *
 *   loading — we are asking                    (skeleton)
 *   failed  — we could not ask                 (stated refusal + retry)
 *   empty   — we asked; this wallet has none   (and the shop below still shows)
 *   ready   — the balance, and what is behind it
 *
 * "Empty" here is a real, checked condition — no balance, no lots AND no
 * holds — not `balance || 0`. A wallet whose balance is zero because every
 * credit is reserved is NOT empty, and saying so would tell a customer their
 * credits are gone while they are in fact spoken for.
 *
 * ── Nothing here re-sorts or re-derives the server's arithmetic ───────────
 *
 * `lots` arrive in spend order and `expiring_soon` is picked by the backend
 * that will do the expiring; the panel renders both as given. A client-side
 * "earliest lot" scan would be a second implementation of a rule that already
 * has one, and the two would drift the first time the backend changed it.
 *
 * ── Two reads, two fates ──────────────────────────────────────────────────
 *
 * The wallet and the catalogue are separate requests and are rendered as
 * such: a wallet that failed to load must not take the way to BUY credits
 * down with it — that failure mode is how a paying customer ends up unable to
 * pay.
 */
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Button,
  Empty,
  Flex,
  Skeleton,
  Statistic,
  Typography,
} from "antd";
import {
  loadStateFromQuery,
  matchLoad,
  toFlowError,
  useDescribeFlowError,
  useI18n,
  useT,
} from "@stapel/core";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { Wallet as WalletData } from "../api/types.js";
import { PricingTable } from "../headless/PricingTable.js";
import { useWallet } from "../model/queries.js";
import { formatExpiryDate } from "../model/pricing.js";
import { BuyOptions } from "./BuyOptions.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { BillingSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface WalletPanelProps extends ThemeModeProp {
  /**
   * Where to send the browser once checkout answers with a hosted URL.
   * Defaults to `location.assign` — a host may pass its router's navigate, and
   * a test passes a spy.
   */
  readonly onCheckoutUrl?: (url: string) => void;
}

/** The default redirect. Module-level so its identity is stable across
 * renders (it is an effect dependency). */
function assignLocation(url: string): void {
  globalThis.location.assign(url);
}

/** No balance, no lots and no holds — the honest empty wallet. */
function isEmptyWallet(wallet: WalletData): boolean {
  return (
    wallet.balance <= 0 &&
    (wallet.lots ?? []).length === 0 &&
    (wallet.holds ?? []).length === 0
  );
}

/** Credits currently reserved — `balance` already excludes them, so the
 * number is stated separately rather than added to anything. */
function heldCredits(wallet: WalletData): number {
  let total = 0;
  for (const hold of wallet.holds ?? []) total += hold.credits;
  return total;
}

function BalanceBlock(props: { wallet: WalletData }): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { wallet } = props;
  const expiring = wallet.expiring_soon ?? null;
  const held = heldCredits(wallet);
  return (
    <Flex
      vertical
      gap={8}
      align="flex-start"
      data-testid="billing-wallet-balance"
    >
      <Statistic
        title={t(BILLING_I18N_KEYS.walletBalance)}
        value={wallet.balance}
        suffix={wallet.currency}
      />
      {expiring === null ? null : (
        <Alert
          type="warning"
          showIcon
          data-testid="billing-wallet-expiring"
          message={t(BILLING_I18N_KEYS.walletExpiring, {
            credits: expiring.credits,
            date: formatExpiryDate(locale, expiring.expires_at),
          })}
        />
      )}
      {held === 0 ? null : (
        <Typography.Text type="secondary" data-testid="billing-wallet-held">
          {t(BILLING_I18N_KEYS.walletHeld, { credits: held })}
        </Typography.Text>
      )}
    </Flex>
  );
}

/**
 * The redirect, as an effect rather than a render-time call: a checkout
 * session is server truth and navigating away is a side effect, so it happens
 * after the paint that showed the "redirecting" state, not during it.
 */
function CheckoutRedirect(props: {
  url: string | null;
  go: (url: string) => void;
}): null {
  const { url, go } = props;
  // The handler is held in a ref so a host that passes an inline arrow does
  // not re-fire the navigation on every render — the URL is what changes.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);
  useEffect(() => {
    if (url !== null) goRef.current(url);
  }, [url]);
  return null;
}

export function WalletPanel(props: WalletPanelProps = {}): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const wallet = useWallet();
  const { mode } = props;
  const go = props.onCheckoutUrl ?? assignLocation;
  const walletState = loadStateFromQuery(wallet);

  return (
    <BillingSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={16} data-testid="billing-wallet">
        {matchLoad(walletState, {
          loading: () => (
            <div data-testid="billing-wallet-loading">
              <Skeleton active />
            </div>
          ),
          failed: (error) => (
            <ErrorAlert
              testId="billing-wallet-failed"
              error={describe(toFlowError(error))}
              action={
                <Button
                  size="small"
                  onClick={() => {
                    void wallet.refetch();
                  }}
                  data-analytics="none"
                  data-analytics-reason="local-ui-refetch-after-a-stated-read-failure"
                >
                  {t(BILLING_I18N_KEYS.walletRetry)}
                </Button>
              }
            />
          ),
          ready: (data) =>
            isEmptyWallet(data) ? (
              <Empty
                data-testid="billing-wallet-empty"
                description={t(BILLING_I18N_KEYS.walletEmpty)}
              />
            ) : (
              <BalanceBlock wallet={data} />
            ),
        })}

        <PricingTable>
          {(bag) => (
            <>
              <CheckoutRedirect url={bag.checkoutUrl} go={go} />
              <BuyOptions
                {...(mode !== undefined ? { mode } : {})}
                state={bag.state}
                isCheckingOut={bag.isCheckingOut}
                onChoose={bag.checkout}
                onRetry={bag.refetch}
              />
              {bag.error === null ? null : (
                <ErrorAlert
                  testId="billing-checkout-failed"
                  error={describe(toFlowError(bag.error))}
                />
              )}
            </>
          )}
        </PricingTable>
      </Flex>
    </BillingSkinTheme>
  );
}
