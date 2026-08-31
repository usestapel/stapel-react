import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Price } from "../src/default/Price.js";
import { CurrencyPicker } from "../src/default/CurrencyPicker.js";
import { RateTable } from "../src/default/RateTable.js";
import { loadReady } from "@stapel/core";
import type { Currency } from "../src/api/types.js";
import { CATALOG, Harness, catalogFetch, setViewport } from "./helpers.js";

const PHONE = 390;
const DESKTOP = 1280;
const rows = CATALOG as unknown as readonly Currency[];

afterEach(() => {
  cleanup();
});

describe("<Price> — the seller's own number is never absent", () => {
  it("renders the original before the catalogue has answered", () => {
    setViewport(PHONE);
    render(
      <Harness>
        <Price amount="1500.00" currency="EUR" displayCurrency="USD" />
      </Harness>
    );
    // No await: this is the FIRST frame, with rates still in flight.
    expect(screen.getByText("€1,500")).toBeTruthy();
  });

  it("adds the estimate once rates land, marked as an estimate", async () => {
    setViewport(PHONE);
    render(
      <Harness>
        <Price amount="1500.00" currency="EUR" displayCurrency="USD" />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-stapel-price="converted"]')).not.toBeNull();
    });
    const converted = document.querySelector('[data-stapel-price="converted"]');
    expect(converted?.textContent).toContain("approx.");
    // 1500 EUR -> 1612.90 USD at 0.93 (through the USD base).
    expect(converted?.textContent).toContain("1,612.90");
  });

  it("says the conversion is unavailable rather than leaving an empty slot", async () => {
    setViewport(PHONE);
    render(
      <Harness fetch={catalogFetch([])}>
        <Price amount="1500.00" currency="EUR" displayCurrency="USD" />
      </Harness>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-stapel-price="unavailable"]')).not.toBeNull();
    });
    // …and the original is still the thing on screen.
    expect(screen.getByText("€1,500")).toBeTruthy();
  });

  it("shows the rate as visible text, never as a title attribute", async () => {
    setViewport(DESKTOP);
    const { container } = render(
      <Harness>
        <Price amount="1500.00" currency="RUB" displayCurrency="USD" showRate />
      </Harness>
    );
    await waitFor(() => {
      expect(container.textContent).toContain("1 RUB =");
    });
    expect(container.querySelectorAll("[title]").length).toBe(0);
  });

  it("formats in the viewer's locale — ru and es, not just en", async () => {
    setViewport(PHONE);
    const ru = render(
      <Harness locale="ru">
        <Price amount="1500.00" currency="RUB" />
      </Harness>
    );
    // ru-RU: space grouping, symbol last — and no `,00` on a whole amount
    // (the `"auto"` fraction policy, `model/money.ts`).
    expect(ru.container.textContent).toMatch(/1\s?500\s?₽/);
    cleanup();
    const es = render(
      <Harness locale="es">
        <Price amount="1500.50" currency="EUR" />
      </Harness>
    );
    // A real fractional amount keeps every place the currency has: comma
    // decimal, symbol last.
    expect(es.container.textContent).toMatch(/1500,50\s?€/);
  });
});

describe("<CurrencyPicker> — the surface follows the viewport", () => {
  it("is a searchable Select on desktop", () => {
    setViewport(DESKTOP);
    render(
      <Harness>
        <CurrencyPicker value="USD" onChange={() => undefined} options={loadReady(rows)} />
      </Harness>
    );
    expect(screen.getByTestId("currencies-picker-select")).toBeTruthy();
  });

  it("is a sheet trigger on a phone, with an accessible name", () => {
    setViewport(PHONE);
    render(
      <Harness>
        <CurrencyPicker value="USD" onChange={() => undefined} options={loadReady(rows)} />
      </Harness>
    );
    const trigger = screen.getByTestId("currencies-picker-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Display currency");
    // The name it shows is the translated one, not the raw display_name KEY.
    expect(trigger.textContent).toContain("US Dollar");
    expect(trigger.textContent).not.toContain("currency.usd");
  });

  it("states WHY it is disabled while the catalogue loads", () => {
    setViewport(PHONE);
    const { container } = render(
      <Harness>
        <CurrencyPicker
          value="USD"
          onChange={() => undefined}
          options={{ status: "loading" }}
        />
      </Harness>
    );
    expect(container.querySelector('[data-stapel-load-state="loading"]')).not.toBeNull();
    expect(container.textContent).toContain("Loading currencies");
  });

  it("says an unconfigured catalogue is empty, not broken", () => {
    setViewport(PHONE);
    const { container } = render(
      <Harness>
        <CurrencyPicker value="USD" onChange={() => undefined} options={loadReady([])} />
      </Harness>
    );
    expect(container.querySelector('[data-stapel-load-state="empty"]')).not.toBeNull();
  });
});

describe("<RateTable>", () => {
  it("formats the stored rate instead of printing the wire's eight zeros", () => {
    setViewport(DESKTOP);
    const { container } = render(
      <Harness>
        <RateTable rates={loadReady(rows)} base="USD" />
      </Harness>
    );
    expect(container.textContent).toContain("92.59");
    expect(container.textContent).not.toContain("92.59000000");
    // The one column the table exists for is right-aligned with tabular
    // figures, or no two decimal points line up.
    const cell = container.querySelector<HTMLElement>(
      "tbody td:last-child span"
    );
    expect(cell?.style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("states a failed read in the pair's own voice, never the server's string", () => {
    setViewport(DESKTOP);
    const { container } = render(
      <Harness>
        <RateTable
          rates={{ status: "failed", error: new Error("Something went wrong") }}
          base="USD"
        />
      </Harness>
    );
    expect(container.textContent).toContain("Currencies could not be loaded.");
    expect(container.textContent).not.toContain("Something went wrong");
  });

  it("draws the shared empty state, not an empty grid", () => {
    setViewport(DESKTOP);
    const { container } = render(
      <Harness>
        <RateTable rates={loadReady([])} base="USD" />
      </Harness>
    );
    expect(container.querySelector("[data-stapel-empty]")).not.toBeNull();
  });

  it("names the base and admits the catalogue carries no update time", () => {
    setViewport(DESKTOP);
    const { container } = render(
      <Harness>
        <RateTable rates={loadReady(rows)} base="USD" />
      </Harness>
    );
    expect(container.textContent).toContain("relative to USD");
    expect(container.textContent).toContain("no update time");
    // display_name resolved, never printed as a key.
    expect(container.textContent).toContain("Russian Ruble");
  });

  it("follows the document theme instead of defaulting to light", () => {
    setViewport(DESKTOP);
    document.documentElement.setAttribute("data-theme", "dark");
    const { container } = render(
      <Harness>
        <RateTable rates={loadReady(rows)} base="USD" />
      </Harness>
    );
    expect(
      container.querySelector('[data-stapel-skin-mode="dark"]')
    ).not.toBeNull();
    document.documentElement.removeAttribute("data-theme");
  });
});
