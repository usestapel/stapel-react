/**
 * Response bodies shaped exactly as stapel-cdn's serializers render them, and
 * the files the tests upload. The hashes are REAL — computed from the same
 * bytes the flow will hash — so a test that asserts the dedup short-circuit is
 * asserting the whole mechanism and not a lucky string match.
 */
import { sha256Hex } from "../src/index.js";

export function imageFile(name = "photo.jpg", body = "some-jpeg-bytes"): File {
  return new File([body], name, { type: "image/jpeg" });
}

export function bigImageFile(bytes: number, name = "huge.jpg"): File {
  return new File(["x".repeat(bytes)], name, { type: "image/jpeg" });
}

export async function hashOf(file: File): Promise<string> {
  return sha256Hex(file);
}

/**
 * The single-pass snapshot the backend inlines on every row since 0.16 and
 * answers `describe` with. Written as a FIXTURE and not as an afterthought:
 * the pair's one boundary into `<Image>` reads this object, so a fixture that
 * omitted it would let a test pass against the old code that ignored it.
 */
export function renderMeta(options?: {
  readonly ref?: string;
  readonly kind?: string;
  readonly mime?: string;
  readonly ext?: string;
  readonly bytes?: number;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly aspect?: number | null;
  readonly previewB64?: string | null;
  readonly previewKind?: "blur" | "poster" | "waveform" | null;
  readonly posterUrl?: string | null;
  readonly durationMs?: number | null;
  readonly metaStatus?: "ok" | "partial" | "missing";
  readonly metaReason?: string | null;
  readonly variants?: readonly Record<string, unknown>[];
}): Record<string, unknown> {
  return {
    ref: options?.ref ?? `product/${"a".repeat(64)}`,
    kind: options?.kind ?? "image",
    mime: options?.mime ?? "image/jpeg",
    ext: options?.ext ?? ".jpg",
    bytes: options?.bytes ?? 1024,
    width: options?.width === undefined ? 1600 : options.width,
    height: options?.height === undefined ? 1200 : options.height,
    aspect: options?.aspect === undefined ? 1.333333 : options.aspect,
    square: false,
    animated: false,
    duration_ms: options?.durationMs ?? null,
    preview_b64:
      options?.previewB64 === undefined
        ? "data:image/webp;base64,UklGRg=="
        : options.previewB64,
    preview_kind: options?.previewKind === undefined ? "blur" : options.previewKind,
    poster_url: options?.posterUrl ?? null,
    meta_status: options?.metaStatus ?? "ok",
    meta_reason: options?.metaReason ?? null,
    ...(options?.variants === undefined ? {} : { variants: options.variants }),
  };
}

/** `POST /describe/`'s envelope: snapshots by ref, plus the refs that are gone. */
export function describeResponse(
  items: Readonly<Record<string, Record<string, unknown>>>,
  missing: readonly string[] = []
): unknown {
  return { items, missing };
}

/** A stored video row — no ladder, a poster, and a measured length. */
export function videoRow(options: {
  readonly hash: string;
  readonly processed?: boolean;
  readonly durationMs?: number | null;
}): Record<string, unknown> {
  const { hash } = options;
  const processed = options.processed ?? true;
  return {
    id: 11,
    file_hash: hash,
    original_filename: "clip.mp4",
    file_extension: ".mp4",
    original_width: 1920,
    original_height: 1080,
    original_size: 4_000_000,
    duration: 12.5,
    original_url: `https://cdn.test/media/cdn/videos/${hash.slice(0, 8)}.mp4`,
    poster_url: `https://cdn.test/media/cdn/posters/${hash.slice(0, 8)}.webp`,
    is_processed: processed,
    render_meta: renderMeta({
      ref: `video/${hash}`,
      kind: "video",
      mime: "video/mp4",
      ext: ".mp4",
      bytes: 4_000_000,
      width: 1920,
      height: 1080,
      aspect: 1.777778,
      previewKind: "poster",
      posterUrl: `https://cdn.test/media/cdn/posters/${hash.slice(0, 8)}.webp`,
      durationMs: options.durationMs === undefined ? 12_500 : options.durationMs,
    }),
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
  };
}

