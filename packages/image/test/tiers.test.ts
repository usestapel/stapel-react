import { describe, expect, it } from "vitest";
import { chooseVariant, limitingAxis, pickTier } from "../src/tiers.js";
import type { RenderMetadata, VariantMeta } from "../src/tiers.js";

describe("pickTier — smallest tier with needed ≤ T×1.1 (§2.2)", () => {
  const tiers = [560, 720, 1080];

  // Owner's examples, verbatim (images-and-cdn.md §2.2).
  it("792 → 720 (720×1.1 = 792 ≥ 792)", () => {
    expect(pickTier(792, tiers)).toBe(720);
  });
  it("793 → 1080 (720×1.1 = 792 < 793)", () => {
    expect(pickTier(793, tiers)).toBe(1080);
  });
  it("616 → 560 (560×1.1 = 616 ≥ 616)", () => {
    expect(pickTier(616, tiers)).toBe(560);
  });

  it("above the whole ladder → largest tier (no upscale at this level)", () => {
    expect(pickTier(4000, tiers)).toBe(1080);
  });

  it("below the whole ladder → smallest tier", () => {
    expect(pickTier(10, tiers)).toBe(560);
  });

  it("order of the tiers array does not matter", () => {
    expect(pickTier(792, [1080, 560, 720])).toBe(720);
  });

  it("full default ladder", () => {
    const ladder = [160, 240, 480, 560, 720, 1080];
    expect(pickTier(160, ladder)).toBe(160);
    expect(pickTier(176, ladder)).toBe(160); // 160×1.1
    expect(pickTier(177, ladder)).toBe(240);
    expect(pickTier(500, ladder)).toBe(480); // 480×1.1 = 528
    expect(pickTier(529, ladder)).toBe(560);
  });

  it("throws on an empty tiers list", () => {
    expect(() => pickTier(100, [])).toThrow(TypeError);
  });
});

describe("limitingAxis — table §3.5", () => {
  it("Ri === Rs → w for both fits (branches equivalent, tie-break w)", () => {
    expect(limitingAxis(1.5, 1.5, "cover")).toBe("w");
    expect(limitingAxis(1.5, 1.5, "contain")).toBe("w");
  });

  it("image wider than slot (Ri > Rs): cover → h, contain → w", () => {
    // Panorama 3:1 in a 4:3 slot.
    expect(limitingAxis(3, 4 / 3, "cover")).toBe("h");
    expect(limitingAxis(3, 4 / 3, "contain")).toBe("w");
  });

  it("image narrower than slot (Ri < Rs): cover → w, contain → h", () => {
    // Portrait 3:4 in a 16:9 slot.
    expect(limitingAxis(0.75, 16 / 9, "cover")).toBe("w");
    expect(limitingAxis(0.75, 16 / 9, "contain")).toBe("h");
  });

  it("owner's bug case: portrait (Ri=0.75) in a wide slot (1280×720), cover → w", () => {
    // Was: 720-by-height (540×720) stretched ×2.37 across 1280px.
    // Now: the w-branch is picked — no upscale.
    expect(limitingAxis(0.75, 1280 / 720, "cover")).toBe("w");
  });

  it("square avatar slot (Rs=1), cover: portrait → w, landscape → h (min-side degenerate case §3.4)", () => {
    expect(limitingAxis(0.75, 1, "cover")).toBe("w"); // Ri < 1 → w
    expect(limitingAxis(1.6, 1, "cover")).toBe("h"); // Ri > 1 → h
  });
});

// §5 fixture: portrait 3024×4032 (aspect 0.75), full default ladder.
const PREVIEW_TIERS = [160, 240, 480, 560, 720, 1080];

function portraitMeta(): RenderMetadata {
  const variants: VariantMeta[] = [
    { tier: 32, branch: null, url: "cdn://img/32.webp", width: 32, height: 43 },
    { tier: 64, branch: null, url: "cdn://img/64.webp", width: 64, height: 85 },
    { tier: 120, branch: null, url: "cdn://img/120.webp", width: 120, height: 160 },
  ];
  for (const tier of PREVIEW_TIERS) {
    variants.push(
      { tier, branch: "w", url: `cdn://img/${tier}w.webp`, width: tier, height: Math.round(tier / 0.75) },
      { tier, branch: "h", url: `cdn://img/${tier}h.webp`, width: Math.round(tier * 0.75), height: tier }
    );
  }
  variants.push({
    tier: "original",
    branch: null,
    url: "cdn://img/original.webp",
    width: 3024,
    height: 4032,
  });
  return {
    mime: "image/webp",
    bytes: 234221,
    width: 3024,
    height: 4032,
    aspect: 0.75,
    duration_ms: null,
    preview_b64: "data:image/webp;base64,UklGRi4A",
    square: false,
    variants,
  };
}

