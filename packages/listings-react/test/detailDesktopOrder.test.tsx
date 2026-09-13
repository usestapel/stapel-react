/**
 * WHAT A PERSON READS FIRST ON THE DESKTOP LISTING PAGE.
 *
 * The reference classified reads, top to bottom:
 *
 *     breadcrumb                      (the host's — it owns the route)
 *     the title, with the view count under it
 *     two columns: the photographs LEFT, price + actions + seller RIGHT
 *
 * This pane read the other way round: the gallery came first and the title
 * stood UNDER it, inside the left column — so the one line that says what the
 * page is about arrived after a 4/3 photograph, and on a 1440x900 screen it
 * was below the fold on a listing with a tall picture.
 *
 * jsdom lays nothing out, so what is asserted here is what a DOM can decide:
 * which element precedes which, and which box contains which. The order IS
 * the claim — a person reads the document in that order, and the two columns
 * only exist below the heading.
 *
 * The phone arm (`layout="column"`) is asserted UNCHANGED in the same file,
 * because "the desktop got its order" is only half a claim if the single
 * column quietly moved with it.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/** Does `b` come after `a` in the document? */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail({ view_count: 42 }) },
  });
}

function pane(node: ReactElement): ReactElement {
  return <TestProviders server={server()}>{node}</TestProviders>;
}

describe("the split layout reads title-first, then two columns", () => {
  it("puts the title ABOVE the grid, not inside the reading column", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          aside={<div data-testid="host-seller-block">seller</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-split")).toBeTruthy();
    });
    const title = screen.getByTestId("listings-detail-title");
    const split = screen.getByTestId("listings-detail-split");
    // The heading is the page's, not the left column's: a title inside the
    // reading column is a title under the photographs.
    expect(split.contains(title)).toBe(false);
    expect(precedes(title, split)).toBe(true);
  });

  it("keeps the view count with the title, above the two columns", async () => {
    render(pane(<ListingDetailPane id={7} layout="split" />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-views")).toBeTruthy();
    });
    const title = screen.getByTestId("listings-detail-title");
    const views = screen.getByTestId("listings-detail-views");
    const split = screen.getByTestId("listings-detail-split");
    expect(views.textContent).toBe("42");
    expect(precedes(title, views)).toBe(true);
    expect(split.contains(views)).toBe(false);
    expect(precedes(views, split)).toBe(true);
  });

  it("reads gallery LEFT, price + actions + seller RIGHT", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          aside={<div data-testid="host-seller-block">seller</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-buy-column")).toBeTruthy();
    });
    const reading = screen.getByTestId("listings-detail-reading-column");
    const buy = screen.getByTestId("listings-detail-buy-column");
    expect(reading.contains(screen.getByTestId("listings-detail-gallery"))).toBe(
      true
    );
    expect(buy.contains(screen.getByTestId("listings-detail-price"))).toBe(true);
    expect(buy.contains(screen.getByTestId("listings-detail-actions"))).toBe(true);
    expect(buy.contains(screen.getByTestId("host-seller-block"))).toBe(true);
    // The gallery is the FIRST thing in the left column: the description and
    // the spec table follow it, they do not precede it.
    expect(
      precedes(
        screen.getByTestId("listings-detail-gallery"),
        screen.getByTestId("listings-detail-description")
      )
    ).toBe(true);
  });

  it("still watches the title it moved — the observer is on the same h1", async () => {
    const seen: boolean[] = [];
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          headingLevel={1}
          onTitleVisible={(visible) => {
            seen.push(visible);
          }}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    const title = screen.getByTestId("listings-detail-title");
    expect(title.tagName).toBe("H1");
    // The observer was attached to the heading the page now draws ABOVE the
    // grid — a move that dropped the ref would leave this list empty forever.
    const watched = observers.filter((one) => one.targets.includes(title));
    expect(watched.length).toBe(1);
    act(() => {
      watched[0]?.fire(false);
    });
    expect(seen).toEqual([false]);
  });
});

describe("the one-column arm is untouched", () => {
  it("still reads gallery, then title, then price", async () => {
    render(pane(<ListingDetailPane id={7} />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    const gallery = screen.getByTestId("listings-detail-gallery");
    const title = screen.getByTestId("listings-detail-title");
    const price = screen.getByTestId("listings-detail-price");
    expect(precedes(gallery, title)).toBe(true);
    expect(precedes(title, price)).toBe(true);
  });
});

// ── the fake observer, the same shape `detailCondensedBar` uses ─────────────

interface FakeObserver {
  readonly targets: Element[];
  fire(isIntersecting: boolean): void;
}

let observers: FakeObserver[] = [];
const realIO = globalThis.IntersectionObserver;

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = class {
    readonly targets: Element[] = [];
    constructor(private readonly callback: IntersectionObserverCallback) {
      observers.push({
        targets: this.targets,
        fire: (isIntersecting: boolean) => {
          this.callback(
            this.targets.map((target) => ({ target, isIntersecting })) as unknown as
              IntersectionObserverEntry[],
            this as unknown as IntersectionObserver
          );
        },
      });
    }
    observe(target: Element): void {
      this.targets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = realIO;
});
