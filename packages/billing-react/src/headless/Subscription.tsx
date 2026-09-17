import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type {
  Subscription as SubscriptionData,
  SubscriptionStatus,
} from "../api/types.js";
import { useSubscription } from "../model/queries.js";
import {
  useCancelSubscription,
  useOpenCustomerPortal,
} from "../model/mutations.js";

/** Render-prop bag for {@link Subscription}. */
export interface SubscriptionBag {
  /** The caller's subscription once loaded, else null. */
  readonly subscription: SubscriptionData | null;
  /** The plan slug (e.g. `pro`), or null before load. */
  readonly plan: string | null;
  /** The lifecycle status, narrowed to the backend's choices, else null. */
  readonly status: SubscriptionStatus | null;
  /**
   * Does this subscription entitle the caller RIGHT NOW?
   *
   * The server's `is_active` when it sends one: it compares
   * `current_period_end` against the clock that bills, and a row whose renewal
   * webhook never arrived reads `status: "active"` forever. Servers older than
   * the field send nothing, and only there does the bag fall back to the
   * status rule (`active` or `trialing`).
   */
  readonly isActive: boolean;
  /**
   * Is there a provider subscription behind this row (`is_paid`)?
   *
   * `plan`/`status` cannot answer it — a free-plan row reads `plan: "free",
   * status: "active"` — so this is what gates a cancel button. `null` on a
   * server that does not send the field: not knowing is not `false`.
   */
  readonly isPaid: boolean | null;
  /** The initial subscription read is in flight. */
  readonly isLoading: boolean;
  /** The read, the cancel, or the portal request failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Cancel the subscription. */
  cancel(): void;
  /** A cancel call is in flight. */
  readonly isCancelling: boolean;
  /** Request a Stripe customer-portal link (then redirect to `portalUrl`). */
  openPortal(): void;
  /** A portal request is in flight. */
  readonly isOpeningPortal: boolean;
  /** The customer-portal URL from the last `openPortal`, else null. */
  readonly portalUrl: string | null;
}

/**
 * Headless subscription control — renderless status, cancel, and customer-portal
 * link for the caller's subscription. Wires {@link useSubscription},
 * {@link useCancelSubscription}, and {@link useOpenCustomerPortal} and hands a
 * {@link SubscriptionBag} to `children`; bring your own status badge / buttons.
 * Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <Subscription>
 *   {({ status, isActive, cancel, openPortal }) => ( ... )}
 * </Subscription>
 * ```
 */
export function Subscription(props: {
  children: (bag: SubscriptionBag) => ReactNode;
}): ReactNode {
  const query = useSubscription();
  const cancelMutation = useCancelSubscription();
  const portalMutation = useOpenCustomerPortal();
  const subscription = query.data ?? null;
  const status = (subscription?.status ?? null) as SubscriptionStatus | null;
  return props.children({
    subscription,
    plan: subscription?.plan ?? null,
    status,
    isActive:
      subscription?.is_active ?? (status === "active" || status === "trialing"),
    isPaid: subscription?.is_paid ?? null,
    isLoading: query.isLoading,
    isError: query.isError || cancelMutation.isError || portalMutation.isError,
    error:
      query.error ?? cancelMutation.error ?? portalMutation.error ?? null,
    cancel: () => {
      cancelMutation.mutate();
    },
    isCancelling: cancelMutation.isPending,
    openPortal: () => {
      portalMutation.mutate();
    },
    isOpeningPortal: portalMutation.isPending,
    portalUrl: portalMutation.data?.portal_url ?? null,
  });
}
