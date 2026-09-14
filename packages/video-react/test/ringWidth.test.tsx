/**
 * THE RING'S LAYOUT DECISION MUST NOT FEED ITSELF.
 *
 * `<IncomingCallOverlay>` picks full-screen or card by MEASURING a box. If the
 * ref sits on the box whose own width that answer sets, there is no fixed
 * point: a desktop viewport says "card", the card is 360 across, 360 says
 * "full-screen", full-screen is 1440 across. The overlay then flips on every
 * animation frame and React rebuilds the subtree each time, so a press and a
 * release land on two different DOM nodes and no `click` is ever dispatched —
 * the accept button becomes unpressable, no `POST /calls/<id>/accept` goes
 * out, and the call rings until the server times it out as missed. The stand
 * measured exactly that on the live storefront at 1440 (120 distinct accept
 * nodes over 120 animation frames, the button jumping between x=1250 and
 * x=728) while 390 connected cleanly, because the phone's arm happens to be
 * the stable one.
 *
 * So the property under test is not a pixel: it is that the OBSERVED element's
 * geometry is identical in both arms, and that it is not the dialog the arms
 * redraw. That needs no layout engine, which is why this is a unit test rather
 * than a browser one.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CallsProvider } from "../src/index.js";
import { IncomingCallOverlay } from "../src/default/IncomingCallOverlay.js";
import { TestProviders, mockServer } from "./harness.js";

const ALICE = "u-alice";
const BOB = "u-bob";

function ringingCall(): unknown {
  return {
    id: "call-1",
    thread_key: "conv-1",
    caller_id: ALICE,
    callee_id: BOB,
    room_name: "call-call-1",
    media: "video",
    state: "ringing",
    end_reason: "",
    started_at: new Date(Date.now() - 1000).toISOString(),
    answered_at: null,
    ended_at: null,
    duration_seconds: 0,
    expires_at: new Date(Date.now() + 44_000).toISOString(),
  };
}

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

/**
 * A `ResizeObserver` the test drives by hand: it records what was observed and
 * lets the test state that box's width. jsdom lays nothing out, so this is the
 * only way a width reaches the hook at all.
 */
interface Measured {
  /** Every element anything in the tree asked to observe. */
  readonly elements: Element[];
  /** Report this width for all of them. */
  report: (width: number) => void;
}

function installResizeObserver(): Measured {
  const elements: Element[] = [];
  const callbacks: ((width: number) => void)[] = [];
  const real = globalThis.ResizeObserver;
  class Driven {
    private readonly cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(element: Element): void {
      elements.push(element);
      callbacks.push((width: number) => {
        this.cb(
          [{ contentRect: { width } } as ResizeObserverEntry],
          this as unknown as ResizeObserver
        );
      });
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = Driven as unknown as typeof ResizeObserver;
  restore = () => {
    globalThis.ResizeObserver = real;
  };
  return {
    elements,
    report: (width) => {
      act(() => {
        for (const fire of callbacks) fire(width);
      });
    },
  };
}

async function mountRing(): Promise<Measured> {
  const measured = installResizeObserver();
  const server = mockServer({
    "GET /calls/active": { body: { call: ringingCall() } },
  });
  render(
    <TestProviders server={server}>
      <CallsProvider userId={BOB} notifyWhenHidden={false}>
        <IncomingCallOverlay />
      </CallsProvider>
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("video-ring-accept")).toBeTruthy();
  });
  return measured;
}

const overlay = (): HTMLElement => screen.getByTestId("video-ring-overlay");
const frame = (): HTMLElement => screen.getByTestId("video-ring-frame");

describe("the ring measures a box its own answer cannot resize", () => {
  it("keeps the measured box identical in both arms", async () => {
    const measured = await mountRing();
    const box = frame();
    expect(measured.elements).toContain(box);

    // A desktop-width box is the card arm.
    measured.report(1440);
    expect(overlay().dataset["variant"]).toBe("card");
    const wide = box.getAttribute("style");

    // A phone-width box is the full-screen arm.
    measured.report(360);
    expect(overlay().dataset["variant"]).toBe("fullscreen");
    const narrow = box.getAttribute("style");

    // …and the thing being measured did not move when the arm changed. This
    // is the whole defect: when these differ, the next measurement reports the
    // other arm's width and the overlay never settles.
    expect(narrow).toBe(wide);
  });

  it("measures the frame around the dialog, not the dialog", async () => {
    const measured = await mountRing();
    measured.report(1440);
    const box = frame();
    const dialog = overlay();
    // NOTHING the arms redraw is being measured — not the dialog, not anything
    // inside it. This is the assertion that fails the moment the ref moves
    // back onto the dialog.
    expect(
      measured.elements.filter((el) => el === dialog || dialog.contains(el))
    ).toEqual([]);
    expect(measured.elements).toContain(box);
    // The frame wraps the dialog and fills its containing block, so what it
    // reports is the box the overlay is drawn IN.
    expect(box.contains(dialog)).toBe(true);
    expect(box.style.position).toBe("fixed");
    expect(box.style.inset).toBe("0");
    // Full-bleed and inert: the card arm leaves the page under it clickable,
    // which is what it was before the frame existed.
    expect(box.style.pointerEvents).toBe("none");
    expect(dialog.style.pointerEvents).toBe("auto");
  });
});
