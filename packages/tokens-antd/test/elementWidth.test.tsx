// @vitest-environment jsdom
/**
 * `useElementWidth` — the one element-width measurement — and the two
 * substrate components that read it: `DataTable` (table or cards) and `Pane`
 * (the gutter step), plus `ErrorAlert`'s action column, which stacks under
 * the message in a narrow BOX (VC-B6).
 *
 * The observer is faked at the ENVIRONMENT edge, never by stubbing the hook:
 * a suite that mocked `useElementWidth` would prove only that the mock works.
 */
import { useRef } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { ACTION_STACK_BELOW, DataTable, ErrorAlert, Pane, useElementWidth } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

interface FakeObserver {
  readonly callback: ResizeObserverCallback;
  readonly targets: Element[];
}

const observers: FakeObserver[] = [];

class FakeResizeObserver {
  private readonly entry: FakeObserver;
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element): void {
    this.entry.targets.push(target);
  }
  unobserve(): void {
    // The suite never partially unobserves; disconnect is what React's
    // cleanup calls.
  }
  disconnect(): void {
    this.entry.targets.length = 0;
  }
}

/** Report `width` for every observed element, the way a browser would. */
function reportWidth(width: number): void {
  act(() => {
    for (const observer of observers) {
      if (observer.targets.length === 0) continue;
      observer.callback(
        observer.targets.map(
          (target) =>
            ({
              target,
              contentBoxSize: [{ inlineSize: width, blockSize: 100 }],
              contentRect: { width },
            }) as unknown as ResizeObserverEntry
        ),
        {} as unknown as ResizeObserver
      );
    }
  });
}

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
  observers.length = 0;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
  observers.length = 0;
});

function Probe(): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const { width, below } = useElementWidth(ref, {
    thresholds: { cards: breakpoints.tablet },
  });
  return (
    <div
      ref={ref}
      data-testid="probe"
      data-width={width === undefined ? "unmeasured" : String(width)}
      data-below={String(below.cards)}
    />
  );
}

describe("useElementWidth — the fleet's one element-width hook", () => {
  it("answers `undefined` — not a number — until the box has been measured", () => {
    render(<Probe />);
    const probe = screen.getByTestId("probe");
    expect(probe.getAttribute("data-width")).toBe("unmeasured");
    // The threshold is unknown too, so a caller must state its own seed
    // instead of inheriting somebody else's guess.
    expect(probe.getAttribute("data-below")).toBe("undefined");
  });

  it("reports the live width and every threshold, and follows the box when it changes", () => {
    render(<Probe />);
    reportWidth(900);
    expect(screen.getByTestId("probe").getAttribute("data-width")).toBe("900");
    expect(screen.getByTestId("probe").getAttribute("data-below")).toBe("false");
    reportWidth(390);
    expect(screen.getByTestId("probe").getAttribute("data-width")).toBe("390");
    expect(screen.getByTestId("probe").getAttribute("data-below")).toBe("true");
  });

  it("ignores a zero width — a hidden box measures nothing and must not stick", () => {
    render(<Probe />);
    reportWidth(900);
    reportWidth(0);
    expect(screen.getByTestId("probe").getAttribute("data-width")).toBe("900");
  });
});

describe("the substrate reads the box, not the window", () => {
  interface Row {
    readonly id: string;
    readonly name: string;
  }
  const rows: readonly Row[] = [{ id: "1", name: "Deploy key" }];
  const columns = [
    { key: "name", title: "Name", render: (r: Row) => r.name, cardRole: "title" as const },
  ];

  it("gives DataTable a table and Pane a desktop gutter in a wide box on a phone-wide window", () => {
    setViewport(390);
    render(
      <Host>
        <Pane testId="pane">
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} testId="dt" />
        </Pane>
      </Host>
    );
    // The seed before any measurement is the viewport's phone rule.
    expect(screen.getByTestId("dt").getAttribute("data-stapel-datatable")).toBe("cards");
    const seeded = parseInt(screen.getByTestId("pane").style.paddingInline, 10);

    reportWidth(900);
    expect(screen.getByTestId("dt").getAttribute("data-stapel-datatable")).toBe("table");
    expect(parseInt(screen.getByTestId("pane").style.paddingInline, 10)).toBeGreaterThan(seeded);
  });
});

describe("ErrorAlert stacks its actions under the message in a narrow box (VC-B6)", () => {
  const alert = (): ReactElement => (
    <Host>
      <ErrorAlert
        message="We could not load your balance."
        detail="HTTP 503"
        onRetry={() => undefined}
        testId="err"
      />
    </Host>
  );

  it("keeps antd's action column while the box is wider than the narrow measure", () => {
    render(alert());
    reportWidth(ACTION_STACK_BELOW + 1);
    const box = screen.getByTestId("err").parentElement;
    expect(box?.getAttribute("data-stapel-error-actions")).toBe("inline");
    expect(screen.getByTestId("err").querySelector("[class*='ant-alert-action']")).not.toBeNull();
  });

  it("moves the retry under the message below it — the shop's failed panel at 390px", () => {
    render(alert());
    reportWidth(390);
    const box = screen.getByTestId("err").parentElement;
    expect(box?.getAttribute("data-stapel-error-actions")).toBe("stacked");
    const alertEl = screen.getByTestId("err");
    // No action column at all: the sentence gets the full width of the alert.
    expect(alertEl.querySelector("[class*='ant-alert-action']")).toBeNull();
    const description = alertEl.querySelector(".ant-alert-description");
    expect(description?.textContent).toContain("HTTP 503");
    expect(description?.querySelector("button")?.textContent).toBe("Try again");
  });

  it("seeds the unmeasured frame from the dialog-surface rule, so a phone never squeezes", () => {
    setViewport(390);
    render(alert());
    expect(screen.getByTestId("err").parentElement?.getAttribute("data-stapel-error-actions")).toBe(
      "stacked"
    );
    cleanup();
    setViewport(1280);
    render(alert());
    expect(screen.getByTestId("err").parentElement?.getAttribute("data-stapel-error-actions")).toBe(
      "inline"
    );
  });
});
