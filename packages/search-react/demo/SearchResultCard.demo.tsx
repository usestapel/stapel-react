/**
 * The generic card — the fallback behind `renderCard`, and the surface the
 * DSA Art. 26 marking has to survive on.
 *
 * Four variants, because the card has four honestly different answers about a
 * photo and one about the law:
 *
 *  - a GALLERY (`images[]`, the whole seller-ordered set the projection has
 *    carried since stapel-classified 0.7.0) — a swipeable strip with a peek
 *    and a position indicator, which is the shape a phone SERP is read in;
 *  - ONE photo (the singular `image`, for a doc type that never grew a list)
 *    — the same well with no peek and no dots, because a sliver of a next
 *    slide is an affordance for something that is not there;
 *  - a reference NOTHING resolves — the well and a sentence, which is what an
 *    unwired `resolveImage` looks like, rather than an empty grey box;
 *  - no photo field at all — nothing drawn, because reserving a 4:3 well for
 *    a text corpus is a hole in every row.
 *
 * The promoted variant carries the marking IN WORDS under the tag. The
 * explanation used to live in a `Tooltip`, which on the device most of this
 * traffic arrives from is nowhere at all.
 *
 * The harness's runtime carries a `resolveImage` (see `_harness.tsx`): a card
 * stores an opaque CDN reference and this pair cannot resolve one on its own,
 * so the seam is part of what these shots document.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchResultCard } from "../src/default/SearchResultCard.js";
import { SearchDemoHarness, DemoFrame } from "./_harness.js";
import {
  DEMO_GALLERY_ITEM,
  DEMO_PLAIN_ITEM,
  DEMO_PROMOTED_ITEM,
  DEMO_UNRESOLVED_ITEM,
} from "./fixtures.js";
import type { SearchItem } from "../src/index.js";

function Card(props: { phone?: boolean; item: SearchItem }): ReactElement {
  return (
    <SearchDemoHarness>
      <DemoFrame {...(props.phone === true ? { phone: true } : {})}>
        <SearchResultCard item={props.item} />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

export default defineDemo({
  id: "search.result-card",
  title: "Result card",
  description:
    "The default card a doc type gets for free: the card's whole photo gallery as a swipeable strip (references resolved through the runtime's resolveImage seam and drawn by @stapel/image, so the 4:3 well lands before the network does), the title, the price with its currency, the location and distance — and the promoted marking painted from a token role rather than an antd preset, with its explanation as ordinary text beneath it.",
  component: SearchResultCard,
  tokens: [
    "warning-bg",
    "warning-on",
    "warning-border",
    "surface-sunken",
    "text-muted",
    "border",
    "focus-ring",
  ],
  variants: {
    gallery: {
      description:
        "Five photos at 390px: the strip snaps, the edge of the next photo is the only thing on screen that says there is more, and the dots say where you are. The strip is a SIBLING of the card's anchor — a swipe that ended inside the link would be delivered as a click on it.",
      viewport: "phone",
      step: "gallery",
      render: () => <Card phone item={DEMO_GALLERY_ITEM} />,
    },
    promoted: {
      description:
        "A paid placement with the singular `image` and no gallery: one slide, no peek, no dots — and the marking with the sentence that makes it mean something, both visible without a pointer.",
      viewport: "desktop",
      step: "promoted",
      render: () => <Card item={DEMO_PROMOTED_ITEM} />,
    },
    unresolved: {
      description:
        "The card stores references and nothing resolved them — an unwired `resolveImage`, or files that are gone. The well is drawn at the shape the photo would have had, and it SAYS so: an empty grey box teaches nobody anything, a sentence gets the wiring fixed.",
      viewport: "phone",
      step: "unresolved",
      render: () => <Card phone item={DEMO_UNRESOLVED_ITEM} />,
    },
    plain: {
      description:
        "An ordinary row at 390px — no marking, no photo field stored, no distance: the card shows what it finds and reserves no space for what it does not.",
      viewport: "phone",
      step: "plain",
      render: () => <Card phone item={DEMO_PLAIN_ITEM} />,
    },
  },
});
