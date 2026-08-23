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
 * exact defect `LoadState` exists to prevent, and `matchLoad` here makes the
 * empty sentence reachable only from a read that actually answered.
 */
import type { ReactElement } from "react";
import { Badge, Button, Card, Col, Empty, Flex, Row, Skeleton, Typography } from "antd";
import { matchLoad, toFlowError, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { BillingI18nKey } from "../i18n/keys.js";
import type { PricingCatalog, CheckoutSelection } from "../headless/PricingTable.js";
import {
  bestPerCredit,
  formatMoney,
  formatPerCredit,
  packageOffer,
  perCreditSavingsPercent,
  planOffer,
} from "../model/pricing.js";
import type { CreditOffer } from "../model/pricing.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { BillingSkinTheme } from "./theme.js";
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
}

function OfferCard(props: {
  offer: CreditOffer;
  best: boolean;
  savings: number | null;
  disabled: boolean;
  onChoose: (selection: CheckoutSelection) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { offer, best, savings } = props;
  const recurring = offer.kind === "plan";
  const card = (
    <Card
      size="small"
      data-testid={`billing-offer-${offer.slug}`}
      data-billing-best={best ? "true" : "false"}
      title={offer.name}
    >
      <Flex vertical gap={4} align="flex-start">
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
        <Button
          type={best ? "primary" : "default"}
          disabled={props.disabled}
          data-testid={`billing-offer-buy-${offer.slug}`}
          onClick={() => {
            props.onChoose(
              recurring ? { plan: offer.slug } : { package: offer.slug }
            );
          }}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
        >
          {t(
            recurring
              ? BILLING_I18N_KEYS.pricingSubscribe
              : BILLING_I18N_KEYS.pricingBuy
          )}
        </Button>
      </Flex>
    </Card>
  );
  if (!best) return card;
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
  disabled: boolean;
  testId: string;
  onChoose: (selection: CheckoutSelection) => void;
}): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={8} data-testid={props.testId}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t(props.headingKey)}
      </Typography.Title>
      {props.offers.map((offer) => (
        <OfferCard
          key={`${offer.kind}:${offer.slug}`}
          offer={offer}
          best={offer.slug === props.bestSlug}
          savings={offer.slug === props.savingsSlug ? props.savings : null}
          disabled={props.disabled}
          onChoose={props.onChoose}
        />
      ))}
    </Flex>
  );
}

export function BuyOptions(props: BuyOptionsProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const { mode, state, onChoose, onRetry } = props;
  const disabled = props.isCheckingOut === true;

  return (
    <BillingSkinTheme {...(mode !== undefined ? { mode } : {})}>
      <Flex vertical gap={8} data-testid="billing-buy">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t(BILLING_I18N_KEYS.walletBuyHeading)}
        </Typography.Title>
        {matchLoad(state, {
          loading: () => (
            <div data-testid="billing-buy-loading">
              <Skeleton active />
            </div>
          ),
          failed: (error) => (
            <ErrorAlert
              testId="billing-buy-failed"
              error={describe(toFlowError(error))}
              {...(onRetry
                ? {
                    action: (
                      <Button
                        size="small"
                        onClick={onRetry}
                        data-analytics="none"
                        data-analytics-reason="local-ui-refetch-after-a-stated-read-failure"
                      >
                        {t(BILLING_I18N_KEYS.pricingRetry)}
                      </Button>
                    ),
                  }
                : {})}
            />
          ),
          ready: (catalog) => {
            const packages = catalog.packages.map(packageOffer);
            const plans = catalog.plans.map(planOffer);
            if (packages.length === 0 && plans.length === 0) {
              return (
                <Empty
                  data-testid="billing-buy-empty"
                  description={t(BILLING_I18N_KEYS.pricingEmpty)}
                />
              );
            }
            const bestPackage = bestPerCredit(packages);
            const bestPlan = bestPerCredit(plans);
            const best = bestPerCredit([
              ...(bestPackage ? [bestPackage] : []),
              ...(bestPlan ? [bestPlan] : []),
            ]);
            // Stated against the best PACKAGE, so the number means "versus the
            // other way of buying" rather than "versus our own worst offer".
            const savings = perCreditSavingsPercent(bestPackage, bestPlan);
            return (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <OfferColumn
                    headingKey={BILLING_I18N_KEYS.pricingPackages}
                    offers={packages}
                    bestSlug={best?.kind === "package" ? best.slug : null}
                    savingsSlug={null}
                    savings={null}
                    disabled={disabled}
                    testId="billing-buy-packages"
                    onChoose={onChoose}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <OfferColumn
                    headingKey={BILLING_I18N_KEYS.pricingPlans}
                    offers={plans}
                    bestSlug={best?.kind === "plan" ? best.slug : null}
                    savingsSlug={
                      savings === null ? null : (bestPlan?.slug ?? null)
                    }
                    savings={savings}
                    disabled={disabled}
                    testId="billing-buy-plans"
                    onChoose={onChoose}
                  />
                </Col>
              </Row>
            );
          },
        })}
      </Flex>
    </BillingSkinTheme>
  );
}
