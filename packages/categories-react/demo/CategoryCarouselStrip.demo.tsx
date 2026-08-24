/**
 * The landing strip of featured categories.
 *
 * The icon references (`carousel_icon` / `catalog_icon`) are OPAQUE STRINGS
 * the backend deliberately does not resolve. This skin therefore renders no
 * `<img>` and builds no URL: it hands the reference to the host through
 * `renderIcon`, and draws nothing when the host supplies none — a guessed CDN
 * path would be a broken image on every deployment that guessed differently.
 * Both halves of that decision are photographed below.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { CategoryCarouselStrip } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_CAROUSEL } from "./fixtures.js";

const SEEDED: DemoSeed = { carousel: DEMO_CAROUSEL };
const NOTHING: DemoSeed = { carousel: [] };
const OUTAGE: DemoHandlers = {
  "/categories/carousel/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

function Glyph(props: { readonly reference: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-demo-icon={props.reference}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.5em",
        height: "1.5em",
        borderRadius: "50%",
        background: cssVar("surface-sunken"),
        color: cssVar("brand"),
      }}
    >
      {props.reference.slice(-1).toUpperCase()}
    </span>
  );
}

export default defineDemo({
  id: "categories.carousel",
  title: "Category carousel",
  description:
    "The one endpoint that arrives ready to render — the server filters active + carousel_enabled, orders by priority and sends its own Cache-Control. Labels still say whether they are translation keys or literals, because the catalogue's names belong to the deployment, not to the library.",
  component: CategoryCarouselStrip,
  covers: ["CategoryCarousel"],
  tokens: ["surface-raised"],
  variants: {
    tiles: {
      description: "With the host's icon resolver wired.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCarouselStrip renderIcon={(reference) => <Glyph reference={reference} />} />
        </CategoriesDemoHarness>
      ),
    },
    "text only": {
      description: "No resolver: text tiles, on purpose, rather than a broken image.",
      viewport: "desktop",
      step: "ready-without-icons",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryCarouselStrip />
        </CategoriesDemoHarness>
      ),
    },
    "nothing featured": {
      description: "A real configuration — a landing page that says so instead of spinning.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={NOTHING}>
          <CategoryCarouselStrip />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The strip refuses. The skeleton is three tiles wide, so nothing jumps.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryCarouselStrip />
        </CategoriesDemoHarness>
      ),
    },
  },
});
