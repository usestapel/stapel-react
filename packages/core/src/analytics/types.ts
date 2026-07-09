/**
 * Analytics facade types (analytics-standard.md §1–2). Packages and hosts
 * talk to the facade only — never to providers directly
 * (frontend-standard §4.7).
 */

import type { PersistStorage } from "../storage.js";
import type { AnyEventDef, EventProps } from "./events.js";

export type AnalyticsEventKind = "track" | "page" | "identify";

export type ConsentState = "granted" | "denied" | "pending";

export type PiiGuardMode = "strip" | "warn" | "off";

/** A captured event as providers receive it (PII-guarded, user id hashed). */
export interface AnalyticsEvent {
  /** Facade-assigned id, unique per instance lifetime (dedupe aid). */
  readonly id: string;
  readonly kind: AnalyticsEventKind;
  /** track: registry event name; page: page name; identify: `"identify"`. */
  readonly name: string;
  /** track/page props or identify traits, after the PII guard. */
  readonly props: Record<string, unknown>;
  /** SHA-256 hex of the user id (identify events only). */
  readonly userHash?: string;
  /** Epoch ms at capture time. */
  readonly ts: number;
}

/**
 * A fan-out target. Only `track` is mandatory: events of kind `page` /
 * `identify` fall back to `track(event)` when the dedicated method is
 * absent (the event carries its `kind`). `flush` is called after each
 * delivered batch and on page teardown — batching providers (like the
 * Stapel collector) send there. A rejected/thrown delivery marks the whole
 * batch as undelivered for this provider; it will be retried.
 */
export interface AnalyticsProvider {
  track(event: AnalyticsEvent): void | Promise<void>;
  identify?(
    userHash: string,
    traits?: Record<string, unknown>
  ): void | Promise<void>;
  page?(name: string, props?: Record<string, unknown>): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export interface AnalyticsBatchOptions {
  /** Queue length that triggers an automatic flush. Default 20. */
  readonly maxSize?: number;
  /** Periodic flush interval, ms. Default 10000. */
  readonly flushIntervalMs?: number;
  /** Delivery attempts per batch before it is dropped. Default 5. */
  readonly maxAttempts?: number;
  /** Base of the exponential retry backoff, ms. Default 500. */
  readonly backoffBaseMs?: number;
}

export interface AnalyticsOptions {
  /** Initial named providers (more via `register`/`unregister`). */
  readonly providers?: Record<string, AnalyticsProvider>;
  /**
   * Event registry (analytics-standard §1.1): `track` with a name outside
   * it logs a dev console.warn but still delivers — the hard gate is the
   * eslint rule against the project's events.json.
   */
  readonly registry?: readonly string[];
  /**
   * Initial consent when none has been persisted yet. Default `"pending"`.
   * A state persisted by `setConsent` takes precedence on recreation.
   */
  readonly consent?: ConsentState;
  /** PII guard mode for prop/trait values. Default `"strip"`. */
  readonly piiGuard?: PiiGuardMode;
  readonly batch?: AnalyticsBatchOptions;
  /** Storage key prefix for the offline queue + consent. Default `"stapel-analytics"`. */
  readonly persistKey?: string;
  /** Storage override (tests, custom stores). Default: IndexedDB → localStorage → memory. */
  readonly storage?: PersistStorage;
}

export interface Analytics {
  /**
   * Queue a registry event. No-op while consent is `"denied"`.
   *
   * Two forms (frontend-guardrails §3.1):
   *  - `track(name, props?)` — the low-level string form, kept for library
   *    auto-instrumentation (`flow.<id>.<step>`); in app code the eslint rule
   *    steers callers to the typed form.
   *  - `track(event, props)` — the typed form: `event` is a {@link defineEvent}
   *    object, `props` is checked against its schema (required props enforced,
   *    unknown props rejected, `oneOf` narrowed).
   */
  track(event: string, props?: Record<string, unknown>): void;
  track<E extends AnyEventDef>(event: E, props: EventProps<E>): void;
  /**
   * Queue an identify. The raw `userId` never leaves the facade: providers
   * see its SHA-256 hex. Traits pass the PII guard.
   */
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Queue a page view. */
  page(name: string, props?: Record<string, unknown>): void;
  /** Deliver everything queued (one delivery attempt per pending batch). */
  flush(): Promise<void>;
  /**
   * Consent gate (analytics-standard §1.4): `"pending"` buffers,
   * `"granted"` flushes the buffer, `"denied"` drops it (memory +
   * persisted) and turns subsequent calls into no-ops. Persisted.
   */
  setConsent(state: ConsentState): Promise<void>;
  /** Current consent state (after async restore; see `flush`). */
  getConsent(): ConsentState;
  /** Register a provider at runtime (merge semantics). */
  register(name: string, provider: AnalyticsProvider): void;
  unregister(name: string): void;
  /**
   * @internal Dev-only double-count detector (frontend-guardrails §3.2).
   * `tracked()` opens a scope around its wrapped handler; a `flow.*` emission
   * inside that scope is a `tracked()`-over-a-flow-step double count and warns.
   * Returns a closer. Absent (undefined) in production builds — callers guard
   * with `?.`.
   */
  __trackedScope?(eventName: string): () => void;
}
