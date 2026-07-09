import { defaultPersistStorage } from "@stapel/core";
import type { PersistStorage } from "@stapel/core";
import { guardPii } from "./pii.js";
import { sha256Hex } from "./hash.js";
import type { AnyEventDef } from "@stapel/core";
import type {
  Analytics,
  AnalyticsEvent,
  AnalyticsEventKind,
  AnalyticsOptions,
  AnalyticsProvider,
  ConsentState,
} from "@stapel/core";

/** Exponential backoff delay for a batch delivery attempt (1-based). */
export function backoffDelay(attempt: number, baseMs: number): number {
  return Math.min(30_000, baseMs * 2 ** Math.max(0, attempt - 1));
}

/** Whether dev-only diagnostics run — off in production bundles. */
function devEnabled(): boolean {
  // Read process.env via globalThis so core needs no @types/node; bundlers
  // (Vite/webpack) statically replace `process.env.NODE_ENV`, so this
  // dead-code-eliminates to `false` in production builds.
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return !env || env["NODE_ENV"] !== "production";
}

interface InflightBatch {
  events: AnalyticsEvent[];
  attempts: number;
  /** Provider names that already accepted this batch (never re-called). */
  delivered: Set<string>;
}

async function deliverToProvider(
  provider: AnalyticsProvider,
  events: readonly AnalyticsEvent[]
): Promise<void> {
  for (const event of events) {
    if (event.kind === "identify" && provider.identify) {
      await provider.identify(event.userHash ?? "", event.props);
    } else if (event.kind === "page" && provider.page) {
      await provider.page(event.name, event.props);
    } else {
      await provider.track(event);
    }
  }
  await provider.flush?.();
}

