import type { StapelClient } from "@stapel/core";
import type {
  Delivery,
  DeliveryStatus,
  DeliveryTarget,
  EventCatalog,
  ReplayResult,
  Subscription,
  SubscriptionPatch,
  SubscriptionSecret,
} from "./types.js";

/**
 * The pair's typed operation surface over stapel-webhooks's ten operations
 * (`urls_v1.py`), mounted on the module base the host injects
 * (`/webhooks/api/v1/`).
 *
 * ── No trailing slashes, anywhere ─────────────────────────────────────────
 *
 * `urls_v1.py` registers every route WITHOUT one, and Django's
 * `APPEND_SLASH` only rescues a GET — a POST to `subscriptions/` is a 301 that
 * a browser replays as a GET, i.e. a create that silently becomes a list. So
 * the paths here carry none, and `pair.test.ts` asserts it against the wire.
 *
 * ── Every route is mandate-scoped ─────────────────────────────────────────
 *
 * `HasWorkspaceMandateIfScoped` guards all ten (`views.py`; MODULE.md said
 * otherwise until backend 0.1.1). In a multi-tenant deployment that gate can
 * answer **503 `error.503.mandate_unavailable`** — "we could not check whether
 * you are in this workspace", which is neither a permission failure nor a
 * fault of the request. `model/refusals.ts` names it so the screens can say
 * so instead of drawing a generic error.
 */
export interface WebhooksApi {
  readonly client: StapelClient;

  /**
   * What this deployment can react to, and how it can deliver. Generated from
   * installed packages' `schemas/emits/` on every call — never a mirror of a
   * list somebody maintains, which is why the picker reads it instead of
   * shipping its own catalogue.
   */
  eventCatalog(options?: {
    readonly signal?: AbortSignal;
  }): Promise<EventCatalog>;

  /**
   * The caller's reaction rules. A BARE ARRAY, not a page: there is no cursor
   * on this endpoint and `limit` is clamped server-side, so the pair clamps it
   * here too rather than asking for a number the backend will quietly reduce
   * (BACKEND-GAP W-2).
   */
  subscriptions(
    filters?: SubscriptionFilters,
    options?: { readonly signal?: AbortSignal }
  ): Promise<readonly Subscription[]>;

  /**
   * Write a new rule. The **201 carries the signing secret**, and it is the
   * only response that ever will — `SubscriptionPresenterDTO` has
   * `has_secret`, never `secret`. A caller that drops this body has lost the
   * secret for a receiver that has not been configured yet.
   */
  createSubscription(body: CreateSubscriptionBody): Promise<SubscriptionSecret>;

  subscription(
    subscriptionId: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<Subscription>;

  updateSubscription(
    subscriptionId: string,
    patch: SubscriptionPatch
  ): Promise<Subscription>;

  /** 204, and it CASCADES the delivery log with it. */
  deleteSubscription(subscriptionId: string): Promise<void>;

  /**
   * Rotate the signing secret and hand back the new one.
   *
   * There is **no overlap window** (BACKEND-GAP W-3): the moment this
   * resolves, deliveries are signed with the new secret and a receiver still
   * checking the old one rejects every one of them. The confirm copy says
   * that in as many words. Refuses with 400 `webhooks_not_signed_type` for a
   * delivery type that carries no signature at all.
   */
  rotateSecret(subscriptionId: string): Promise<SubscriptionSecret>;

  /**
   * The delivery log of one rule — including its dead letters. Rows carry the
   * full `payload` (BACKEND-GAP W-4), which is why the log renders it behind
   * an expand rather than in a column.
   */
  deliveries(
    subscriptionId: string,
    filters?: DeliveryFilters,
    options?: { readonly signal?: AbortSignal }
  ): Promise<readonly Delivery[]>;

  delivery(
    deliveryId: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<Delivery>;

  /** Put a dead letter back in the queue. Anything else is a 409. */
  replay(deliveryId: string): Promise<ReplayResult>;
}

/** Query for `GET subscriptions`. */
export interface SubscriptionFilters {
  readonly eventType?: string;
  readonly isActive?: boolean;
  readonly limit?: number;
}

/** Query for `GET subscriptions/{id}/deliveries`. */
export interface DeliveryFilters {
  readonly status?: DeliveryStatus;
  readonly limit?: number;
}

/**
 * What a create is called with — camelCase in, snake_case on the wire.
 *
 * `filter` is spelled the way the API spells it (the column is
 * `payload_filter`; the vocabulary of the feature is "filter") and is
 * validated by `model/filter.ts` BEFORE it is sent, because the backend's
 * refusal is a single `webhooks_invalid_filter` that names no position.
 */
export interface CreateSubscriptionBody {
  readonly eventType: string;
  readonly delivery: string;
  readonly target: DeliveryTarget;
  readonly filter?: unknown;
  readonly description?: string;
  /** The workspace partition, when the deployment scopes by one. */
  readonly workspaceId?: string;
}

/**
 * `MAX_SUBSCRIPTIONS_PER_OWNER` is 100 by default and the list view clamps
 * `limit` to it server-side (BACKEND-GAP W-2: the ceiling is not served, so
 * this mirrors `conf.py`). Asking for more is asking for a number the server
 * will reduce without saying so.
 */
export const SUBSCRIPTION_LIST_LIMIT = 100;

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

const clamp = (limit: number | undefined): number | undefined =>
  limit === undefined ? undefined : Math.min(limit, SUBSCRIPTION_LIST_LIMIT);

/** An id is a UUID from the server, and it is still escaped: the rule holds
 * by shape rather than by an argument about this particular type. */
const seg = (value: string): string => encodeURIComponent(value);

export function createWebhooksApi(client: StapelClient): WebhooksApi {
  return {
    client,

    eventCatalog: (options) =>
      client.get("/event-catalog", signalOf(options)),

    subscriptions: (filters, options) =>
      client.get("/subscriptions", {
        query: {
          event_type: filters?.eventType,
          is_active: filters?.isActive,
          limit: clamp(filters?.limit),
        },
        ...signalOf(options),
      }),

    createSubscription: (body) =>
      client.post("/subscriptions", {
        event_type: body.eventType,
        delivery: body.delivery,
        target: body.target,
        ...(body.filter !== undefined ? { filter: body.filter } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.workspaceId !== undefined
          ? { workspace_id: body.workspaceId }
          : {}),
      }),

    subscription: (subscriptionId, options) =>
      client.get(`/subscriptions/${seg(subscriptionId)}`, signalOf(options)),

    updateSubscription: (subscriptionId, patch) =>
      client.patch(`/subscriptions/${seg(subscriptionId)}`, patch),

    deleteSubscription: (subscriptionId) =>
      client.delete(`/subscriptions/${seg(subscriptionId)}`),

    rotateSecret: (subscriptionId) =>
      client.post(`/subscriptions/${seg(subscriptionId)}/secret`),

    deliveries: (subscriptionId, filters, options) =>
      client.get(`/subscriptions/${seg(subscriptionId)}/deliveries`, {
        query: {
          status: filters?.status,
          limit: clamp(filters?.limit),
        },
        ...signalOf(options),
      }),

    delivery: (deliveryId, options) =>
      client.get(`/deliveries/${seg(deliveryId)}`, signalOf(options)),

    replay: (deliveryId) =>
      client.post(`/deliveries/${seg(deliveryId)}/replay`),
  };
}
