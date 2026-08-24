/**
 * The client-side mirror of stapel-cdn's own intake gates.
 *
 * ── Why mirror at all ──────────────────────────────────────────────────────
 *
 * Because the alternative is uploading 40 MB over a phone connection to be
 * told "File is too large" by the server that just received all of it. The
 * gates below are the cheap half of what `_validate_image_upload` does before
 * it hashes a byte (`stapel_cdn/views.py`): the size ceiling and the extension
 * allowlist. The expensive half — an actual libvips decode, which is what
 * catches a `.jpg` full of HTML — has no browser equivalent and is not
 * simulated here. A file that passes this mirror can still be refused, and
 * that refusal renders through the same error contour as any other.
 *
 * ── The rule the mirror must never break ───────────────────────────────────
 *
 * A MIRROR THAT REFUSES WHAT THE SERVER WOULD ACCEPT IS WORSE THAN NO MIRROR.
 * It blocks a valid upload with no way for the person to appeal, and the
 * server never even hears about it. So every ceiling here is CONFIGURABLE on
 * the runtime and defaults to the library's own default — because all of them
 * are `STAPEL_CDN` settings a deployment moves (`stapel_cdn/conf.py`), and a
 * hardcoded 20 MB would be a client-side lie on a host that raised it. The
 * same argument in the opposite direction: a host that LOWERED the ceiling
 * passes its number here and gets the refusal early, which is the point.
 *
 * The refusals below are raised with stapel-cdn's OWN error codes, so a skin
 * renders "File is too large" from the generated bundle whether the sentence
 * came from here or from the server. There is no second vocabulary for
 * client-side refusals.
 */
import { StapelApiError } from "@stapel/core";

/** `error.413.file_too_large` — the byte ceiling, from `MAX_*_SIZE`. */
export const ERROR_FILE_TOO_LARGE = "error.413.file_too_large";
/** `error.400.invalid_format` — the extension allowlist. */
export const ERROR_INVALID_FORMAT = "error.400.invalid_format";
/** `error.400.no_file` — an empty pick. */
export const ERROR_NO_FILE = "error.400.no_file";

/**
 * The ceilings for one intake kind. Defaults reproduce `stapel_cdn/conf.py`'s
 * `DEFAULTS` at the pinned contract (v0.17.0) — re-verified line by line
 * against `conf.py` when the pin moved 0.12 → 0.17: `MAX_IMAGE_SIZE` 20 MB,
 * `MAX_VIDEO_SIZE` 100 MB, `MAX_FILE_SIZE` 50 MB, all three extension lists and
 * `ALLOWED_FILE_MIME_TYPES` unchanged, including the deliberate absence of
 * `application/octet-stream`.
 */
export interface CdnIntakeLimits {
  /** Byte ceiling. `STAPEL_CDN["MAX_IMAGE_SIZE" | …]`. */
  readonly maxBytes: number;
  /** Lowercase extensions INCLUDING the dot, as the backend stores them. */
  readonly extensions: readonly string[];
  /**
   * MIME types the backend narrows on, when it narrows on MIME at all. Only
   * the generic-file intake does (`ALLOWED_FILE_MIME_TYPES`); images and
   * videos are gated on the extension plus a decode/sniff, so this is
   * `undefined` for them rather than a guess. An empty array would mean
   * "nothing is allowed", which is a different and wrong statement.
   */
  readonly mimeTypes?: readonly string[];
}

export interface CdnLimits {
  readonly image: CdnIntakeLimits;
  readonly video: CdnIntakeLimits;
  readonly file: CdnIntakeLimits;
}

const MB = 1024 * 1024;

/** stapel-cdn's library defaults — the mirror's starting point. */
export const CDN_DEFAULT_LIMITS: CdnLimits = {
  image: {
    maxBytes: 20 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif"],
  },
  video: {
    maxBytes: 100 * MB,
    extensions: [".mp4", ".webm", ".mov", ".avi", ".mkv"],
  },
  file: {
    maxBytes: 50 * MB,
    extensions: [
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".txt", ".csv", ".zip", ".rar", ".7z", ".gz",
    ],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/gzip",
    ],
  },
};

