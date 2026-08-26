import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  useActiveSessionReady,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type {
  CreateSubscriptionBody,
  SubscriptionFilters,
} from "../api/webhooksApi.js";
import type {
  Subscription,
  SubscriptionPatch,
  SubscriptionSecret,
} from "../api/types.js";
import { WEBHOOKS_EVENTS } from "../analytics/events.js";
import { useWebhooksAnalytics, useWebhooksApi } from "./context.js";
import { isSignedDelivery } from "./deliveryTypes.js";
import { webhooksQueryKeys } from "./queryKeys.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";

/**
 * A stable cache identity for a filter set. Sorted, so `{isActive, eventType}`
 * and `{eventType, isActive}` are ONE cache entry rather than two copies of the
 * same list that invalidate independently.
 */
export function subscriptionFiltersKey(filters?: SubscriptionFilters): string {
  if (filters === undefined) return "";
  const parts: string[] = [];
  if (filters.eventType !== undefined) parts.push(`event=${filters.eventType}`);
  if (filters.isActive !== undefined) parts.push(`active=${String(filters.isActive)}`);
  if (filters.limit !== undefined) parts.push(`limit=${String(filters.limit)}`);
  return parts.sort().join("&");
}

/**
 * Write a new rule.
 *
 * Standalone (rather than only living on the list bag) because the subscription
 * SHEET needs it and the sheet must not start a second copy of the list query
 * just to reach a mutation.
 */
export function useCreateSubscription(): UseMutationResult<
  SubscriptionSecret,
  StapelApiError,
  CreateSubscriptionBody
> {
  const api = useWebhooksApi();
  const analytics = useWebhooksAnalytics();
  const queryClient = useQueryClient();
  return useMutation<SubscriptionSecret, StapelApiError, CreateSubscriptionBody>(
    {
      mutationFn: (body) => api.createSubscription(body),
      onSuccess: (_secret, body) => {
        analytics?.track(WEBHOOKS_EVENTS.subscriptionCreated, {
          delivery: body.delivery,
        });
        void queryClient.invalidateQueries({
          queryKey: webhooksQueryKeys.subscriptions,
        });
      },
    }
  );
}

/** What {@link useSubscriptions} reports. */
export interface SubscriptionsBag {
  readonly rows: LoadState<readonly Subscription[]>;
  /** Rules the backend switched off after repeated dead letters. */
  readonly autoDisabled: readonly Subscription[];
  readonly refetch: () => void;
  readonly create: UseMutationResult<
    SubscriptionSecret,
    StapelApiError,
    CreateSubscriptionBody
  >;
  /**
   * Flip `is_active`. **Re-activating also resets the strike counter**
   * (`services.py`: `consecutive_failures = 0`, `disabled_at = None`), which
   * the switch's copy says — a person turning a rule back on is entitled to
   * know it gets a full ladder of attempts again and not one.
   */
  readonly toggleActive: UseMutationResult<
    Subscription,
    StapelApiError,
    { readonly id: string; readonly isActive: boolean }
  >;
  /** Delete. It CASCADES the delivery log, and the confirm says so. */
  readonly remove: UseMutationResult<void, StapelApiError, string>;
}

/**
 * The caller's reaction rules.
 *
 * ── `autoDisabled` is lifted out of the list on purpose ───────────────────
 *
 * A rule the backend switched off after `DISABLE_AFTER_DEAD` consecutive dead
 * letters is the single thing on this screen somebody must act on, and it is
 * indistinguishable from a rule a person switched off themselves unless the
 * screen looks at `disabled_at`. The threshold itself is a setting and is not
 * served (BACKEND-GAP W-7), so the copy says "after repeated failures" rather
 * than inventing a number.
 */
export function useSubscriptions(
  filters?: SubscriptionFilters,
  options: { readonly enabled?: boolean } = {}
): SubscriptionsBag {
  const api = useWebhooksApi();
  const analytics = useWebhooksAnalytics();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);
  const filtersKey = subscriptionFiltersKey(filters);

  const query = useQuery({
    queryKey: webhooksQueryKeys.subscriptionList(filtersKey),
    queryFn: ({ signal }) => api.subscriptions(filters, { signal }),
    enabled,
  });

  const rows = loadStateFromQuery(query);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({
      queryKey: webhooksQueryKeys.subscriptions,
    });
  };

  const create = useCreateSubscription();

  const toggleActive = useMutation<
    Subscription,
    StapelApiError,
    { readonly id: string; readonly isActive: boolean }
  >({
    mutationFn: (input) =>
      api.updateSubscription(input.id, { is_active: input.isActive }),
    onSuccess: (row, input) => {
      analytics?.track(WEBHOOKS_EVENTS.subscriptionToggled, {
        active: input.isActive,
      });
      queryClient.setQueryData(webhooksQueryKeys.subscription(row.id), row);
      invalidate();
    },
  });

  const removeOptions: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (id) => api.deleteSubscription(id),
    onSuccess: (_deleted, id) => {
      // The delete cascades the delivery log server-side, so the log's cache
      // goes with it rather than surviving as rows pointing at nothing.
      queryClient.removeQueries({ queryKey: webhooksQueryKeys.subscription(id) });
      void queryClient.invalidateQueries({
        queryKey: webhooksQueryKeys.deliveries,
      });
      invalidate();
    },
  };
  const remove = useMutation(removeOptions);

  // A rule with a `disabled_at` was switched off by the BACKEND after repeated
  // dead letters; one without it was switched off by a person. Read off the
  // load state, so a failed read can never be drawn as "nothing is broken".
  const autoDisabled =
    rows.status === "ready"
      ? rows.data.filter((row) => !row.is_active && row.disabled_at != null)
      : [];

  return {
    rows,
    autoDisabled,
    refetch: () => {
      void query.refetch();
    },
    create,
    toggleActive,
    remove,
  };
}

