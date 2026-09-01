// @vitest-environment jsdom
/**
 * `SkinPickerSheet` — the four states a dropdown never modelled (loading, a
 * stale list, empty, capped), the two commit shapes (a single choice answers
 * and closes; a multi draft commits on a counted button), and the surface
 * rule it inherits from `SkinDialog`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { PICKER_DONE_TESTID, PICKER_SEARCH_TESTID, SkinPickerSheet } from "../src/skin.js";
import type { PickerOption } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

const OPTIONS: readonly PickerOption[] = [
  { value: "bmw", label: "BMW" },
  { value: "audi", label: "Audi" },
  { value: "kia", label: "Kia" },
];

function row(value: string): HTMLButtonElement {
  const element = document.querySelector(`[data-stapel-picker-row="${value}"]`);
  if (element === null) throw new Error(`no row for ${value}`);
  return element as HTMLButtonElement;
}

function list(): HTMLElement {
  const element = document.querySelector("[data-stapel-picker-list]");
  if (element === null) throw new Error("no list");
  return element as HTMLElement;
}

describe("SkinPickerSheet — the surface", () => {
  it("is a bottom sheet on a phone and a modal above the breakpoint", () => {
    setViewport(390);
    const { rerender } = render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={OPTIONS}
          title="Make"
          testId="make"
        />
      </Host>
    );
    expect(screen.getByTestId("make").dataset["stapelDialogSurface"]).toBe("sheet");
    setViewport(breakpoints.tablet);
    rerender(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={OPTIONS}
          title="Make"
          testId="make"
        />
      </Host>
    );
    expect(screen.getByTestId("make").dataset["stapelDialogSurface"]).toBe("modal");
  });
});

describe("SkinPickerSheet — single", () => {
  it("answers and closes on one tap", () => {
    setViewport(390);
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={onClose}
          onChange={onChange}
          options={OPTIONS}
          value="audi"
        />
      </Host>
    );
    expect(row("audi").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(row("kia"));
    expect(onChange).toHaveBeenCalledWith("kia");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no commit button — the tap was the commit", () => {
    setViewport(390);
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={OPTIONS}
        />
      </Host>
    );
    expect(screen.queryByTestId(PICKER_DONE_TESTID)).toBeNull();
  });
});

describe("SkinPickerSheet — multi", () => {
  it("holds a draft and commits it once, with the count on the button", () => {
    setViewport(390);
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="multi"
          open
          onClose={onClose}
          onChange={onChange}
          options={OPTIONS}
          values={["bmw"]}
          doneLabel="Done"
        />
      </Host>
    );
    expect(screen.getByTestId(PICKER_DONE_TESTID).textContent).toBe("Done · 1");
    fireEvent.click(row("kia"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId(PICKER_DONE_TESTID).textContent).toBe("Done · 2");
    fireEvent.click(screen.getByTestId(PICKER_DONE_TESTID));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["bmw", "kia"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is honest at zero: no count, and committing an empty draft is allowed", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="multi"
          open
          onClose={() => undefined}
          onChange={onChange}
          options={OPTIONS}
          values={[]}
          doneLabel="Done"
        />
      </Host>
    );
    const done = screen.getByTestId(PICKER_DONE_TESTID);
    expect(done.textContent).toBe("Done");
    expect((done as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(done);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("unticking is a draft edit, not a commit", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="multi"
          open
          onClose={() => undefined}
          onChange={onChange}
          options={OPTIONS}
          values={["bmw", "kia"]}
          doneLabel="Done"
        />
      </Host>
    );
    fireEvent.click(row("bmw"));
    expect(row("bmw").getAttribute("aria-checked")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(PICKER_DONE_TESTID));
    expect(onChange).toHaveBeenCalledWith(["kia"]);
  });
});

describe("SkinPickerSheet — search", () => {
  it("filters locally when nobody else is answering the query", () => {
    setViewport(390);
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={OPTIONS}
          searchPlaceholder="Search"
        />
      </Host>
    );
    fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: "au" } });
    expect(document.querySelector('[data-stapel-picker-row="audi"]')).not.toBeNull();
    expect(document.querySelector('[data-stapel-picker-row="bmw"]')).toBeNull();
  });

  it("does NOT filter a controlled list — the caller's answer is the answer", () => {
    setViewport(390);
    const onSearchChange = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={OPTIONS}
          searchValue="au"
          onSearchChange={onSearchChange}
          searchPlaceholder="Search"
        />
      </Host>
    );
    expect(document.querySelector('[data-stapel-picker-row="bmw"]')).not.toBeNull();
    fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: "aud" } });
    expect(onSearchChange).toHaveBeenCalledWith("aud");
  });
});

describe("SkinPickerSheet — the states a dropdown never had", () => {
  it("a stale list is dimmed AND inert, and says so on the element", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          listStale
          onClose={() => undefined}
          onChange={onChange}
          options={OPTIONS}
        />
      </Host>
    );
    expect(list().dataset["stapelPickerList"]).toBe("stale");
    expect(list().style.pointerEvents).toBe("none");
    expect(row("kia").disabled).toBe(true);
    fireEvent.click(row("kia"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("loading draws a skeleton and does NOT block the commit", () => {
    setViewport(390);
    const onChange = vi.fn();
    render(
      <Host>
        <SkinPickerSheet
          mode="multi"
          open
          loading
          onClose={() => undefined}
          onChange={onChange}
          options={OPTIONS}
          values={["bmw"]}
          doneLabel="Done"
        />
      </Host>
    );
    expect(document.querySelector("[data-stapel-picker-loading]")).not.toBeNull();
    expect(document.querySelector("[data-stapel-picker-list]")).toBeNull();
    const done = screen.getByTestId(PICKER_DONE_TESTID);
    expect((done as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(done);
    expect(onChange).toHaveBeenCalledWith(["bmw"]);
  });

  it("empty is a sentence the caller owns, not an empty list", () => {
    setViewport(390);
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={[]}
          emptyLabel="No makes match that."
        />
      </Host>
    );
    expect(screen.getByText("No makes match that.")).toBeTruthy();
  });

  it("caps the rows it draws and says the list was cut", () => {
    setViewport(390);
    const many: readonly PickerOption[] = Array.from({ length: 260 }, (_, index) => ({
      value: `code-${String(index)}`,
      label: `Term ${String(index)}`,
    }));
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          options={many}
          maxRows={200}
          refineLabel="Keep typing to narrow this down."
        />
      </Host>
    );
    expect(document.querySelectorAll("[data-stapel-picker-row]")).toHaveLength(200);
    expect(screen.getByText("Keep typing to narrow this down.")).toBeTruthy();
  });
});

describe("SkinPickerSheet — groups", () => {
  it("draws a group heading, and skips a group with nothing in it", () => {
    setViewport(390);
    render(
      <Host>
        <SkinPickerSheet
          mode="single"
          open
          onClose={() => undefined}
          onChange={() => undefined}
          groups={[
            { key: "recent", label: "Recent", options: [{ value: "kia", label: "Kia" }] },
            { key: "empty", label: "Nothing", options: [] },
            { key: "all", label: "All", options: OPTIONS },
          ]}
        />
      </Host>
    );
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.queryByText("Nothing")).toBeNull();
    expect(document.querySelectorAll('[data-stapel-picker-row="kia"]')).toHaveLength(2);
  });
});
