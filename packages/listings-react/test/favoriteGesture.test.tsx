/**
 * A GATED HEART REFUSES ON ACTIVATION, AND THE ACTIVATION IS WHAT EXPLAINS IT.
 *
 * Measured on a live deployment, signed out: the heart rendered
 * `aria-disabled="true"` on the SERP and the listing page and `disabled` on
 * the home feed, and tapping ANY of them produced nothing — no toast, no
 * tooltip, no disclosure, no navigation. An earlier fix had correctly removed
 * the standing "Sign in to do this" captions from the layout; the replacement
 * never arrived. On a phone there is no hover, so the reason was disclosed to
 * nobody.
 *
 * Two separate defects wore one symptom, and this file holds one test for
 * each:
 *
 * ── 1. The inert control ───────────────────────────────────────────────────
 *
 * `disabled` on a DOM button is not "styled off", it is INERT: no focus, no
 * pointer events, no keyboard activation. A control in that state cannot
 * disclose anything, which is the whole argument for `aria-disabled` plus a
 * live handler — the refusal happens when `toggle` declines to write, and
 * that is observable here as a request count of zero.
 *
 * The feed card is the surface that had this one: it was still on the
 * standing-caption arm, so its heart was html-`disabled` AND it was printing
 * "Sign in to do this" over the photograph under every tile.
 *
 * ── 2. The hover that opened the disclosure and the click that shut it ─────
 *
 * The three surfaces already on the interaction disclosure had a subtler
 * failure, and it is a POINTER one rather than a touch one. An uncontrolled
 * popover triggered by hover and click treats the click as a toggle, so a
 * cursor that rests on the heart (hover opens it) and then presses it (click
 * closes it) ends on a blank screen.
 *
 * `hoverThenClick` below is the gesture that reproduces it and `tap` is the
 * one that does not — the difference is only whether antd's 0.1s hover delay
 * has elapsed before the click. Both are here because both are gestures
 * people make, and because the distinction is precisely why a suite full of
 * click-only tests stayed green: a synthetic `click` carries no hover in
 * front of it and exercises the one ordering that always worked.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ListingDetailPane,
  ListingFeedCard,
  ListingSerpCard,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

const DOOR = "/login?next=/l/7";
const REASON = "Sign in to do this";

/** A visitor: the state every one of these was measured in. */
function visitor(children: ReactElement, server: MockServer = mockServer({})): ReactElement {
  return (
    <TestProviders server={server} mandate="anonymous">
      {children}
    </TestProviders>
  );
}

/** Let antd's open/close animations and its 0.1s hover delay run out, so a
 * disclosure asserted "open" is open when the dust has settled and not only
 * for the frame in between. */
async function settle(ms = 250): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** What the person can see. antd keeps a closed popover MOUNTED and marks it
 * `ant-popover-hidden`, so presence in the DOM proves nothing — this is the
 * marker that separates "disclosed" from "flashed and shut". */
function disclosed(): boolean {
  const overlay = document.querySelector(".ant-popover");
  return overlay !== null && !overlay.classList.contains("ant-popover-hidden");
}

/**
 * The gesture a THUMB makes: a touch reaches the page as an emulated
 * `mouseenter` immediately followed by a `click`, both inside a few
 * milliseconds — i.e. well inside antd's 0.1s hover delay, so the hover has
 * not opened anything yet when the click lands.
 */
function tap(element: HTMLElement): void {
  fireEvent.mouseEnter(element);
  fireEvent.click(element);
}

/**
 * The gesture a POINTER makes, and the one that was broken: the cursor rests
 * on the control long enough for the hover to open the disclosure, and THEN
 * clicks. An uncontrolled popover listening for hover and click treats that
 * click as a toggle and shuts what the hover just opened.
 *
 * The delay is the whole test. Fired back to back the two events pass against
 * the broken component, which is why `tap` above proves a different thing and
 * why a suite of click-only tests never saw this.
 */
async function hoverThenClick(element: HTMLElement): Promise<void> {
  fireEvent.mouseEnter(element);
  await settle();
  fireEvent.click(element);
  await settle();
}

