/**
 * The DESKTOP gallery of the listing page, on its own.
 *
 * The walk of 2026-09-12 read this page's photographs against the reference
 * classified and found three absences at once: a grid of equal tiles, no
 * arrows anywhere, and no way to enlarge a photograph at all. On a listing
 * with seven pictures a person could see seven thumbnails of a phone and never
 * one phone — which on a classified is the whole read.
 *
 * The variants are the three shapes this component actually has: a set worth
 * a filmstrip, a single photograph (no filmstrip, because a strip of one is a
 * control for a choice nobody has), and a listing whose seller uploaded
 * nothing, which still draws the designed placeholder rather than a gap.
 *
 * The LIGHTBOX is reached by pressing the hero, and the last variant does so
 * with a `play` step rather than describing it — the surface with the arrows,
 * the counter and the trapped keyboard in it is the one this component exists
 * for, and a demo that only showed the closed state would document the half
 * that was never missing.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DETAIL_GALLERY_GUTTER, ListingHeroGallery } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";

const TITLE = "Bosch GSB 13 RE";

function Gallery(props: { readonly images: readonly string[] }): ReactElement {
  return (
    <div style={{ maxWidth: 640 }}>
      <ListingsDemoHarness>
        <ListingHeroGallery
          images={props.images}
          title={TITLE}
          gap={DETAIL_GALLERY_GUTTER}
        />
      </ListingsDemoHarness>
    </div>
  );
}

export default defineDemo({
  id: "listings.hero-gallery",
  title: "Listing hero gallery",
  description:
    "The desktop listing page's photographs: one large picture, a filmstrip of thumbnails that changes which one that is, and a lightbox behind a click on the large one — two arrow controls, the two arrow keys, a swipe and Escape, with focus held inside the dialog while it is open and handed back to the hero when it closes. It is <ListingDetailPane galleryLayout=\"hero\">, and the default whenever the host says layout=\"split\"; the phone keeps its snap-scrolling strip.",
  component: ListingHeroGallery,
  tokens: ["brand", "surface-overlay", "text-muted"],
  variants: {
    default: {
      viewport: "desktop",
      step: "four_photos",
      description:
        "Four photographs: one hero and a filmstrip under it. The chosen thumbnail is undimmed and outlined, and carries aria-current — the mark a reader sees and the fact a screen reader is told are one attribute, never a class that means something only to the eye.",
      render: () => (
        <Gallery
          images={["image/9f2c1a", "image/71b0dd", "image/33cc10", "image/5ad421"]}
        />
      ),
    },
    single: {
      viewport: "desktop",
      step: "one_photo",
      description:
        "One photograph: no filmstrip at all. A strip of one is a row of controls for a choice nobody has, and the hero still opens the lightbox.",
      render: () => <Gallery images={["image/9f2c1a"]} />,
    },
    "no photos": {
      viewport: "desktop",
      step: "no_media",
      description:
        "A listing the seller uploaded nothing for: the designed placeholder in the hero's own box, so the column's height is the same as it will be once a photograph lands.",
      render: () => <Gallery images={[]} />,
    },
    lightbox: {
      viewport: "desktop",
      step: "lightbox_open",
      description:
        "The lightbox, opened by pressing the hero. The photograph is drawn whole rather than cropped — that is what a person opened it for — with an arrow on each side, a counter saying where in the set this is, and a way out that is a word and not only the dialog's corner glyph.",
      render: () => (
        <Gallery
          images={["image/9f2c1a", "image/71b0dd", "image/33cc10", "image/5ad421"]}
        />
      ),
      play: async ({ click }) => {
        await click('[data-testid="listings-detail-hero"]');
      },
    },
  },
});
