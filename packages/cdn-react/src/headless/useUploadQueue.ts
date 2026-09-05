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
import { useQueries } from "@tanstack/react-query";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  StapelApiError,
  toStapelApiError,
  useActiveSessionReady,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type {
  CdnFileExistsResponse,
  CdnFileKind,
  CdnImage,
  CdnMediaRow,
  CdnRef,
  CdnVariantsStatus,
} from "../api/types.js";
import { useCdnRuntime } from "../model/context.js";
import type { CdnIntakeLimits } from "../model/limits.js";
import { acceptAttribute, validateFile } from "../model/limits.js";
import { cdnQueryKeys } from "../model/queryKeys.js";
import { parseCdnRef } from "../model/refs.js";
import {
  isProcessed,
  isUploadCanceled,
  runUpload,
  targetFileKind,
  variantsStatusOf,
} from "../model/upload.js";
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
  /**
   * The stored row, when this item's flow produced one — an image, a video or
   * a document, said out loud by {@link kind} rather than sniffed.
   */
  readonly row: CdnMediaRow | null;
  /** Which of the three models {@link row} is; `null` until there is one. */
  readonly kind: CdnFileKind | null;
  /**
   * For a restored item (`file === null`): whether the owner-scoped lookup
   * for its stored row has settled. Every other item is born `"done"` — its
   * row, if it has one, already came back with the upload outcome, so there
   * is nothing to wait for.
   *
   * The reason this exists rather than reading {@link row} alone: `row` is
   * `null` BOTH while the lookup is in flight and after it comes back saying
   * the reference no longer resolves. A skin needs to tell those apart —
   * "still asking" draws a skeleton, "asked, and it is gone" draws a broken
   * image.
   */
  readonly restoredLookup: "pending" | "done";
  /** The pre-check hit: these bytes were already stored and nothing was sent. */
  readonly deduped: boolean;
  /** Why the pre-check did not run, when it did not. */
  readonly dedupSkipped: DedupSkipReason | undefined;
  /** Whether the variant ladder existed by the time the flow stopped waiting. */
  readonly variantsReady: boolean;
  /**
   * The row's `variants_status` — `"pending"` while the ladder's URLs are
   * still a prediction, `"ready"` once they resolve, `null` for a model that
   * publishes no ladder. This is the field the contract says to read before
   * rendering a variant URL; `variantsReady` above is derived from it.
   */
  readonly variantsStatus: CdnVariantsStatus | null;
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

/**
 * The image row of an item, or `null` when this item is not an image.
 *
 * The narrowing reads `kind` — which the flow SET from the target it uploaded
 * to — rather than sniffing for a field only images have. A skin that renders a
 * variant ladder needs the difference to be a decision somebody made, not a
 * shape somebody guessed.
 */
export function imageRowOf(item: UploadItem): CdnImage | null {
  return item.kind === "image" ? (item.row as CdnImage) : null;
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
  row: null,
  kind: null,
  // Nothing has asked `file/exists/` about this reference yet — the effect
  // in `useUploadQueue` below does that, once, per distinct hash.
  restoredLookup: "pending",
  deduped: false,
  dedupSkipped: undefined,
  variantsReady: false,
  variantsStatus: null,
  error: null,
};

