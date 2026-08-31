/**
 * `SkinCarousel` — the substrate's swipe primitive, drawn at phone width
 * because that is the only width where the question it answers exists.
 *
 * The slides here are flat token-coloured plates rather than photographs on
 * purpose: what a reviewer has to be able to see in one glance is the
 * GEOMETRY — how much of slide 2 is showing at rest, whether the well keeps
 * its shape, where the indicator sits — and a real photograph hides all three
 * behind its own content. In the product these are `@stapel/image` `<Image>`
 * elements; the strip does not know or care.
 *
 * Demos are first-class code (frontend-guardrails §4.2), so this file obeys
 * the product ruleset: colours are role references (`cssVar`), dimensions come
 * off the scale, and the plate labels are ordinal NUMBERS — a technical token,
 * not prose, so there is nothing here for a translator to own.
 */
import type { CSSProperties, ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, fontSize, fontWeight, radii, spacing } from "@stapel/tokens";
import type { CoreTokenName } from "@stapel/tokens";
import { SkinCarousel } from "../src/skin/carousel.js";
import { SkinTheme } from "../src/skin/theme.js";

/** The 390px frame every phone variant is looked at in. */
const PHONE_FRAME_WIDTH = 390;

/**
 * The plates. Distinct ROLES, not distinct hexes: each one re-themes with
 * `data-theme`, so the dark pass of this story is the same story rather than
 * five dark rectangles.
 */
const PLATES: readonly CoreTokenName[] = ["brand", "info", "success", "warning", "error"];

/** The strip's accessible name — copy the CALLER owns (see `label`). */
const STRIP_LABEL = "Demo photo strip";

function plateStyle(role: CoreTokenName): CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: spacing[3],
    background: cssVar(role),
    color: cssVar("text-on-accent"),
    fontSize: fontSize.xl.fontSize,
    fontWeight: fontWeight.bold,
    borderRadius: radii.lg,
    boxSizing: "border-box",
    // Tall enough that the peek sliver is a shape rather than a stripe, on
    // the scale rather than beside it.
    minHeight: spacing[8] + spacing[7],
  };
}

/** One placeholder slide: a token-coloured plate carrying its own ordinal. */
function Plate(props: { readonly role: CoreTokenName; readonly ordinal: number }): ReactElement {
  return <div style={plateStyle(props.role)}>{String(props.ordinal)}</div>;
}

function plates(): readonly ReactElement[] {
  return PLATES.map((role, index) => <Plate key={role} role={role} ordinal={index + 1} />);
}

/** The frame: a self-themed base surface, phone-width unless told otherwise. */
function Frame(props: {
  readonly phone?: boolean;
  readonly children: ReactElement;
}): ReactElement {
  return (
    <SkinTheme
      surface="base"
      style={{
        padding: spacing[4],
        ...(props.phone === true ? { maxWidth: PHONE_FRAME_WIDTH } : {}),
      }}
    >
      {props.children}
    </SkinTheme>
  );
}

export default defineDemo({
  id: "tokens-antd.skin-carousel",
  title: "Skin carousel",
  description:
    "The fleet's one swipe primitive: a native CSS scroll-snap strip with no gesture code at all. The default `peek` leaves the edge of the next slide on screen — the affordance that says there is more — the scrollbar is hidden while the strip itself stays a focusable, arrow-scrollable region, and the optional dots are an indicator rather than a control, because a tappable dot would need per-dot copy the token bridge cannot invent.",
  component: SkinCarousel,
  tokens: ["brand", "info", "success", "warning", "error", "border", "text-muted", "focus-ring"],
  variants: {
    peek: {
      description:
        "The default strip at 390px: slides are the container minus an 8% sliver, so the second plate's edge is visible at rest. Nothing else is drawn — no indicator, no ratio — which is the shape a card in a result list uses.",
      viewport: "phone",
      step: "peek",
      render: () => (
        <Frame phone>
          <SkinCarousel label={STRIP_LABEL}>{plates()}</SkinCarousel>
        </Frame>
      ),
    },
    dots: {
      description:
        "The same strip with the position indicator. The row is aria-hidden and holds no buttons: position is announced through the strip's list semantics instead, in every locale, with no key to register.",
      viewport: "phone",
      step: "dots",
      render: () => (
        <Frame phone>
          <SkinCarousel label={STRIP_LABEL} dots>
            {plates()}
          </SkinCarousel>
        </Frame>
      ),
    },
    "aspect-ratio": {
      description:
        "A 4 / 3 photo well with a fixed 56px peek. The well's shape is fixed by the strip, so a gallery does not change height as each image lands — the reason a photo carousel states an aspectRatio and a text one does not.",
      viewport: "phone",
      step: "aspect-ratio",
      render: () => (
        <Frame phone>
          <SkinCarousel label={STRIP_LABEL} dots peek="56px" aspectRatio="4 / 3">
            {plates()}
          </SkinCarousel>
        </Frame>
      ),
    },
    "no-peek": {
      description:
        "peek={false} at desktop width: full-width slides, nothing showing beside them. The honest shape for a hero or a single-photo card — and the visible cost of it is that the strip no longer says there is more.",
      viewport: "desktop",
      step: "no-peek",
      render: () => (
        <Frame>
          <SkinCarousel label={STRIP_LABEL} dots peek={false} aspectRatio="16 / 9">
            {plates()}
          </SkinCarousel>
        </Frame>
      ),
    },
  },
});
