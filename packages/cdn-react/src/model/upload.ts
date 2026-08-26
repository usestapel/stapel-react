/**
 * The dedup-first upload flow — the one piece of business this pair exists
 * for, written once, with no React in it.
 *
 * ```
 *  validate ─┬─ refuse (client-side mirror, cdn's own error codes)
 *            │
 *            └─ hash ── check `file/exists/` ─┬─ HIT  → done, ZERO bytes sent
 *                                             │
 *                                             └─ MISS → POST multipart
 *                                                        └─ poll for variants
 * ```
 *
 * ── Why the phases are named and not a percentage ──────────────────────────
 *
 * There is no honest byte-percentage to report. `fetch` cannot observe how
 * much of a request body has gone out (only a `ReadableStream` body with
 * `duplex: "half"` can, and that is neither universal nor reachable through
 * the injected client), and `crypto.subtle.digest` reports nothing between
 * "started" and "finished". The two ways to have a moving bar anyway are to
 * fork the transport onto `XMLHttpRequest` — which means re-implementing the
 * client's bearer/refresh/verification/error seams, i.e. a second transport
 * with its own bugs — or to animate a number that is not measured. This
 * package does neither: `UploadPhase` says which step is running, and a skin
 * shows an indeterminate indicator during the two steps whose duration is
 * real. Naming the step the person is waiting on is more information than a
 * bar that is lying, and it is the same rule the rest of this fleet applies to
 * counts it did not compute.
 *
 * ── What the pre-check can and cannot promise ──────────────────────────────
 *
 * A HIT is a promise: the bytes are already stored, under this caller's
 * ownership, as the asset type being uploaded — so the POST is skipped and the
 * reference is handed back immediately. That is the property spec §8.2 asks to
 * be tested, and `test/dedup.test.ts` asserts it by counting requests.
 *
 * A MISS is not a promise of the opposite. `file/exists/` filters on
 * `uploaded_by=request.user` unconditionally, while the upload paths honour
 * `STAPEL_CDN["DEDUP_SCOPE"]` (default `"owner"`, optionally `"global"`), so
 * under a global scope the POST can still answer 200 "already exists". Nothing
 * downstream cares — the same body comes back either way — but this is why
 * `deduped` reports what THIS CLIENT observed rather than claiming to know
 * what the server did with the bytes.
 */
import { toStapelApiError } from "@stapel/core";
import type { CdnApi } from "../api/cdnApi.js";
import type {
  CdnFileKind,
  CdnImage,
  CdnMediaRow,
  CdnRef,
  CdnVariantsStatus,
} from "../api/types.js";
import { canHashLocally, sha256Hex } from "./hash.js";
import { validateFile } from "./limits.js";
import type { CdnIntakeLimits } from "./limits.js";
import { refOf } from "./refs.js";

/** Where the bytes go, and therefore what asset type the row gets. */
export type CdnUploadTarget =
  | {
      /**
       * `POST /upload/image/`. The general intake — note that it stores
       * `type="product"` regardless of `ASSET_TYPES`.
       */
      readonly kind: "image";
    }
  | {
      /** `POST /upload/avatar/`. The only intake that needs a real session. */
      readonly kind: "avatar";
    }
  | {
      /** `POST /images/<assetType>/upload/`, validated against `ASSET_TYPES`. */
      readonly kind: "typed";
      readonly assetType: string;
    }
  | {
      /**
       * `POST /upload/video/`. Stored as `video/<hash>`; variants are not
       * generated upstream, so the row arrives with an empty ladder and
       * `is_processed: false` — which is why a video's picture is its
       * `poster_url` and its `render_meta.preview_kind` is `"poster"`.
       */
      readonly kind: "video";
    }
  | {
      /**
       * `POST /upload/file/` — documents and archives, stored as
       * `file/<hash>`. Its allowlist narrows on MIME as well as extension.
       */
      readonly kind: "file";
    };

/**
 * The asset type a target produces, which is what the pre-check must match
 * before it may short-circuit. `"product"` is not a guess: it is the literal
 * the view writes (`ImageUploadView.post`); `"video"` and `"file"` are the
 * prefixes `stapel_cdn.metadata.media_ref` builds for those two models.
 */
export function targetAssetType(target: CdnUploadTarget): string {
  switch (target.kind) {
    case "image":
      return "product";
    case "avatar":
      return "avatar";
    case "typed":
      return target.assetType;
    case "video":
      return "video";
    case "file":
      return "file";
  }
}

