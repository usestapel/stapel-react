/**
 * `<BuyOptions>` — the two ways to buy credits, side by side.
 *
 * THE POINT OF THE LAYOUT IS THE COMPARISON. `GET /products` answers two
 * lists, packages and plans, and a shop that renders them as two unrelated
 * sections (a "Credits" page here, a "Plans" page there) leaves the buyer to
 * work out which is cheaper with a calculator — which is how a plan that IS
 * cheaper per credit ends up selling worse than a top-up. So both columns
 * print the same derived number, `formatPerCredit`, under the same label, and
 * the cheaper side carries the badge that says so out loud.
 *
 * The claim is deliberately narrow: "save N% PER CREDIT", not "cheaper". A
 * plan also buys storage, and a package is a one-time charge against a
 * recurring one — those are the buyer's tradeoffs, not this component's, and
 * `perCreditSavingsPercent` refuses the comparison entirely when the two sides
 * are priced in different currencies.
 *
 * FOUR ARMS, NOT THREE (@stapel/core loadState.ts): "we could not load the
 * catalogue" must never render as "nothing is on sale" — a shop telling
 * customers it sells nothing because its own pricing endpoint is down is the
 * exact defect `LoadState` exists to prevent, and the empty sentence here is
 * reachable only from a read that actually answered.
 *
 * ── The layout is sized by THIS element, not by the window ────────────────
 *
 * The two columns used to come from antd's grid (`<Col xs={24} md={12}>`),
 * whose breakpoints are media queries on the VIEWPORT. Dropped into a 380px
 * side panel on a wide desktop, the shop still rendered two columns squeezed
 * together and the comparison became unreadable. The columns now come from
 * `useElementWidth` — the room this component actually has.
 *
 * ── A control that offers the state you are already in ────────────────────
 *
 * The shop never read the subscription, so a caller already on `pro` was
 * offered a "Subscribe" button on `pro`. It now reads `useSubscription` and
 * switches that one card's button off with the reason printed beside it
 * (`GatedButton`), and marks the card as the caller's plan. Nothing else on
 * the card changes: the price, the per-credit rate and the comparison are
 * still the information a person needs to judge the plan they hold.
 *
 * ── A debt makes the next purchase mean something different ───────────────
 *
 * With `debt_outstanding` in play, buying 100 credits does not add 100
 * spendable credits: the server collects the debt off the top first. Each
 * offer therefore states how many of ITS credits are already spoken for. The
 * number is passed in rather than read here, so a host that mounts the shop
 * alone (a public pricing page) neither needs nor triggers a wallet read.
 */
