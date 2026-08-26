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
//
// Two numbers appear in the element-width story and they mean different
// things: the one in the CAPTION is the box, the one INSIDE the frame is the
// file. Both are labelled where they are drawn, and the legend says it once
// more above the ladder — a demo whose point needs its source read is not a
// demo.
const COPY = {
  legendTitle: "How to read this",
  legendBoxTerm: "Box width",
  legendBoxDef:
    "the caption under each frame — the CSS width the element was given. A box never grows past the screen, so on a phone the widest one is narrower than it asks for.",
  legendVariantTerm: "Variant served",
  legendVariantDef:
    "the number inside each frame — the ladder rung the element actually fetched for its measured size at this device pixel ratio.",
  inFrameLabel: "variant",
  small: "Box width — 96 px",
  medium: "Box width — 240 px",
  large: "Box width — 640 px",
  fluid: "Box width — as wide as the viewport gives it",
  photo: "blur — a still photograph",
  poster: "poster — a frame from a video",
  waveform: "waveform — a voice note",
  pendingPoster: "Waiting for the video poster",
  pendingWaveform: "Waiting for the waveform",
  pendingPhoto: "Waiting for the blurred preview",
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
 * One picture of a tier: an outlined box with the number printed across it, so
 * the story SHOWS which file the element asked for instead of asking the
 * reader to open a network panel.
 *
 * `label` is what turns a bare number into a readable fact. It is opt-in
 * because only the LADDER rungs are variants: the micro-preview bytes and the
 * single url of a link image are drawn by the same generator and calling
 * either of those "variant" would be a caption that lies.
 */
function tierPixels(
  tier: number,
  width: number,
  height: number,
  label?: string
): string {
  const numberSize = Math.max(10, Math.round(width / 5));
  const labelSize = Math.max(6, Math.round(width / 16));
  const middle = height / 2;
  const numberY = label === undefined ? middle : middle - labelSize * 0.8;
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" ` +
    `viewBox="0 0 ${String(width)} ${String(height)}">` +
    `<rect width="100%" height="100%" fill="#e6e6ea"/>` +
    `<rect x="1" y="1" width="${String(width - 2)}" height="${String(height - 2)}" fill="none" stroke="#8a8a99" stroke-width="2"/>` +
    `<text x="50%" y="${String(numberY)}" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="ui-sans-serif,system-ui,sans-serif" font-size="${String(numberSize)}" ` +
    `fill="#3a3a46">${String(tier)}</text>` +
    (label === undefined
      ? ""
      : `<text x="50%" y="${String(middle + numberSize * 0.55)}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="ui-sans-serif,system-ui,sans-serif" font-size="${String(labelSize)}" ` +
        `letter-spacing="${String(labelSize * 0.12)}" fill="#6a6a78">${label}</text>`) +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(doc)}`;
}

/** A 4:3 ladder whose rungs are visibly different — and labelled — files. */
function ladder(): VariantMeta[] {
  return LADDER.map((tier) => {
    const height = Math.round((tier * 3) / 4);
    return {
      tier: String(tier),
      branch: null,
      url: tierPixels(tier, tier, height, COPY.inFrameLabel),
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
  // Mobile first: a 640px box must not slice a 390px page open at the right
  // edge. `maxWidth: 100%` alone cannot do it — a percentage resolves against
  // the parent's width, and a shrink-to-fit parent's width IS its content, so
  // the cap is 100% of 640. `minmax(0, 1fr)` gives the track a floor of zero
  // and `minWidth: 0` overrides a flex item's `min-width: auto`; between them
  // every ancestor has a definite width for the percentage to bite on.
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "var(--stapel-space-1)",
  maxWidth: "100%",
  minWidth: 0,
  color: "var(--stapel-text-muted)",
  fontSize: "var(--stapel-font-size-xs)",
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
    maxWidth: "100%",
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
  gap: "var(--stapel-space-5)",
  alignItems: "flex-start",
  flexWrap: "wrap",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

const stackStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "var(--stapel-space-4)",
  width: "100%",
  maxWidth: "100%",
};

const legendStyle: CSSProperties = {
  margin: 0,
  display: "grid",
  gap: "var(--stapel-space-2)",
  padding: "var(--stapel-space-3)",
  border: "1px solid var(--stapel-border-subtle)",
  borderRadius: "var(--stapel-radius-md)",
  background: "var(--stapel-surface-sunken)",
  color: "var(--stapel-text-muted)",
  fontSize: "var(--stapel-font-size-sm)",
  lineHeight: 1.4,
  maxWidth: "34rem",
};

const legendTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--stapel-text)",
  fontSize: "var(--stapel-font-size-sm)",
  fontWeight: 600,
};

const legendTermStyle: CSSProperties = {
  color: "var(--stapel-text)",
  fontWeight: 600,
};

const legendDefStyle: CSSProperties = {
  margin: 0,
};

/**
 * The two numbers, named.
 *
 * Every frame below prints one number inside itself and carries a different
 * one in its caption, and without this block the difference is only readable
 * in the source — which is the same as not documenting it.
 */
function Legend(): ReactElement {
  return (
    <div style={legendStyle}>
      <p style={legendTitleStyle}>{COPY.legendTitle}</p>
      <dl style={{ margin: 0, display: "grid", gap: "var(--stapel-space-1)" }}>
        <div>
          <dt style={legendTermStyle}>{COPY.legendBoxTerm}</dt>
          <dd style={legendDefStyle}>{COPY.legendBoxDef}</dd>
        </div>
        <div>
          <dt style={legendTermStyle}>{COPY.legendVariantTerm}</dt>
          <dd style={legendDefStyle}>{COPY.legendVariantDef}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Three boxes, three different files, one descriptor. */
function ElementWidthDemo(): ReactElement {
  return (
    <div style={stackStyle}>
      <Legend />
      <div style={rowStyle}>
        <Frame caption={COPY.small} alt={COPY.photoAlt} meta={photo()} width={96} />
        <Frame caption={COPY.medium} alt={COPY.photoAlt} meta={photo()} width={240} />
        <Frame caption={COPY.large} alt={COPY.photoAlt} meta={photo()} width={640} />
      </div>
    </div>
  );
}

/** One element that fills the viewport — the resize / no-downgrade case. */
function FluidDemo(): ReactElement {
  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
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
  // `url: ""` is what makes this story honest. A snapshot whose preview has
  // not been generated yet has no full-size file to fall back on either, and
  // with the fixture's default url left in place the photo rung simply
  // rendered — one painted image beside two reserved boxes, which documents
  // nothing about reserving a box.
  const pending = {
    url: "",
    preview_b64: null,
    meta_status: "partial",
    meta_reason: "not_generated",
  } as const;
  return (
    <div style={rowStyle}>
      <Frame
        caption={COPY.pendingPhoto}
        alt={COPY.photoAlt}
        meta={photo({ ...pending, variants: [], aspect: 4 / 3 })}
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
  tokens: ["surface-sunken", "text-muted", "text", "border-subtle"],
  variants: {
    default: {
      description:
        "Three boxes, three different files, one descriptor — with the legend that says which number is which: the caption is the box, the number inside the frame is the variant that was served. Every box is capped at the viewport, so the ladder reads the same at 390px as it does on a desktop.",
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
        "preview_kind is known while preview_b64 is still null, so the box is reserved in the right shape now instead of collapsing and jumping later. All three are the same designed state: the medium's own glyph inside the reserved box, and a caption saying what is being waited for — never a blank rectangle, which is indistinguishable from nothing being there at all.",
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
