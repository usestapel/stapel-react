/**
 * ONE CLUSTER, TWO PLACEMENTS — and the sentinel that tells a host when to ask
 * for the second one.
 *
 * The gap a live storefront filed (`darom-storefront`, "Named gaps"): the pane
 * mounted its reader actions at exactly ONE `actionsPlacement` and offered no
 * portal target and no render prop, so a container that wanted the two verbs
 * beside the title AND in a condensed top bar mounted a second
 * `<ListingActions>` of its own — a second `useFavoriteToggle`, two hearts
 * agreeing only after a refetch, and its own test ids so the pane's single
 * `listings-detail-reader-actions` stayed single for anything counting it. The
 * same container found the pane's `<h1>` by test id and waited for it with a
 * `MutationObserver`, because the title lands with the listing and not with the
 * first frame.
 *
 * The two properties below are the ones a well-behaved REMOUNT would also
 * satisfy, so each is asserted the only way that can tell them apart:
 *
 *   1. the favourite is the SAME `HTMLElement` before and after the move —
 *      held across the transition and compared by identity, not by test id,
 *      not by count. A cluster rendered twice, or one unmounted and mounted
 *      again in the bar, fails this and passes everything weaker;
 *   2. `onTitleVisible` reports both crossings, off an `IntersectionObserver`
 *      the test owns — never a scroll listener, and never a callback the pane
 *      fires from a render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  DETAIL_PHOTO_MIN,
  LISTINGS_GALLERY_CLASS,
  LISTINGS_GALLERY_STRIP_BASIS,
  ListingDetailPane,
  detailGalleryCss,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
    "/listings/7/": { body: detail({ is_favorited: false }) },
  });
}

/**
 * A host bar whose visibility a test flips — the shape the storefront draws:
 * chrome the container owns, with the pane's own cluster inside it.
 */
function BarHost(props: {
  readonly onReady: (show: (shown: boolean) => void) => void;
}): ReactNode {
  const [shown, setShown] = useState(false);
  props.onReady(setShown);
  return (
    <ListingDetailPane
      id={7}
      actionsPlacement={["header", "bar"]}
      renderActionsBar={(cluster) =>
        shown ? (
          <div data-testid="host-topbar">
            <span>Bosch GSB 1200</span>
            {cluster}
          </div>
        ) : null
      }
    />
  );
}

describe("the reader's cluster travels; it is never copied", () => {
  it("keeps ONE favourite instance across both placements — the same DOM node moves", async () => {
    let show: ((shown: boolean) => void) | undefined;
    render(
      <TestProviders server={server()} resolveImage>
        <BarHost
          onReady={(setter) => {
            show = setter;
          }}
        />
      </TestProviders>
    );

    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    // One cluster on the page, at its home, before the bar exists.
    expect(screen.getAllByTestId("listings-detail-reader-actions")).toHaveLength(1);
    const heading = screen.getByTestId("listings-detail-title").parentElement;
    const heart = screen.getByTestId("listings-detail-favorite");
    expect(heading?.contains(heart)).toBe(true);

    await act(async () => {
      show?.(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("host-topbar")).toBeTruthy();
    });
    // STILL ONE — the bar borrowed the cluster, it did not get a copy.
    expect(screen.getAllByTestId("listings-detail-reader-actions")).toHaveLength(1);
    expect(screen.getAllByTestId("listings-detail-favorite")).toHaveLength(1);
    // …and it is the SAME element. This is the assertion the second mount
    // could not have passed: a remount produces a node that answers to the
    // same test id and is a different object.
    expect(screen.getByTestId("listings-detail-favorite")).toBe(heart);
    expect(screen.getByTestId("host-topbar").contains(heart)).toBe(true);
    expect(heading?.contains(heart)).toBe(false);

    // And back, when the bar goes: the cluster returns home rather than
    // leaving the page with the chrome that was borrowing it.
    await act(async () => {
      show?.(false);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("host-topbar")).toBeNull();
    });
    expect(screen.getByTestId("listings-detail-favorite")).toBe(heart);
    expect(
      screen.getByTestId("listings-detail-title").parentElement?.contains(heart)
    ).toBe(true);
  });

  it("changes nothing for a host that asked for one placement", async () => {
    // Every existing mount: no `"bar"`, no render prop, no portal, no slots.
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} actionsPlacement="buy-box" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-reader-actions")).toBeTruthy();
    });
    expect(
      screen
        .getByTestId("listings-detail-actions")
        .contains(screen.getByTestId("listings-detail-reader-actions"))
    ).toBe(true);
    expect(document.querySelector("[data-listings-cluster-slot]")).toBeNull();
  });

  it("keeps the cluster at home when the list names a bar but the host draws none", async () => {
    // `renderActionsBar` is the only thing that can place the loan. Without
    // one, `["header", "bar"]` is just `"header"` — never a cluster rendered
    // nowhere.
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} actionsPlacement={["header", "bar"]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(
      screen
        .getByTestId("listings-detail-title")
        .parentElement?.contains(screen.getByTestId("listings-detail-favorite"))
    ).toBe(true);
  });
});

/**
 * THE GALLERY'S SHAPE IS THE HOST'S, AND SAYING SO COSTS NO `!important`.
 *
 * A live storefront carried
 * `[data-testid="listings-detail-gallery"] { display: flex !important }`
 * because the pane wrote `display: grid` inline and offered no seam: on a
 * 390px phone the element-width grid resolves to ONE column, so three
 * pictures push the listing's own title and price nearly three screens down.
 *
 * Both halves are asserted, because they close different things: the PROP
 * (the pane ships both shapes and the host names one, exactly as it names
 * `layout`), and the fact that `display` is no longer an inline declaration —
 * which is the only reason the container's rule needed `!important` in the
 * first place.
 */