import type { ReactElement } from "react";
import { Badge, Card, Flex, Tag, Typography } from "antd";
import {
  EmptyState,
  GatedButton,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  useI18n,
  useT,
  useTPlural,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { BillingI18nKey } from "../i18n/keys.js";
import type { PricingCatalog, CheckoutSelection } from "../headless/PricingTable.js";
import {
  bestPerCredit,
  packageOffer,
  perCreditSavingsPercent,
  planOffer,
} from "../model/pricing.js";
import type { CreditOffer } from "../model/pricing.js";
import {
  formatCreditCount,
  formatMoney,
  formatPerCredit,
} from "../model/money.js";
import { collectedFromPurchase } from "../model/credits.js";
import { useSubscription } from "../model/queries.js";
import { columnsForWidth, useElementWidth } from "./elementWidth.js";
import type { ThemeModeProp } from "./types.js";

export interface BuyOptionsProps extends ThemeModeProp {
  /** The catalogue read. One state for both columns — they arrive in one
   * body, so they can never disagree. */
  readonly state: LoadState<PricingCatalog>;
  /** Start a checkout for the chosen package or plan. */
  readonly onChoose: (selection: CheckoutSelection) => void;
  /** A checkout call is in flight — every buy button waits together, because
   * a redirect is about to take the whole page. */
  readonly isCheckingOut?: boolean;
  /** Retry affordance for the failed arm. Absent renders no button. */
  readonly onRetry?: () => void;
  /**
   * The plan slug the caller already holds. Omitted, the component reads it
   * from `useSubscription` itself; pass `null` to state "nobody is signed in
   * here" on a public pricing page and skip the question entirely.
   */
  readonly currentPlan?: string | null;
  /**
   * Credits the wallet owes (`debt_outstanding`). Each offer states how many
   * of its credits the next purchase will hand straight to the debt. Omitted
   * or `0`: nothing is said, because nothing is owed.
   */
  readonly debtOutstanding?: number;
}

/** The caller's ACTIVE plan slug, or null. A cancelled or past-due
 * subscription is deliberately not "the plan you are on": re-subscribing is
 * exactly what such a caller may want to do, and switching the button off
 * would take that away. */
function useHeldPlan(override: string | null | undefined): string | null {
  const query = useSubscription();
  if (override !== undefined) return override;
  const data = query.data;
  if (data === undefined) return null;
  if (data.status !== "active" && data.status !== "trialing") return null;
  return data.plan;
}

function OfferCard(props: {
  offer: CreditOffer;
  best: boolean;
  savings: number | null;
  held: boolean;
  debtOutstanding: number;
  disabled: boolean;
  onChoose: (selection: CheckoutSelection) => void;
}): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { locale } = useI18n();
  const { offer, best, savings, held } = props;
  const recurring = offer.kind === "plan";
  const settles = collectedFromPurchase(props.debtOutstanding, offer.credits);
  const gate: ActionAvailability = held
    ? actionBlocked(BILLING_I18N_KEYS.pricingBlockedCurrentPlan)
    : actionAvailable();
  const card = (
    <Card
      size="small"
      data-testid={`billing-offer-${offer.slug}`}
      data-billing-best={best ? "true" : "false"}
      data-billing-held={held ? "true" : "false"}
      title={
        <Flex align="center" gap={spacing[2]} wrap="wrap">
          <span>{offer.name}</span>
          {held ? (
            <Tag data-testid={`billing-offer-current-${offer.slug}`}>
              {t(BILLING_I18N_KEYS.pricingCurrentPlan)}
            </Tag>
          ) : null}
        </Flex>
      }
    >
      <Flex vertical gap={spacing[1]} align="flex-start">
        <Typography.Text strong data-testid={`billing-offer-price-${offer.slug}`}>
          {recurring
            ? t(BILLING_I18N_KEYS.pricingPerMonth, {
                price: formatMoney(locale, offer.currency, offer.priceCents),
              })
            : formatMoney(locale, offer.currency, offer.priceCents)}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t(
            recurring
              ? BILLING_I18N_KEYS.pricingCreditsMonthly
              : BILLING_I18N_KEYS.pricingCredits,
            { credits: offer.credits }
          )}
        </Typography.Text>
        {/* The comparable number, printed for BOTH sides under one label —
            absent only when the offer prices no credits at all. */}
        {offer.perCreditCents === null ? null : (
          <Typography.Text data-testid={`billing-offer-rate-${offer.slug}`}>
            {t(BILLING_I18N_KEYS.pricingPerCredit, {
              price: formatPerCredit(
                locale,
                offer.currency,
                offer.perCreditCents
              ),
            })}
          </Typography.Text>
        )}
        {savings === null ? null : (
          <Typography.Text
            type="success"
            strong
            data-testid={`billing-offer-savings-${offer.slug}`}
          >
            {t(BILLING_I18N_KEYS.pricingPlanSaves, { percent: savings })}
          </Typography.Text>
        )}
        {/* What this purchase will actually leave spendable. */}
        {settles === 0 ? null : (
          <Typography.Text
            type="warning"
            data-testid={`billing-offer-debt-${offer.slug}`}
          >
            {tPlural(BILLING_I18N_KEYS.pricingSettlesDebt, {
              count: settles,
              credits: formatCreditCount(locale, settles),
            })}
          </Typography.Text>
        )}
        <GatedButton
          gate={gate}
          type={best && !held ? "primary" : "default"}
          loading={props.disabled}
          testId={`billing-offer-buy-${offer.slug}`}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          onClick={() => {
            props.onChoose(
              recurring ? { plan: offer.slug } : { package: offer.slug }
            );
          }}
        >
          {t(
            recurring
              ? BILLING_I18N_KEYS.pricingSubscribe
              : BILLING_I18N_KEYS.pricingBuy
          )}
        </GatedButton>
      </Flex>
    </Card>
  );
  if (!best || held) return card;
  return (
    <Badge.Ribbon text={t(BILLING_I18N_KEYS.pricingBestValue)}>
      {card}
    </Badge.Ribbon>
  );
}