describe("the gated heart is never inert", () => {
  it("carries aria-disabled and a live handler, on every card surface", () => {
    render(
      visitor(
        <>
          <ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />
          <ListingSerpCard
            listing={CARD}
            href="/l/7"
            blockedReason="popover"
            signIn={{ href: DOOR }}
          />
        </>
      )
    );
    for (const id of ["listings-feed-favorite", "listings-serp-favorite"]) {
      const heart = screen.getByTestId(id);
      expect(heart.getAttribute("aria-disabled"), id).toBe("true");
      // The html attribute is what makes a button unreachable by focus and
      // by tap. It must not be there.
      expect(heart.hasAttribute("disabled"), id).toBe(false);
      expect(heart).toHaveProperty("disabled", false);
    }
  });

  it("refuses the WRITE on activation, not by swallowing the event", async () => {
    const server = mockServer({});
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />, server));
    tap(screen.getByTestId("listings-feed-favorite"));
    await settle();
    // The click arrived — the disclosure below proves it — and the gate is
    // what declined to write.
    expect(server.matching("/listings/7/favorite/")).toHaveLength(0);
    expect(disclosed()).toBe(true);
  });
});

describe("the tap discloses the reason and the door", () => {
  it("on the feed card, which is where the standing caption used to be", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));

    tap(screen.getByTestId("listings-feed-favorite"));
    await settle();

    expect(disclosed()).toBe(true);
    const content = screen.getByTestId("listings-feed-favorite-reason");
    expect(content.textContent).toContain(REASON);
    // The door, carrying the `next` the container built back to this listing.
    expect(
      screen.getByTestId("listings-feed-favorite-sign-in").getAttribute("href")
    ).toBe(DOOR);
  });

  it("STAYS disclosed when a pointer hovers first and then clicks", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    await hoverThenClick(screen.getByTestId("listings-feed-favorite"));
    // Activation is monotonic: a click may only open the disclosure. Before
    // that rule this closed, and the overlay came back `ant-popover-hidden`.
    expect(disclosed()).toBe(true);
    expect(
      screen.getByTestId("listings-feed-favorite-sign-in").getAttribute("href")
    ).toBe(DOOR);
  });

  it("on the SERP card", async () => {
    render(
      visitor(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          blockedReason="popover"
          signIn={{ href: DOOR }}
        />
      )
    );

    tap(screen.getByTestId("listings-serp-favorite"));
    await settle();

    expect(disclosed()).toBe(true);
    expect(
      screen.getByTestId("listings-serp-favorite-sign-in").getAttribute("href")
    ).toBe(DOOR);

    await hoverThenClick(screen.getByTestId("listings-serp-favorite"));
    expect(disclosed()).toBe(true);
  });

  it("on the listing page", async () => {
    const server = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ is_favorited: null }) },
    });
    render(
      visitor(
        <ListingDetailPane id={7} blockedReason="popover" signIn={{ href: DOOR }} />,
        server
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });

    tap(screen.getByTestId("listings-detail-favorite"));
    await settle();

    expect(disclosed()).toBe(true);
    expect(
      screen.getByTestId("listings-detail-sign-in").getAttribute("href")
    ).toBe(DOOR);

    await hoverThenClick(screen.getByTestId("listings-detail-favorite"));
    expect(disclosed()).toBe(true);
  });

  it("opens for a keyboard too — Enter on the focused heart", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    const heart = screen.getByTestId("listings-feed-favorite");
    fireEvent.focus(heart);
    fireEvent.keyDown(heart, { key: "Enter" });
    await settle();
    expect(disclosed()).toBe(true);
  });

  it("keeps the reason in the accessibility tree with no gesture at all", () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    const heart = screen.getByTestId("listings-feed-favorite");
    const describedBy = heart.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(REASON);
  });
});

