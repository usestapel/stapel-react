import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ImgHTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { chooseVariant, numericTier, PREVIEW_KIND_ASPECT } from "./tiers.js";
import type { Fit, PreviewKind, StapelImage, VariantMeta } from "./tiers.js";
import { useDevicePixelRatio, useImageSlot } from "./useImageSlot.js";

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
  /**
   * How long the slot has to hold still before its new size re-picks a tier,
   * in ms (see `useImageSlot`). Default 120. Lower it for a slot that is
   * animated to its final size; raise it for one inside a draggable splitter.
   */
  slotSettleMs?: number;
}

/**
 * How big a variant is, as ONE comparable number: its ladder tier, with
 * `"original"` at the top.
 *
 * The upgrade-only rule needs to compare two picks, and the file's pixel
 * dimensions are the wrong instrument for it: `width`/`height` are `null` on
 * every variant of a ladder whose resolver could not read them (the honest
 * shape for a CDN-reference resolver), which is how an area comparison of
 * `0 <= 0` once refused every upgrade for the life of the component. The tier
 * is on the wire for every variant, always, and it is what the ladder is
 * ordered by.
 */
function tierRank(variant: VariantMeta): number {
  if (variant.tier === "original") {
    return Number.POSITIVE_INFINITY;
  }
  const numeric = numericTier(variant.tier);
  return numeric === null ? Number.NaN : numeric;
}

const FILL: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * What the placeholder is, resolved once.
 *
 * A snapshot that carries `preview_b64` but no `preview_kind` predates §83.2
 * (or was built by a host by hand). Its bytes are a micro thumbnail of a still
 * image — that is the only thing anything has ever put there — so it reads as
 * `"blur"`, which keeps every existing producer rendering exactly as before.
 */
function previewKindOf(meta: StapelImage): PreviewKind | null {
  const declared = meta.preview_kind;
  if (declared !== undefined && declared !== null) {
    return declared;
  }
  return meta.preview_b64 != null ? "blur" : null;
}

/**
 * The placeholder source, or `null`.
 *
 * `preview_b64` goes straight into a `src`, and `meta` is a value a HOST builds
 * as often as it is one the server sent — `listings-react` documents
 * `resolveImage: (ref) => …` as a function the application writes. The backend
 * bounds its own previews to a few KB of `data:image/webp;base64,…`; nothing
 * bounds a host's. So the trust boundary is stated here rather than assumed: a
 * placeholder is a `data:image/` URI or it is not drawn.
 */
function previewSrcOf(meta: StapelImage): string | null {
  const raw = meta.preview_b64;
  return typeof raw === "string" && raw.startsWith("data:image/") ? raw : null;
}

/**
 * Whether an `<img>` may load this medium's own bytes.
 *
 * `<img src="clip.mp4">` is not a video, it is a broken image — and before
 * `kind` existed that is precisely what a chat attachment would have rendered.
 * A video's loadable still is its `poster_url`; an audio row has no still at
 * all and its waveform placeholder IS the render.
 */
function isTimeBased(meta: StapelImage, previewKind: PreviewKind | null): boolean {
  return (
    meta.kind === "video" ||
    meta.kind === "audio" ||
    previewKind === "poster" ||
    previewKind === "waveform"
  );
}

/**
 * The box a preview is drawn in when there is no preview yet.
 *
 * This is the whole point of `preview_kind` being knowable while `preview_b64`
 * is still null: the slot is reserved at the right shape NOW, and what lands in
 * it later lands without moving anything. A sunken rectangle for a poster; a
 * centred baseline for a waveform, which is what an amplitude strip degrades to
 * when its amplitudes are unknown.
 */