/**
 * What `file/exists/` would call this target's rows.
 *
 * The pre-check answers about ANY object with these bytes, and its `type` is
 * one of three strings (`FileExistsView._exists_response`). A hit is only a hit
 * when the KIND matches too: the same bytes stored earlier as a document are
 * not the image this upload would return, and short-circuiting on them would
 * hand a caller a ref that resolves to the wrong model.
 */
export function targetFileKind(target: CdnUploadTarget): CdnFileKind {
  switch (target.kind) {
    case "video":
      return "video";
    case "file":
      return "file";
    default:
      return "image";
  }
}

/** Which step of the flow is running. */
export type UploadPhase =
  | "idle"
  | "hashing"
  | "checking"
  | "uploading"
  | "processing"
  | "done"
  | "failed"
  | "canceled";

/** Why the dedup pre-check did not happen (or did not answer). */
export type DedupSkipReason =
  /** No `crypto.subtle` — this page is not a secure context. */
  | "no_crypto"
  /** `file/exists/` needs `IsAuthenticated`; a guest identity may still upload. */
  | "unauthorized"
  /** The check itself failed. Never fatal: the upload proceeds. */
  | "check_failed"
  /** The caller asked for no pre-check. */
  | "disabled";

/** What a finished upload yields. */
export interface UploadOutcome {
  /** `<type>/<hash>` — the value a consuming module stores. */
  readonly ref: CdnRef;
  /**
   * The stored row. Which of the three models it is, is stated by
   * {@link kind} — never inferred from which fields happen to be present.
   */
  readonly row: CdnMediaRow;
  /** `image` | `video` | `file` — the model this row is. */
  readonly kind: CdnFileKind;
  /** The pre-check hit and NO upload request was made. */
  readonly deduped: boolean;
  /** `undefined` when the pre-check ran; a reason when it did not. */
  readonly dedupSkipped: DedupSkipReason | undefined;
  /**
   * Whether the variant ladder had been generated by the time the flow
   * stopped waiting. `false` is not a failure — variants are produced by a
   * background task and the reference is valid immediately; it means a skin
   * should show the original (or its own placeholder) for now.
   */
  readonly variantsReady: boolean;
  /**
   * The row's OWN word for the state above, when it publishes one
   * (`"pending"` | `"ready"`), or `null` for the two models that have no
   * ladder. A skin shows the difference between "the server says the previews
   * are still being made" and "this kind never had any".
   */
  readonly variantsStatus: CdnVariantsStatus | null;
  /** When the ladder finished, from the row; `null` while pending. */
  readonly variantsReadyAt: string | null;
}

export interface RunUploadOptions {
  readonly target: CdnUploadTarget;
  readonly limits: CdnIntakeLimits;
  readonly signal?: AbortSignal;
  /** Phase transitions, in order. Called synchronously. */
  readonly onPhase?: (phase: UploadPhase) => void;
  /** Skip the pre-check entirely (reported as `dedupSkipped: "disabled"`). */
  readonly dedup?: boolean;
  /** How long to wait for the variant ladder. Default: 8 tries, 750 ms apart. */
  readonly variants?: CdnVariantWaitOptions;
}

