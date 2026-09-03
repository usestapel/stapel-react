// @vitest-environment jsdom
/**
 * `ChoiceChips` — the selection semantics (which are the whole component),
 * the 44px phone floor, and the rule that a chip which cannot be chosen says
 * why in text that a person and a screen reader both reach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { ChoiceChips } from "../src/skin.js";
import type { ChoiceChipOption } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

const OPTIONS: readonly ChoiceChipOption[] = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "parts", label: "For parts" },
];

function chip(value: string): HTMLButtonElement {
  const element = document.querySelector(`[data-stapel-chip="${value}"]`);
  if (element === null) throw new Error(`no chip for ${value}`);
  return element as HTMLButtonElement;
}

describe("ChoiceChips — single", () => {
  it("a tap answers, and the chosen chip is pressed", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} value="used" onChange={onChange} />
      </Host>
    );
    expect(chip("used").getAttribute("aria-pressed")).toBe("true");
    expect(chip("new").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("new"));
    expect(onChange).toHaveBeenCalledWith("new");
  });

  it("tapping the chosen chip again does nothing unless clearing is offered", () => {
    setViewport(390);
    const onChange = vi.fn();
    const { rerender } = render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} value="used" onChange={onChange} />
      </Host>
    );
    fireEvent.click(chip("used"));
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <Host>
        <ChoiceChips mode="single" allowClear options={OPTIONS} value="used" onChange={onChange} />
      </Host>
    );
    fireEvent.click(chip("used"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("ChoiceChips — multi", () => {
  it("toggles a value in and out, leaving the rest alone", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <ChoiceChips mode="multi" options={OPTIONS} values={["new"]} onChange={onChange} />
      </Host>
    );
    fireEvent.click(chip("parts"));
    expect(onChange).toHaveBeenLastCalledWith(["new", "parts"]);
    fireEvent.click(chip("new"));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe("ChoiceChips — the shape of the row", () => {
  it("is a 44px touch target on a phone", () => {
    setViewport(390);
    render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} onChange={() => undefined} />
      </Host>
    );
    expect(chip("new").style.minHeight).toBe("44px");
  });

  it("is antd's control height above the phone breakpoint", () => {
    setViewport(breakpoints.tablet);
    render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} onChange={() => undefined} />
      </Host>
    );
    expect(chip("new").style.minHeight).not.toBe("44px");
  });

  it("never truncates a label: it wraps instead", () => {
    setViewport(390);
    render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} onChange={() => undefined} />
      </Host>
    );
    expect(chip("parts").style.whiteSpace).toBe("normal");
    expect(chip("parts").style.textOverflow).toBe("");
  });

  it("stamps the layout it was asked for", () => {
    setViewport(390);
    render(
      <Host>
        <ChoiceChips
          mode="multi"
          columns="grid"
          options={OPTIONS}
          values={[]}
          onChange={() => undefined}
          testId="body-types"
        />
      </Host>
    );
    const root = screen.getByTestId("body-types");
    expect(root.dataset["stapelChoiceChips"]).toBe("multi");
    expect(root.dataset["stapelChipsColumns"]).toBe("grid");
  });
});

describe("ChoiceChips — a chip that cannot be chosen says why", () => {
  const BLOCKED: readonly ChoiceChipOption[] = [
    { value: "new", label: "New" },
    { value: "used", label: "Used", disabled: true, disabledReason: "Not sold in this region." },
    { value: "parts", label: "For parts", disabled: true, disabledReason: "Not sold in this region." },
  ];

  it("renders the reason as visible text, once per distinct sentence", () => {
    setViewport(390);
    render(
      <Host>
        <ChoiceChips mode="single" options={BLOCKED} onChange={() => undefined} />
      </Host>
    );
    expect(screen.getAllByText("Not sold in this region.")).toHaveLength(1);
  });

  it("points both blocked chips at that one copy, and refuses their taps", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <ChoiceChips mode="single" options={BLOCKED} onChange={onChange} />
      </Host>
    );
    const reason = screen.getByText("Not sold in this region.");
    expect(chip("used").getAttribute("aria-describedby")).toBe(reason.id);
    expect(chip("parts").getAttribute("aria-describedby")).toBe(reason.id);
    // `aria-disabled` and alive — the chip has to keep firing for the
    // sentence it points at to reach a keyboard. The TAP is what is refused.
    expect(chip("used").getAttribute("aria-disabled")).toBe("true");
    expect(chip("used").disabled).toBe(false);
    chip("used").focus();
    expect(document.activeElement).toBe(chip("used"));
    fireEvent.click(chip("used"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("draws no reason block when nothing is blocked", () => {
    setViewport(390);
    render(
      <Host>
        <ChoiceChips mode="single" options={OPTIONS} onChange={() => undefined} testId="plain" />
      </Host>
    );
    expect(screen.getByTestId("plain").querySelector("[data-stapel-chip-reasons]")).toBeNull();
  });

  it("puts the caller's id on the first chip — the group's focus target", () => {
    render(
      <Host>
        <ChoiceChips
          mode="single"
          id="field-condition"
          ariaLabel="Condition"
          options={[
            { value: "new", label: "New" },
            { value: "used", label: "Used" },
          ]}
          value={undefined}
          onChange={() => undefined}
        />
      </Host>
    );
    const first = document.getElementById("field-condition");
    expect(first?.tagName).toBe("BUTTON");
    expect(first?.getAttribute("data-stapel-chip")).toBe("new");
    (first as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(first);
  });
});
