/**
 * The gallery both card surfaces draw, on its own.
 *
 * It is one component and not two because the live measurement found exactly
 * the divergence that happens when it is two: the phone card had three photos,
 * dots and a 17px peek, and the desktop card beside it drew a single still
 * image with no way to reach the other two — and that image was inside the
 * card's own link, so a swipe at it opened the listing.
 *
 * The three variants are the three facts the strip has to state differently:
 * several photos (dots and a counter), one photo (neither — one dot is not a
 * position), and none at all (still one slide, so a row's height does not
 * depend on whether a seller uploaded anything).
 *
 * There is no PEEK in any of them, and that is deliberate (2026-09-13). The
 * sliver of a next slide is a real affordance on a full-width phone gallery;
 * on a card it painted 14-30px of the next photograph inside the port, under
 * the counter and the heart, and a feed read as a column of torn images. The
 * card says "there is more" with its dots and its counter instead.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingPhotoStrip } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";

const TITLE = "Bosch GSB 13 RE";

function Strip(props: { readonly images: readonly string[] }): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <ListingsDemoHarness>
        <ListingPhotoStrip
          images={props.images}
          title={TITLE}
          testId="demo-photo-strip"
        />
      </ListingsDemoHarness>
    </div>
  );
}

export default defineDemo({
  id: "listings.photo-strip",
  title: "Listing photo strip",
  description:
    "Every stored photo of a listing as one swipeable, snapping strip — the gallery <ListingCard> and <ListingSerpCard> both render, always as a SIBLING of the card's anchor. A swipeable strip is a control, a link may not contain one, and a horizontal swipe that ends inside an <a> is a swipe the browser may deliver as a click; that is what made the desktop gallery unreachable on a live deployment while the phone one worked.",
  component: ListingPhotoStrip,
  tokens: ["surface-sunken", "text-muted"],
  variants: {
    default: {
      viewport: "phone",
      step: "three_photos",
      description:
        "Three photos: the picture fills the strip's whole port and the dots and the counter say how many there are. No sliver of the next slide — on a card that tore the photograph rather than inviting a swipe.",
      render: () => (
        <Strip images={["image/9f2c1a", "image/71b0dd", "image/33cc10"]} />
      ),
    },
    single: {
      viewport: "phone",
      step: "one_photo",
      description:
        "One photo: no dots and no counter. One dot is not a position, and a count of one is not news.",
      render: () => <Strip images={["image/9f2c1a"]} />,
    },
    "no photos": {
      viewport: "desktop",
      step: "no_media",
      description:
        "A listing the seller uploaded nothing for: still one slide, carrying the designed placeholder rather than a broken image, so the card's height is the same as its neighbours'.",
      render: () => <Strip images={[]} />,
    },
  },
});