/** A stored document row — no ladder, no pixels, born settled. */
export function fileRow(options: { readonly hash: string }): Record<string, unknown> {
  const { hash } = options;
  return {
    id: 13,
    file_hash: hash,
    original_filename: "invoice.pdf",
    file_extension: ".pdf",
    file_size: 250_000,
    prefix: `file/${hash}`,
    file_url: `https://cdn.test/media/cdn/files/${hash.slice(0, 8)}.pdf`,
    render_meta: renderMeta({
      ref: `file/${hash}`,
      kind: "file",
      mime: "application/pdf",
      ext: ".pdf",
      bytes: 250_000,
      width: null,
      height: null,
      aspect: null,
      previewB64: null,
      previewKind: null,
    }),
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
  };
}

export function videoFile(name = "clip.mp4"): File {
  return new File(["some-mp4-bytes"], name, { type: "video/mp4" });
}

export function documentFile(name = "invoice.pdf"): File {
  return new File(["%PDF-1.4 bytes"], name, { type: "application/pdf" });
}

export function imageRow(options: {
  readonly hash: string;
  readonly type?: string;
  readonly processed?: boolean;
}): Record<string, unknown> {
  const { hash } = options;
  const type = options.type ?? "product";
  const processed = options.processed ?? true;
  const url = (tier: number): string =>
    `https://cdn.test/media/cdn/images/${String(tier)}/${hash.slice(0, 8)}.webp`;
  return {
    id: 7,
    file_hash: hash,
    original_filename: "photo.jpg",
    file_extension: ".jpg",
    type,
    prefix: `${type}/${hash}`,
    original_width: 1600,
    original_height: 1200,
    original_size: 1024,
    original_url: url(1600),
    variant_16_url: url(16),
    variant_32_url: url(32),
    variant_64_url: url(64),
    variant_120_url: url(120),
    variant_160_url: url(160),
    variant_240_url: url(240),
    variant_480_url: url(480),
    variant_560_url: url(560),
    variant_720_url: url(720),
    variant_1080_url: url(1080),
    variant_1440_url: url(1440),
    variant_2160_url: url(2160),
    // Only what EXISTS is listed. The flat `variant_<n>_url` fields above are
    // computed paths and are populated even before the background task runs —
    // which is exactly why the pair reads the ladder from here instead.
    variants_meta: processed
      ? [
          { tier: 120, branch: null, url: url(120), width: 120, height: 90 },
          { tier: 480, branch: "w", url: url(480), width: 480, height: 360 },
        ]
      : [],
    is_processed: processed,
    // The field the CONTRACT says to read before rendering a variant URL. It is
    // derived from `is_processed` server-side, so the fixture derives it the
    // same way — a fixture that hardcoded "ready" would hide the read.
    variants_status: processed ? "ready" : "pending",
    variants_ready_at: processed ? "2026-08-22T10:00:05Z" : null,
    render_meta: renderMeta({
      ref: `${type}/${hash}`,
      variants: processed
        ? [
            { tier: 120, branch: null, url: url(120), width: 120, height: 90 },
            { tier: 480, branch: "w", url: url(480), width: 480, height: 360 },
            { tier: "original", branch: null, url: url(1600), width: 1600, height: 1200 },
          ]
        : [],
    }),
    uploaded_by: "00000000-0000-0000-0000-000000000001",
    uploaded_by_username: "seller",
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
  };
}

export const MISS = { exists: false, type: null, file: null };

export function hit(row: Record<string, unknown>, type = "image"): unknown {
  return { exists: true, type, file: row };
}

export function uploaded(row: Record<string, unknown>): unknown {
  return { image: row, message: "Image uploaded successfully" };
}

export function uploadedVideo(row: Record<string, unknown>): unknown {
  return { video: row, message: "Video uploaded successfully" };
}

export function uploadedFile(row: Record<string, unknown>): unknown {
  return { file: row, message: "File uploaded successfully" };
}

/** stapel-cdn's real refusal envelope. */
export function refusal(code: string, message: string): unknown {
  return { localizable_error: code, error: message };
}
