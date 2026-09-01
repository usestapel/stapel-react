// @vitest-environment jsdom
/**
 * `SkinNumberField` — the three promises: the numeric keypad, the unit that
 * is never part of the value, and NO silent clamping (the reason this is not
 * antd's `InputNumber`). Plus the half-typed decimal, which is the one bug
 * every hand-rolled numeric field ships with.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkinNumberField, parseNumericText } from "../src/skin.js";
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

describe("parseNumericText", () => {
  it("reads what a person can plausibly type or paste", () => {
    expect(parseNumericText("120")).toBe(120);
    expect(parseNumericText("1,5")).toBe(1.5);
    expect(parseNumericText("1 250")).toBe(1250);
    expect(parseNumericText("-3.25")).toBe(-3.25);
  });

  it("calls an unfinished number the absence of a value, not zero", () => {
    expect(parseNumericText("")).toBeUndefined();
    expect(parseNumericText("-")).toBeUndefined();
    expect(parseNumericText(".")).toBeUndefined();
    expect(parseNumericText("abc")).toBeUndefined();
  });
});

describe("SkinNumberField", () => {
  it("asks for the numeric keypad on an integer field and the decimal one otherwise", () => {
    const { rerender } = render(
      <Host>
        <SkinNumberField integer onValueChange={() => undefined} ariaLabel="Year" />
      </Host>
    );
    expect(field().inputMode).toBe("numeric");
    rerender(
      <Host>
        <SkinNumberField onValueChange={() => undefined} ariaLabel="Weight" />
      </Host>
    );
    expect(field().inputMode).toBe("decimal");
  });

  it("emits the parsed number as it is typed", () => {
    const onValueChange = vi.fn();
    render(
      <Host>
        <SkinNumberField onValueChange={onValueChange} ariaLabel="Weight" />
      </Host>
    );
    fireEvent.change(field(), { target: { value: "12" } });
    expect(onValueChange).toHaveBeenLastCalledWith(12);
    fireEvent.change(field(), { target: { value: "" } });
    expect(onValueChange).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps a half-typed decimal: `1.` does not snap back to `1`", () => {
    function Controlled(): ReactElement {
      const [value, setValue] = useState<number | undefined>(undefined);
      return <SkinNumberField value={value} onValueChange={setValue} ariaLabel="Weight" />;
    }
    render(
      <Host>
        <Controlled />
      </Host>
    );
    fireEvent.change(field(), { target: { value: "1." } });
    expect(field().value).toBe("1.");
    fireEvent.change(field(), { target: { value: "1.5" } });
    expect(field().value).toBe("1.5");
  });

  it("NEVER clamps: a value past the stated range is kept and reported", () => {
    const onValueChange = vi.fn();
    render(
      <Host>
        <SkinNumberField
          integer
          hintPlaceholder="20-500"
          onValueChange={onValueChange}
          ariaLabel="Volume"
        />
      </Host>
    );
    fireEvent.change(field(), { target: { value: "9000" } });
    expect(field().value).toBe("9000");
    expect(onValueChange).toHaveBeenLastCalledWith(9000);
  });

  it("shows the range as the placeholder, and the unit as a suffix outside the value", () => {
    render(
      <Host>
        <SkinNumberField
          value={120}
          unit="km"
          hintPlaceholder="20-500"
          onValueChange={() => undefined}
          ariaLabel="Range"
        />
      </Host>
    );
    expect(field().placeholder).toBe("20-500");
    expect(field().value).toBe("120");
    expect(screen.getByText("km")).toBeTruthy();
  });

  it("takes a new value from outside, but only when it disagrees with the text", () => {
    const { rerender } = render(
      <Host>
        <SkinNumberField value={5} onValueChange={() => undefined} ariaLabel="Weight" />
      </Host>
    );
    expect(field().value).toBe("5");
    rerender(
      <Host>
        <SkinNumberField value={9} onValueChange={() => undefined} ariaLabel="Weight" />
      </Host>
    );
    expect(field().value).toBe("9");
  });

  it("renders the caller's refusal under the field and links it to the input", () => {
    render(
      <Host>
        <SkinNumberField
          value={9000}
          status="error"
          errorText="Between 20 and 500."
          onValueChange={() => undefined}
          ariaLabel="Volume"
        />
      </Host>
    );
    const message = screen.getByText("Between 20 and 500.");
    expect(field().getAttribute("aria-describedby")).toBe(message.id);
  });
});