describe("chooseVariant — axis + DPR + ladder over metadata (§3.5, §4)", () => {
  it("owner's bug case end-to-end: portrait in 1280×720 slot, cover, dpr=1 → 1080w", () => {
    const v = chooseVariant(
      { slotWidthCss: 1280, slotHeightCss: 720, dpr: 1, imgAspect: 0.75, fit: "cover" },
      portraitMeta()
    );
    // Axis w, needed 1280 > 1080×1.1=1188 → past the ladder → original (§2.2).
    expect(v.tier).toBe("original");
  });

  it("portrait in 640×360 slot, cover, dpr=1 → 640 by WIDTH (not height)", () => {
    const v = chooseVariant(
      { slotWidthCss: 640, slotHeightCss: 360, dpr: 1, imgAspect: 0.75, fit: "cover" },
      portraitMeta()
    );
    expect(v).toMatchObject({ tier: 720, branch: "w" }); // 640 > 560×1.1=616 → 720
  });

  it("DPR is part of the budget: 400css × dpr2 = 800 → 1080 (720×1.1=792 < 800)", () => {
    const v = chooseVariant(
      { slotWidthCss: 400, slotHeightCss: 225, dpr: 2, imgAspect: 0.75, fit: "cover" },
      portraitMeta()
    );
    expect(v).toMatchObject({ tier: 1080, branch: "w" });
  });

  it("contain flips the axis: portrait in a wide slot → h-branch", () => {
    const v = chooseVariant(
      { slotWidthCss: 640, slotHeightCss: 360, dpr: 1, imgAspect: 0.75, fit: "contain" },
      portraitMeta()
    );
    // Ri < Rs, contain → h; needed 360 > 240×1.1=264 → 480.
    expect(v).toMatchObject({ tier: 480, branch: "h" });
  });

  it("needed past the whole ladder → original (no upscale, §2.2)", () => {
    const v = chooseVariant(
      { slotWidthCss: 2000, slotHeightCss: 1500, dpr: 2, imgAspect: 0.75, fit: "cover" },
      portraitMeta()
    );
    expect(v.tier).toBe("original");
    expect(v.width).toBe(3024);
  });

  it("thumbnail-class (branch null, min-side) serves a small square slot", () => {
    const v = chooseVariant(
      { slotWidthCss: 64, slotHeightCss: 64, dpr: 1, imgAspect: 0.75, fit: "cover" },
      portraitMeta()
    );
    // Ri<Rs=1 → w, needed 64; min-side 64 variant guarantees both sides ≥ 64.
    expect(v).toMatchObject({ tier: 64, branch: null });
  });

  it("square=true makes branch irrelevant — the single stored branch is picked", () => {
    const meta: RenderMetadata = {
      mime: "image/webp",
      bytes: 1000,
      width: 800,
      height: 800,
      aspect: 1,
      square: true,
      variants: [
        { tier: 560, branch: "w", url: "cdn://sq/560w.webp", width: 560, height: 560 },
        { tier: 720, branch: "w", url: "cdn://sq/720w.webp", width: 720, height: 720 },
        { tier: "original", branch: null, url: "cdn://sq/original.webp", width: 800, height: 800 },
      ],
    };
    // cover, landscape-ish slot: Ri=1 < Rs → axis w... force the h-axis case:
    const v = chooseVariant(
      { slotWidthCss: 300, slotHeightCss: 600, dpr: 1, imgAspect: 1, fit: "cover" },
      meta
    );
    // Ri=1 > Rs=0.5, cover → h; there is no h-branch, but square ⇒ w serves it.
    expect(v).toMatchObject({ tier: 560, branch: "w" });
  });

  it("falls back to original when there are no numeric variants", () => {
    const meta: RenderMetadata = {
      mime: "image/webp",
      bytes: 1000,
      width: 100,
      height: 100,
      aspect: 1,
      variants: [
        { tier: "original", branch: null, url: "cdn://o.webp", width: 100, height: 100 },
      ],
    };
    const v = chooseVariant(
      { slotWidthCss: 50, slotHeightCss: 50, dpr: 1, imgAspect: 1, fit: "cover" },
      meta
    );
    expect(v.tier).toBe("original");
  });

  it("throws on empty variants", () => {
    const meta: RenderMetadata = {
      mime: "image/webp",
      bytes: 0,
      width: 1,
      height: 1,
      aspect: 1,
      variants: [],
    };
    expect(() =>
      chooseVariant({ slotWidthCss: 10, slotHeightCss: 10, dpr: 1, imgAspect: 1, fit: "cover" }, meta)
    ).toThrow(TypeError);
  });
});