/**
 * The analytics facade (analytics-standard §2): fan-out to N providers,
 * consent gate, offline queue on the core persist layer, batched delivery
 * with retry/backoff, PII guard, hashed identify.
 */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const providers = new Map<string, AnalyticsProvider>(
    Object.entries(options.providers ?? {})
  );
  const registry =
    options.registry !== undefined ? new Set(options.registry) : null;
  const piiMode = options.piiGuard ?? "strip";
  const persistKey = options.persistKey ?? "stapel-analytics";
  const storage: PersistStorage = options.storage ?? defaultPersistStorage();
  const maxSize = options.batch?.maxSize ?? 20;
  const flushIntervalMs = options.batch?.flushIntervalMs ?? 10_000;
  const maxAttempts = options.batch?.maxAttempts ?? 5;
  const backoffBaseMs = options.batch?.backoffBaseMs ?? 500;

  const eventsKey = `${persistKey}:events`;
  const consentKey = `${persistKey}:consent`;

  let consent: ConsentState = options.consent ?? "pending";
  let queue: AnalyticsEvent[] = [];
  let batch: InflightBatch | null = null;
  let flushing = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  const warnedPii = new Set<string>();
  const warnedRegistry = new Set<string>();
  const warnedDouble = new Set<string>();
  /** Dev-only: the tracked() event name whose handler is currently running. */
  let trackedScopeName: string | null = null;
  /** In-flight async work (identify hashing, persist writes) awaited by flush. */
  let pendingOps: Promise<unknown>[] = [];
  /** Serializes identify hashing so enqueue order matches call order. */
  let identifyChain: Promise<void> = Promise.resolve();

  const ready: Promise<void> = (async () => {
    try {
      const storedConsent = await storage.get(consentKey);
      if (
        storedConsent === "granted" ||
        storedConsent === "denied" ||
        storedConsent === "pending"
      ) {
        consent = storedConsent;
      }
      const storedEvents = await storage.get(eventsKey);
      if (Array.isArray(storedEvents)) {
        // Restored events precede anything captured before init finished.
        queue = [...(storedEvents as AnalyticsEvent[]), ...queue];
      }
    } catch {
      // Storage unavailable — degrade to in-memory only.
    }
  })();

  async function persistQueue(): Promise<void> {
    try {
      if (consent === "denied") {
        await storage.del(eventsKey);
        return;
      }
      const pending = batch ? [...batch.events, ...queue] : queue;
      await storage.set(eventsKey, pending);
    } catch {
      // Best-effort.
    }
  }

  function schedulePersist(): void {
    pendingOps.push(ready.then(persistQueue));
  }

  function clearRetryTimer(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(delayMs: number): void {
    if (retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush();
    }, delayMs);
    (retryTimer as { unref?: () => void }).unref?.();
  }

  function enqueue(
    kind: AnalyticsEventKind,
    name: string,
    props: Record<string, unknown>,
    userHash?: string
  ): void {
    seq += 1;
    const event: AnalyticsEvent = {
      id: `${String(Date.now())}-${String(seq)}`,
      kind,
      name,
      props,
      ...(userHash !== undefined ? { userHash } : {}),
      ts: Date.now(),
    };
    queue.push(event);
    schedulePersist();
    if (consent === "granted" && queue.length >= maxSize) {
      void flush();
    }
  }

  /** One delivery attempt for the current batch. True = batch settled. */
  async function attemptBatch(): Promise<boolean> {
    const current = batch;
    if (current === null) return true;
    current.attempts += 1;
    await Promise.all(
      [...providers.entries()].map(async ([name, provider]) => {
        if (current.delivered.has(name)) return;
        try {
          await deliverToProvider(provider, current.events);
          current.delivered.add(name);
        } catch {
          // Undelivered for this provider; batch will be retried.
        }
      })
    );
    const undelivered = [...providers.keys()].filter(
      (name) => !current.delivered.has(name)
    );
    if (undelivered.length === 0) {
      batch = null;
      clearRetryTimer();
      return true;
    }
    if (current.attempts >= maxAttempts) {
      console.warn(
        `[stapel analytics] dropping a batch of ${String(current.events.length)} event(s) ` +
          `after ${String(current.attempts)} attempts; undelivered to: ${undelivered.join(", ")}`
      );
      batch = null;
      clearRetryTimer();
      return true;
    }
    scheduleRetry(backoffDelay(current.attempts, backoffBaseMs));
    return false;
  }

  async function flush(): Promise<void> {
    await ready;
    const ops = pendingOps;
    pendingOps = [];
    await Promise.all(ops);
    if (flushing) return;
    flushing = true;
    try {
      if (consent !== "granted") return;
      for (;;) {
        if (batch === null) {
          if (queue.length === 0 || providers.size === 0) break;
          batch = {
            events: queue.splice(0, maxSize),
            attempts: 0,
            delivered: new Set<string>(),
          };
        }
        const settled = await attemptBatch();
        if (!settled) break;
      }
    } finally {
      flushing = false;
      await persistQueue();
    }
  }

  async function setConsent(state: ConsentState): Promise<void> {
    await ready;
    consent = state;
    try {
      await storage.set(consentKey, state);
    } catch {
      // Best-effort.
    }
    if (state === "denied") {
      queue = [];
      batch = null;
      clearRetryTimer();
      try {
        await storage.del(eventsKey);
      } catch {
        // Best-effort.
      }
      return;
    }
    if (state === "granted") {
      await flush();
    }
  }

  function track(
    event: string | AnyEventDef,
    props?: Record<string, unknown>
  ): void {
    if (consent === "denied") return;
    const name = typeof event === "string" ? event : event.name;
    // Dev-only: a flow.* emission while a tracked() handler runs = double count
    // (the flow step is already auto-instrumented). frontend-guardrails §3.2.
    if (
      trackedScopeName !== null &&
      trackedScopeName !== name &&
      name.startsWith("flow.")
    ) {
      const key = `${trackedScopeName}→${name}`;
      if (!warnedDouble.has(key)) {
        warnedDouble.add(key);
        console.warn(
          `[stapel analytics] double-count: tracked("${trackedScopeName}") wraps a ` +
            `handler that also steps flow "${name}". A flow-stepping click is already ` +
            `instrumented — drop the tracked() wrapper and mark the element ` +
            `data-analytics="flow" (frontend-guardrails §3.2).`
        );
      }
    }
    if (registry && !registry.has(name) && !warnedRegistry.has(name)) {
      warnedRegistry.add(name);
      console.warn(
        `[stapel analytics] event "${name}" is not in the registry ` +
          "(analytics-standard §1.1) — delivered anyway; declare it in events.json."
      );
    }
    enqueue("track", name, guardPii(name, props ?? {}, piiMode, warnedPii));
  }

  function page(name: string, props?: Record<string, unknown>): void {
    if (consent === "denied") return;
    enqueue("page", name, guardPii(name, props ?? {}, piiMode, warnedPii));
  }

  function identify(userId: string, traits?: Record<string, unknown>): void {
    if (consent === "denied") return;
    const guarded = guardPii("identify", traits ?? {}, piiMode, warnedPii);
    identifyChain = identifyChain
      .then(() => sha256Hex(userId))
      .then((userHash) => {
        enqueue("identify", "identify", guarded, userHash);
      });
    pendingOps.push(identifyChain);
  }

  function finalFlush(): void {
    // Best-effort teardown flush; batching providers use sendBeacon here.
    void flush();
    for (const provider of providers.values()) {
      try {
        void provider.flush?.();
      } catch {
        // Never break page teardown.
      }
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", finalFlush);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") finalFlush();
    });
  }

  const interval = setInterval(() => {
    if (consent === "granted" && (queue.length > 0 || batch !== null)) {
      void flush();
    }
  }, flushIntervalMs);
  (interval as { unref?: () => void }).unref?.();

  const facade: Analytics = {
    track,
    identify,
    page,
    flush,
    setConsent,
    getConsent: () => consent,
    register: (name, provider) => {
      providers.set(name, provider);
    },
    unregister: (name) => {
      providers.delete(name);
    },
  };
  if (devEnabled()) {
    facade.__trackedScope = (eventName: string): (() => void) => {
      const prev = trackedScopeName;
      trackedScopeName = eventName;
      return () => {
        trackedScopeName = prev;
      };
    };
  }
  return facade;
}