function PreviewSkeleton(props: { previewKind: PreviewKind }): ReactElement {
  return (
    <div
      data-testid="stapel-image-preview-skeleton"
      data-stapel-preview-kind={props.previewKind}
      aria-hidden="true"
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--stapel-surface-sunken)",
      }}
    >
      {props.previewKind === "waveform" && (
        <div
          style={{
            width: "80%",
            height: 2,
            background: "var(--stapel-text-muted)",
            opacity: 0.4,
          }}
        />
      )}
    </div>
  );
}

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
 *    network round-trip. Where the snapshot has no geometry, `preview_kind`
 *    still fixes the shape (a waveform is a wide strip; see
 *    `PREVIEW_KIND_ASPECT`).
 * 2. The placeholder: the inlined `preview_b64` renders instantly underneath
 *    until the chosen tier has decoded — BRANCHED on `preview_kind`, because a
 *    blurred waveform is noise and a blurred poster is a discarded frame. When
 *    `preview_kind` is known and the preview itself has not been generated yet,
 *    the reserved box is drawn in that shape rather than left empty.
 * 3. `useImageSlot()` measures the actual slot → `chooseVariant(...)` → src.
 *    A time-based medium (`kind: "video" | "audio"`) skips the ladder: an
 *    `<img>` cannot load a video, so a video shows its `poster_url` and an
 *    audio row shows its waveform and nothing else.
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
  slotSettleMs,
  ...imgProps
}: ImageProps): ReactElement {
  const { ref, size } = useImageSlot<HTMLDivElement>(
    slotSettleMs === undefined ? undefined : { settleMs: slotSettleMs }
  );
  const dpr = useDevicePixelRatio();

  const [displayed, setDisplayed] = useState<VariantMeta | undefined>(undefined);
  const [failed, setFailed] = useState<VariantMeta | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const displayedRef = useRef<VariantMeta | undefined>(undefined);

  const previewKind = previewKindOf(meta);
  const previewSrc = previewSrcOf(meta);

  const target = useMemo(() => {
    // ── A time-based medium never loads its own bytes ─────────────────────
    //
    // An audio row's `url` is the audio file and there is nothing an <img> can
    // do with it; a video's is the video. What IS loadable for a video is the
    // poster still, so that is what the ladder logic below is skipped in favour
    // of. With neither, the placeholder stands alone in a correctly shaped box,
    // which is a finished render and not a failure — so no error is reported
    // either.
    if (isTimeBased(meta, previewKindOf(meta))) {
      const poster = meta.poster_url;
      return typeof poster === "string" && poster !== ""
        ? ({
            tier: "original",
            branch: null,
            url: poster,
            width: meta.width,
            height: meta.height,
          } as VariantMeta)
        : undefined;
    }
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
    // The size is THIS element's, measured; the DPR is the device's, and it
    // moves (zoom, a window dragged to a 1x monitor). Neither is the viewport.
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
  }, [size, meta, fit, dpr]);

  // The load below is keyed by the chosen variant's URL, not by the object
  // that carries it — and that distinction is the whole of a bug that made
  // images never appear.
  //
  // `meta` is a value a HOST builds. The documented way to write a resolver is
  // `resolveImage: (ref) => ({ … })`, called inline in render, which returns a
  // fresh object every time. That made `target` a new identity on every render
  // of the caller, which re-ran this effect, whose cleanup set `cancelled` on
  // the decode that was already in flight — so on any screen that re-renders
  // while a photo loads (a listing page settling four queries, say) every
  // attempt was cancelled by the next one and NOTHING was ever committed: not
  // the image, not the error box. An empty slot, indefinitely.
  //
  // The identity of the pick is not what the browser is fetching; the URL is.
  // Deps are therefore the URL alone, and the pick itself is read through a
  // ref so a re-render can update it without restarting a live load.
  const targetRef = useRef<VariantMeta | undefined>(target);
  targetRef.current = target;
  const targetUrl = target?.url;

  useEffect(() => {
    const pick = targetRef.current;
    if (pick === undefined || targetUrl === undefined) {
      return;
    }
    const current = displayedRef.current;
    // ── The upgrade-only rule lives HERE, and only here ────────────────────
    //
    // "Never downgrade" is a statement about what is ON SCREEN: replacing a
    // painted variant with a smaller one is a visible regression, not an
    // optimization. It is therefore checked against `displayedRef` — the
    // variant actually decoded and committed — and NOT by freezing the ruler
    // in `useImageSlot`, which is where it used to live and which made the
    // measurement itself a maximum (see that hook's doc). Before anything is
    // painted, a re-measure is free to pick smaller, which is the whole point:
    // a small element gets a small file.
    //
    // The comparison is by TIER, the one field every variant carries. It used
    // to be by pixel AREA, which is `null` on every variant of an unmeasured
    // ladder — `0 <= 0` then refused every upgrade for the life of the
    // component. Area survives only as the tiebreaker for a non-ladder tier
    // string nothing can rank.
    const area = (v: VariantMeta): number => (v.width ?? 0) * (v.height ?? 0);
    if (current !== undefined) {
      if (current.url === pick.url) {
        return;
      }
      const currentRank = tierRank(current);
      const pickRank = tierRank(pick);
      if (!Number.isNaN(currentRank) && !Number.isNaN(pickRank)) {
        if (pickRank < currentRank) {
          return; // a strict downgrade: never.
        }
        if (pickRank === currentRank && pick.branch === current.branch) {
          return; // the same rung of the same ladder, by another URL.
        }
        // Equal tier, DIFFERENT branch is not a downgrade — it is the slot's
        // limiting axis having changed (a portrait card became landscape), and
        // the variant that served the old axis is short on the new one. Let it
        // through, or the image stays soft on the axis that now matters.
      } else if (area(current) > 0 && area(pick) > 0 && area(pick) <= area(current)) {
        return;
      }
    }
    let cancelled = false;
    const loader = document.createElement("img");
    const commit = (): void => {
      if (cancelled) {
        return;
      }
      displayedRef.current = pick;
      setDisplayed(pick);
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
      setFailed(pick);
    };
    loader.src = pick.url;
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
  }, [targetUrl]);

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

  // Layout-shift protection from the snapshot. The measured aspect wins; where
  // there is none, `preview_kind` still fixes a SHAPE for two of the three
  // kinds (see PREVIEW_KIND_ASPECT) — an audio row carries no geometry
  // whatsoever, and a strip reserved at nothing is a strip that arrives by
  // shoving the rest of the page down.
  const reservedAspect =
    meta.aspect ?? (previewKind !== null ? PREVIEW_KIND_ASPECT[previewKind] : null);

  const containerStyle: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    ...(reservedAspect ? { aspectRatio: String(reservedAspect) } : {}),
    ...style,
  };

  // Only when NOTHING is on screen: a failed upgrade keeps the tier already
  // rendered, because the person is looking at the image, not at its ladder.
  const showError = failed !== undefined && displayed === undefined;
  const showPlaceholder = !showError && displayed === undefined;

  return (
    <div
      ref={ref}
      className={className}
      style={containerStyle}
      {...(previewKind !== null ? { "data-stapel-preview-kind": previewKind } : {})}
    >
      {showError &&
        (renderError !== undefined
          ? renderError({ alt, meta, url: failed.url })
          : <DefaultImageError alt={alt} />)}
      {/* ── The placeholder, branched on WHAT it is ────────────────────────
          A blurred waveform is noise and a blurred poster throws away the one
          frame somebody chose. `filter`/`transform` belong to "blur" alone;
          a poster is a real still and is shown as one; a waveform is drawn
          whole (`contain`), because cropping an amplitude strip to fill a box
          removes the amplitudes. Under the loaded image it stays visible only
          until that image commits, exactly as before. */}
      {!showError && previewSrc !== null && (
        <img
          src={previewSrc}
          alt=""
          aria-hidden="true"
          data-testid="stapel-image-preview"
          data-stapel-preview-kind={previewKind ?? "blur"}
          style={{
            ...FILL,
            objectFit: previewKind === "waveform" ? "contain" : fit,
            ...(previewKind === "blur" || previewKind === null
              ? { filter: "blur(12px)", transform: "scale(1.05)" }
              : {}),
          }}
        />
      )}
      {showPlaceholder && previewSrc === null && previewKind !== null && (
        <PreviewSkeleton previewKind={previewKind} />
      )}
      {displayed !== undefined && (
        <img
          loading="lazy"
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
