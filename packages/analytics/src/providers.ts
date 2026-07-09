import type { AnalyticsEvent, AnalyticsProvider, StapelClient } from "@stapel/core";

/** Dev provider: logs every event via console.debug. Never throws. */
export function consoleProvider(): AnalyticsProvider {
  const log = (...args: unknown[]): void => {
    try {
      console.debug("[stapel analytics]", ...args);
    } catch {
      // Never throws — a broken console must not fail a batch.
    }
  };
  return {
    track: (event) => {
      log(event.kind, event.name, event.props);
    },
    identify: (userHash, traits) => {
      log("identify", userHash, traits ?? {});
    },
    page: (name, props) => {
      log("page", name, props ?? {});
    },
  };
}

export interface StapelCollectorOptions {
  /** Collector origin, e.g. `https://api.example.com`. */
  readonly baseUrl?: string;
  /**
   * Alternatively reuse a `StapelClient` (its base URL, auth headers and
   * error envelope handling).
   */
  readonly client?: StapelClient;
  /** Source write key (analytics-standard §3); sent in the batch body. */
  readonly writeKey?: string;
  /** Injectable fetch (tests). */
  readonly fetch?: typeof globalThis.fetch;
}

const COLLECTOR_PATH = "/analytics/api/events";

/**
 * Built-in provider for the stapel-analytics ingest endpoint: buffers
 * events handed over by the facade and POSTs `{events: [...]}` to
 * `{base}/analytics/api/events` on flush (one request per facade batch).
 * During page teardown (document hidden) it prefers `navigator.sendBeacon`
 * so the final batch survives navigation; otherwise fetch with keepalive.
 * On a failed send the buffer is surrendered back to the facade's retry
 * (the facade re-delivers the batch, repopulating the buffer).
 */
export function stapelCollectorProvider(
  options: StapelCollectorOptions
): AnalyticsProvider {
  const baseUrl = options.baseUrl ?? options.client?.baseUrl;
  if (baseUrl === undefined) {
    throw new Error("stapelCollectorProvider requires a baseUrl or a client");
  }
  const endpoint = `${baseUrl.replace(/\/+$/, "")}${COLLECTOR_PATH}`;
  let buffer: AnalyticsEvent[] = [];

  async function send(events: readonly AnalyticsEvent[]): Promise<void> {
    const body: Record<string, unknown> = { events };
    if (options.writeKey !== undefined) body["write_key"] = options.writeKey;

    const teardown =
      typeof document !== "undefined" &&
      document.visibilityState === "hidden" &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function";
    if (teardown) {
      const accepted = navigator.sendBeacon(
        endpoint,
        new Blob([JSON.stringify(body)], { type: "application/json" })
      );
      if (accepted) return;
      // Beacon rejected (payload too large / unsupported) — fall through.
    }

    if (options.client) {
      await options.client.post(COLLECTOR_PATH, body);
      return;
    }
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!response.ok) {
      throw new Error(
        `[stapel analytics] collector responded ${String(response.status)}`
      );
    }
  }

  return {
    track: (event) => {
      buffer.push(event);
    },
    flush: async () => {
      if (buffer.length === 0) return;
      const events = buffer;
      buffer = [];
      await send(events);
    },
  };
}
