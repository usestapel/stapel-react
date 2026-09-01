// @vitest-environment jsdom
/**
 * `CountedInput` — the counter counts CODE POINTS, the field is never capped
 * below what the counter promises, and `normalize` runs where foreign text
 * enters (paste) and where the person leaves (blur), never per keystroke.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fontFamily } from "@stapel/tokens";
import { COUNTER_TESTID, CountedInput, codePointLength } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(390);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

function field(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function counter(): HTMLElement {
  return screen.getByTestId(COUNTER_TESTID);
}

/** The component is controlled; these tests need the state a caller holds. */
function Harness(props: {
  readonly initial?: string;
  readonly maxLength?: number;
  readonly normalize?: (value: string) => string;
  readonly mono?: boolean;
}): ReactElement {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <CountedInput
      value={value}
      onChange={setValue}
      ariaLabel="VIN"
      {...(props.maxLength !== undefined ? { maxLength: props.maxLength } : {})}
      {...(props.normalize !== undefined ? { normalize: props.normalize } : {})}
      {...(props.mono === true ? { mono: true } : {})}
    />
  );
}

describe("codePointLength", () => {
  it("counts what the backend counts, not UTF-16 units", () => {
    expect(codePointLength("abc")).toBe(3);
    expect("😀".length).toBe(2);
    expect(codePointLength("😀")).toBe(1);
  });
});

describe("CountedInput", () => {
  it("counts live, in the shape `n / max`", () => {
    render(
      <Host>
        <Harness initial="WBA" maxLength={17} />
      </Host>
    );
    expect(counter().textContent).toBe("3 / 17");
    fireEvent.change(field(), { target: { value: "WBAX" } });
    expect(counter().textContent).toBe("4 / 17");
  });

  it("counts code points, so an emoji is one character", () => {
    render(
      <Host>
        <Harness initial="😀😀" maxLength={10} />
      </Host>
    );
    expect(counter().textContent).toBe("2 / 10");
  });

  it("goes over the limit VISIBLY instead of refusing the keystroke", () => {
    render(
      <Host>
        <Harness initial="12345" maxLength={4} />
      </Host>
    );
    expect(field().value).toBe("12345");
    // Nothing was capped: the DOM attribute that would have capped it is absent.
    expect(field().getAttribute("maxlength")).toBeNull();
    expect(counter().textContent).toBe("5 / 4");
    const root = counter().closest("[data-stapel-counted-input]");
    expect(root?.getAttribute("data-stapel-counted-input")).toBe("over");
  });

  it("is `under` while it fits", () => {
    render(
      <Host>
        <Harness initial="123" maxLength={4} />
      </Host>
    );
    expect(
      counter().closest("[data-stapel-counted-input]")?.getAttribute("data-stapel-counted-input")
    ).toBe("under");
  });

  it("normalizes what is PASTED, at the cursor", () => {
    render(
      <Host>
        <Harness normalize={(text) => text.replace(/\s/g, "").toUpperCase()} />
      </Host>
    );
    fireEvent.paste(field(), {
      clipboardData: { getData: () => " wba 1234 " },
    });
    expect(field().value).toBe("WBA1234");
  });

  it("normalizes again on blur — the last moment a fix is still invisible", () => {
    render(
      <Host>
        <Harness initial="wba 12" normalize={(text) => text.replace(/\s/g, "").toUpperCase()} />
      </Host>
    );
    fireEvent.blur(field());
    expect(field().value).toBe("WBA12");
  });

  it("does NOT normalize per keystroke — two words stay typeable", () => {
    render(
      <Host>
        <Harness normalize={(text) => text.replace(/\s/g, "")} />
      </Host>
    );
    fireEvent.change(field(), { target: { value: "two words" } });
    expect(field().value).toBe("two words");
  });

  it("draws a code in the token monospace face when asked", () => {
    render(
      <Host>
        <Harness initial="WBA" mono />
      </Host>
    );
    expect(field().style.fontFamily).toContain("Menlo");
    expect(fontFamily.mono).toContain("Menlo");
  });

  it("counts with the caller's own unit when it has one", () => {
    const countOf = vi.fn((value: string) => value.split(" ").length);
    render(
      <Host>
        <CountedInput
          value="one two three"
          onChange={() => undefined}
          maxLength={5}
          countOf={countOf}
          ariaLabel="Words"
        />
      </Host>
    );
    expect(counter().textContent).toBe("3 / 5");
    expect(countOf).toHaveBeenCalled();
  });

  it("links the counter to the field, so it is read with it", () => {
    render(
      <Host>
        <Harness initial="WBA" maxLength={17} />
      </Host>
    );
    expect(field().getAttribute("aria-describedby")).toContain(counter().id);
  });
});
