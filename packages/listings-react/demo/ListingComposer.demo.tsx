/** Submission: the category decides the form, and every block names itself. */
import { useState } from "react";
import type { ReactElement } from "react";
import { Segmented, Select } from "antd";
import { defineDemo } from "@stapel/showcase";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { ListingComposerPage } from "../src/default/index.js";
import type { ComposerLocationPickerProps } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
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
    name: "Brand",
    mandatory: true,
    config: {
      type: "select",
      options: [
        { value: "demo.brand.bosch", label: "demo.brand.bosch" },
        { value: "demo.brand.makita", label: "demo.brand.makita" },
      ],
      maxSelected: 1,
    },
  },
  {
    slug: "condition",
    name: "Condition",
    config: {
      type: "select",
      options: [
        { value: "demo.condition.used", label: "demo.condition.used" },
        { value: "demo.condition.new", label: "demo.condition.new" },
      ],
      maxSelected: 1,
    },
  },
  {
    slug: "power",
    name: "Power",
    config: { type: "int", min: 0, max: 5000, postfix: "W" },
  },
];

const UNDRAWABLE: readonly FeatureDef[] = [
  ...FEATURES,
  { slug: "size_grid", name: "Size grid", config: { type: "size_grid" } },
];

const HANDLERS: DemoHandlers = {
  "/listings/": {
    id: 42,
    category_id: "tools/power",
    status: "draft",
    moderation_status: "pending",
    geohash_draft: "",
    created_at: "",
    updated_at: "",
  },
};

/** The container's `<CategoryPickerField>` from `@stapel/categories-react`,
 * stood in for: L2 pairs do not import each other and a demo may not either. */
function DemoCategoryPicker(props: {
  value: string;
  setCategory: (id: string) => void;
}): ReactElement {
  const t = useT();
  return (
    <Select
      value={props.value === "" ? null : props.value}
      placeholder={t("demo.category.placeholder")}
      style={{ width: "100%" }}
      data-testid="demo-category-picker"
      options={[
        { value: "tools/power", label: "Tools / Power tools" },
        { value: "tools/hand", label: "Tools / Hand tools" },
      ]}
      onChange={props.setCategory}
    />
  );
}

/** The container's `<LocationPickerField>` from `@stapel/geo-react`, stood in
 * for by the two buttons a map would offer. Same `{ value, onChange }`
 * contract, so the real one drops in through the adapter documented on
 * {@link ComposerLocationPickerProps}. */
function DemoLocationPicker(props: ComposerLocationPickerProps): ReactElement {
  return (
    <Segmented
      value={props.value.address ?? ""}
      data-testid="demo-location-picker"
      options={[
        { value: "", label: "Not set" },
        { value: "Kazan", label: "Kazan" },
        { value: "Moscow", label: "Moscow" },
      ]}
      onChange={(next) => {
        const city = String(next);
        props.onChange(
          city === "Kazan"
            ? { lat: 55.7961, lon: 49.1064, address: "Kazan" }
            : city === "Moscow"
              ? { lat: 55.7558, lon: 37.6173, address: "Moscow" }
              : { lat: null, lon: null }
        );
      }}
    />
  );
}

function DemoCurrencyPicker(props: {
  value: string;
  setCurrency: (code: string) => void;
}): ReactElement {
  return (
    <Segmented
      value={props.value}
      data-testid="demo-currency-picker"
      options={["RUB", "EUR", "USD"]}
      onChange={(next) => {
        props.setCurrency(String(next));
      }}
    />
  );
}

/** A stand-in for `@stapel/cdn-react`'s `<MediaGalleryField bag>`. */
function DemoGallery(props: { tiles: number }): ReactElement {
  return (
    <div
      data-testid="demo-gallery"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(6rem, 1fr))",
        gap: 8,
      }}
    >
      {Array.from({ length: props.tiles }, (_, index) => (
        <div
          key={index}
          style={{
            aspectRatio: "1 / 1",
            border: "1px dashed currentColor",
            opacity: 0.4,
            borderRadius: 8,
          }}
        />
      ))}
    </div>
  );
}

/** Everything wired, the way a scaffolded storefront mounts it. */
function Wired(): ReactElement {
  const [category, setCategory] = useState("tools/power");
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingComposerPage
        features={FEATURES}
        category={category}
        onCategoryChange={setCategory}
        renderCategoryPicker={(slot) => (
          <DemoCategoryPicker value={slot.value} setCategory={slot.setCategory} />
        )}
        renderCurrencyPicker={(slot) => (
          <DemoCurrencyPicker value={slot.value} setCurrency={slot.setCurrency} />
        )}
        locationPicker={DemoLocationPicker}
        gallerySlot={<DemoGallery tiles={3} />}
        images={{ refs: ["image/9f2c1a"], settled: actionAvailable() }}
      />
    </ListingsDemoHarness>
  );
}

/** Nothing wired: four named slots, and not one improvised control. */
function Unwired(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingComposerPage features={[]} />
    </ListingsDemoHarness>
  );
}

function PhotosInFlight(): ReactElement {
  const [category, setCategory] = useState("tools/power");
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingComposerPage
        features={FEATURES}
        category={category}
        onCategoryChange={setCategory}
        renderCategoryPicker={(slot) => (
          <DemoCategoryPicker value={slot.value} setCategory={slot.setCategory} />
        )}
        locationPicker={DemoLocationPicker}
        gallerySlot={<DemoGallery tiles={1} />}
        images={{
          refs: [],
          settled: actionBlocked(LISTINGS_I18N_KEYS.composeBlockedPhotosPending),
        }}
      />
    </ListingsDemoHarness>
  );
}

function UnsupportedType(): ReactElement {
  const [category, setCategory] = useState("tools/power");
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingComposerPage
        features={UNDRAWABLE}
        category={category}
        onCategoryChange={setCategory}
        renderCategoryPicker={(slot) => (
          <DemoCategoryPicker value={slot.value} setCategory={slot.setCategory} />
        )}
        locationPicker={DemoLocationPicker}
        gallerySlot={<DemoGallery tiles={2} />}
        images={{ refs: ["image/9f2c1a"], settled: actionAvailable() }}
      />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.composer",
  title: "Listing composer",
  description:
    "The submission screen, where five contracts meet through four slots: the category picker and its schema (@stapel/categories-react), the location picker (@stapel/geo-react), the currency vocabulary, and the photo grid whose upload bag's refs ARE images_draft and whose settled gates the submit (@stapel/cdn-react). An UNFILLED slot renders its own name and nothing else — the composer will not ask a seller for a numeric category id, a currency code or a pair of decimal coordinates, which is what it used to do. The variants show two of the six reasons the publish button can be off: photos in flight, and a value type this build has no editor for.",
  component: ListingComposerPage,
  covers: ["ListingComposer"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "editing_all_slots_filled",
      description: "The screen a wired container mounts.",
      render: () => <Wired />,
    },
    unwired: {
      viewport: "phone",
      step: "choosing_category_slots_empty",
      description:
        "Nothing wired: four named placeholders where four invented controls used to be.",
      render: () => <Unwired />,
    },
    "photos-in-flight": {
      viewport: "phone",
      step: "editing_photos_pending",
      description:
        "An upload still running — publish is off and says which of the six reasons it is.",
      render: () => <PhotosInFlight />,
    },
    "unsupported-type": {
      viewport: "desktop",
      step: "editing_unsupported_type",
      description:
        "A value type this build has no editor for: the submit blocks loudly rather than dropping a possibly-mandatory field.",
      render: () => <UnsupportedType />,
    },
  },
});
