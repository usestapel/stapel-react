// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestHarness, mockServer } from "./harness.js";
import { PopularValues } from "../src/default/PopularValues.js";
import type { FacetGroup } from "../src/index.js";
import type { ReactElement } from "react";

/**
 * A VALUE WRAPS INSIDE ITS COLUMN — measured defect, jobs root, 2026-09-14.
 *
 * `column-width` is a MINIMUM, so the browser hands each row whatever width
 * the box divides into (155px in a 1088px pane). antd's `.ant-btn` carries
 * `white-space: nowrap`, so a value longer than its column kept its natural
 * width and painted OVER the next column: columns pitched 187px with
 * «Производство электроники и бытовой техники» rendering 357px wide at the
 * same baseline as the value 187px to its right.
 *
 * Makes never showed it — "Ford" is short. The defect was in the block all
 * along and only a long vocabulary revealed it, which is why this asserts the
 * DECLARATIONS rather than a rendered width: jsdom lays nothing out, so a
 * geometry assertion here would be theatre. The geometry is checked on the
 * stand by p52 and by the before/after crop.
 */
function group(labels: readonly string[]): FacetGroup {
  return {
    slug: "industry",
    label: "Сфера деятельности",
    type: "select",
    counted: true,
    selected: [],
    options: labels.map((label, i) => ({
      value: `v${String(i)}`,
      label,
      count: 10 - i,
    })),
  } as unknown as FacetGroup;
}

const LONG = "Производство электроники и бытовой техники";

function mount(node: ReactElement): void {
  render(<TestHarness server={mockServer({})}>{node}</TestHarness>);
}

describe("a popular value longer than its column", () => {
  it("is allowed to wrap, and does not keep antd's nowrap", () => {
    mount(<PopularValues group={group([LONG, "Общественное питание"])} onApply={() => {}} columns="responsive" />);
    const value = screen.getByTestId("popular-value-industry-v0");
    expect(value.style.whiteSpace).toBe("normal");
  });

  it("is allowed to be narrower than its own text", () => {
    // A flex item's automatic minimum size is its CONTENT. Without an explicit
    // zero the row cannot be narrower than its longest word, which is the
    // other half of how it escaped the column.
    mount(<PopularValues group={group([LONG])} onApply={() => {}} columns="responsive" />);
    const value = screen.getByTestId("popular-value-industry-v0");
    expect(value.style.minInlineSize).toBe("0");
  });

  it("aligns its wrapped lines to the start, not centred like a button", () => {
    mount(<PopularValues group={group([LONG])} onApply={() => {}} columns="responsive" />);
    expect(screen.getByTestId("popular-value-industry-v0").style.textAlign).toBe("start");
  });

  it("still draws the value and its count", () => {
    mount(<PopularValues group={group([LONG])} onApply={() => {}} columns="responsive" />);
    expect(screen.getByTestId("popular-value-industry-v0").textContent).toBe(LONG);
    expect(screen.getByTestId("popular-count-industry-v0").textContent).toBe("10");
  });
});
