/**
 * THE CONDENSED BAR THE PANE DRAWS ITSELF (`actionsPlacement="condensed-top"`).
 *
 * The gap the comparison filed (REPORT §24/§25/§29, and the inventory row
 * "No scroll-triggered condensed action bar on the phone listing"): past the
 * first screen the reference classified carries back / title / heart / share
 * pinned to the top, and this pane carried nothing — a host wanting it had to
 * build the bar AND mount a second `<ListingActions>` inside it.
 *
 * The properties asserted here are the ones a naive implementation would fail
 * and a weaker test would not notice:
 *
 *   1. the bar is absent while the title is in the fold, and present when the
 *      title has left it — driven through a fake `IntersectionObserver`,
 *      because jsdom computes no crossings and a `scroll` listener is exactly
 *      what this is not built on;
 *   2. the heart in the bar is the SAME `HTMLElement` as the heart beside the
 *      title. One cluster, one `useFavoriteToggle` — the rule `movableCluster`
 *      exists for, and the only assertion that tells a MOVE from a well-behaved
 *      second mount;
 *   3. `onTitleVisible` still reaches a host that also subscribes, so the two
 *      readers of one observer do not exclude each other;
 *   4. the host's own `renderActionsBar` wins where both loans are asked for —
 *      never two bars at the top of one viewport.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  CONDENSED_BAR_CLASS,
  CONDENSED_TITLE_CLASS,
  ListingDetailPane,
  condensedBarCss,
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

interface FakeObserver {
  readonly targets: Element[];
  fire(isIntersecting: boolean): void;
  /** A disconnected observer reports nothing, exactly as the DOM's does — a
   * fake that kept firing one would turn every re-attach into a duplicate
   * crossing and blame the pane for it. */
  disconnected(): boolean;
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
        disconnected: () => this.gone,
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

/** Drive every observer the pane armed. */
async function crossTitle(visible: boolean): Promise<void> {
  await act(async () => {
    for (const observer of observers) {
      if (!observer.disconnected()) observer.fire(visible);
    }
  });
}

