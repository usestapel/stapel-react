/**
 * A PARTITION PRESS MUST NOT REBUILD THE PAGE IT LANDS ON.
 *
 * The defect (D454, storefront `/c/:slug`). `/c/:slug` composes the listings
 * pair INSIDE `<CategoryPage renderListings>`, and the page put that slot
 * under its own `LoadBoundary` gated on `GET {id}/` AND `GET {id}/children/`.
 * A partition press navigates to a SIBLING — same page, same rail, same
 * segmented control, different rows — and it changed `categoryId`, sent both
 * reads pending, and swapped the boundary's subtree for a four-row skeleton.
 * A different element at the same position is an UNMOUNT: the filter rail,
 * the facet panel, the control the person had just pressed, its focus and its
 * scroll position, twice (out and back).
 *
 * The storefront worked around it by mounting these very hooks in the
 * container and withholding the id from the page until both had landed — 47
 * lines to tell the page something the page already knew.
 *
 * So the assertions here are about MOUNTS, not about pixels: a counter inside
 * the `renderListings` node, which can only move if React tore the subtree
 * down. A test that merely looked for the skeleton would pass against a
 * remount that happened to be fast.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CategoryPage } from "../src/default/index.js";
import type { Category } from "../src/index.js";
import {
  DESKTOP_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  rowRoutes,
  setViewport,
} from "./harness.js";
import { ELECTRONICS, FEATURES, FULL_PAGE, LAPTOPS, PHONES, ROWS } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
  ...rowRoutes(ROWS),
};

/** The host's half of the screen, with a mount counter — the thing the
 * boundary used to throw away on every sibling press. */
let mounts = 0;
function Listings(props: { readonly category: Category }): ReactElement {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <div data-testid="host-listings">{props.category.slug}</div>;
}

/** The page under a host that can change its address — a partition press,
 * which is a state change in the container and not a remount of anything. */
let goTo: (id: number) => void = () => undefined;
function Switcher(props: {
  readonly keepPrevious?: boolean;
  readonly start: number;
}): ReactElement {
  const [id, setId] = useState(props.start);
  goTo = setId;
  return (
    <CategoryPage
      categoryId={id}
      subcategories="none"
      breadcrumbs={false}
      {...(props.keepPrevious !== undefined
        ? { keepPrevious: props.keepPrevious }
        : {})}
      renderListings={(category) => <Listings category={category} />}
    />
  );
}

function skeleton(): HTMLElement | null {
  return screen.queryByTestId("categories-category-loading");
}

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
  mounts = 0;
});

describe("<CategoryPage> keeps the page it is showing", () => {
  it("draws the skeleton on a FIRST mount — there is nothing behind it to keep", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <Switcher start={PHONES.id} />
      </TestProviders>
    );
    // Synchronously, before either read has landed: a page with no previous
    // answer says "loading", which is the honest sentence there.
    expect(skeleton()).toBeTruthy();
    expect(screen.queryByTestId("host-listings")).toBeNull();

    await waitFor(() => expect(screen.getByTestId("host-listings")).toBeTruthy());
    expect(skeleton()).toBeNull();
    expect(mounts).toBe(1);
  });

  it("keeps the listings node MOUNTED across a sibling change, and never draws the skeleton", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <Switcher start={PHONES.id} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("phones")
    );
    expect(mounts).toBe(1);

    // The press. `phones` → `laptops`: both of the pair's reads go pending.
    act(() => {
      goTo(LAPTOPS.id);
    });

    // This render is the one that used to be a skeleton. The page on the
    // glass is still the previous category — the WHOLE frame, heading and
    // listings agreeing, not half of each.
    expect(skeleton()).toBeNull();
    expect(screen.getByTestId("host-listings").textContent).toBe("phones");
    expect(screen.getByTestId("categories-category-title").textContent).toBe(
      "category.phones"
    );

    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("laptops")
    );
    expect(screen.getByTestId("categories-category-title").textContent).toBe(
      "category.laptops"
    );
    // The whole point: React never tore the subtree down, so nothing the host
    // rendered into the slot lost its state, its scroll or its focus.
    expect(mounts).toBe(1);
    expect(skeleton()).toBeNull();
  });

  it("says it is refreshing, so a host can dim or announce the wait", async () => {
    const { container } = render(
      <TestProviders server={mockServer(OK)}>
        <Switcher start={PHONES.id} />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("host-listings")).toBeTruthy());
    const refreshing = (): Element | null =>
      container.querySelector('[data-stapel-load-refreshing="true"]');
    expect(refreshing()).toBeNull();

    act(() => {
      goTo(LAPTOPS.id);
    });
    expect(refreshing()).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("laptops")
    );
    // …and it stops saying so once the new frame is whole.
    expect(refreshing()).toBeNull();
  });

  it("keepPrevious={false} restores the old behaviour exactly, skeleton and remount included", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <Switcher start={PHONES.id} keepPrevious={false} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("phones")
    );
    expect(mounts).toBe(1);

    act(() => {
      goTo(LAPTOPS.id);
    });
    expect(skeleton()).toBeTruthy();
    expect(screen.queryByTestId("host-listings")).toBeNull();

    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("laptops")
    );
    // The subtree was rebuilt — which is what the opt-out is for, and what
    // every other assertion in this file exists to prevent by default.
    expect(mounts).toBe(2);
  });

  it("hands a REFUSAL the error arm rather than the page it was holding", async () => {
    // A dead category wearing the last live one is a dead link that looks
    // alive. `failed` is never kept — see `keepPreviousLoad` in @stapel/core.
    const server = mockServer({
      ...OK,
      [`/categories/${String(LAPTOPS.id)}/`]: () => ({
        status: 404,
        body: { code: "stapel.http.404", message: "Not found" },
      }),
    });
    render(
      <TestProviders server={server}>
        <Switcher start={PHONES.id} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("host-listings").textContent).toBe("phones")
    );

    act(() => {
      goTo(LAPTOPS.id);
    });
    await waitFor(() =>
      expect(screen.getByTestId("categories-category-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("host-listings")).toBeNull();
  });
});
