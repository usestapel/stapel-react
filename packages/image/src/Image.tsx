import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ImgHTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { chooseVariant } from "./tiers.js";
import type { Fit, StapelImage, VariantMeta } from "./tiers.js";
import { useImageSlot } from "./useImageSlot.js";

/** What {@link ImageProps.renderError} is told about the image that failed. */
export interface ImageErrorInfo {
  /** The `alt` the caller passed — the only description of what is missing. */
  readonly alt: string;
  readonly meta: StapelImage;
  /** The variant URL that would not load, when one was chosen. */
  readonly url: string | undefined;
}

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
  /**
   * What to draw when the chosen variant will not load — a dead CDN URL, a
   * pruned variant, an expired signature. Omitted, a neutral placeholder
   * renders: a sunken box with a broken-image glyph and the `alt` text, which
   * is the description the caller already wrote.
   *
   * It is NOT drawn over an image that is already on screen: an UPGRADE that
   * fails leaves the tier the person is looking at exactly where it is.
   */
  renderError?: (info: ImageErrorInfo) => ReactNode;
}

const FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * The honest default for an image that will not load: a neutral box, a glyph,
 * and the `alt` text — never a broken `<img>`, whose native rendering is a
 * torn-page icon and the alt string in the browser's own font, and never an
 * empty slot, which reads as "there is nothing here" for something that IS
 * there and could not be fetched.
 *
 * Colours are token roles (`@stapel/tokens`, referenced as CSS variables so
 * this package keeps its zero dependencies). A host that has not loaded the
 * token sheet gets an unstyled — not a broken — box.
 */
function DefaultImageError(props: { alt: string }): ReactElement {
  return (
    <div
      data-testid="stapel-image-error"
      role="img"
      aria-label={props.alt}
      style={{
        ...FILL,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: 8,
        boxSizing: "border-box",
        textAlign: "center",
        fontSize: 12,
        lineHeight: 1.3,
        overflow: "hidden",
        background: "var(--stapel-surface-sunken)",
        color: "var(--stapel-text-muted)",
      }}
    >
      {/* Inline, so the glyph costs no icon dependency and inherits the
          token colour through currentColor. */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
        <path d="M4 3l16 18" />
      </svg>
      <span style={{ wordBreak: "break-word" }}>{props.alt}</span>
    </div>
  );
}

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
  renderError,
  ...imgProps
}: ImageProps): ReactElement {
  const { ref, size } = useImageSlot<HTMLDivElement>();

  const [displayed, setDisplayed] = useState<VariantMeta | undefined>(undefined);
  const [failed, setFailed] = useState<VariantMeta | undefined>(undefined);
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
      setFailed(undefined);
    };
    // A load that does not arrive is NOT a load. Committing on `onerror` (or
    // on a rejected `decode()`, which is what a fetch failure resolves to)
    // rendered an `<img>` pointed at a url the browser had already refused —
    // the torn-page glyph, sized to the slot, with no way for the caller to
    // say anything else.
    const fail = (): void => {
      if (cancelled) {
        return;
      }
      setFailed(target);
    };
    loader.src = target.url;
    if (typeof loader.decode === "function") {
      // Swap only after decode — no blank frame during the upgrade. A
      // rejection here is an EncodingError (undecodable bytes) or the load
      // failure itself; either way there is nothing to show.
      loader.decode().then(commit, fail);
    } else {
      loader.onload = commit;
      loader.onerror = fail;
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

  // Only when NOTHING is on screen: a failed upgrade keeps the tier already
  // rendered, because the person is looking at the image, not at its ladder.
  const showError = failed !== undefined && displayed === undefined;

  return (
    <div ref={ref} className={className} style={containerStyle}>
      {showError &&
        (renderError !== undefined
          ? renderError({ alt, meta, url: failed.url })
          : <DefaultImageError alt={alt} />)}
      {!showError && meta.preview_b64 != null && (
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
