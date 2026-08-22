/**
 * The upload bag — an ordered queue of picks, each running the dedup-first
 * flow, with the reference list a consuming module actually stores hanging off
 * the front of it.
 *
 * ── This is the shape listings' composer consumes ──────────────────────────
 *
 * `Listing.images_draft` is a list of opaque `<type>/<hash>` strings whose
 * ORDER is the gallery order (`stapel_listings/serializers.py` dedupes it and
 * otherwise keeps it verbatim). So the bag's contract with a composer is three
 * things and no more:
 *
 *   bag.refs       the list to send, in display order
 *   bag.reorder    the only way that order changes
 *   bag.settled    an ActionAvailability that says whether it is safe to send
 *
 * `settled` is what stops the composer from publishing a draft whose photos
 * are still in flight — the classic "I pressed Save and half the pictures are
 * missing". It is an availability rather than a boolean because a blocked Save
 * has to be able to say WHICH of the two reasons it is (still uploading / one
 * failed), and a boolean cannot.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  StapelApiError,
  toStapelApiError,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { CdnImage, CdnRef } from "../api/types.js";
import { useCdnRuntime } from "../model/context.js";
import type { CdnIntakeLimits } from "../model/limits.js";
import { acceptAttribute, validateFile } from "../model/limits.js";
import { isUploadCanceled, runUpload } from "../model/upload.js";
import type {
  CdnUploadTarget,
  DedupSkipReason,
  UploadPhase,
} from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";

/** One pick in the queue, at whatever step of the flow it has reached. */
export interface UploadItem {
  readonly id: string;
  /**
   * The picked file, or `null` for an item restored from a reference the
   * caller already had — a reopened draft has references but no bytes.
   */
  readonly file: File | null;
  readonly phase: UploadPhase;
  /** `<type>/<hash>`, as soon as the CDN holds the bytes. */
  readonly ref: CdnRef | null;
  /** The CDN row, when this item's flow produced one. */
  readonly image: CdnImage | null;
  /** The pre-check hit: these bytes were already stored and nothing was sent. */
  readonly deduped: boolean;
  /** Why the pre-check did not run, when it did not. */
  readonly dedupSkipped: DedupSkipReason | undefined;
  /** Whether the variant ladder existed by the time the flow stopped waiting. */
  readonly variantsReady: boolean;
  readonly error: StapelApiError | null;
}

export interface UseUploadQueueOptions {
  /**
   * How many references this gallery may hold. The storefront's listing
   * composer passes 10; a single-image field passes 1.
   */
  readonly max: number;
  /** Where the bytes go. Default: `{ kind: "image" }`. */
  readonly target?: CdnUploadTarget;
  /** References this queue starts with — a reopened draft. */
  readonly initialRefs?: readonly CdnRef[];
  /** How many uploads run at once. Default 3. */
  readonly concurrency?: number;
  /** Called whenever `refs` changes, including on reorder and removal. */
  readonly onRefsChange?: (refs: readonly CdnRef[]) => void;
}

export interface UploadQueueBag {
  readonly items: readonly UploadItem[];
  /**
   * The settled references in display order — the value a composer stores.
   * Items still uploading or failed contribute nothing, so this list is never
   * a promise about bytes that are not there.
   */
  readonly refs: readonly CdnRef[];
  readonly capacity: {
    readonly max: number;
    readonly used: number;
    readonly remaining: number;
  };
  /** The deployment's ceilings for this intake, plus the `accept` string. */
  readonly accept: {
    readonly attribute: string;
    readonly limits: CdnIntakeLimits;
  };
  /** Available while there is room; blocked WITH the reason when full. */
  readonly canAdd: ActionAvailability;
  /**
   * Available when every item has a reference; blocked while any is in flight
   * and blocked when any failed. This is the composer's submit gate.
   */
  readonly settled: ActionAvailability;
  /**
   * Admit files. Anything over `max` or refused by the client-side mirror is
   * still ADMITTED, as a failed item carrying its refusal — a file that
   * vanishes on drop teaches the person nothing. `remove` is how it leaves.
   */
  add(files: Iterable<File>): void;
  /** Re-run a failed or canceled item's flow from the top. */
  retry(id: string): void;
  /** Abort an in-flight item. It stays in the queue, canceled, retryable. */
  cancel(id: string): void;
  /** Drop an item entirely. */
  remove(id: string): void;
  /** Move an item; this is what makes the gallery order editable. */
  reorder(from: number, to: number): void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `upload-${String(counter)}`;
}

