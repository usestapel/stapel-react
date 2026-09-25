import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firstFocusableIn,
  obstructedInsets,
  revealField,
  revealFirstInvalid,
} from "../src/reveal.js";

/** jsdom has no layout: every box is given one by hand. */
function box(element: Element, top: number, height: number, left = 0, width = 390): void {
  const rect = {
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
  Object.defineProperty(element, "getBoundingClientRect", { value: () => rect, configurable: true });
  Object.defineProperty(element, "getClientRects", { value: () => [rect], configurable: true });
}

/** The one element `selector` names, or a thrown test failure. */
function one(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`no ${selector}`);
  return found;
}

let scrolls: ScrollToOptions[] = [];

beforeEach(() => {
  scrolls = [];
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
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

/** A 56px sticky header and a 64px fixed bottom bar over a 844px viewport. */
function chrome(): { header: HTMLElement; dock: HTMLElement } {
  const header = document.createElement("header");
  header.style.position = "sticky";
  const dock = document.createElement("nav");
  dock.style.position = "fixed";
  document.body.append(header, dock);
  box(header, 0, 56);
  box(dock, 780, 64);
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: (_x: number, y: number) => (y < 56 ? [header] : y > 780 ? [dock] : [document.body]),
  });
  return { header, dock };
}

function row(html: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.append(wrapper);
  return wrapper.firstElementChild as HTMLElement;
}

describe("revealField", () => {
  it("measures the bars over the scrollport", () => {
    chrome();
    const field = row('<div class="row"><input /></div>');
    box(field, 300, 80);
    expect(obstructedInsets(field)).toEqual({ top: 56, bottom: 64 });
  });

  it("scrolls a field hidden under the bottom bar into the uncovered band and focuses its input", () => {
    chrome();
    const field = row('<div class="row"><label>Title</label><input id="t" /><div role="alert">Fill in this field</div></div>');
    box(field, 760, 80);
    box(one(field, "input"), 790, 32);
    const result = revealField(field);
    expect(document.activeElement).toBe(field.querySelector("input"));
    expect(result?.focused).toBe(field.querySelector("input"));
    // Band is 56+12 .. 780-12 = 68..768, room 700, centred: top 378.
    expect(scrolls[0]?.top).toBeCloseTo(760 - 378);
    expect(scrolls[0]?.behavior).toBe("smooth");
    expect(result?.announced).toBe("Title: Fill in this field");
    vi.advanceTimersByTime(100);
    expect(document.querySelector("[data-stapel-reveal-announcer]")?.textContent).toBe(
      "Title: Fill in this field"
    );
  });

  it("does not scroll a field already inside the band, and still focuses it", () => {
    chrome();
    const field = row('<div class="row"><textarea></textarea></div>');
    box(field, 200, 80);
    box(one(field, "textarea"), 220, 40);
    revealField(field);
    expect(scrolls).toHaveLength(0);
    expect(document.activeElement).toBe(field.querySelector("textarea"));
  });

  it("treats a field under the sticky header as hidden", () => {
    chrome();
    const field = row('<div class="row"><input /></div>');
    box(field, 20, 60);
    box(one(field, "input"), 30, 32);
    revealField(field);
    expect(scrolls[0]?.top).toBeLessThan(0);
  });

  it("opens the closed section the field lives in", () => {
    const section = row('<details><summary>More</summary><div class="row"><input /></div></details>') as HTMLDetailsElement;
    const field = one(section, ".row");
    box(field, 100, 60);
    box(one(field, "input"), 110, 32);
    revealField(field);
    expect(section.open).toBe(true);
  });

  it("focuses the first control of a group, skipping a hidden file input", () => {
    const group = row(
      '<div><input type="file" /><button type="button">Add photo</button></div>'
    );
    box(group, 100, 60);
    box(one(group, "button"), 110, 32);
    expect(firstFocusableIn(group)).toBe(group.querySelector("button"));
  });

  it("gives the caret to the row when the control cannot take it", () => {
    const field = row('<div class="row"><label>Year</label><input disabled /></div>');
    box(field, 100, 60);
    revealField(field);
    expect(document.activeElement).toBe(field);
    expect(field.tabIndex).toBe(-1);
  });

  it("holds a searchable select's keyboard back on a touch screen until it is touched", () => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
    })) as unknown as typeof window.matchMedia;
    const field = row('<div class="row"><input role="combobox" /></div>');
    box(field, 100, 60);
    const input = one(field, "input");
    box(input, 110, 32);
    revealField(field);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("inputmode")).toBe("none");
    input.dispatchEvent(new Event("pointerdown"));
    expect(input.hasAttribute("inputmode")).toBe(false);
    Reflect.deleteProperty(window, "matchMedia");
  });
});

describe("revealFirstInvalid", () => {
  it("takes the first refused field in document order, skipping hidden ones", () => {
    const root = row(
      '<form><div class="r" style="display:none"><input aria-invalid="true" id="a" /></div>' +
        '<div class="r err"><input id="b" /></div><div class="r"><input aria-invalid="true" id="c" /></div></form>'
    );
    const [, second, third] = [...root.querySelectorAll<HTMLElement>(".r")].map((r) => {
      if (r === undefined) throw new Error("row missing");
      return r;
    }) as [HTMLElement, HTMLElement, HTMLElement];
    box(second, 100, 60);
    box(one(second, "input"), 110, 32);
    box(third, 200, 60);
    box(one(third, "input"), 210, 32);
    const found = revealFirstInvalid(root, {
      rowSelector: ".err",
      rowOf: (element) => element.closest(".r"),
    });
    expect(found).toBe(true);
    expect(document.activeElement?.id).toBe("b");
  });

  it("answers false when nothing is refused", () => {
    const root = row("<form><input /></form>");
    expect(revealFirstInvalid(root)).toBe(false);
  });
});