/** One rule by id — the read the edit sheet and the log header share. */
export function useSubscription(
  subscriptionId: string | undefined,
  options: { readonly enabled?: boolean } = {}
): {
  readonly state: LoadState<Subscription>;
  readonly refetch: () => void;
} {
  const api = useWebhooksApi();
  const sessionReady = useActiveSessionReady();
  const enabled =
    sessionReady && subscriptionId !== undefined && (options.enabled ?? true);

  const query = useQuery({
    queryKey: webhooksQueryKeys.subscription(subscriptionId ?? ""),
    queryFn: ({ signal }) => api.subscription(subscriptionId ?? "", { signal }),
    enabled,
  });

  return {
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Edit one rule in place (the sheet's save). */
export function useUpdateSubscription(): UseMutationResult<
  Subscription,
  StapelApiError,
  { readonly id: string; readonly patch: SubscriptionPatch }
> {
  const api = useWebhooksApi();
  const queryClient = useQueryClient();
  return useMutation<
    Subscription,
    StapelApiError,
    { readonly id: string; readonly patch: SubscriptionPatch }
  >({
    mutationFn: (input) => api.updateSubscription(input.id, input.patch),
    onSuccess: (row) => {
      queryClient.setQueryData(webhooksQueryKeys.subscription(row.id), row);
      void queryClient.invalidateQueries({
        queryKey: webhooksQueryKeys.subscriptions,
      });
    },
  });
}

/** What {@link useSecretRotation} reports. */
export interface SecretRotationBag {
  /**
   * Whether rotation is offered at all. Blocked — with the reason beside the
   * control — for a delivery type that carries no signature (`ws`,
   * `notification`, `custom`), because the backend's answer for those is a 400
   * `webhooks_not_signed_type` and a button that exists only to be refused is
   * a button that should not exist.
   */
  readonly rotate: ActionAvailability;
  readonly confirming: boolean;
  readonly ask: () => void;
  readonly cancel: () => void;
  readonly run: () => void;
  readonly isPending: boolean;
  readonly error: unknown;
  /**
   * The new secret — **held only in this hook's state, only until the person
   * acknowledges it**. There is no re-read: `SubscriptionPresenterDTO` carries
   * `has_secret`, never `secret`.
   */
  readonly secret: string | undefined;
  readonly acknowledge: () => void;
}

/**
 * Rotate the signing secret of one subscription.
 *
 * ── The confirm is not ceremony ───────────────────────────────────────────
 *
 * There is **no overlap window** (BACKEND-GAP W-3). The old secret stops
 * verifying the instant this returns, so every delivery to a receiver that has
 * not been updated fails from that moment — and after enough of them the
 * backend disables the subscription. That is a live integration going down as
 * a direct consequence of one click, which is exactly the situation a
 * destructive confirm exists for, and the copy says the sentence rather than
 * asking "are you sure?".
 */
export function useSecretRotation(
  subscriptionId: string | undefined,
  deliveryType: string | undefined
): SecretRotationBag {
  const api = useWebhooksApi();
  const analytics = useWebhooksAnalytics();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [secret, setSecret] = useState<string | undefined>(undefined);

  const mutation = useMutation<SubscriptionSecret, StapelApiError, string>({
    mutationFn: (id) => api.rotateSecret(id),
    onSuccess: (result) => {
      analytics?.track(WEBHOOKS_EVENTS.secretRotated);
      setSecret(result.secret);
      setConfirming(false);
      void queryClient.invalidateQueries({
        queryKey: webhooksQueryKeys.subscriptions,
      });
    },
  });

  const rotate: ActionAvailability =
    subscriptionId === undefined
      ? actionBlocked(WEBHOOKS_I18N_KEYS.secretRotateUnsaved)
      : deliveryType !== undefined && !isSignedDelivery(deliveryType)
        ? actionBlocked(WEBHOOKS_I18N_KEYS.secretRotateUnsigned, {
            delivery: deliveryType,
          })
        : actionAvailable();

  return {
    rotate,
    confirming,
    ask: () => setConfirming(true),
    cancel: () => setConfirming(false),
    run: () => {
      if (subscriptionId !== undefined) mutation.mutate(subscriptionId);
    },
    isPending: mutation.isPending,
    error: mutation.error,
    secret,
    // Acknowledging DROPS it. The whole contract of a shown-once secret is
    // that nothing keeps a copy — including this hook.
    acknowledge: () => setSecret(undefined),
  };
}