function refsOf(items: readonly UploadItem[]): readonly CdnRef[] {
  const out: CdnRef[] = [];
  for (const item of items) if (item.ref !== null) out.push(item.ref);
  return out;
}

function isInFlight(phase: UploadPhase): boolean {
  return (
    phase === "hashing" ||
    phase === "checking" ||
    phase === "uploading" ||
    phase === "processing"
  );
}

const RESTORED: Omit<UploadItem, "id" | "ref"> = {
  file: null,
  phase: "done",
  image: null,
  deduped: false,
  dedupSkipped: undefined,
  variantsReady: false,
  error: null,
};

export function useUploadQueue(options: UseUploadQueueOptions): UploadQueueBag {
  const runtime = useCdnRuntime();
  const limits = runtime.limits.image;
  const target: CdnUploadTarget = options.target ?? { kind: "image" };
  const concurrency = options.concurrency ?? 3;
  const { max, onRefsChange } = options;

  const [items, setItems] = useState<readonly UploadItem[]>(() =>
    (options.initialRefs ?? []).map((ref) => ({ ...RESTORED, id: nextId(), ref }))
  );

  // Per-item abort handles and a started-set. The set is what keeps React's
  // double-invoked effects (StrictMode, and any re-render that reorders the
  // list) from starting the same upload twice — the queue is driven by an
  // effect over state, so "have I already begun this id" cannot be answered
  // from the state itself.
  const controllers = useRef(new Map<string, AbortController>());
  const started = useRef(new Set<string>());

  // The latest callback, read from inside the runner without making the runner
  // depend on the caller's render identity.
  const onRefsChangeRef = useRef(onRefsChange);
  onRefsChangeRef.current = onRefsChange;

  const patch = useCallback(
    (id: string, next: Partial<UploadItem>): void => {
      setItems((current) => {
        let changed = false;
        const updated = current.map((item) => {
          if (item.id !== id) return item;
          changed = true;
          return { ...item, ...next };
        });
        return changed ? updated : current;
      });
    },
    []
  );

  const targetRef = useRef(target);
  targetRef.current = target;
  const limitsRef = useRef(limits);
  limitsRef.current = limits;
  const apiRef = useRef(runtime.api);
  apiRef.current = runtime.api;
  const variantsRef = useRef(runtime.variants);
  variantsRef.current = runtime.variants;

  const start = useCallback(
    (item: UploadItem): void => {
      const file = item.file;
      if (file === null) return;
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      patch(item.id, { phase: "hashing", error: null });

      void runUpload(apiRef.current, file, {
        target: targetRef.current,
        limits: limitsRef.current,
        signal: controller.signal,
        onPhase: (phase) => {
          // The terminal phases are written from the outcome below, together
          // with the data they are terminal ABOUT — a phase that says "done"
          // one render before the reference exists is a gallery that flickers
          // an empty tile.
          if (phase === "done" || phase === "failed" || phase === "canceled") {
            return;
          }
          patch(item.id, { phase });
        },
        ...(variantsRef.current !== undefined
          ? { variants: variantsRef.current }
          : {}),
      }).then(
        (outcome) => {
          controllers.current.delete(item.id);
          patch(item.id, {
            phase: "done",
            ref: outcome.ref,
            image: outcome.image,
            deduped: outcome.deduped,
            dedupSkipped: outcome.dedupSkipped,
            variantsReady: outcome.variantsReady,
            error: null,
          });
        },
        (error: unknown) => {
          controllers.current.delete(item.id);
          if (isUploadCanceled(error)) {
            patch(item.id, { phase: "canceled", error: null });
            return;
          }
          patch(item.id, { phase: "failed", error: toStapelApiError(error) });
        }
      );
    },
    [patch]
  );

  // The pump: whenever the list changes, begin as many idle items as the
  // concurrency budget allows.
  useEffect(() => {
    const running = items.filter((item) => isInFlight(item.phase)).length;
    let budget = concurrency - running;
    if (budget <= 0) return;
    for (const item of items) {
      if (budget <= 0) break;
      if (item.phase !== "idle" || item.file === null) continue;
      if (started.current.has(item.id)) continue;
      started.current.add(item.id);
      budget -= 1;
      start(item);
    }
  }, [items, concurrency, start]);

  // Abort everything still in flight when the control goes away. Without this
  // a person who navigates off mid-upload leaves requests running against a
  // component that can no longer report what happened to them.
  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight.values()) controller.abort();
      inFlight.clear();
    };
  }, []);

  const refs = useMemo(() => refsOf(items), [items]);
  const refsKey = refs.join(" ");
  const lastRefsKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastRefsKey.current === refsKey) return;
    lastRefsKey.current = refsKey;
    onRefsChangeRef.current?.(refs);
    // `refs` is derived from `refsKey`; depending on both would re-fire on
    // every render that rebuilds the array with equal contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined value, not the array identity
  }, [refsKey]);

  const add = useCallback(
    (files: Iterable<File>): void => {
      setItems((current) => {
        const admitted: UploadItem[] = [];
        let room = max - current.length;
        for (const file of files) {
          const overflow =
            room <= 0
              ? new StapelApiError({
                  // The gallery ceiling is the PAIR's rule, not stapel-cdn's:
                  // the backend has no opinion on how many photos a listing
                  // carries (stapel-listings does, and it passes the number
                  // in). So the refusal lives in this pair's own namespace
                  // rather than borrowing a code the server can never send —
                  // and its status is 0, because nothing was asked of any
                  // server. Inventing a 4xx would make a client-side rule
                  // indistinguishable from a refusal that came over the wire.
                  code: CDN_I18N_KEYS.blockedFull,
                  message: "The gallery is full",
                  status: 0,
                  params: { max },
                })
              : null;
          room -= 1;
          const refusal = overflow ?? validateFile(file, limitsRef.current);
          admitted.push({
            id: nextId(),
            file,
            phase: refusal === null ? "idle" : "failed",
            ref: null,
            image: null,
            deduped: false,
            dedupSkipped: undefined,
            variantsReady: false,
            error: refusal,
          });
        }
        return admitted.length === 0 ? current : [...current, ...admitted];
      });
    },
    [max]
  );

  const cancel = useCallback((id: string): void => {
    const controller = controllers.current.get(id);
    if (controller !== undefined) {
      controller.abort();
      return;
    }
    // An item still WAITING for a concurrency slot has no request to abort,
    // and "cancel" has to mean cancel for it too — otherwise pressing it on a
    // queued tile does nothing visible and the file uploads a moment later
    // anyway. Marking the id as started keeps the pump from picking it up;
    // `retry` clears that, so a canceled item is still retryable.
    started.current.add(id);
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.phase === "idle"
          ? { ...item, phase: "canceled" as const }
          : item
      )
    );
  }, []);

  const remove = useCallback((id: string): void => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    started.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const retry = useCallback((id: string): void => {
    started.current.delete(id);
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, phase: "idle", error: null } : item
      )
    );
  }, []);

  const reorder = useCallback((from: number, to: number): void => {
    setItems((current) => {
      if (from === to) return current;
      if (from < 0 || from >= current.length) return current;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const used = items.length;
  const canAdd: ActionAvailability =
    used >= max
      ? actionBlocked(CDN_I18N_KEYS.blockedFull, { max })
      : actionAvailable();

  const pending = items.some((item) => isInFlight(item.phase) || item.phase === "idle");
  const failed = items.some((item) => item.phase === "failed");
  const settled = firstBlock(
    pending ? actionBlocked(CDN_I18N_KEYS.blockedPending) : actionAvailable(),
    failed ? actionBlocked(CDN_I18N_KEYS.blockedFailed) : actionAvailable()
  );

  return {
    items,
    refs,
    capacity: { max, used, remaining: Math.max(0, max - used) },
    accept: { attribute: acceptAttribute(limits), limits },
    canAdd,
    settled,
    add,
    retry,
    cancel,
    remove,
    reorder,
  };
}
