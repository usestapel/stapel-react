import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { formatFeatureValue } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type {
  FeatureCopySource,
  ListingDetailData,
  ListingFeatureDao,
} from "../src/index.js";
import { featureFromDao } from "../src/index.js";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/**
 * A stored `select` prints its OPTION COPY, not the storage slug.
 *
 * The DAO never carries the option table (it lives on the category), so
 * `featureFromDao` rebuilds one — from the row's `labels` snapshot when it has
 * one, from the values themselves when it does not. Both arms are asserted
 * here, because the second one is every listing stored before the snapshot
 * release and it must go on reading exactly as it did.
 */

/** What a spec row does: split the DAO, format the pair. */
function formatted(
  dao: ListingFeatureDao,
  t?: (key: string) => string,
  source: FeatureCopySource = {}
): string | undefined {
  const view = featureFromDao(dao, source);
  if (view === undefined) return undefined;
  return formatFeatureValue(view.feature, view.value, t === undefined ? {} : { t });
}

/** The category's own definition of `condition`, as
 * `GET /categories/api/v1/categories/{id}/features/` answers it: the option
 * table WITH labels, which is the thing the stored row does not carry. */
function categoryCondition(overrides: Partial<FeatureDef> = {}): FeatureDef {
  return {
    slug: "condition",
    name: "Condition",
    config: {
      type: "select",
      translatable_options: false,
      options: [
        { value: "novoe", label: "New" },
        { value: "b-u", label: "Second-hand" },
      ],
    },
    ...overrides,
  };
}

/** A non-translatable catalogue: literal copy in the category, no key to look
 * up, which is precisely the case the identity table could never serve. */
function literalSelect(overrides: Partial<ListingFeatureDao> = {}): ListingFeatureDao {
  return {
    slug: "condition",
    type: "select",
    value: ["b-u"],
    name: "Condition",
    translatable_options: false,
    ...overrides,
  };
}

describe("a select DAO carrying its label snapshot", () => {
  it("prints the label, not the slug", () => {
    expect(formatted(literalSelect({ labels: ["Second-hand"] }))).toBe(
      "Second-hand"
    );
  });

  it("pairs several values with their own labels, in order", () => {
    expect(
      formatted(
        literalSelect({
          slug: "sensors",
          value: ["gps", "gyro"],
          labels: ["GPS", "Gyroscope"],
        })
      )
    ).toBe("GPS, Gyroscope");
  });

  it("still reaches a translatable catalogue's bundle: the label IS the key", () => {
    const dao = literalSelect({
      translatable_options: true,
      labels: ["option.condition.used"],
    });
    expect(formatted(dao, (key) => (key === "option.condition.used" ? "Used" : key))).toBe(
      "Used"
    );
  });

  it("labels a value the snapshot left empty as itself", () => {
    expect(
      formatted(literalSelect({ value: ["gps", "gyro"], labels: ["GPS", ""] }))
    ).toBe("GPS, gyro");
  });
});

describe("a listing stored before the snapshot existed", () => {
  it("keeps the identity table: a translatable catalogue reads out of the bundle", () => {
    const dao = literalSelect({ translatable_options: true, value: ["used"] });
    expect(formatted(dao, (key) => (key === "used" ? "Used" : key))).toBe("Used");
  });

  it("shows the slug for a non-translatable catalogue — visible, not invented", () => {
    expect(formatted(literalSelect(), (key) => key)).toBe("b-u");
  });

  it("leaves a DAO that DOES carry an option table exactly as it arrived", () => {
    const dao = literalSelect({
      options: [{ value: "b-u", label: "From the category" }],
      labels: ["Ignored"],
    });
    expect(formatted(dao)).toBe("From the category");
  });
});

describe("a snapshot that does not line up with the values", () => {
  it("falls back whole rather than pairing the overlap (shorter)", () => {
    expect(
      formatted(literalSelect({ value: ["gps", "gyro"], labels: ["GPS"] }))
    ).toBe("gps, gyro");
  });

  it("falls back whole rather than pairing the overlap (longer)", () => {
    expect(
      formatted(
        literalSelect({ value: ["gps"], labels: ["GPS", "Gyroscope"] })
      )
    ).toBe("gps");
  });

  it("does not throw on a snapshot that is not a list at all", () => {
    expect(() =>
      formatted(literalSelect({ labels: "Second-hand" as unknown as readonly string[] }))
    ).not.toThrow();
    expect(
      formatted(literalSelect({ labels: "Second-hand" as unknown as readonly string[] }))
    ).toBe("b-u");
  });
});

describe("the snapshot the ref types have always had is not swallowed", () => {
  it("keeps `labels` in the config, where `ref_select` reads it", () => {
    expect(
      formatted({
        slug: "brand",
        type: "ref_select",
        value: ["term-17"],
        labels: ["A vocabulary term"],
      })
    ).toBe("A vocabulary term");
  });
});

describe("the fix reaches a surface", () => {
  it("prints the option copy in the detail pane's title line", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": {
        body: detail({
          // The generated `FeatureDao` union cannot describe a stored row (the
          // discriminator defect `api/types.ts` documents), which is why the
          // pair reads the field through `asFeatureDaoList`. The fixture
          // crosses the same boundary here, once.
          features_title: [
            literalSelect({ title: true, order: 0, labels: ["Second-hand"] }),
          ] as unknown as ListingDetailData["features_title"],
        }),
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-detail-title-features").textContent
      ).toBe("Second-hand");
    });
  });
});

