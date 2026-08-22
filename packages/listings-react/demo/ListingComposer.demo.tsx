/** Submission: the category decides the form, and every block names itself. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { ListingComposerPage } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { LISTINGS_I18N_KEYS } from "../src/index.js";

/**
 * A category's schema as `GET /categories/{id}/features/` sends it — config
 * VERBATIM, with no defaults filled in. That is not a simplification: the
 * serializer really does return `obj.config` untouched, so every reader has
 * to know its own type defaults (spec §13.2, note 1).
 */
const FEATURES: readonly FeatureDef[] = [
  {
    slug: "brand",
    name: "demo.feature.brand",
    mandatory: true,
    config: {
      type: "select",
      options: [
        { value: "demo.brand.bosch", label: "demo.brand.bosch" },
      ],
      maxSelected: 1,
    },
  },
  {
    slug: "power",
    name: "demo.feature.power",
    config: { type: "int", min: 0, max: 5000, postfix: "W" },
  },
];

const UNDRAWABLE: readonly FeatureDef[] = [
  ...FEATURES,
  { slug: "size_grid", name: "Size grid", config: { type: "size_grid" } },
];

const HANDLERS: DemoHandlers = {
  "/listings/": { id: 42, category_id: "tools/power", status: "draft", moderation_status: "pending", created_at: "", updated_at: "" },
};

function Composer(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="ListingComposerPage">
        <ListingComposerPage
          features={FEATURES}
          images={{ refs: ["image/9f2c1a"], settled: actionAvailable() }}
        />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function PhotosInFlight(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="ListingComposerPage — photos still uploading">
        <ListingComposerPage
          features={FEATURES}
          images={{
            refs: [],
            settled: actionBlocked(LISTINGS_I18N_KEYS.composeBlockedPhotosPending),
          }}
        />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function UnsupportedType(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="ListingComposerPage — a detail this build cannot draw">
        <ListingComposerPage
          features={UNDRAWABLE}
          images={{ refs: ["image/9f2c1a"], settled: actionAvailable() }}
        />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.composer",
  title: "Listing composer",
  description:
    "The submission screen, where four contracts meet through three seams: the category schema arrives as FeatureDef[], the photos as @stapel/cdn-react's upload bag (its refs ARE images_draft, its settled gates the submit), and the value editors from @stapel/attributes-react. The variants show two of the six reasons the publish button can be off — photos in flight, and a value type this build has no editor for, which blocks the submit loudly rather than dropping a possibly-mandatory field.",
  component: ListingComposerPage,
  covers: ["ListingComposer"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Composer /> },
    "photos-in-flight": { render: () => <PhotosInFlight /> },
    "unsupported-type": { render: () => <UnsupportedType /> },
  },
});