function OfferColumn(props: {
  headingKey: BillingI18nKey;
  offers: readonly CreditOffer[];
  bestSlug: string | null;
  savingsSlug: string | null;
  savings: number | null;
  heldSlug: string | null;
  debtOutstanding: number;
  disabled: boolean;
  testId: string;
  onChoose: (selection: CheckoutSelection) => void;
}): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={spacing[2]} flex="1 1 0" data-testid={props.testId}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t(props.headingKey)}
      </Typography.Title>
      {props.offers.map((offer) => (
        <OfferCard
          key={`${offer.kind}:${offer.slug}`}
          offer={offer}
          best={offer.slug === props.bestSlug}
          savings={offer.slug === props.savingsSlug ? props.savings : null}
          held={offer.kind === "plan" && offer.slug === props.heldSlug}
          debtOutstanding={props.debtOutstanding}
          disabled={props.disabled}
          onChoose={props.onChoose}
        />
      ))}
    </Flex>
  );
}

export function BuyOptions(props: BuyOptionsProps): ReactElement {
  const t = useT();
  const { mode, state, onChoose, onRetry } = props;
  const disabled = props.isCheckingOut === true;
  const heldPlan = useHeldPlan(props.currentPlan);
  const debt = props.debtOutstanding ?? 0;
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const columns = columnsForWidth(width);

  return (
    <SkinTheme surface="bare" {...(mode !== undefined ? { mode } : {})}>
      <div ref={ref} data-billing-columns={String(columns)}>
        <Flex vertical gap={spacing[2]} data-testid="billing-buy">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t(BILLING_I18N_KEYS.walletBuyHeading)}
          </Typography.Title>
          <LoadBoundary
            state={state}
            testId="billing-buy"
            {...(onRetry ? { onRetry } : {})}
          >
            {(catalog) => {
              const packages = catalog.packages.map(packageOffer);
              const plans = catalog.plans.map(planOffer);
              if (packages.length === 0 && plans.length === 0) {
                return (
                  <EmptyState
                    testId="billing-buy-empty"
                    title={t(BILLING_I18N_KEYS.pricingEmpty)}
                  />
                );
              }
              const bestPackage = bestPerCredit(packages);
              const bestPlan = bestPerCredit(plans);
              const best = bestPerCredit([
                ...(bestPackage ? [bestPackage] : []),
                ...(bestPlan ? [bestPlan] : []),
              ]);
              // Stated against the best PACKAGE, so the number means "versus
              // the other way of buying" rather than "versus our own worst
              // offer".
              const savings = perCreditSavingsPercent(bestPackage, bestPlan);
              return (
                <Flex
                  gap={spacing[4]}
                  vertical={columns === 1}
                  align="stretch"
                  data-testid="billing-buy-columns"
                >
                  <OfferColumn
                    headingKey={BILLING_I18N_KEYS.pricingPackages}
                    offers={packages}
                    bestSlug={best?.kind === "package" ? best.slug : null}
                    savingsSlug={null}
                    savings={null}
                    heldSlug={heldPlan}
                    debtOutstanding={debt}
                    disabled={disabled}
                    testId="billing-buy-packages"
                    onChoose={onChoose}
                  />
                  <OfferColumn
                    headingKey={BILLING_I18N_KEYS.pricingPlans}
                    offers={plans}
                    bestSlug={best?.kind === "plan" ? best.slug : null}
                    savingsSlug={
                      savings === null ? null : (bestPlan?.slug ?? null)
                    }
                    savings={savings}
                    heldSlug={heldPlan}
                    debtOutstanding={debt}
                    disabled={disabled}
                    testId="billing-buy-plans"
                    onChoose={onChoose}
                  />
                </Flex>
              );
            }}
          </LoadBoundary>
        </Flex>
      </div>
    </SkinTheme>
  );
}
