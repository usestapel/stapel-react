/**
 * The listing page's characteristics, as sentences with units.
 *
 * Three founder findings from the live page, one suite:
 *
 *  1. the row is a PARAGRAPH — a muted inline label, then the value in the
 *     same text flow — and never a label column beside a value column. The
 *     old `<Descriptions>` put a long answer in a third-of-a-page cell where
 *     it wrapped under itself;
 *  2. a number carries its UNIT. "Power 173" and "Mileage 20000" were on
 *     screen, and the unit was in the catalogue the whole time;
 *  3. digits are grouped by the reader's LOCALE — "20 000 km", not "20000",
 *     and "2,0 l" in Russian rather than "2.0 l".
 *
 * The unit path has two rungs and both are proved here: the stored row's own
 * `postfix` (written by `dto_to_dao`), and — for every listing published
 * before its category declared one — the CATEGORY definition the page is
 * already holding.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import { ListingDetailPane } from "../src/default/index.js";
import type { ListingDetailData } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/** A car's three numbers, as a live catalogue actually stores them. */
const MILEAGE = {
  slug: "mileage",
  type: "int" as const,
  value: 20000,
  name: "Mileage",
  order: 0,
  postfix: "km",
};
/** The defect: a stored row with NO unit, published before the catalogue had
 * one. Its category definition below is where the unit lives. */
const POWER = {
  slug: "power_hp",
  type: "int" as const,
  value: 173,
  name: "Power",
  order: 1,
};
const VOLUME = {
  slug: "volume",
  type: "float" as const,
  value: 2,
  name: "Engine volume",
  order: 2,
  precision: 1,
  postfix: "l",
};
/** A value long enough to need a paragraph rather than a cell. */
const TRIM = {
  slug: "trim",
  type: "string" as const,
  value:
    "Comfort Plus with the winter package, tow bar, parking sensors front and rear",
  name: "Trim level",
  order: 3,
};

const CATEGORY_POWER: FeatureDef = {
  slug: "power_hp",
  name: "Power",
  config: { type: "int", postfix: "hp" },
};

function pane(
  rows: readonly Record<string, unknown>[],
  element: ReactElement,
  locale?: string
): ReactElement {
  const server = mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": {
      body: detail({
        features: rows as unknown as ListingDetailData["features"],
      }),
    },
  });
  return (
    <TestProviders server={server} {...(locale !== undefined ? { locale } : {})}>
      {element}
    </TestProviders>
  );
}

describe("a characteristic is a sentence, not a table row", () => {
  it("puts the label INSIDE the row's text flow, as an inline span", async () => {
    render(pane([TRIM], <ListingDetailPane id={7} />));
    const row = await screen.findByTestId("listings-spec-row-trim");
    const label = within(row).getByTestId("listings-spec-label-trim");
    const value = within(row).getByTestId("listings-spec-value-trim");
    // The whole finding: one row element containing both, in ONE flow — not
    // a label cell beside a value cell, which is what wrapped a long answer
    // under itself in a narrow column.
    expect(row.contains(label)).toBe(true);
    expect(row.contains(value)).toBe(true);
    expect(label.tagName).toBe("SPAN");
    expect(row.tagName).toBe("P");
    // …and the value is the whole answer, not a truncated one.
    expect(value.textContent).toContain("parking sensors front and rear");
  });

  it("draws no antd description table for the characteristics any more", async () => {
    render(pane([MILEAGE], <ListingDetailPane id={7} />));
    const list = await screen.findByTestId("listings-spec-list");
    // Scoped to the spec list: the stock/place block further down the page is
    // a different table and is not what this finding is about.
    expect(list.querySelectorAll(".ant-descriptions-item-label")).toHaveLength(0);
  });

  it("keeps a two-column grid of ROWS in the split layout", async () => {
    render(pane([MILEAGE, POWER, VOLUME], <ListingDetailPane id={7} layout="split" />));
    const split = await screen.findByTestId("listings-detail-specs-split");
    const lists = split.querySelectorAll("[data-testid^='listings-spec-list']");
    // Two columns of whole rows, cut by row count so declaration order still
    // reads top-to-bottom, left column first.
    expect(lists).toHaveLength(2);
    expect(lists[0]?.textContent).toContain("Mileage");
    expect(lists[0]?.textContent).toContain("Power");
    expect(lists[1]?.textContent).toContain("Engine volume");
    // The label is still never a column of its own inside either half.
    expect(split.querySelectorAll(".ant-descriptions-item-label")).toHaveLength(0);
  });
});

describe("a number carries its unit and groups its digits", () => {
  it("prints the stored postfix and groups thousands", async () => {
    render(pane([MILEAGE], <ListingDetailPane id={7} />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-value-mileage")).toBeTruthy();
    });
    const text = screen.getByTestId("listings-spec-value-mileage").textContent ?? "";
    expect(text).toContain("km");
    // The grouping separator is the locale's — a narrow no-break space in
    // several of them — so the claim is that the digits are NOT run together.
    expect(text).not.toContain("20000");
    // The separator is the locale's: a comma in English, a narrow no-break
    // space in Russian. The claim is only that the digits are grouped.
    expect(text.replace(/[^0-9a-z]/gi, "")).toBe("20000km");
  });

  it("takes the unit from the CATEGORY when the stored row has none", async () => {
    render(
      pane(
        [POWER],
        <ListingDetailPane id={7} categoryFeatures={[CATEGORY_POWER]} />
      )
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-spec-value-power_hp").textContent
      ).toContain("hp");
    });
  });

  it("still prints the bare number when nothing declares a unit", async () => {
    // The honest floor: no unit is invented. This is the live defect, and it
    // is a CATALOGUE gap — the page cannot repair what nobody wrote down.
    render(pane([POWER], <ListingDetailPane id={7} />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-value-power_hp").textContent).toBe(
        "173"
      );
    });
  });

  it("keeps a float's configured decimals and the locale's decimal mark", async () => {
    render(pane([VOLUME], <ListingDetailPane id={7} />, "ru"));
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-value-volume")).toBeTruthy();
    });
    const text = screen.getByTestId("listings-spec-value-volume").textContent ?? "";
    // Russian writes 2,0 — the engine's `toFixed` wrote 2.0 in every locale.
    expect(text).toContain("2,0");
    expect(text).not.toContain("2.0");
  });

  it("says nothing rather than zero for a row the seller left empty", async () => {
    render(
      pane(
        [{ ...MILEAGE, value: null }],
        <ListingDetailPane id={7} />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-spec-value-mileage")).toBeTruthy();
    });
    // `Number(null)` is 0, and a confident "0 km" on a used car is a lie the
    // grouping path could have introduced for free.
    const text = screen.getByTestId("listings-spec-value-mileage").textContent ?? "";
    expect(text).not.toContain("0 km");
    expect(text.length).toBeGreaterThan(0);
  });
});
