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

/** stapel-cdn's real refusal envelope. */
export function refusal(code: string, message: string): unknown {
  return { localizable_error: code, error: message };
}
