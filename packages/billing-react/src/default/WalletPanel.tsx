/**
 * `<WalletPanel>` — the billing screen: what you hold, what you owe, what you
 * pay for, how to get more, and where it all went.
 *
 * ── Why one screen ────────────────────────────────────────────────────────
 *
 * These are five surfaces (`WalletBalance`, `SubscriptionCard`,
 * `BuyOptions`, `WalletSettings`, `TransactionHistory`) and each stands on
 * its own for a host that wants only one. Together they are the account's
 * billing page, in the order the questions arrive: what do I have → what am I
 * subscribed to → how do I get more → should it top up by itself → where did
 * the last lot go.
 *
 * ── Independent reads, independent fates ──────────────────────────────────
 *
 * The wallet, the subscription, the catalogue and the ledger are four
 * requests, and each part renders its own loading/failed/empty arms through
 * the shared substrate. A wallet that failed to load must not take the way to
 * BUY credits down with it — that failure mode is exactly how a paying
 * customer ends up unable to pay — and a ledger outage must not hide the
 * balance. The one thing that crosses a boundary is the debt total, handed to
 * the shop so each offer can say how much of it the next purchase settles;
 * absent (loading, failed) it is 0 and the shop simply says nothing.
 *
 * ── Nothing here re-sorts or re-derives the server's arithmetic ───────────
 *
 * `lots` arrive in spend order, `expiring_soon` is picked by the backend that
 * will do the expiring, and `debt_outstanding` is totalled by the one that
 * will collect it. Every part renders them as given.
 */
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { loadStateFromQuery, matchLoad, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import { PricingTable } from "../headless/PricingTable.js";
import { useWallet } from "../model/queries.js";
import { isEmptyWallet } from "../model/credits.js";
import { BuyOptions } from "./BuyOptions.js";
import { SubscriptionCard } from "./SubscriptionCard.js";
import { TransactionHistory } from "./TransactionHistory.js";
import { WalletBalance } from "./WalletBalance.js";
import { WalletSettings } from "./WalletSettings.js";
import type { ThemeModeProp } from "./types.js";

export interface WalletPanelProps extends ThemeModeProp {
  /**
   * Where to send the browser once checkout — or the customer portal —
   * answers with a hosted URL. Defaults to `location.assign`; a host may pass
   * its router's navigate, and a test passes a spy.
   */
  readonly onCheckoutUrl?: (url: string) => void;
}

/** The default redirect. Module-level so its identity is stable across
 * renders (it is an effect dependency). */
function assignLocation(url: string): void {
  globalThis.location.assign(url);
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
  const wallet = useWallet();
  const { mode } = props;
  const go = props.onCheckoutUrl ?? assignLocation;
  const walletState = loadStateFromQuery(wallet);
  // A debt we have not read is not a debt of 0 — but it is the same silence,
  // and the shop's line about it is an addition to a card, not a claim the
  // screen would otherwise make. Loading and failed therefore say nothing.
  const debt = matchLoad(wallet.debtOutstanding, {
    loading: () => 0,
    failed: () => 0,
    ready: (owed) => owed,
  });

  return (
    <SkinTheme
      surface="base"
      {...(mode !== undefined ? { mode } : {})}
      style={{ padding: spacing[4] }}
    >
      <Flex vertical gap={spacing[5]} data-testid="billing-wallet">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t(BILLING_I18N_KEYS.walletHeading)}
        </Typography.Title>

        <LoadBoundary
          state={walletState}
          testId="billing-wallet"
          onRetry={() => {
            void wallet.refetch();
          }}
        >
          {(data) =>
            isEmptyWallet(data) ? (
              <EmptyState
                testId="billing-wallet-empty"
                title={t(BILLING_I18N_KEYS.walletEmpty)}
                hint={t(BILLING_I18N_KEYS.walletEmptyHint)}
              />
            ) : (
              <WalletBalance wallet={data} />
            )
          }
        </LoadBoundary>

        <SubscriptionCard
          {...(mode !== undefined ? { mode } : {})}
          onPortalUrl={go}
        />

        <PricingTable>
          {(bag) => (
            <>
              <CheckoutRedirect url={bag.checkoutUrl} go={go} />
              <BuyOptions
                {...(mode !== undefined ? { mode } : {})}
                state={bag.state}
                isCheckingOut={bag.isCheckingOut}
                debtOutstanding={debt}
                onChoose={bag.checkout}
                onRetry={bag.refetch}
              />
              <ErrorAlert
                testId="billing-checkout-failed"
                thrown={bag.error}
              />
            </>
          )}
        </PricingTable>

        <WalletSettings {...(mode !== undefined ? { mode } : {})} />

        <TransactionHistory {...(mode !== undefined ? { mode } : {})} />
      </Flex>
    </SkinTheme>
  );
}