/** Host overrides — every field optional, merged over the defaults. */
export interface CdnLimitsOverride {
  readonly image?: Partial<CdnIntakeLimits>;
  readonly video?: Partial<CdnIntakeLimits>;
  readonly file?: Partial<CdnIntakeLimits>;
}

function mergeIntake(
  base: CdnIntakeLimits,
  override: Partial<CdnIntakeLimits> | undefined
): CdnIntakeLimits {
  if (override === undefined) return base;
  return {
    maxBytes: override.maxBytes ?? base.maxBytes,
    extensions: override.extensions ?? base.extensions,
    ...(override.mimeTypes !== undefined
      ? { mimeTypes: override.mimeTypes }
      : base.mimeTypes !== undefined
        ? { mimeTypes: base.mimeTypes }
        : {}),
  };
}

export function resolveCdnLimits(override?: CdnLimitsOverride): CdnLimits {
  return {
    image: mergeIntake(CDN_DEFAULT_LIMITS.image, override?.image),
    video: mergeIntake(CDN_DEFAULT_LIMITS.video, override?.video),
    file: mergeIntake(CDN_DEFAULT_LIMITS.file, override?.file),
  };
}

/** The lowercase extension of a filename, dot included, or `""`. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot).toLowerCase();
}

/**
 * The `accept` attribute for a file input, built from the same allowlist the
 * refusal is built from — so the picker and the gate cannot disagree.
 */
export function acceptAttribute(limits: CdnIntakeLimits): string {
  const parts = [...limits.extensions];
  if (limits.mimeTypes !== undefined) parts.push(...limits.mimeTypes);
  return parts.join(",");
}

/**
 * Check one file against one intake's ceilings.
 *
 * Returns the refusal as a {@link StapelApiError} in stapel-cdn's own
 * vocabulary, or `null` when the file may be sent. Never throws: the caller
 * (a queue admitting ten files at once) needs a per-file verdict, not a
 * control-flow interruption on the first bad one.
 */
export function validateFile(
  file: File,
  limits: CdnIntakeLimits
): StapelApiError | null {
  if (file.size === 0) {
    return new StapelApiError({
      code: ERROR_NO_FILE,
      message: "No file provided",
      status: 400,
    });
  }
  if (file.size > limits.maxBytes) {
    return new StapelApiError({
      code: ERROR_FILE_TOO_LARGE,
      message: "File is too large",
      // The server answers 413 for this; the mirror says the same number so a
      // host branching on `status` cannot tell the two apart — which is the
      // intent. `params` carries what the sentence would need to be specific,
      // even though the backend's own copy has no slots today.
      status: 413,
      params: { max_bytes: limits.maxBytes, size: file.size },
    });
  }
  const extension = fileExtension(file.name);
  if (!limits.extensions.includes(extension)) {
    return new StapelApiError({
      code: ERROR_INVALID_FORMAT,
      message: "Unsupported file format",
      status: 400,
      params: { extension, allowed: limits.extensions.join(", ") },
    });
  }
  // MIME is checked only where the backend checks it, and only when the
  // browser actually supplied one. A blank `file.type` is common (an
  // extension the OS does not know) and is NOT evidence of a bad file — the
  // backend reads the declared Content-Type the same way, as a narrowing
  // device rather than a verdict.
  if (
    limits.mimeTypes !== undefined &&
    file.type.length > 0 &&
    !limits.mimeTypes.includes(file.type)
  ) {
    return new StapelApiError({
      code: ERROR_INVALID_FORMAT,
      message: "Unsupported file format",
      status: 400,
      params: { mime: file.type },
    });
  }
  return null;
}
