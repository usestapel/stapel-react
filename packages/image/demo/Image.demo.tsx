/**
 * The story `@stapel/image` never had.
 *
 * This package holds the subtlest runtime behaviour in the fleet — a tier that
 * changes on resize, changes again when the device pixel ratio changes, and
 * never downgrades once something is painted — and until now there was nothing
 * a human could open and look at. Every claim below is visible in the frame
 * itself, because each rung of the ladder is a picture OF ITS OWN TIER: what
 * the number inside the box says is the file the element decided it needed.
 *
 * ── Why the pixels are inline SVG ──────────────────────────────────────────
 *
 * No network, no fixtures on disk, no third-party host: the demo has to render
 * under a strict CSP and inside a static screenshot runner, and a variant URL
 * that 404s would prove the request but show an error box. A `data:` URI is a
 * real image the browser really decodes, so the upgrade path (load off-DOM,
 * `decode()`, swap) runs exactly as it does in production.
 *
 * The greys inside those documents are not styled surface: an SVG in a `data:`
 * URI is an isolated document with no access to the host's token sheet, and
 * these bytes stand in for a photograph. The demo's own chrome is tokens.
 */
import type { CSSProperties, ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Image } from "../src/Image.js";
import type { StapelImage, VariantMeta } from "../src/tiers.js";

// Developer-facing captions. This package ships no i18n layer and correctly so
// (the only text it renders is the caller's `alt`), so the showcase copy is a
// constant table, the same status as `defineDemo`'s own literal title.
const COPY = {
  small: "96 px box",
  medium: "240 px box",
  large: "640 px box",
  fluid: "as wide as the viewport gives it",
  photo: "blur — a still photograph",
  poster: "poster — a frame from a video",
  waveform: "waveform — a voice note",
  pendingPoster: "poster, not generated yet",
  pendingWaveform: "waveform, not generated yet",
  pendingPhoto: "blur, not generated yet",
  dead: "the chosen variant will not load",
  link: "a link with no ladder at all",
  photoAlt: "A landscape photograph",
  clipAlt: "A short video clip",
  noteAlt: "A voice note",
  deadAlt: "A photograph that could not be fetched",
  linkAlt: "An image hosted somewhere else",
} as const;

const LADDER = [32, 64, 120, 240, 480, 960, 1440] as const;

/**
 * One rung, drawn as a picture of its own tier: an outlined box with the tier
 * printed across it, so the story SHOWS which file the element asked for
 * instead of asking the reader to open a network panel.
 */
function tierPixels(tier: number, width: number, height: number): string {
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" ` +
    `viewBox="0 0 ${String(width)} ${String(height)}">` +
    `<rect width="100%" height="100%" fill="#e6e6ea"/>` +
    `<rect x="1" y="1" width="${String(width - 2)}" height="${String(height - 2)}" fill="none" stroke="#8a8a99" stroke-width="2"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="ui-sans-serif,system-ui,sans-serif" font-size="${String(Math.max(10, Math.round(width / 5)))}" ` +
    `fill="#3a3a46">${String(tier)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(doc)}`;
}

/** A 4:3 ladder whose rungs are visibly different files. */
function ladder(): VariantMeta[] {
  return LADDER.map((tier) => {
    const height = Math.round((tier * 3) / 4);
    return {
      tier: String(tier),
      branch: null,
      url: tierPixels(tier, tier, height),
      width: tier,
      height,
    };
  });
}

const MICRO_BLUR = tierPixels(16, 16, 12);
const MICRO_POSTER = tierPixels(160, 160, 90);
const MICRO_WAVEFORM =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 240 60">` +
      `<g fill="#5a5a6a">` +
      Array.from({ length: 40 }, (_, i) => {
        const h = 6 + Math.round(22 * Math.abs(Math.sin(i * 0.7)));
        return `<rect x="${String(i * 6)}" y="${String(30 - h / 2)}" width="3" height="${String(h)}" rx="1"/>`;
      }).join("") +
      `</g></svg>`
  );

function photo(overrides?: Partial<StapelImage>): StapelImage {
  return {
    source: "cdn",
    url: tierPixels(1440, 1440, 1080),
    mime: "image/webp",
    width: 1600,
    height: 1200,
    aspect: 4 / 3,
    square: false,
    preview_b64: MICRO_BLUR,
    variants: ladder(),
    kind: "image",
    preview_kind: "blur",
    duration_ms: null,
    poster_url: null,
    meta_status: "ok",
    meta_reason: null,
    ...overrides,
  };
}

const frameStyle: CSSProperties = {
  margin: 0,
  display: "grid",
  gap: 4,
  color: "var(--stapel-text-muted)",
  fontSize: 12,
};

