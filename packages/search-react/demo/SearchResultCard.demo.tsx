/**
 * The generic card — the fallback behind `renderCard`, and the surface the
 * DSA Art. 26 marking has to survive on.
 *
 * Two variants, because the two rows differ in exactly the thing the law is
 * about: one is a paid placement and says so IN WORDS under the tag, the other
 * is an ordinary result. The explanation used to live in a `Tooltip`, which on
 * the device most of this traffic arrives from is nowhere at all.
 *
 * No provider beyond i18n is needed: the card takes an item and renders it.
 * That is the seam — a storefront swaps the whole card for
 * `<ListingCard>` and keeps the marking, because the item goes in whole.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchResultCard } from "../src/default/SearchResultCard.js";
import { SearchDemoHarness, DemoFrame } from "./_harness.js";
import { DEMO_PLAIN_ITEM, DEMO_PROMOTED_ITEM } from "./fixtures.js";
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
    "The default card a doc type gets for free: a 4:3 photo well drawn before the network answers (via @stapel/image, so a dead URL is a named placeholder rather than a torn-page icon), the title, the price with its currency, the location and distance — and the promoted marking painted from a token role rather than an antd preset, with its explanation as ordinary text beneath it.",
  component: SearchResultCard,
  tokens: ["warning-bg", "warning-on", "warning-border", "surface-sunken"],
  variants: {
    promoted: {
      description:
        "A paid placement with a photo: the marking, and the sentence that makes the marking mean something, both visible without a pointer.",
      viewport: "desktop",
      step: "promoted",
      render: () => <Card item={DEMO_PROMOTED_ITEM} />,
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
