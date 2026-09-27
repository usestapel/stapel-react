import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealStart } from "../src/reveal.js";

/**
 * Owner, 2026-09-27: «on Next there is no scroll to the top of the form».
 * A step change brings the step's START under the sticky header — in the
 * window on a phone and in the dialog body on a desktop — and focuses the
 * step heading for a screen reader.
 */
function box(element: Element, top: number, height: number): void {
  const rect = {
    top,
    bottom: top + height,
    left: 0,
    right: 390,
    width: 390,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
  Object.defineProperty(element, "getBoundingClientRect", { value: () => rect, configurable: true });
  Object.defineProperty(element, "getClientRects", { value: () => [rect], configurable: true });
}

let scrolls: ScrollToOptions[] = [];

beforeEach(() => {
  scrolls = [];
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "scrollY", { value: 2000, configurable: true });
  window.scrollTo = ((options: ScrollToOptions) => {
    scrolls.push(options);
  }) as typeof window.scrollTo;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "elementsFromPoint");
});

function stickyHeader(): void {
  const header = document.createElement("header");
  header.style.position = "sticky";
  document.body.append(header);
  box(header, 0, 56);
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: (_x: number, y: number) => (y < 56 ? [header] : [document.body]),
  });
}

function step(): { start: HTMLElement; heading: HTMLElement } {
  const start = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = "Characteristics";
  start.append(heading);
  document.body.append(start);
  return { start, heading };
}

describe("revealStart", () => {
  it("scrolls a start far above the viewport to just under the sticky header", () => {
    stickyHeader();
    const { start, heading } = step();
    box(start, -1500, 3000);
    const focused = revealStart(start, { focus: heading });
    // Band top 56 + 12 gap: the start lands at 68.
    expect(scrolls[0]?.top).toBeCloseTo(2000 + (-1500 - 68));
    expect(scrolls[0]?.behavior).toBe("smooth");
    expect(focused).toBe(heading);
    expect(document.activeElement).toBe(heading);
    expect(heading.tabIndex).toBe(-1);
  });

  it("is instant under reduced motion", () => {
    stickyHeader();
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const { start } = step();
    box(start, -400, 900);
    revealStart(start);
    expect(scrolls[0]?.behavior).toBe("auto");
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("leaves a start already near the top alone", () => {
    stickyHeader();
    const { start, heading } = step();
    box(start, 80, 900);
    revealStart(start, { focus: heading });
    expect(scrolls).toHaveLength(0);
    expect(document.activeElement).toBe(heading);
  });

  it("scrolls the dialog body, not the window, when that is the scroll port", () => {
    const body = document.createElement("div");
    body.style.overflowY = "auto";
    Object.defineProperty(body, "scrollHeight", { value: 3000, configurable: true });
    Object.defineProperty(body, "clientHeight", { value: 600, configurable: true });
    body.scrollTop = 900;
    const calls: ScrollToOptions[] = [];
    body.scrollTo = ((options: ScrollToOptions) => {
      calls.push(options);
    }) as typeof body.scrollTo;
    document.body.append(body);
    box(body, 100, 600);
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => [body],
    });
    const start = document.createElement("div");
    body.append(start);
    box(start, -800, 2000);
    revealStart(start, { behavior: "auto" });
    expect(scrolls).toHaveLength(0);
    expect(calls[0]?.top).toBeCloseTo(900 + (-800 - 112));
  });
});