describe("the standing caption does not come back", () => {
  it("the feed tile prints nothing in its layout", () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    // The pooled/standing reason a `GatedControl` renders — the thing that
    // was overprinting the photograph under every tile.
    expect(document.querySelector("[data-stapel-gated-reason]")).toBeNull();
    expect(screen.queryByTestId("listings-feed-favorite-gate")).toBeNull();
    // Every surviving copy of the sentence is the a11y one, clipped out of
    // the layout (`visuallyHidden` uses `clip-path: inset(50%)`).
    const standing = screen
      .queryAllByText(REASON)
      .filter((node) => !/inset\(50%\)/.test(node.getAttribute("style") ?? ""));
    expect(standing).toEqual([]);
  });

  it("gives it back only to a host that asks for it by name", () => {
    render(
      visitor(
        <ListingFeedCard
          listing={CARD}
          href="/l/7"
          blockedReason="text"
          signIn={{ href: DOOR }}
        />
      )
    );
    expect(document.querySelector("[data-stapel-gated-reason]")).not.toBeNull();
    // And even in the standing arm the heart is not inert.
    const heart = screen.getByTestId("listings-feed-favorite");
    expect(heart.getAttribute("aria-disabled")).toBe("true");
    expect(heart).toHaveProperty("disabled", false);
  });
});

/**
 * ── 3. The disclosure the gesture opened, and the same gesture's hover-out ──
 *
 * The two tests above proved the click OPENS it. The deployed phone proved
 * that is not the same as a person seeing it, and the timeline is the whole
 * defect (walker D72, pass 7):
 *
 *   +0 ms    tap → `click` → the overlay loses `ant-popover-hidden`
 *   +10 ms   the finger lifts; the emulated hover ends; `mouseleave`
 *   +110 ms  antd's `mouseLeaveDelay` expires → close
 *   +260 ms  the leave motion finishes; `ant-popover-hidden` is back
 *
 * A quarter of a second is not a disclosure, it is a flash, and six walker
 * passes in a row read it as "tapping the heart does nothing". The old
 * monotonic-activation flag could not see it: it lived for one microtask and
 * the closer is a TIMER a fifth of a second behind the gesture.
 *
 * So activation PINS, and these are the tests for what a pin must and must
 * not do.
 */
describe("an activated disclosure survives the gesture that opened it", () => {
  it("stays open after the tap's own hover ends — the D72 timeline", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    const heart = screen.getByTestId("listings-feed-favorite");

    tap(heart);
    await settle();
    expect(disclosed()).toBe(true);

    // The finger lifts. On a phone this is unavoidable and immediate.
    fireEvent.mouseLeave(heart);
    // Well past antd's 0.1s leave delay AND its leave motion.
    await settle(500);

    expect(disclosed()).toBe(true);
    expect(
      screen.getByTestId("listings-feed-favorite-sign-in").getAttribute("href")
    ).toBe(DOOR);
  });

  it("a hover that was never clicked still closes on the way out", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    const heart = screen.getByTestId("listings-feed-favorite");

    // No click: this is a cursor passing over the control, and the pin has no
    // claim on it. Pinning a hover would leave a trail of open popovers behind
    // a mouse crossing a grid of twenty-four cards.
    fireEvent.mouseEnter(heart);
    await settle();
    expect(disclosed()).toBe(true);

    fireEvent.mouseLeave(heart);
    await settle(500);
    expect(disclosed()).toBe(false);
  });

  it("a pointer down outside it dismisses it", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    tap(screen.getByTestId("listings-feed-favorite"));
    await settle();
    expect(disclosed()).toBe(true);

    // Refusing antd's own outside-click close is what makes this the pin's
    // job. A panel with no way out would be a worse defect than the flash.
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    await settle(500);
    expect(disclosed()).toBe(false);
  });

  it("Escape dismisses it, for the keyboard", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    tap(screen.getByTestId("listings-feed-favorite"));
    await settle();
    expect(disclosed()).toBe(true);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await settle(500);
    expect(disclosed()).toBe(false);
  });

  it("a pointer down INSIDE it does not — the door has to survive its own press", async () => {
    render(visitor(<ListingFeedCard listing={CARD} href="/l/7" signIn={{ href: DOOR }} />));
    tap(screen.getByTestId("listings-feed-favorite"));
    await settle();

    const door = screen.getByTestId("listings-feed-favorite-sign-in");
    await act(async () => {
      fireEvent.pointerDown(door);
    });
    await settle(300);
    // Dismissing on the overlay's own pointerdown would take the link away
    // between the press and the click that follows it.
    expect(disclosed()).toBe(true);
  });
});
