/**
 * The tier a tile asks for comes from the TILE.
 *
 * This demo exists to be looked at with the network panel open. Each frame
 * below renders the SAME image descriptor at a different rendered size; the
 * request each one makes is the evidence that the pick is per element, not per
 * screen. Resize the viewer and the large frame asks for a bigger rung; the
 * small one does not move, because 96 CSS pixels is 96 CSS pixels no matter
 * how wide the window is.
 *
 * The variant URLs are same-origin paths that do not exist. That is
 * deliberate: a 404 in the network log still records WHICH url was requested,
 * which is the whole claim being demonstrated, and it needs no CDN, no
 * fixtures on disk and no third-party host in a page that has to render inside
 * a strict CSP.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { CdnThumbnail } from "../src/default/CdnThumbnail.js";
import { PREVIEW_BOX } from "../src/default/phase.js";
import type { CdnImage } from "../src/api/types.js";
import { CDN_I18N_KEYS } from "../src/i18n/keys.js";
import { CdnDemoHarness } from "./_harness.js";

const TIERS = [32, 64, 120, 240, 480, 960, 1440] as const;

/** A row whose ladder spans small to large, so "the smallest" and "the one
 * that fits" are visibly different answers. */
function ladderRow(): CdnImage {
  const hash = "b".repeat(64);
  return {
    id: 1,
    file_hash: hash,
    prefix: `product/${hash}`,
    type: "product",
    original_width: 1600,
    original_height: 1200,
    original_url: "/demo-variants/original.webp",
    is_processed: true,
    variants_meta: TIERS.map((tier) => ({
      tier,
      branch: null,
      url: `/demo-variants/${String(tier)}.webp`,
      width: tier,
      height: Math.round((tier * 3) / 4),
    })),
  } as unknown as CdnImage;
}

const frame = (label: string, width: number): ReactElement => (
  <Frame key={label} label={label} width={width} />
);

function Frame(props: { label: string; width: number }): ReactElement {
  const t = useT();
  const box = { ...PREVIEW_BOX, width: props.width, height: Math.round((props.width * 3) / 4) };
  return (
    <figure style={{ margin: 0, display: "grid", gap: spacing[2] }}>
      <CdnThumbnail
        localUrl={null}
        image={ladderRow()}
        box={box}
        alt={t(CDN_I18N_KEYS.itemAlt)}
      />
      <figcaption
        style={{
          fontSize: fontSize.xs.fontSize,
          color: cssVar("text-muted"),
        }}
      >
        {props.label}
      </figcaption>
    </figure>
  );
}

function ThumbnailTierDemo(): ReactElement {
  return (
    <CdnDemoHarness handlers={{}}>
      <div
        style={{
          display: "flex",
          gap: spacing[5],
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {frame("96", 96)}
        {frame("240", 240)}
        {frame("640", 640)}
      </div>
    </CdnDemoHarness>
  );
}

/** One element that fills whatever the viewport gives it — the resize case. */
function FluidTierDemo(): ReactElement {
  const t = useT();
  return (
    <CdnDemoHarness handlers={{}}>
      <CdnThumbnail
        localUrl={null}
        image={ladderRow()}
        box={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
        alt={t(CDN_I18N_KEYS.itemAlt)}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.thumbnail-tier",
  title: "Thumbnail tier comes from the element",
  description:
    "The same image descriptor at three rendered sizes. Each frame requests the smallest ladder rung that does not upscale for ITS box at the live device pixel ratio — not the smallest rung on the ladder, and not a size derived from the viewport.",
  component: CdnThumbnail,
  tokens: ["text-muted"],
  variants: {
    default: {
      description: "Three fixed boxes, three different requests.",
      render: () => <ThumbnailTierDemo />,
    },
    fluid: {
      description:
        "One full-width element: resize the viewer and it upgrades, never downgrades once a tier is painted.",
      render: () => <FluidTierDemo />,
    },
  },
});
