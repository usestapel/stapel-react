/**
 * The desktop catalogue panel: a rail of roots, and the chosen root's second
 * and third levels beside it.
 *
 * The variants photograph what the panel is FOR rather than how it loads: an
 * uneven second level where one column runs past the five links a column
 * shows and ends in the tail link, the same panel with a tighter cap so the
 * tail is visible in every column at once, and the two arms a one-call read
 * still has — a catalogue with nothing in it, and a refusal.
 *
 * The `nodes` override has no variant of its own: it draws the same panel
 * from the same rows, so it would photograph as a second copy of `open` under
 * another name. What it actually promises — that the override asks the server
 * nothing — is a request count, and `test/megaMenu.test.tsx` counts it.
 *
 * There is no phone variant, and that is the point of `minWidth`: below it
 * this component renders nothing at all, because a phone's door into the
 * catalogue is the tile grid.
 */
import { defineDemo } from "@stapel/showcase";
import { CategoryMegaMenu } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_TREE } from "./fixtures.js";

/* `lockScroll={false}` on every variant: the showcase draws the panel INLINE
   on a page that must keep scrolling, which is the one case the prop is for.

   `minWidth={0}` on every variant, and it is not a shortcut. Each variant
   declares `viewport: "desktop"`, but a frame's DECLARED viewport is not the
   `window.innerWidth` the runner has — a static render photographs at whatever
   width the environment happens to be, which used to be the same 1024 the
   default guard was hard-coded to, so the photograph only ever worked by
   coincidence. The guard is a behaviour, and behaviour is proven in
   `test/megaMenuGuard.test.tsx` at six real widths; a photograph is for what
   the panel LOOKS like. Switching it off here keeps the two from deciding each
   other. */
const SEEDED: DemoSeed = { tree: { depth: 3, nodes: DEMO_TREE } };
const NOTHING: DemoSeed = { tree: { depth: 3, nodes: [] } };
const OUTAGE: DemoHandlers = {
  "/tree/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

export default defineDemo({
  id: "categories.mega-menu",
  title: "Category mega menu",
  description:
    "The desktop catalogue panel: roots on the left, the chosen root's second-level headers and their first five third-level links on the right, and a tail link to the header when there are more. One cached tree read, ARIA menu semantics on the rail, and nothing at all below the tokens' desktop rung, which a host moves with `minWidth`.",
  component: CategoryMegaMenu,
  covers: ["useCategoryTree"],
  tokens: ["surface-overlay", "surface-sunken", "border-subtle", "text-muted", "text-subtle"],
  variants: {
    open: {
      description:
        "The first root disclosed. One column is short, one runs past the cap and ends in the tail link.",
      viewport: "desktop",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryMegaMenu minWidth={0} lockScroll={false} />
        </CategoriesDemoHarness>
      ),
    },
    "tight cap": {
      description:
        "maxLinksPerColumn={2} — the tail link in every column, so the shape is readable in one frame.",
      viewport: "desktop",
      step: "ready-capped",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryMegaMenu minWidth={0} maxLinksPerColumn={2} lockScroll={false} />
        </CategoriesDemoHarness>
      ),
    },
    "empty catalogue": {
      description: "A real configuration, said out loud instead of an empty panel.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={NOTHING}>
          <CategoryMegaMenu minWidth={0} lockScroll={false} />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The read refuses, with the retry beside the bad news.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CategoryMegaMenu minWidth={0} lockScroll={false} />
        </CategoriesDemoHarness>
      ),
    },
  },
});
