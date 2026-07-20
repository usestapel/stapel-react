import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ImgHTMLAttributes, ReactElement } from "react";
import { chooseVariant } from "./tiers.js";
import type { Fit, StapelImage, VariantMeta } from "./tiers.js";
import { useImageSlot } from "./useImageSlot.js";

export interface ImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "alt"> {
  /** A source-agnostic `StapelImage` (`stapel_core.media`). With a variant
   * ladder → the right tier is picked from the measured slot; without one
   * (a `"link"` / unprocessed file) → the single `url` is shown. */
  meta: StapelImage;
  /** Default `"cover"` (chat/catalog/avatar — fill the slot). */
  fit?: Fit;
  /** Required, no default. */
  alt: string;
}

const FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * CDN-ladder-aware image (images-and-cdn.md §4):
 *
 * 1. `aspect-ratio` from metadata goes on the container BEFORE the first slot
 *    measurement — layout-shift protection entirely from the snapshot, no
 *    network round-trip.
 * 2. Blur-up: the inlined 16px `preview_b64` renders instantly underneath
 *    until the chosen tier has decoded.
 * 3. `useImageSlot()` measures the actual slot → `chooseVariant(...)` → src.
 * 4. Upgrades only: a re-measure that picks a variant no bigger than the one
 *    already rendered is ignored; a bigger pick loads off-DOM and swaps in
 *    only after `decode()` — never a flash of empty slot, never a downgrade.
 */
export function Image({
  meta,
  fit = "cover",
  alt,
  style,
  className,
  ...imgProps
}: ImageProps): ReactElement {
  const { ref, size } = useImageSlot<HTMLDivElement>();

  const [displayed, setDisplayed] = useState<VariantMeta | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const displayedRef = useRef<VariantMeta | undefined>(undefined);

  const target = useMemo(() => {
    // No ladder (a "link" / unprocessed file): the single top-level url is all
    // there is — show it immediately, no slot measurement needed.
    if (meta.variants.length === 0) {
      return meta.url
        ? ({ tier: "original", branch: null, url: meta.url, width: meta.width, height: meta.height } as VariantMeta)
        : undefined;
    }
    if (size === undefined || size.width <= 0 || size.height <= 0) {
      return undefined;
    }
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    return chooseVariant(
      {
        slotWidthCss: size.width,
        slotHeightCss: size.height,
        dpr,
        imgAspect: meta.aspect ?? 1,
        fit,
      },
      meta
    );
  }, [size, meta, fit]);

  useEffect(() => {
    if (target === undefined) {
      return;
    }
    const current = displayedRef.current;
    // Upgrade only (§4): never replace an already-rendered variant with an
    // equal or smaller one (resize jitter, transient shrink).
    const area = (v: VariantMeta): number => (v.width ?? 0) * (v.height ?? 0);
    if (current !== undefined && area(target) <= area(current)) {
      return;
    }
    let cancelled = false;
    const loader = document.createElement("img");
    const commit = (): void => {
      if (cancelled) {
        return;
      }
      displayedRef.current = target;
      setDisplayed(target);
    };
    loader.src = target.url;
    if (typeof loader.decode === "function") {
      // Swap only after decode — no blank frame during the upgrade.
      loader.decode().then(commit, commit);
    } else {
      loader.onload = commit;
      loader.onerror = commit;
    }
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (displayed === undefined || visible) {
      return;
    }
    // One frame at opacity 0 so the blur-up → sharp transition actually runs.
    const id = requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [displayed, visible]);

  const containerStyle: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    // Layout-shift protection from the snapshot — only when the aspect is
    // actually known (a "link" image may not carry one).
    ...(meta.aspect ? { aspectRatio: String(meta.aspect) } : {}),
    ...style,
  };

  return (
    <div ref={ref} className={className} style={containerStyle}>
      {meta.preview_b64 != null && (
        <img
          src={meta.preview_b64}
          alt=""
          aria-hidden="true"
          style={{
            ...FILL,
            objectFit: fit,
            filter: "blur(12px)",
            transform: "scale(1.05)",
          }}
        />
      )}
      {displayed !== undefined && (
        <img
          {...imgProps}
          src={displayed.url}
          alt={alt}
          style={{
            ...FILL,
            objectFit: fit,
            opacity: visible ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        />
      )}
    </div>
  );
}