function Frame(props: {
  caption: string;
  alt: string;
  meta: StapelImage;
  width: number | string;
  height?: number;
}): ReactElement {
  const box: CSSProperties = {
    width: props.width,
    ...(props.height === undefined ? {} : { height: props.height }),
  };
  return (
    <figure style={frameStyle}>
      <Image meta={props.meta} alt={props.alt} style={box} />
      <figcaption>{props.caption}</figcaption>
    </figure>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 24,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

/** Three boxes, three different files, one descriptor. */
function ElementWidthDemo(): ReactElement {
  return (
    <div style={rowStyle}>
      <Frame caption={COPY.small} alt={COPY.photoAlt} meta={photo()} width={96} />
      <Frame caption={COPY.medium} alt={COPY.photoAlt} meta={photo()} width={240} />
      <Frame caption={COPY.large} alt={COPY.photoAlt} meta={photo()} width={640} />
    </div>
  );
}

/** One element that fills the viewport — the resize / no-downgrade case. */
function FluidDemo(): ReactElement {
  return (
    <div style={{ maxWidth: "100%" }}>
      <Frame caption={COPY.fluid} alt={COPY.photoAlt} meta={photo()} width="100%" />
    </div>
  );
}

/** The placeholder is branched on what it IS, not on being present. */
function PreviewKindDemo(): ReactElement {
  return (
    <div style={rowStyle}>
      <Frame caption={COPY.photo} alt={COPY.photoAlt} meta={photo()} width={200} />
      <Frame
        caption={COPY.poster}
        alt={COPY.clipAlt}
        meta={photo({
          kind: "video",
          preview_kind: "poster",
          preview_b64: MICRO_POSTER,
          poster_url: null,
          duration_ms: 42_000,
          aspect: 16 / 9,
          variants: [],
        })}
        width={200}
      />
      <Frame
        caption={COPY.waveform}
        alt={COPY.noteAlt}
        meta={photo({
          kind: "audio",
          preview_kind: "waveform",
          preview_b64: MICRO_WAVEFORM,
          width: null,
          height: null,
          aspect: null,
          duration_ms: 4200,
          variants: [],
        })}
        width={200}
      />
    </div>
  );
}

/** `preview_kind` is known while `preview_b64` is still null — reserve the box. */
function ReservedBoxDemo(): ReactElement {
  const pending = { preview_b64: null, meta_status: "partial", meta_reason: "not_generated" } as const;
  return (
    <div style={rowStyle}>
      <Frame
        caption={COPY.pendingPhoto}
        alt={COPY.photoAlt}
        meta={photo({ ...pending, variants: [] })}
        width={200}
      />
      <Frame
        caption={COPY.pendingPoster}
        alt={COPY.clipAlt}
        meta={photo({
          ...pending,
          kind: "video",
          preview_kind: "poster",
          width: null,
          height: null,
          aspect: null,
          variants: [],
        })}
        width={200}
      />
      <Frame
        caption={COPY.pendingWaveform}
        alt={COPY.noteAlt}
        meta={photo({
          ...pending,
          kind: "audio",
          preview_kind: "waveform",
          width: null,
          height: null,
          aspect: null,
          variants: [],
        })}
        width={200}
      />
    </div>
  );
}

/** A dead URL is a designed box carrying the caller's own description. */
function DeadUrlDemo(): ReactElement {
  return (
    <div style={rowStyle}>
      <Frame
        caption={COPY.dead}
        alt={COPY.deadAlt}
        meta={photo({
          preview_b64: null,
          variants: [
            { tier: "240", branch: null, url: "/demo-variants/gone.webp", width: 240, height: 180 },
          ],
        })}
        width={240}
      />
    </div>
  );
}

/** No ladder: one url, shown at once, with the aspect box still doing its job. */
function NoLadderDemo(): ReactElement {
  return (
    <div style={rowStyle}>
      <Frame
        caption={COPY.link}
        alt={COPY.linkAlt}
        meta={photo({ source: "link", preview_b64: null, variants: [], kind: null, preview_kind: null })}
        width={240}
      />
    </div>
  );
}

export default defineDemo({
  id: "image.element-width",
  title: "The variant comes from the element",
  description:
    "One image descriptor rendered at several sizes. Each box asks for the smallest ladder rung that does not upscale for ITS measured width at the live device pixel ratio — never a size derived from the viewport — and every rung is a picture of its own tier, so the number in the frame is the file that was fetched. Resizing upgrades; it never downgrades something already painted.",
  component: Image,
  tokens: ["surface-sunken", "text-muted"],
  variants: {
    default: {
      description: "Three fixed boxes, three different files, one descriptor.",
      viewport: "desktop",
      step: "measured",
      render: () => <ElementWidthDemo />,
    },
    fluid: {
      description:
        "One full-width element: resize the viewer and it upgrades, and once a tier is painted it is never replaced by a smaller one.",
      viewport: "phone",
      step: "measured",
      render: () => <FluidDemo />,
    },
    "preview-kinds": {
      description:
        "The placeholder is branched on preview_kind: a photo blurs up, a video poster is a real frame and is not smeared, a waveform is drawn whole.",
      viewport: "desktop",
      step: "preview",
      render: () => <PreviewKindDemo />,
    },
    "reserved-box": {
      description:
        "preview_kind is known while preview_b64 is still null, so the box is reserved in the right shape now instead of collapsing and jumping later.",
      viewport: "phone",
      step: "not_generated",
      render: () => <ReservedBoxDemo />,
    },
    "dead-url": {
      description:
        "A variant that will not load renders the neutral error box with the caller's alt — never the browser's torn-page glyph, never an empty slot.",
      viewport: "desktop",
      step: "failed",
      render: () => <DeadUrlDemo />,
    },
    "no-ladder": {
      description:
        "A link image has one url and no rungs: it is shown immediately, with the aspect box still preventing the layout shift.",
      viewport: "desktop",
      step: "link",
      render: () => <NoLadderDemo />,
    },
  },
});
