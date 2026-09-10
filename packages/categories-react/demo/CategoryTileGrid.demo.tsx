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
    "compact flat": {
      description:
        "size=\"compact\" with the flat surface — the reference's second-level tile, half the root tile's height, as a LIST ROW: the art first, the caption second, adjacent and against the leading edge. The 2026-09-04 anatomy put the name at one end of that row and the picture at the other, which works while a fill holds the two together and reads as scattered text once the fill is gone (measured on the stand) — the same finding as the regular tile's corners, along the row's own axis. Height, density and padding are unchanged; size=\"compact\" with tileSurface=\"card\" keeps the 2026-09-04 arrangement exactly.",
      viewport: "desktop",
      step: "ready-compact-flat",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTileGrid
            size="compact"
            layout="wrap"
            renderIcon={(reference) => <Art reference={reference} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "card tiles": {
      description:
        "tileSurface=\"card\" — the filled tile this grid used to draw for everybody, kept for a surface that was designed around it. The default is now \"flat\": no fill and no border at rest (every other variant here), with the same token fill and the same radius arriving on hover and on keyboard focus, where it means «this is the one you are about to open». A dozen filled boxes on a landing outweigh the art inside them, which is the whole finding.",
      viewport: "phone",
      step: "ready-card-surface",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryTileGrid
            tileSurface="card"
            renderIcon={(reference) => <Art reference={reference} />}
          />
        </CategoriesDemoHarness>
      ),
    },
    "reserved rows": {
      description:
        "reserve + reserveCount — the box the tiles arrive into, while a HOST's own read is still in flight. One skeleton per tile in the grid the tiles land in, so the reservation is `tileStageRows(count, columns)` rows and no more: six tiles in five columns is two rows, five is one, and the difference used to stand as an empty band under the last tile before the next block. A caller that does not know the number still gets this arm's own four.",
      viewport: "desktop",
      step: "reserved-rows",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryTileGrid layout="wrap" reserve="pending" reserveCount={6} />
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
