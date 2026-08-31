import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { formatFeatureValue } from "@stapel/attributes-react";
import type { ListingDetailData, ListingFeatureDao } from "../src/index.js";
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
  t?: (key: string) => string
): string | undefined {
  const view = featureFromDao(dao);
  if (view === undefined) return undefined;
  return formatFeatureValue(view.feature, view.value, t === undefined ? {} : { t });
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
