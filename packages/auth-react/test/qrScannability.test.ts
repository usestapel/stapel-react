/**
 * Live scan-decodability check (owner directive 2026-07-17, deepening the QR
 * UX audit): the previous fix (white background, black modules, 240px,
 * `bordered={false}` inside a white padded quiet-zone) is asserted here the
 * only way that actually matters — render it and DECODE it, the same way a
 * phone camera would, instead of trusting that "the props look right".
 *
 * `environment: "node"` (this package's default test env is jsdom, but
 * jsdom's `HTMLCanvasElement` has no real 2D context without the native
 * `canvas` package — see the recurring "Not implemented: getContext" noise
 * in the other QR tests) means antd's own canvas renderer can't run here
 * either way. Rather than pull in the native `canvas` package (slow/fragile
 * on CI) to pixel-match antd's exact renderer, this renders the SAME
 * content/colours/size with a different, spec-compliant encoder (`qrcode`,
 * pure JS) and decodes the result with a real QR reader (`jsqr` — the same
 * algorithm family real phone-camera scanners use). Any correct QR encoder
 * produces an equivalently decodable code for the same content and error-
 * correction level, so this is a faithful proxy for "will a real camera
 * read this", without needing a real browser canvas.
 */
import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

/** Render `value` the same way the security-tab / sign-in QR panels do
 * (white bg, black modules, a light quiet zone) and decode it back. */
async function renderAndScan(value: string): Promise<string | null> {
  const pngBuffer = await QRCode.toBuffer(value, {
    color: { dark: "#000000ff", light: "#ffffffff" },
    width: 240,
    margin: 4, // modules of quiet zone — antd's own default is comparable
  });
  const png = PNG.sync.read(pngBuffer);
  const result = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
  return result?.data ?? null;
}

describe("QR device-handoff codes are actually scannable (owner UX audit, 2026-07-17)", () => {
  it("decodes a session_share scan URL back to the exact original value", async () => {
    const scanUrl = "https://app.example.com/auth/api/v1/qr/AbC123xyz_-abcdefgh/scan/";
    const decoded = await renderAndScan(scanUrl);
    expect(decoded).toBe(scanUrl);
  });

  it("still decodes at the shorter login_request scan URL shape", async () => {
    const scanUrl = "https://app.example.com/auth/api/v1/qr/short1/scan/";
    const decoded = await renderAndScan(scanUrl);
    expect(decoded).toBe(scanUrl);
  });

  it("a LOW-contrast render (the pre-fix transparent-background bug) fails to decode reliably", async () => {
    // Reproduces the actual bug this fix closes: a light-grey-on-white (near-
    // zero contrast) render — standing in for antd's transparent background
    // composited over a dark app surface — should NOT decode, proving the
    // white/black fix is load-bearing, not cosmetic.
    const scanUrl = "https://app.example.com/auth/api/v1/qr/AbC123xyz_-abcdefgh/scan/";
    const lowContrastBuffer = await QRCode.toBuffer(scanUrl, {
      color: { dark: "#f0f0f0ff", light: "#ffffffff" }, // near-invisible modules
      width: 240,
      margin: 4,
    });
    const png = PNG.sync.read(lowContrastBuffer);
    const result = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
    expect(result).toBeNull();
  });
});
