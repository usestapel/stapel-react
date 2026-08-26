/**
 * `<SubscriptionCard/>` — the subscription, its next date, and the two things
 * a person can do about it.
 *
 * ── The §54 hole this fills ───────────────────────────────────────────────
 *
 * `Subscription` shipped as a headless bag over three operations (status,
 * cancel, customer portal) and five already-translated i18n keys, with no
 * default skin at all. The audit's story showed the consequence: a card whose
 * whole content was a `pro · active` chip, the word "Active", and two
 * buttons — with the renewal date, the price and the plan's meaning nowhere.
 *
 * ── The destructive action is LAST, quiet, and confirmed ──────────────────
 *
 * The old story had "Cancel subscription" as a solid primary sitting FIRST,
 * left of "Manage billing" — the exit was the loudest thing on the card, and
 * in dark mode the two buttons became more identical, not less (visual class
 * VC-A6). Here "Manage billing" is the primary, "Cancel subscription" is a
 * quiet danger text button at the bottom, and it opens `SkinConfirm` — a
 * bottom sheet on a phone, a modal above 768px — whose confirm NAMES the act
 * and whose body says what survives it. `danger` focuses Cancel-the-dialog
 * first and refuses a backdrop tap, so the destructive path takes a
 * deliberate second press.
 *
 * ── "No subscription" is a state, not an empty card ───────────────────────
 *
 * stapel-billing auto-creates a `free` row for every caller, so there is
 * ALWAYS a subscription object and never a 404. A card that rendered that row
 * literally would show "Plan: free · Active" with a Cancel button that
 * cancels nothing a person bought. Instead the free tier renders as what it
 * is — no paid plan — with a sentence pointing at the shop below and no dead
 * controls beside it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Tag, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinConfirm,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  mapLoad,
  matchLoad,
  useI18n,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type {
  Plan,
  Subscription as SubscriptionData,
} from "../api/types.js";
import { useCatalog, useSubscription } from "../model/queries.js";
import {
  useCancelSubscription,
  useOpenCustomerPortal,
} from "../model/mutations.js";
import { formatExpiryDate } from "../model/money.js";
import {
  subscriptionStatusKey,
  subscriptionStatusTone,
  tagColorForTone,
  titleCaseSlug,
} from "./labels.js";
import type { ThemeModeProp } from "./types.js";

/** The plan the backend hands every caller who has bought nothing. */
const FREE_PLAN = "free";

export interface SubscriptionCardProps extends ThemeModeProp {
  /**
   * Where to send the browser once the customer portal answers with a URL.
   * Defaults to `location.assign`; a host passes its router's navigate and a
   * test passes a spy.
   */
  readonly onPortalUrl?: (url: string) => void;
}

function assignLocation(url: string): void {
  globalThis.location.assign(url);
}

/** The plan's display NAME from the catalogue, or a title-cased slug when the
 * catalogue does not list it (a legacy plan, a catalogue outage, or a read
 * still in flight). The three cases share an outcome on purpose: the name is
 * a caption, and a caption is not worth a second load state on this card. */
function usePlanName(slug: string): string {
  const catalog = useCatalog();
  const plans = matchLoad(
    // `answered` is the catalogue body of a read that SUCCEEDED, not a
    // query's `.data` half: the wire marks `plans` optional, and inside a
    // successful read its absence honestly means "this shop sells no plans".
    mapLoad(loadStateFromQuery(catalog), (answered) => answered.plans ?? []),
    {
      loading: (): readonly Plan[] => [],
      failed: (): readonly Plan[] => [],
      ready: (ready) => ready,
    }
  );
  for (const plan of plans) {
    if (plan.slug === slug) return plan.name;
  }
  return titleCaseSlug(slug);
}

/** Whether cancelling is a real action right now, and why not when it is not. */
function cancelGate(subscription: SubscriptionData): ActionAvailability {
  if (subscription.status === "cancelled") {
    return actionBlocked(BILLING_I18N_KEYS.subCancelBlocked);
  }
  return actionAvailable();
}

