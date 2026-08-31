/**
 * The phone landing's category tiles — two rows, scrolling sideways, with the
 * third column peeking in.
 *
 * The two ready variants are the whole point of the image seam: the same rows,
 * once with the host's resolver wired and once without. Neither draws an
 * `<img>` this library built a URL for — `carousel_icon` is an opaque string
 * the backend does not resolve — and the unresolved corner is a muted disc
 * rather than a hole, because a tile with an empty corner reads as a tile that
 * failed to load.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { CategoryTileGrid } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_CHILD_TILES, DEMO_TILE_CAROUSEL } from "./fixtures.js";

const SEEDED: DemoSeed = { carousel: DEMO_TILE_CAROUSEL };
const NOTHING: DemoSeed = { carousel: [] };
const OUTAGE: DemoHandlers = {
  "/categories/carousel/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

/** A host's icon resolver, standing in for `CdnThumbnail` + `useDescribe`. */
function Art(props: { readonly reference: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-demo-icon={props.reference}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "3em",
        height: "3em",
        borderRadius: "0.75em",
        background: cssVar("brand-subtle"),
        color: cssVar("brand"),
      }}
    >
      {props.reference.slice(-1).toUpperCase()}
    </span>
  );
}

export default defineDemo({
  id: "categories.tile-grid",
  title: "Category tile grid",
  description:
    "Two rows of rounded tiles that scroll sideways, sized as a fraction of the box they were mounted in rather than of the viewport. The label sits top-left over two lines; the art is pinned bottom-right through the same renderIcon seam the carousel strip takes, and an unresolved reference draws a placeholder rather than a broken image.",
  component: CategoryTileGrid,
  covers: ["CategoryCarousel"],
  tokens: ["surface-sunken", "border-subtle"],
  variants: {
    tiles: {
      description: "The host's resolver wired: art in the bottom-right corner.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTileGrid
            renderIcon={(reference) => <Art reference={reference} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "no art": {
      description:
        "No resolver, and rows that carry no reference: the placeholder glyph, on purpose, rather than a guessed URL.",
      viewport: "phone",
      step: "ready-without-art",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTileGrid />
        </CategoriesDemoHarness>
      ),
    },
    "host tiles": {
      description:
        "entries — the host's own rows, here a category's CHILDREN, which the carousel endpoint does not serve. The handler is the outage one on purpose: the override asks the server nothing, so the tiles draw anyway.",
      viewport: "phone",
      step: "ready-from-entries",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryTileGrid
            entries={DEMO_CHILD_TILES}
            allTile={false}
            renderIcon={(reference) => <Art reference={reference} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "inside a category": {
      description:
        "allTile={false} — a row already inside a category does not lead with a link back to the catalogue root.",
      viewport: "desktop",
      step: "ready-without-all",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTileGrid
            allTile={false}
            renderIcon={(reference) => <Art reference={reference} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "nothing featured": {
      description: "A real configuration — a landing that says so instead of spinning.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={NOTHING}>
          <CategoryTileGrid />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The grid refuses, with the retry beside the bad news.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryTileGrid />
        </CategoriesDemoHarness>
      ),
    },
  },
});
