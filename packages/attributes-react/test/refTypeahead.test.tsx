/**
 * THE REFERENCE TYPEAHEAD NEVER SHOWS A LIST THAT ANSWERS AN OLDER QUERY
 * (defect C23).
 *
 * Measured on the live stand, on both seller flows, on every reference field
 * of the phone category:
 *
 * ```
 * Vendor 621/635 ms · Model 416/421 ms · RAM 631/639 ms
 * ```
 *
 * — the time for which the dropdown kept the PREVIOUS query's terms on screen,
 * all of them pickable. A person who types three letters and taps the first
 * row (which is what people do) wrote somebody else's code into the attribute
 * with nothing on screen saying so: a night run published `vendor=3q,
 * model=qoo-s` for a listing the seller had typed as Apple / iPhone 13.
 *
 * ── Why the old suite passed on a broken control ──────────────────────────
 *
 * `vocabulary.test.tsx` already asserted that typing debounces and that the
 * previous request is ABORTED. Both were true and neither was the defect: the
 * stale window is not a race between two responses, it is the quarter second
 * of debounce plus a round trip during which the last ANSWER is still rendered
 * and still pickable. A test that only ever resolves one request in order
 * cannot see it.
 *
 * So every case below either advances the clock a keystroke at a time, or
 * resolves two requests OUT OF ORDER against a client that ignores `signal` —
 * which is the honest model of a client the seam does not own.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { VocabularyClientProvider } from "../src/index.js";
import type { VocabularyClient, VocabularyTerm } from "../src/index.js";
import { renderDemoVariant, runDemoPlay } from "@stapel/showcase";
import { PICKER_SEARCH_TESTID } from "@stapel/tokens-antd/skin";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { FeatureFields } from "../src/default/FeatureFields.js";
import { REF_SELECT_FEATURE } from "./fixtures.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const APPLE: readonly VocabularyTerm[] = [{ code: "apple", label: "Apple" }];
const SAMSUNG: readonly VocabularyTerm[] = [{ code: "samsung", label: "Samsung" }];

interface Deferred {
  readonly query: string;
  resolve(terms: readonly VocabularyTerm[]): void;
  reject(): void;
}

/**
 * A client that answers when the TEST says so, and that deliberately ignores
 * `signal`.
 *
 * Both halves matter. Answering on demand is what lets a case resolve "a"
 * after "sam"; ignoring the abort is what makes the case a real one — the
 * seam's contract asks an implementation to honour the signal and this package
 * cannot enforce it, so correctness may not rest on it.
 */
function deferredClient(): {
  client: VocabularyClient;
  pending: Deferred[];
} {
  const pending: Deferred[] = [];
  const client: VocabularyClient = {
    search: (_vocabulary, _level, query) =>
      new Promise((resolve, reject) => {
        pending.push({
          query,
          resolve: (terms) => {
            resolve(terms);
          },
          reject: () => {
            reject(new Error("boom"));
          },
        });
      }),
    resolve: async () => ({}),
  };
  return { client, pending };
}

function mount(
  client: VocabularyClient,
  values: Readonly<Record<string, unknown>> = {},
  onChange: (slug: string, value: unknown) => void = () => undefined
): void {
  const i18n = createI18n({ locale: "en" });
  registerAttributesI18n(i18n);
  const tree: ReactElement = (
    <I18nProvider i18n={i18n}>
      <VocabularyClientProvider value={client}>
        <FeatureFields
          features={[REF_SELECT_FEATURE]}
          values={values}
          onChange={onChange}
        />
      </VocabularyClientProvider>
    </I18nProvider>
  );
  render(tree);
}

/** The control's own verdict on whether the list answers the box. */
function matched(): string | null {
  return screen
    .getByTestId("attributes-ref-select")
    .getAttribute("data-vocabulary-matched");
}

/**
 * What the SHEET offers, as `label:disabled` pairs.
 *
 * The rows are the picker's own (`data-stapel-picker-row`), and a stale list
 * is not read off the nodes but off the two facts the substrate stamps: the
 * list's `data-stapel-picker-list="stale"` and each row's `disabled`. That
 * matters here more than anywhere: the defect is a row that LOOKS pickable,
 * so the test has to ask whether it can be pressed rather than whether it is
 * on screen.
 */
function offered(): readonly string[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-stapel-picker-row]")
  ).map((node) => `${node.textContent ?? ""}:${node.disabled ? "true" : "false"}`);
}

/** The sheet's row for a term, or `null` when nothing on screen offers it. */
function row(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-stapel-picker-row]")
    ).find((node) => (node.textContent ?? "").includes(label)) ?? null
  );
}

/** Tap the field, which is what opens the sheet and asks for the first page. */
function openSheet(): void {
  fireEvent.click(screen.getByTestId("attributes-ref-trigger"));
}