/**
 * The REPAIR path: the category's own option table, handed to a display
 * surface that has it.
 *
 * Every listing already published on a live classified deployment carries a
 * `select` with no `labels` key at all, and no snapshot can help a row that
 * has none. The category's feature defs are the other place the copy lives,
 * and these are the four rules the seam holds.
 */
describe("the category's option table repairs a snapshot-less select", () => {
  it("prints the category's label where the row has no snapshot", () => {
    expect(
      formatted(literalSelect(), undefined, {
        categoryFeatures: [categoryCondition()],
      })
    ).toBe("Second-hand");
  });

  it("keeps the SNAPSHOT where the two disagree — a listing is what it was published with", () => {
    expect(
      formatted(literalSelect({ labels: ["Used, boxed"] }), undefined, {
        categoryFeatures: [categoryCondition()],
      })
    ).toBe("Used, boxed");
  });

  it("repairs the values the snapshot missed without touching the ones it made", () => {
    const dao = literalSelect({
      slug: "condition",
      value: ["b-u", "novoe"],
      // A snapshot of a different length is not this value list's snapshot, so
      // it is dropped whole — and the category then answers for both values.
      labels: ["Used, boxed"],
    });
    expect(
      formatted(dao, undefined, { categoryFeatures: [categoryCondition()] })
    ).toBe("Second-hand, New");
  });

  it("ignores a def whose value type is no longer the stored one", () => {
    expect(
      formatted(literalSelect(), undefined, {
        categoryFeatures: [
          categoryCondition({ config: { type: "string" } }),
        ],
      })
    ).toBe("b-u");
  });

  it("ignores a category that does not declare this slug at all", () => {
    expect(
      formatted(literalSelect(), undefined, {
        categoryFeatures: [categoryCondition({ slug: "colour" })],
      })
    ).toBe("b-u");
  });

  it("still prints a value the category never declared — raw, never blank", () => {
    expect(
      formatted(literalSelect({ value: ["vitrina"] }), undefined, {
        categoryFeatures: [categoryCondition()],
      })
    ).toBe("vitrina");
  });

  it("leaves a row that carries its own table alone: it is the stronger snapshot", () => {
    expect(
      formatted(
        literalSelect({ options: [{ value: "b-u", label: "As stored" }] }),
        undefined,
        { categoryFeatures: [categoryCondition()] }
      )
    ).toBe("As stored");
  });

  it("with nothing supplied, behaves exactly as it does today", () => {
    expect(formatted(literalSelect(), (key) => key, {})).toBe("b-u");
    expect(formatted(literalSelect(), (key) => key)).toBe("b-u");
    expect(
      formatted(literalSelect(), undefined, { categoryFeatures: [] })
    ).toBe("b-u");
  });
});

describe("the same repair for a hierarchical_select, whose table is a tree", () => {
  const CATEGORY_TREE: FeatureDef = {
    slug: "body",
    name: "Body",
    config: {
      type: "hierarchical_select",
      translatable_options: false,
      options: [
        {
          value: "passenger",
          label: "Passenger car",
          children: [{ value: "sedan", label: "Saloon" }],
        },
      ],
    },
  };

  it("prints the storage keys with no category, exactly as it does today", () => {
    expect(
      formatted({
        slug: "body",
        type: "hierarchical_select",
        value: ["passenger", "sedan"],
        translatable_options: false,
      })
    ).toBe("passenger / sedan");
  });

  it("names every level once the category's tree is handed in", () => {
    expect(
      formatted(
        {
          slug: "body",
          type: "hierarchical_select",
          value: ["passenger", "sedan"],
          translatable_options: false,
        },
        undefined,
        { categoryFeatures: [CATEGORY_TREE] }
      )
    ).toBe("Passenger car / Saloon");
  });

  it("keeps a step the tree does not contain as its raw value", () => {
    expect(
      formatted(
        {
          slug: "body",
          type: "hierarchical_select",
          value: ["passenger", "liftback"],
          translatable_options: false,
        },
        undefined,
        { categoryFeatures: [CATEGORY_TREE] }
      )
    ).toBe("Passenger car / liftback");
  });
});

describe("the repair reaches the detail pane's spec table", () => {
  function paneWith(features: readonly ListingFeatureDao[]) {
    return mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": {
        body: detail({
          features: features as unknown as ListingDetailData["features"],
        }),
      },
    });
  }

  it("prints the slug when the page wires no category features", async () => {
    render(
      <TestProviders server={paneWith([literalSelect()])}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-spec-list").textContent
      ).toContain("b-u");
    });
  });

  it("prints the category's copy when it does", async () => {
    render(
      <TestProviders server={paneWith([literalSelect()])}>
        <ListingDetailPane id={7} categoryFeatures={[categoryCondition()]} />
      </TestProviders>
    );
    await waitFor(() => {
      const text = screen.getByTestId("listings-spec-list").textContent ?? "";
      expect(text).toContain("Second-hand");
      expect(text).not.toContain("b-u");
    });
  });
});