export interface CdnVariantWaitOptions {
  /** `0` disables waiting; the outcome then reports the row as it arrived. */
  readonly attempts?: number;
  readonly intervalMs?: number;
  /** Injectable timer (tests). Default: `setTimeout`. */
  readonly wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_VARIANT_ATTEMPTS = 8;
const DEFAULT_VARIANT_INTERVAL_MS = 750;

/**
 * Named, not inlined, for the same reason `stapel/no-adhoc-401` names it in
 * its own source: the rule bans a bare `=== 401` because that shape is how ad
 * hoc refresh/redirect logic gets written outside core's one seam. What
 * happens below is not that — nothing is refreshed, retried or redirected;
 * a 401 from the OPTIONAL pre-check is merely CLASSIFIED, so the outcome can
 * say "a guest may upload but may not pre-check" instead of "the check
 * failed". The real 401 handling stays where it belongs, on the client's
 * `onAuthRefresh` seam, and this flow never sees it.
 */
const HTTP_UNAUTHORIZED = 401;

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

/** The abort a caller asked for, told apart from a genuine transport fault. */
export class UploadCanceled extends Error {
  constructor() {
    super("Upload canceled");
    this.name = "UploadCanceled";
  }
}

export function isUploadCanceled(value: unknown): value is UploadCanceled {
  return value instanceof UploadCanceled;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new UploadCanceled();
}

/**
 * Run the whole flow for one file.
 *
 * Rejects with a {@link StapelApiError} for every failure that is one — the
 * client-side refusal, the server's, a transport fault folded by
 * `toStapelApiError` — and with {@link UploadCanceled} when the signal fired.
 * A caller therefore branches on cancellation without having to recognise
 * `AbortError` by name, which is a DOMException whose shape differs between
 * runtimes.
 */
export async function runUpload(
  api: CdnApi,
  file: File,
  options: RunUploadOptions
): Promise<UploadOutcome> {
  const { target, limits, signal } = options;
  const phase = (next: UploadPhase): void => options.onPhase?.(next);

  throwIfAborted(signal);

  const refusal = validateFile(file, limits);
  if (refusal !== null) {
    phase("failed");
    throw refusal;
  }

  const assetType = targetAssetType(target);
  const fileKind = targetFileKind(target);
  let fileHash: string | null = null;
  let dedupSkipped: DedupSkipReason | undefined;

  if (options.dedup === false) {
    dedupSkipped = "disabled";
  } else if (!canHashLocally()) {
    dedupSkipped = "no_crypto";
  } else {
    phase("hashing");
    fileHash = await sha256Hex(file);
    throwIfAborted(signal);

    phase("checking");
    try {
      const found = await api.fileExists(fileHash, sig(signal));
      throwIfAborted(signal);
      // Three conditions, all required. `exists` alone is not enough: the
      // endpoint answers about ANY object with these bytes, so the same file
      // stored earlier as a video or a document reports a hit that is not the
      // model this upload would produce. And an IMAGE of a different asset type
      // is not the row this POST would return either — the upload views filter
      // dedup on `type=`, so uploading the bytes of one's own avatar as a
      // listing photo must really upload them. Video and file rows carry no
      // asset type at all (one model, one prefix), so for those the kind match
      // is the whole test.
      if (found.exists && found.type === fileKind && found.file !== null) {
        const row = found.file;
        if (fileKind !== "image" || (row as CdnImage).type === assetType) {
          phase("done");
          return {
            ref: refOf(row, fileKind),
            row,
            kind: fileKind,
            deduped: true,
            dedupSkipped: undefined,
            variantsReady: isProcessed(row),
            variantsStatus: variantsStatusOf(row),
            variantsReadyAt: variantsReadyAtOf(row),
          };
        }
      }
    } catch (error) {
      if (isUploadCanceled(error)) throw error;
      const failure = toStapelApiError(error);
      // 401 is the documented asymmetry: `file/exists/` needs
      // `IsAuthenticated` while the upload endpoints take
      // `IsNotAnonymousUser`, so a guest legitimately reaches this line and
      // must still be able to upload. Every other failure is treated the same
      // way for the same reason — the pre-check is an OPTIMISATION, and an
      // optimisation that can fail the operation it optimises is a defect.
      dedupSkipped =
        failure.status === HTTP_UNAUTHORIZED ? "unauthorized" : "check_failed";
    }
  }

  throwIfAborted(signal);
  phase("uploading");
  let row: CdnMediaRow;
  try {
    row = await uploadTo(api, target, file, signal);
  } catch (error) {
    if (signal?.aborted === true) {
      phase("canceled");
      throw new UploadCanceled();
    }
    phase("failed");
    throw toStapelApiError(error);
  }

  const settled = await waitForVariants(api, row, fileKind, {
    ...(signal !== undefined ? { signal } : {}),
    ...(options.variants !== undefined ? { variants: options.variants } : {}),
    onPhase: phase,
  });

  phase("done");
  return {
    ref: refOf(settled, fileKind),
    row: settled,
    kind: fileKind,
    deduped: false,
    dedupSkipped,
    variantsReady: isProcessed(settled),
    variantsStatus: variantsStatusOf(settled),
    variantsReadyAt: variantsReadyAtOf(settled),
  };
}

/**
 * The row's own statement about its variant ladder, when it makes one.
 *
 * `variants_status` is the field the CONTRACT tells a client to read ("read it
 * before you render a variant URL"): `"pending"` means every `variant_<n>_url`
 * in the payload is a derived path with no file behind it yet, `"ready"` means
 * they resolve. Only the image row publishes it — a video has no ladder and a
 * document has no derived work at all — so this is `null` for the other two
 * rather than a guessed `"ready"`.
 */
export function variantsStatusOf(row: CdnMediaRow): CdnVariantsStatus | null {
  return "variants_status" in row ? row.variants_status : null;
}

/** When the ladder finished, ISO-8601; `null` while pending or unpublished. */
export function variantsReadyAtOf(row: CdnMediaRow): string | null {
  return "variants_ready_at" in row ? row.variants_ready_at : null;
}

/**
 * Whether the derived work on a row is done.
 *
 * READS `variants_status` FIRST, and that is the point of D-6. The two fields
 * agree today by derivation (`stapel_cdn/models.py` computes `variants_status`
 * FROM `is_processed`), so this is not a behaviour change for an image — but
 * `is_processed` is the field whose meaning the release notes moved ("Video.
 * is_processed now means measured facts exist", which is a statement about a
 * probe, not about a ladder), while `variants_status` is the one the contract
 * documents as the answer to "may I render a variant URL". Reading the derived
 * field and calling it the ladder is how the two drift apart silently.
 *
 * A document has neither — no ladder, no probe, nothing to wait for — so it is
 * born settled, and reporting `false` for it would make a file upload look
 * permanently unfinished.
 */
function isProcessed(row: CdnMediaRow): boolean {
  const status = variantsStatusOf(row);
  if (status !== null) return status === "ready";
  return "is_processed" in row ? row.is_processed : true;
}

function sig(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal !== undefined ? { signal } : {};
}

/**
 * POST the bytes and hand back the ROW, whichever of the three envelopes it
 * arrived in — `{image}`, `{video}` or `{file}`. Unwrapping here is what lets
 * the rest of the flow be one flow: the three intakes differ in the key their
 * envelope uses and in nothing else this pair cares about.
 */
async function uploadTo(
  api: CdnApi,
  target: CdnUploadTarget,
  file: File,
  signal: AbortSignal | undefined
): Promise<CdnMediaRow> {
  switch (target.kind) {
    case "avatar":
      return (await api.uploadAvatar(file, sig(signal))).image;
    case "typed":
      return (await api.uploadTypedImage(target.assetType, file, sig(signal))).image;
    case "image":
      return (await api.uploadImage(file, sig(signal))).image;
    case "video":
      return (await api.uploadVideo(file, sig(signal))).video;
    case "file":
      return (await api.uploadFile(file, sig(signal))).file;
  }
}

/**
 * Wait for the background task to produce the variant ladder, by re-asking
 * `file/exists/` — which is the only read stapel-cdn offers for a stored row.
 *
 * Bounded, and bounded is the point: variants are generated by a worker that
 * may be down, and a polling loop with no ceiling turns "the thumbnail is not
 * ready yet" into a tab that never stops making requests. When the budget runs
 * out the flow returns the row it has, with `variantsReady: false` — a stated
 * outcome, not a hang and not a failure. The reference is already valid.
 */
async function waitForVariants(
  api: CdnApi,
  row: CdnMediaRow,
  fileKind: CdnFileKind,
  options: {
    readonly signal?: AbortSignal;
    readonly variants?: CdnVariantWaitOptions;
    readonly onPhase: (phase: UploadPhase) => void;
  }
): Promise<CdnMediaRow> {
  if (isProcessed(row)) return row;
  const attempts = options.variants?.attempts ?? DEFAULT_VARIANT_ATTEMPTS;
  if (attempts <= 0) return row;
  const intervalMs = options.variants?.intervalMs ?? DEFAULT_VARIANT_INTERVAL_MS;
  const wait = options.variants?.wait ?? defaultWait;

  options.onPhase("processing");
  let latest = row;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(intervalMs, options.signal);
    if (options.signal?.aborted === true) return latest;
    try {
      const found = await api.fileExists(latest.file_hash, sig(options.signal));
      if (found.exists && found.type === fileKind && found.file !== null) {
        latest = found.file;
        if (isProcessed(latest)) return latest;
      }
    } catch {
      // Same posture as the pre-check: the ladder is an enhancement of a row
      // that already exists. A failed poll ends the wait and reports the row
      // as unprocessed; it never turns a stored upload into a failed one.
      return latest;
    }
  }
  return latest;
}