describe("the photographs take the shape the host asked for", () => {
  it("defaults to the element-width grid, and writes no inline display", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    const gallery = screen.getByTestId("listings-detail-gallery");
    expect(gallery.getAttribute("data-gallery-layout")).toBe("grid");
    expect(gallery.classList.contains(LISTINGS_GALLERY_CLASS)).toBe(true);
    // The declaration a host stylesheet had to fight. An inline `display` is
    // beaten by nothing that is not `!important`; there is none to beat.
    expect(gallery.style.display).toBe("");
    expect(gallery.style.gridTemplateColumns).toBe("");
    // …and what stays inline is what nobody overrides: the page's own gutter
    // (D418, a var so a resize reflows it) and the overlay's containing block.
    expect(gallery.style.position).toBe("relative");
    expect(gallery.style.gap).not.toBe("");
    // The rule itself lives in the pair's own sheet, at one class plus one
    // attribute — a selector a host can out-specify without `!important`.
    expect(detailGalleryCss()).toContain(
      `.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="grid"]`
    );
    expect(detailGalleryCss()).toContain(
      `repeat(auto-fit, minmax(${DETAIL_PHOTO_MIN}, 1fr))`
    );
  });

  it("draws a snap-scrolling strip when the host asks for one", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} galleryLayout="strip" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-gallery")).toBeTruthy();
    });
    const gallery = screen.getByTestId("listings-detail-gallery");
    expect(gallery.getAttribute("data-gallery-layout")).toBe("strip");
    expect(gallery.style.display).toBe("");
    // The strip's own three rules, and the CHILD rule that makes it a strip
    // rather than a row of squeezed photographs — the reason this is a
    // stylesheet and not two more inline properties.
    const css = detailGalleryCss();
    const strip = `.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="strip"]`;
    expect(css).toContain(`${strip} {`);
    expect(css).toContain("display: flex");
    expect(css).toContain("scroll-snap-type: x mandatory");
    expect(css).toContain(`${strip} > * {`);
    expect(css).toContain(`flex: 0 0 ${LISTINGS_GALLERY_STRIP_BASIS}`);
    expect(css).toContain("scroll-snap-align: start");
    // The peek is the only thing on a phone that says the strip scrolls, so
    // it is not 100%.
    expect(LISTINGS_GALLERY_STRIP_BASIS).not.toBe("100%");
  });

  it("keeps the overlay placement pinned in either shape", async () => {
    // `actionsPlacement="gallery"` is absolutely positioned against the
    // gallery box; the containing block is the inline `position: relative`,
    // which the layout seam must not have taken with it.
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} galleryLayout="strip" actionsPlacement="gallery" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-reader-actions")).toBeTruthy();
    });
    const gallery = screen.getByTestId("listings-detail-gallery");
    expect(gallery.style.position).toBe("relative");
    expect(
      gallery.contains(screen.getByTestId("listings-detail-reader-actions"))
    ).toBe(true);
  });
});

/**
 * The sentinel. A fake `IntersectionObserver` the test drives, because jsdom
 * has no layout and therefore no real crossings — what is under test is that
 * the pane observes the TITLE and reports both directions, not that a browser
 * computes intersections.
 */
interface FakeObserver {
  readonly targets: Element[];
  fire(isIntersecting: boolean): void;
  readonly disconnected: () => boolean;
}

let observers: FakeObserver[] = [];
const realIO = globalThis.IntersectionObserver;

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = class {
    readonly targets: Element[] = [];
    private gone = false;
    constructor(private readonly callback: IntersectionObserverCallback) {
      observers.push({
        targets: this.targets,
        fire: (isIntersecting: boolean) => {
          this.callback(
            this.targets.map((target) => ({ target, isIntersecting })) as
              unknown as IntersectionObserverEntry[],
            this as unknown as IntersectionObserver
          );
        },
        disconnected: () => this.gone,
      });
    }
    observe(target: Element): void {
      this.targets.push(target);
    }
    unobserve(): void {}
    disconnect(): void {
      this.gone = true;
    }
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

describe("the pane says whether its own title is in the fold", () => {
  it("observes the title and reports it leaving and coming back", async () => {
    const seen: boolean[] = [];
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          headingLevel={1}
          onTitleVisible={(visible) => {
            seen.push(visible);
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    // The observed node is the pane's OWN title — the thing a container used
    // to find by test id through a `MutationObserver`, because the title lands
    // with the listing rather than with the first frame. Here it is observed
    // when it lands, by the pane that draws it.
    await waitFor(() => expect(observers).toHaveLength(1));
    const observer = observers[0] as FakeObserver;
    expect(observer.targets).toEqual([screen.getByTestId("listings-detail-title")]);

    // Nothing is reported before a crossing: the pane does not invent an
    // answer at mount for a question only layout can settle.
    expect(seen).toEqual([]);

    act(() => {
      observer.fire(false);
    });
    act(() => {
      observer.fire(true);
    });
    expect(seen).toEqual([false, true]);
  });

  it("wires no observer at all when nobody asked", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    expect(observers).toHaveLength(0);
  });

  it("says nothing where the environment has no IntersectionObserver", async () => {
    // The honest answer is "this page cannot tell". A fabricated `true` would
    // wedge a host's bar open on the one arm that has no scrolling to close it.
    const saved = globalThis.IntersectionObserver;
    // @ts-expect-error — deleting a global for the arm that has none.
    delete globalThis.IntersectionObserver;
    const onTitleVisible = vi.fn();
    try {
      render(
        <TestProviders server={server()} resolveImage>
          <ListingDetailPane id={7} onTitleVisible={onTitleVisible} />
        </TestProviders>
      );
      await waitFor(() => {
        expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
      });
      expect(onTitleVisible).not.toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = saved;
    }
  });
});
