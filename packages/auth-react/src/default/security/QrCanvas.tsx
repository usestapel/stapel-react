/**
 * `<QrCanvas/>` — the pair's one QR surface.
 *
 * Two files drew a QR code and both carried the SAME block verbatim: a white
 * padded quiet zone, an explicit `#000000`/`#ffffff` pair, and an identical
 * `stapel/no-raw-colors` disable comment explaining why (`panels.tsx`'s sign-in
 * QR and `QrDeviceLinkPanel`'s settings QR). Two copies of a justified rule
 * break is two places to forget it: the next surface that needs a code copies
 * whichever one it found, and a token sweep that touches one and not the other
 * leaves a code that photographs at 3:1 contrast and simply will not scan.
 *
 * The exemption is stated once, here, with the reason attached to it.
 */
import type { ReactElement } from "react";
import { QRCode } from "antd";
import { radii, spacing } from "@stapel/tokens";

/**
 * The code's side, in CSS px. A one-off geometry rather than a spacing step:
 * it is sized so a phone camera resolves the modules at arm's length, which is
 * a scanning fact, not a rhythm decision.
 */
export const QR_CODE_SIZE = 240;

export interface QrCanvasProps {
  /** What the code encodes — the scan URL. */
  readonly value: string;
  /** antd's own state rendering: active / expired / loading / scanned. */
  readonly status?: "active" | "expired" | "loading" | "scanned";
  /** Antd's built-in refresh affordance on the expired state. */
  readonly onRefresh?: () => void;
  readonly size?: number;
  readonly "data-testid"?: string;
}

/** A scannable code on its own quiet zone, in both themes. */
export function QrCanvas(props: QrCanvasProps): ReactElement {
  // Deliberate, theme-INDEPENDENT pure white/black: a QR code's camera
  // contrast is a functional requirement, not decor, and must not follow dark
  // mode into low-contrast token colours. antd's transparent default renders a
  // technically valid but practically unscannable code over anything but a
  // plain white page.
  const quietZone = {
    // eslint-disable-next-line stapel/no-raw-colors -- see above
    background: "#ffffff",
    padding: spacing[4],
    borderRadius: radii.md,
  };
  return (
    <div
      style={quietZone}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <QRCode
        value={props.value}
        {...(props.status !== undefined ? { status: props.status } : {})}
        {...(props.onRefresh !== undefined ? { onRefresh: props.onRefresh } : {})}
        color="#000000"
        bgColor="#ffffff"
        bordered={false}
        size={props.size ?? QR_CODE_SIZE}
      />
    </div>
  );
}
