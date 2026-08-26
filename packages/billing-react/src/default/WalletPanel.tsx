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
 *
 * ── Five sections, reachable in one tap ───────────────────────────────────
 *
 * On a phone the five parts are ~5,700px of scroll. They are still five
 * parts, still all mounted — a person comparing their balance against a
 * package price needs both on the page at once, which is what rules tabs
 * out — but a narrow layout gets an anchor row so the ledger is one tap away
 * rather than seven viewports. The heading levels are the other half of the
 * same fix: the page is level 3, each section level 4, each column label
 * plain strong text.
 */
import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography, theme as antdTheme } from "antd";
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
import { columnsForWidth, useElementWidth } from "./elementWidth.js";
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

/** The five sections, in the order the questions arrive. The id is both the
 * anchor target and the section's own `id`, so the nav below is ordinary
 * in-page navigation — no scroll listener, no JS, and it still works in a
 * printed page or with scripting off. */
const SECTIONS = [
  { id: "billing-section-balance", labelKey: BILLING_I18N_KEYS.walletBalance },
  { id: "billing-section-subscription", labelKey: BILLING_I18N_KEYS.subHeading },
  { id: "billing-section-buy", labelKey: BILLING_I18N_KEYS.walletBuyHeading },
  {
    id: "billing-section-settings",
    labelKey: BILLING_I18N_KEYS.walletSettingsHeading,
  },
  { id: "billing-section-history", labelKey: BILLING_I18N_KEYS.txHeading },
] as const;

/**
 * The section jumps, on a narrow screen only.
 *
 * The billing page is 5,700px of phone scroll — nearly seven viewports — and
 * had no way to reach the ledger except the whole thumb-journey past the
 * shop. Tabs would have unmounted sections a person came here to compare
 * (the balance against what a package costs), so this is anchors: everything
 * stays on the page and rendered, and the five headings become reachable in
 * one tap. The row scrolls sideways rather than wrapping, so it costs one
 * line at any width.
 */
function SectionNav(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  return (
    <nav
      aria-label={t(BILLING_I18N_KEYS.walletSectionsLabel)}
      data-testid="billing-sections"
      style={{
        display: "flex",
        gap: token.paddingXS,
        overflowX: "auto",
        paddingBottom: token.paddingXXS,
      }}
    >
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          data-analytics="none"
          data-analytics-reason="in-page anchor; navigates nothing and reads nothing"
          style={{
            whiteSpace: "nowrap",
            padding: `${String(token.paddingXXS)}px ${String(token.paddingSM)}px`,
            borderRadius: token.borderRadiusLG,
            border: `${String(token.lineWidth)}px solid ${token.colorBorderSecondary}`,
            color: token.colorText,
          }}
        >
          {t(section.labelKey)}
        </a>
      ))}
    </nav>
  );
}

/** One section of the page: an anchor target that a jump lands ON rather
 * than just above. */
function Section(props: { id: string; children: ReactNode }): ReactElement {
  const { token } = antdTheme.useToken();
  return (
    <section id={props.id} style={{ scrollMarginTop: token.padding }}>
      {props.children}
    </section>
  );
}

export function WalletPanel(props: WalletPanelProps = {}): ReactElement {
  const t = useT();
  const wallet = useWallet();
  const { mode } = props;
  const go = props.onCheckoutUrl ?? assignLocation;
  const walletState = loadStateFromQuery(wallet);
  // The nav earns its line only where the page is a long single column.
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const narrow = columnsForWidth(width) === 1;
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
      <Flex vertical gap={spacing[5]} data-testid="billing-wallet" ref={ref}>
        {/* The page's own heading, a full step above the section headings
            inside it — the audit found page, section and card title set in
            three near-identical weights. */}
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t(BILLING_I18N_KEYS.walletHeading)}
        </Typography.Title>

        {narrow ? <SectionNav /> : null}

        <Section id="billing-section-balance">
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
        </Section>

        <Section id="billing-section-subscription">
          <SubscriptionCard
            {...(mode !== undefined ? { mode } : {})}
            onPortalUrl={go}
          />
        </Section>

        <Section id="billing-section-buy">
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
        </Section>

        <Section id="billing-section-settings">
          <WalletSettings {...(mode !== undefined ? { mode } : {})} />
        </Section>

        <Section id="billing-section-history">
          <TransactionHistory {...(mode !== undefined ? { mode } : {})} />
        </Section>
      </Flex>
    </SkinTheme>
  );
}