function SubscriptionBody(props: {
  subscription: SubscriptionData;
  go: (url: string) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { subscription } = props;
  const planName = usePlanName(subscription.plan);
  const cancel = useCancelSubscription();
  const portal = useOpenCustomerPortal();
  const [confirming, setConfirming] = useState(false);

  // The free tier is not a subscription a person bought — see the file note.
  if (subscription.plan === FREE_PLAN) {
    return (
      <Flex vertical gap={spacing[1]} data-testid="billing-subscription-none">
        <Typography.Text>{t(BILLING_I18N_KEYS.subNone)}</Typography.Text>
        <Typography.Text type="secondary">
          {t(BILLING_I18N_KEYS.subNoneHint)}
        </Typography.Text>
      </Flex>
    );
  }

  const cancelled = subscription.status === "cancelled";
  const periodEnd = subscription.current_period_end;
  const gate = cancelGate(subscription);
  const tone = subscriptionStatusTone(subscription.status);
  const tagColor = tagColorForTone(tone);

  return (
    <Flex vertical gap={spacing[3]} data-testid="billing-subscription-active">
      <Flex align="center" gap={spacing[2]} wrap="wrap">
        <Typography.Text strong data-testid="billing-subscription-plan">
          {planName}
        </Typography.Text>
        {/* The tone is decided by the STATE, in one table beside the label —
            not by "is it cancelled?", which is how "Payment overdue" ended up
            green (visual class VC-B4). */}
        <Tag
          {...(tagColor !== undefined ? { color: tagColor } : {})}
          data-testid="billing-subscription-status"
          data-billing-tone={tone}
        >
          {t(subscriptionStatusKey(subscription.status))}
        </Tag>
      </Flex>

      {/* The date, in words. "Renews on" and "Runs until" are different
          promises, and which one applies is exactly what a cancelled
          subscription's holder needs to read. */}
      {periodEnd === null ? null : (
        <Typography.Text
          type="secondary"
          data-testid="billing-subscription-period"
        >
          {t(cancelled ? BILLING_I18N_KEYS.subEnds : BILLING_I18N_KEYS.subRenews, {
            date: formatExpiryDate(locale, periodEnd),
          })}
        </Typography.Text>
      )}

      {subscription.status === "past_due" ? (
        <ErrorAlert
          variant="block"
          message={t(BILLING_I18N_KEYS.subPastDue)}
          detail={t(BILLING_I18N_KEYS.subPastDueHint)}
          testId="billing-subscription-past-due"
        />
      ) : null}

      {portal.isError ? (
        <ErrorAlert thrown={portal.error} testId="billing-portal-failed" />
      ) : null}
      {cancel.isError ? (
        <ErrorAlert thrown={cancel.error} testId="billing-cancel-failed" />
      ) : null}

      {/* Primary first: the thing most people came here to do. */}
      <Flex vertical gap={spacing[2]} align="flex-start">
        <Button
          type="primary"
          loading={portal.isPending}
          data-testid="billing-subscription-manage"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          onClick={() => {
            portal.mutate(undefined, {
              onSuccess: (data) => {
                props.go(data.portal_url);
              },
            });
          }}
        >
          {t(
            portal.isPending
              ? BILLING_I18N_KEYS.subOpeningPortal
              : BILLING_I18N_KEYS.subManage
          )}
        </Button>

        {/* The way out: last, quiet, and behind a confirm. */}
        <GatedButton
          gate={gate}
          type="text"
          danger
          size="small"
          testId="billing-subscription-cancel"
          data-analytics="none"
          data-analytics-reason="opens the cancel confirmation; the mutation is fired from the dialog"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t(BILLING_I18N_KEYS.subCancel)}
        </GatedButton>
      </Flex>

      <SkinConfirm
        open={confirming}
        danger
        title={t(BILLING_I18N_KEYS.subCancelConfirmTitle, { plan: planName })}
        body={t(BILLING_I18N_KEYS.subCancelConfirmBody)}
        confirmLabel={t(BILLING_I18N_KEYS.subCancel)}
        confirming={cancel.isPending}
        data-testid="billing-subscription-cancel-confirm"
        onConfirm={() => {
          cancel.mutate(undefined, {
            onSettled: () => {
              setConfirming(false);
            },
          });
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </Flex>
  );
}

/**
 * The subscription surface: status, the next date, the customer portal, and
 * a confirmed way out. Composed into `<WalletPanel/>`; mountable on its own
 * by a host that owns the rest of its billing page.
 */
export function SubscriptionCard(
  props: SubscriptionCardProps = {}
): ReactElement {
  const t = useT();
  const { mode } = props;
  const go = props.onPortalUrl ?? assignLocation;
  const query = useSubscription();
  const state = mapLoad(
    loadStateFromQuery(query),
    (subscription) => subscription
  );

  return (
    <SkinTheme
      surface="bare"
      {...(mode !== undefined ? { mode } : {})}
      data-testid="billing-subscription"
    >
      <Card size="small" title={t(BILLING_I18N_KEYS.subHeading)}>
        <LoadBoundary
          state={state}
          testId="billing-subscription"
          onRetry={() => {
            void query.refetch();
          }}
        >
          {(subscription) => (
            <SubscriptionBody subscription={subscription} go={go} />
          )}
        </LoadBoundary>
      </Card>
    </SkinTheme>
  );
}
