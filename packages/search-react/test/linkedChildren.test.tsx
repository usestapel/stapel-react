/**
 * A POINTER IS NOT A SECTION OF THIS TEMPLATE.
 *
 * A partition is one template split by a value its children's names express:
 * new / used / for rent. A pointer (`CategoryChild.linked`, stapel-categories
 * 0.22.0) is a different branch of the catalogue an operator drew among these
 * children so a person can reach it from here — it does not narrow this feed,
 * and it has no count of its own.
 *
 * Rendered as one of the chips, it produced the line the owner read off the
 * stand: `All | New 0 | Used 3 | Car rental 0`. Two of those zeroes
 * were a section's real emptiness; the third was a count of somebody else's
 * category that nobody had asked for, under a control that would have filtered
 * this page by an id path into another branch.
 *
 * What is asserted here is the SEMANTICS, not one rendering of them: a linked
 * child never becomes a radio, never draws a count, never matches `value`, and
 * — when it is drawn at all — is an ordinary anchor to the target rather than
 * a control that changes this page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { PartitionChips } from "../src/default/index.js";
import type { PartitionChild } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { searchResponse } from "./fixtures.js";

afterEach(cleanup);

/** The storefront's own `/c/transport-avtomobili`: two real sections and one
 * pointer at a wholly different branch. */
const NEW: PartitionChild = { id: 152, path: "141/151/152", name: "New", count: 0 };
const USED: PartitionChild = { id: 153, path: "141/151/153", name: "Used", count: 3 };
const RENTAL: PartitionChild = {
  id: 400,
  path: "141/400",
  name: "Car rental",
  // A host that maps its rows mechanically hands the count and the flag
  // together — the flag has to win, or the mapping is the thing that has to
  // remember, which is how this defect reached a stand.
  count: 0,
  linked: true,
  href: "/c/arenda-avto",
};
const ITEMS: readonly PartitionChild[] = [NEW, USED, RENTAL];

function mount(node: ReactElement): void {
  render(
    <TestHarness server={mockServer({ "/query": { body: searchResponse() } })}>
      {node}
    </TestHarness>
  );
}

function radioLabels(): readonly string[] {
  return [
    ...screen.getByTestId("partition-chips").querySelectorAll('[role="radio"]'),
  ].map((node) => node.textContent ?? "");
}

describe("a linked child is out of the partition's semantics", () => {
  it("never becomes one of the choices", () => {
    mount(<PartitionChips items={ITEMS} value={null} onChange={() => undefined} />);
    const labels = radioLabels();
    // The parent and the two real sections — and not the pointer.
    expect(labels.length).toBe(3);
    expect(labels.some((label) => label.includes("Car rental"))).toBe(false);
    expect(screen.queryByTestId("partition-chip-141/400")).toBeNull();
  });

  it("never receives a count, even when the host hands one over", () => {
    mount(<PartitionChips items={ITEMS} value={null} onChange={() => undefined} />);
    // The sections keep theirs — this is not "counts went away".
    expect(screen.getByTestId("partition-count-141/151/153").textContent).toBe("3");
    expect(screen.queryByTestId("partition-count-141/400")).toBeNull();
    const link = screen.getByTestId("partition-link-141/400");
    expect(link.textContent).toBe("Car rental");
    expect(link.textContent).not.toContain("0");
  });

  it("never becomes the ACTIVE partition, even when the address names it", () => {
    // A stale link, or a host mirroring the pointer's own path into `category`.
    mount(
      <PartitionChips items={ITEMS} value="141/400" onChange={() => undefined} />
    );
    const checked = [
      ...screen.getByTestId("partition-chips").querySelectorAll('[role="radio"]'),
    ].filter((node) => node.getAttribute("aria-checked") === "true");
    expect(checked.length).toBe(0);
    // And the row is still reachable: the roving stop falls back to the parent.
    expect(screen.getByTestId("partition-chip-all").getAttribute("tabindex")).toBe(
      "0"
    );
  });

  it("is not inside the radiogroup — a choice with an unchoosable option", () => {
    mount(<PartitionChips items={ITEMS} value={null} onChange={() => undefined} />);
    const group = screen.getByTestId("partition-chips");
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.querySelector('[data-testid="partition-link-141/400"]')).toBeNull();
  });
});

describe("the pointer chip is a destination", () => {
  it("navigates to the target's own address, with no filter on this page", () => {
    let changes = 0;
    mount(
      <PartitionChips
        items={ITEMS}
        value={null}
        onChange={() => {
          changes += 1;
        }}
      />
    );
    const link = screen.getByTestId("partition-link-141/400");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/c/arenda-avto");
    link.click();
    // A real anchor: the browser navigates and this row's state does not move.
    expect(changes).toBe(0);
  });

  it("carries a trailing arrow the screen reader does not read", () => {
    mount(<PartitionChips items={ITEMS} value={null} onChange={() => undefined} />);
    const link = screen.getByTestId("partition-link-141/400");
    const glyph = link.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    // The accessible name is the target's own — not "Car rental, arrow".
    expect(link.textContent).toBe("Car rental");
  });

  it("stands AFTER the partitions, in its own row", () => {
    mount(<PartitionChips items={ITEMS} value={null} onChange={() => undefined} />);
    const group = screen.getByTestId("partition-chips");
    const links = screen.getByTestId("partition-links");
    expect(
      group.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("is drawn in the segmented variant too", () => {
    mount(
      <PartitionChips
        items={ITEMS}
        value={null}
        variant="segmented"
        onChange={() => undefined}
      />
    );
    expect(screen.getByTestId("partition-link-141/400")).toBeTruthy();
    expect(screen.queryByTestId("partition-chip-141/400")).toBeNull();
  });

  it("is not drawn at all with a link that has no address", () => {
    const homeless: PartitionChild = { id: 401, path: "141/401", name: "X", linked: true };
    mount(
      <PartitionChips
        items={[NEW, homeless]}
        value={null}
        onChange={() => undefined}
      />
    );
    expect(screen.queryByTestId("partition-links")).toBeNull();
    // Still out of the partition either way — an entry with no address is not
    // promoted back to being a section.
    expect(screen.queryByTestId("partition-chip-141/401")).toBeNull();
  });
});

describe('<PartitionChips linkedChildren="none">', () => {
  it("omits the pointer here, for a page whose tile stage already shows it", () => {
    mount(
      <PartitionChips
        items={ITEMS}
        value={null}
        linkedChildren="none"
        onChange={() => undefined}
      />
    );
    expect(screen.queryByTestId("partition-links")).toBeNull();
    expect(screen.queryByTestId("partition-link-141/400")).toBeNull();
    // The partitions are untouched by the choice.
    expect(radioLabels().length).toBe(3);
  });
});

describe("a row with no pointers at all is exactly what it was", () => {
  it("renders the control alone, with no extra box around it", () => {
    mount(
      <PartitionChips items={[NEW, USED]} value={null} onChange={() => undefined} />
    );
    expect(screen.queryByTestId("partition-links")).toBeNull();
    expect(radioLabels().length).toBe(3);
  });
});
