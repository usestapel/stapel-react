import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  DeviceListItem,
  DeviceTokenRequest,
  DeviceTokenResponse,
  NotificationFeedPage,
  NotificationFeedParams,
  Platform,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react): the
 * simplest SPA rule is to always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there, so
 * every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return {
    ...options,
    headers: { ...CSRF_HEADERS, ...options?.headers },
  };
}

/**
 * The pair's typed operation surface — one method per stapel-notifications
 * endpoint a JS client may call, bound to the injected {@link StapelClient}
 * (the per-module override seam of frontend-standard §7.2). Paths are relative
 * to the runtime's `baseUrl` (e.g. `/notifications/api/v1/`).
 *
 * The staff/service-only `GET /notification-keys/` (translate collector) is
 * intentionally absent — it is not part of any end-user surface.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2 (task `core-typed-ops`); until then they are hand-authored here (the ONE
 * legal home of path strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface NotificationsApi {
  readonly client: StapelClient;

  /** Register (or re-bind) a push token for the current user. */
  registerDevice(token: string, platform: Platform): Promise<DeviceTokenResponse>;
  /** Unregister a push token. Resolves on 204; 404 becomes a StapelApiError. */
  unregisterDevice(token: string): Promise<void>;
  /**
   * The caller's own push devices, most recently registered first. The read
   * that lets a toggle tell the truth (stapel-notifications 0.17.0): the raw
   * token is never echoed, so a client identifies its own row by hashing the
   * token it holds and matching `token_fingerprint`.
   */
  listDevices(): Promise<readonly DeviceListItem[]>;
  /**
   * Unregister a device by the id `listDevices` handed out — the only way to
   * drop a device whose token this client does not (and cannot) hold. Resolves
   * on 204; someone else's id answers `error.404.device_not_found`.
   */
  unregisterDeviceById(deviceId: number): Promise<void>;
  /** A page of the user's notification feed (newest first, anchor-paginated). */
  feed(params?: NotificationFeedParams): Promise<NotificationFeedPage>;
}

export function createNotificationsApi(client: StapelClient): NotificationsApi {
  return {
    client,

    registerDevice: (token, platform) =>
      client.post(
        "/devices/",
        { token, platform } satisfies DeviceTokenRequest,
        mutating()
      ),

    unregisterDevice: (token) =>
      client.delete(`/devices/${encodeURIComponent(token)}/`, mutating()),

    listDevices: () => client.get("/devices/"),

    unregisterDeviceById: (deviceId) =>
      client.delete(`/devices/by-id/${String(deviceId)}/`, mutating()),

    feed: (params) => {
      const query: Record<string, string | number> = {};
      if (params?.anchor !== undefined) query.anchor = params.anchor;
      if (params?.direction !== undefined) query.direction = params.direction;
      if (params?.limit !== undefined) query.limit = params.limit;
      return client.get("/feed/", { query });
    },
  };
}