/** Type into the sheet's search box. */
function type(query: string): void {
  fireEvent.change(screen.getByTestId(PICKER_SEARCH_TESTID), { target: { value: query } });
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the list is blank, not stale, while a newer query is in flight", () => {
  it("drops the answered list on the KEYSTROKE, a quarter second before the request leaves", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    mount(client);

    // Open, answer the first page: the list is an answer to "".
    openSheet();
    await act(async () => {
      pending[0]?.resolve(APPLE);
      await Promise.resolve();
    });
    expect(matched()).toBe("true");
    expect(row("Apple")).not.toBeNull();

    // One keystroke. Nothing has been requested yet — the debounce has not
    // fired — and this is exactly the window the live measure caught: 250 ms
    // of a list that answers a question nobody is asking any more.
    type("sam");
    await settle();
    expect(pending).toHaveLength(1);
    expect(matched()).toBe("false");
    expect(offered()).toEqual([]);
  });

  it("keeps the list blank across the request, and fills it when the answer for THIS query lands", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    mount(client);
    openSheet();
    await act(async () => {
      pending[0]?.resolve(APPLE);
      await Promise.resolve();
    });

    type("sam");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    // In flight: still nothing pickable.
    expect(pending).toHaveLength(2);
    expect(pending[1]?.query).toBe("sam");
    expect(matched()).toBe("false");
    expect(offered()).toEqual([]);

    await act(async () => {
      pending[1]?.resolve(SAMSUNG);
      await Promise.resolve();
    });
    expect(matched()).toBe("true");
    expect(offered()).toEqual(["Samsung:false"]);
  });

  it("answers a failed search with an empty list rather than the last good one", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    mount(client);
    openSheet();
    await act(async () => {
      pending[0]?.resolve(APPLE);
      await Promise.resolve();
    });

    type("sam");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      pending[1]?.reject();
      await Promise.resolve();
    });
    // The query IS answered — with nothing — so the control stops claiming to
    // be busy, and the previous query's terms are not on screen to be tapped.
    expect(matched()).toBe("true");
    expect(offered()).toEqual([]);
  });
});

describe("a response is dropped unless its query is the one in the box", () => {
  it("ignores an older answer that lands AFTER a newer one, with a client that ignores the signal", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    mount(client);

    openSheet();
    await act(async () => {
      pending[0]?.resolve([]);
      await Promise.resolve();
    });

    type("a");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    type("sam");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(pending.map((one) => one.query)).toEqual(["", "a", "sam"]);

    // The network does not promise order: the newer answer arrives first…
    await act(async () => {
      pending[2]?.resolve(SAMSUNG);
      await Promise.resolve();
    });
    expect(row("Samsung")).not.toBeNull();

    // …and the older one, which the client never abandoned, arrives after it.
    // Before this fix it overwrote the list with the answer to "a" and left
    // the control claiming to be answered.
    await act(async () => {
      pending[1]?.resolve(APPLE);
      await Promise.resolve();
    });
    expect(matched()).toBe("true");
    expect(offered()).toEqual(["Samsung:false"]);
  });

  it("still aborts the superseded request — the drop is belt, the abort is braces", async () => {
    vi.useFakeTimers();
    const search = vi.fn<VocabularyClient["search"]>(async () => APPLE);
    const client: VocabularyClient = { search, resolve: async () => ({}) };
    mount(client);
    openSheet();
    await settle();
    type("a");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    type("sam");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const signalFor = (query: string): AbortSignal =>
      search.mock.calls.find((call) => call[2] === query)?.[4] as AbortSignal;
    expect(signalFor("a").aborted).toBe(true);
    expect(signalFor("sam").aborted).toBe(false);
  });
});

describe("nothing on screen can be picked until it answers the box", () => {
  it("disables the held row a reopened draft keeps in the list", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    const onChange = vi.fn();
    mount(client, { vendor: ["apple"] }, onChange);

    openSheet();
    await act(async () => {
      pending[0]?.resolve([]);
      await Promise.resolve();
    });
    // Answered: the held code stands in for its label and IS pickable.
    expect(matched()).toBe("true");
    expect(row("apple")?.disabled).toBe(false);

    type("sam");
    await settle();
    // The whole sheet is now the held row, and it is inert: the list is not an
    // answer to "sam" and a tap must not be able to commit anything from it.
    // Both halves of the substrate's stale state are asserted — the list says
    // so, and the row cannot be pressed.
    expect(matched()).toBe("false");
    expect(
      document.querySelector("[data-stapel-picker-list]")?.getAttribute(
        "data-stapel-picker-list"
      )
    ).toBe("stale");
    expect(row("apple")?.disabled).toBe(true);

    fireEvent.click(row("apple") as HTMLElement);
    await settle();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("what the person sees while it is thinking", () => {
  it("marks the control busy for the whole stale window, not only the request", async () => {
    vi.useFakeTimers();
    const { client, pending } = deferredClient();
    mount(client);
    openSheet();
    await act(async () => {
      pending[0]?.resolve(APPLE);
      await Promise.resolve();
    });
    const control = (): HTMLElement => screen.getByTestId("attributes-ref-select");
    expect(control().getAttribute("data-vocabulary-busy")).toBe("false");

    type("sam");
    await settle();
    // Busy from the keystroke — including the 250 ms before the request even
    // leaves, which is where most of the measured window lived.
    expect(control().getAttribute("data-vocabulary-busy")).toBe("true");

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(control().getAttribute("data-vocabulary-busy")).toBe("true");
    await act(async () => {
      pending[1]?.resolve(SAMSUNG);
      await Promise.resolve();
    });
    expect(control().getAttribute("data-vocabulary-busy")).toBe("false");
  });
});

describe("the demo variant that photographs the stale window", () => {
  it("really reaches the in-flight state, so the strict skin gate has something to shoot", async () => {
    // `assertVariantsRenderDistinctly` deliberately SKIPS a variant with a
    // `play` step (its first frame is legitimately a sibling's), so without
    // this the demo could quietly stop reaching the state it is named for and
    // the gate would photograph an idle dropdown for ever.
    const demo = (await import("../demo/FeatureFields.demo.js")).default;
    const variant = "ref-select — waiting for the wire";
    const { container } = render(renderDemoVariant(demo, variant));
    await act(async () => {
      await runDemoPlay(demo, variant, container);
    });
    const control = container.querySelector('[data-testid="attributes-ref-select"]');
    expect(control?.getAttribute("data-vocabulary-matched")).toBe("false");
    expect(control?.getAttribute("data-vocabulary-busy")).toBe("true");
  });
});