describe("the condensed bar arrives with the scroll and leaves with it", () => {
  it("is absent until the title leaves the fold, and gone when it returns", async () => {
    const back: number[] = [];
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          headingLevel={1}
          actionsPlacement={["header", "condensed-top"]}
          onBack={() => {
            back.push(1);
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    // The page opens AT the title. A bar on the first frame is the flash this
    // is built not to have.
    expect(screen.queryByTestId("listings-detail-condensed-bar")).toBeNull();

    await crossTitle(false);
    const bar = screen.getByTestId("listings-detail-condensed-bar");
    expect(bar.classList.contains(CONDENSED_BAR_CLASS)).toBe(true);
    // All four things the reference's bar carries.
    expect(screen.getByTestId("listings-detail-back")).toBeTruthy();
    const title = screen.getByTestId("listings-detail-condensed-title");
    expect(title.textContent).toBe("Bosch GSB 1200");
    expect(title.classList.contains(CONDENSED_TITLE_CLASS)).toBe(true);
    expect(bar.contains(screen.getByTestId("listings-detail-favorite"))).toBe(true);
    expect(bar.contains(screen.getByTestId("listings-detail-reader-actions-share"))).toBe(
      true
    );

    await crossTitle(true);
    await waitFor(() => {
      expect(screen.queryByTestId("listings-detail-condensed-bar")).toBeNull();
    });
  });

  it("moves the ONE cluster into the bar rather than mounting a second", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          actionsPlacement={["header", "condensed-top"]}
          onBack={() => undefined}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    const heart = screen.getByTestId("listings-detail-favorite");
    expect(screen.getAllByTestId("listings-detail-reader-actions")).toHaveLength(1);

    await crossTitle(false);
    expect(screen.getAllByTestId("listings-detail-reader-actions")).toHaveLength(1);
    expect(screen.getAllByTestId("listings-detail-favorite")).toHaveLength(1);
    // The assertion a second mount cannot pass: identity, not a test id and
    // not a count.
    expect(screen.getByTestId("listings-detail-favorite")).toBe(heart);
    expect(
      screen.getByTestId("listings-detail-condensed-bar").contains(heart)
    ).toBe(true);

    await crossTitle(true);
    await waitFor(() => {
      expect(screen.queryByTestId("listings-detail-condensed-bar")).toBeNull();
    });
    // Home again, same node — an optimistic favourite in flight survives the
    // round trip because nothing unmounted.
    expect(screen.getByTestId("listings-detail-favorite")).toBe(heart);
    expect(
      screen
        .getByTestId("listings-detail-title")
        .parentElement?.contains(heart)
    ).toBe(true);
  });

  it("still reports the crossing to a host that subscribed to it", async () => {
    const seen: boolean[] = [];
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          actionsPlacement={["header", "condensed-top"]}
          onTitleVisible={(visible) => {
            seen.push(visible);
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    await crossTitle(false);
    await crossTitle(true);
    // One observer, two readers: the pane's own bar AND the host's callback.
    expect(seen).toEqual([false, true]);
  });

  it("draws no arrow for a page with nowhere to go back to", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} actionsPlacement={["header", "condensed-top"]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    await crossTitle(false);
    expect(screen.getByTestId("listings-detail-condensed-bar")).toBeTruthy();
    // An arrow that reloaded the home page would be worse than none.
    expect(screen.queryByTestId("listings-detail-back")).toBeNull();
  });

  it("yields to a host that drew its own bar, and never stacks two", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          actionsPlacement={["header", "bar", "condensed-top"]}
          renderActionsBar={(cluster) => (
            <div data-testid="host-topbar">{cluster}</div>
          )}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-topbar")).toBeTruthy();
    });
    await crossTitle(false);
    expect(screen.queryByTestId("listings-detail-condensed-bar")).toBeNull();
    expect(screen.getAllByTestId("listings-detail-favorite")).toHaveLength(1);
  });

  it("changes nothing for a host that asked for neither loan", async () => {
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    // No observer armed at all, no portal, no slots — the byte-compatible arm.
    expect(observers.filter((one) => !one.disconnected())).toHaveLength(0);
    expect(document.querySelector("[data-listings-cluster-slot]")).toBeNull();
  });
});

describe("the bar's geometry is a stylesheet a container can out-specify", () => {
  it("pins itself, and gives the title one line with an ellipsis", () => {
    const css = condensedBarCss();
    expect(css).toContain(`.${CONDENSED_BAR_CLASS}{position:fixed`);
    expect(css).toContain("inset-block-start:0");
    // The three declarations that make one line: without `min-inline-size:0`
    // a long title pushes the two verbs off the screen instead of truncating.
    expect(css).toContain(`.${CONDENSED_TITLE_CLASS}{`);
    expect(css).toContain("min-inline-size:0");
    expect(css).toContain("white-space:nowrap");
    expect(css).toContain("text-overflow:ellipsis");
  });
});

describe("one heading, one live observer", () => {
  /**
   * The leak the bar's own state made visible, and it predates the bar.
   *
   * `<Typography.Title ref>` is antd's: it merges refs and invokes them
   * itself, and a ref callback's RETURN VALUE means nothing to a caller that
   * is not React — so the hook's cleanup was dropped and a fresh
   * `IntersectionObserver` was attached to the same heading on every render
   * of a page that re-renders on every query settle. Three live observers on
   * one `<h1>` after two crossings, each announcing the crossing again.
   *
   * The assertion is over LIVE observers rather than over constructions,
   * because re-attaching is legitimate and reporting twice is not.
   */
  it("never leaves a second observer reporting the same crossing", async () => {
    const seen: boolean[] = [];
    render(
      <TestProviders server={server()} resolveImage>
        <ListingDetailPane
          id={7}
          actionsPlacement={["header", "condensed-top"]}
          onTitleVisible={(visible) => {
            seen.push(visible);
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    await crossTitle(false);
    await crossTitle(true);
    await crossTitle(false);
    expect(observers.filter((one) => !one.disconnected())).toHaveLength(1);
    expect(seen).toEqual([false, true, false]);
  });
});