export function useUploadQueue(options: UseUploadQueueOptions): UploadQueueBag {
  const runtime = useCdnRuntime();
  const target: CdnUploadTarget = options.target ?? { kind: "image" };
  // What `file/exists/` calls this target's rows — used both for the ceilings
  // below and for matching a restored item's resolved row further down.
  const fileKind = targetFileKind(target);
  // The ceilings that apply are the ones for THIS intake. A video queue
  // validating against the image limits would refuse a 40 MB clip the server
  // would have accepted, which is the exact failure `model/limits.ts` opens by
  // forbidding: a mirror must never refuse what the server would take.
  const limits = runtime.limits[fileKind];
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
            row: outcome.row,
            kind: outcome.kind,
            deduped: outcome.deduped,
            dedupSkipped: outcome.dedupSkipped,
            variantsReady: outcome.variantsReady,
            variantsStatus: outcome.variantsStatus,
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

  // ── Resolving a restored item's row (composer reopen, D383) ────────────
  //
  // A restored item (`RESTORED` above) arrives with a reference and no row: a
  // reopened draft has `images_draft` but never re-uploads it. This resolves
  // it through the SAME owner-scoped `file/exists/` read `useCdnRef` wraps,
  // over the SAME query key (`cdnQueryKeys.exists`) — so a hash `useCdnRef`
  // already resolved elsewhere on the page, or that a sibling restored item
  // in this queue shares, is never asked for twice.
  //
  // `useQueries` rather than one `useCdnRef` call per item: the queue's
  // length changes at runtime (add, remove, restore), and the rules of hooks
  // forbid a variable number of hook calls. This is also what "batched per
  // queue" means here — every unresolved item in ONE queue is asked in the
  // same render pass rather than one after another — there being no HTTP
  // batch for this read (unlike `/describe/`, `file/exists/` takes one hash).
  //
  // `CdnRef` never doubles as an address: stapel-cdn's asset types are
  // host-configured strings and the reference is opaque by design
  // (`model/refs.ts`), so there is no cheaper "build the URL from the ref"
  // branch to take — every restored item pays for one read of its row.
  const sessionReady = useActiveSessionReady();
  const unresolvedHashes = useMemo(() => {
    const hashes = new Set<string>();
    for (const item of items) {
      if (item.file !== null || item.ref === null || item.restoredLookup === "done") {
        continue;
      }
      const parsed = parseCdnRef(item.ref);
      if (parsed !== null) hashes.add(parsed.fileHash);
    }
    return [...hashes];
  }, [items]);

  const resolveResults = useQueries({
    queries: unresolvedHashes.map((fileHash) => ({
      queryKey: cdnQueryKeys.exists(fileHash),
      queryFn: (): Promise<CdnFileExistsResponse> => apiRef.current.fileExists(fileHash),
      enabled: sessionReady,
      // Same posture as `useCdnRef`: a content-addressed row does not change.
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })),
  });

  useEffect(() => {
    if (unresolvedHashes.length === 0) return;
    const byHash = new Map<string, (typeof resolveResults)[number]>();
    unresolvedHashes.forEach((hash, index) => {
      const result = resolveResults[index];
      if (result !== undefined) byHash.set(hash, result);
    });
    setItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.file !== null || item.ref === null || item.restoredLookup === "done") {
          return item;
        }
        const parsed = parseCdnRef(item.ref);
        if (parsed === null) {
          changed = true;
          return { ...item, restoredLookup: "done" as const };
        }
        const result = byHash.get(parsed.fileHash);
        if (result === undefined || result.status === "pending") return item;
        changed = true;
        if (result.status !== "success") {
          // Could not ask — the tile draws the same broken-image fallback as
          // a reference the server said is gone; see `CdnThumbnail`.
          return { ...item, restoredLookup: "done" as const };
        }
        const data = result.data;
        if (!data.exists || data.type !== fileKind || data.file === null) {
          return { ...item, restoredLookup: "done" as const };
        }
        const row = data.file;
        return {
          ...item,
          restoredLookup: "done" as const,
          row,
          kind: fileKind,
          variantsReady: isProcessed(row),
          variantsStatus: variantsStatusOf(row),
        };
      });
      return changed ? next : current;
    });
  }, [resolveResults, unresolvedHashes, fileKind]);

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
            row: null,
            kind: null,
            // A real pick, not a restored reference — there is nothing to
            // look up, so this is born settled.
            restoredLookup: "done",
            deduped: false,
            dedupSkipped: undefined,
            variantsReady: false,
            variantsStatus: null,
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
