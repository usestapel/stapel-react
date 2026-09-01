/**
 * `<VocabularyTermSelect/>` — the three claims a screenshot cannot make.
 *
 *  1. A held code is shown as its LABEL, resolved through the seam. This is
 *     the defect the attributes-react screenshots found on the ref editors
 *     (`iphone-15-pro` where the person had chosen "iPhone 15 Pro"); the same
 *     control shipped standalone has to have the same answer.
 *  2. No client is a LOUD state — the notice, not an empty dropdown.
 *  3. Typing DEBOUNCES and SUPERSEDES: one request per pause, and the answer
 *     on screen belongs to the query on screen.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { VocabularyTermSelect } from "../src/default/VocabularyTermSelect.js";
import { registerVocabulariesI18n } from "../src/i18n/keys.js";
import type { VocabularyClient, VocabularyTerm } from "../src/client.js";
import { TERM_SEARCH_DEBOUNCE_MS } from "../src/model/useTermSearch.js";

afterEach(() => {
  vi.useRealTimers();
});

function wrap(node: ReactElement): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerVocabulariesI18n(i18n);
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <I18nProvider i18n={i18n}>{node}</I18nProvider>
    </QueryClientProvider>
  );
}

const TERMS: readonly VocabularyTerm[] = [
  { code: "apple", label: "Apple", has_children: true },
  { code: "samsung", label: "Samsung", has_children: true },
];

function client(overrides: Partial<VocabularyClient> = {}): VocabularyClient {
  return {
    search: () => Promise.resolve(TERMS),
    resolve: (_v, _l, codes) =>
      Promise.resolve(
        Object.fromEntries(
          codes
            .map((code) => [code, TERMS.find((t) => t.code === code)?.label])
            .filter((pair): pair is [string, string] => typeof pair[1] === "string")
        )
      ),
    ...overrides,
  };
}

describe("a held code is shown as its label", () => {
  it("resolves the stored answer through the seam", async () => {
    render(
      wrap(
        <VocabularyTermSelect
          client={client()}
          vocabulary="phone-models"
          level="Vendor"
          value={["apple"]}
        />
      )
    );
    // Before the resolve lands the control shows the code, which is the honest
    // fallback; after it, the word the person actually chose.
    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeTruthy();
    });
  });

  it("keeps showing an unresolvable code rather than emptying itself", async () => {
    render(
      wrap(
        <VocabularyTermSelect
          client={client({ resolve: () => Promise.resolve({}) })}
          vocabulary="phone-models"
          level="Vendor"
          value={["nokia-3310"]}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByText("nokia-3310")).toBeTruthy();
    });
  });
});

describe("no client is a loud state", () => {
  it("draws the notice instead of an empty dropdown", () => {
    render(
      wrap(
        <VocabularyTermSelect client={null} vocabulary="phone-models" level="Vendor" />
      )
    );
    expect(screen.getByTestId("vocabulary-term-select-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("vocabulary-term-select")).toBeNull();
  });

  it("draws it for a pointer with no level, too — an undrawable field either way", () => {
    render(wrap(<VocabularyTermSelect client={client()} vocabulary="v" level="" />));
    expect(screen.getByTestId("vocabulary-term-select-unavailable")).toBeTruthy();
  });
});

describe("typing debounces and supersedes", () => {
  it("asks once per pause, not once per character", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const search = vi.fn<VocabularyClient["search"]>(() => Promise.resolve(TERMS));
    const { container } = render(
      wrap(
        <VocabularyTermSelect
          client={client({ search })}
          vocabulary="phone-models"
          level="Vendor"
        />
      )
    );

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    for (const value of ["a", "ap", "app"]) {
      act(() => {
        // antd's Select drives `onSearch` off this input's change event.
        const setter = Object.getOwnPropertyDescriptor(
          globalThis.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, value);
        (input as HTMLInputElement).dispatchEvent(
          new Event("input", { bubbles: true })
        );
      });
    }
    expect(search).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(TERM_SEARCH_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });

    expect(search).toHaveBeenCalledTimes(1);
    // The one call carries the LAST thing typed, not the first.
    expect(search.mock.calls[0]?.[2]).toBe("app");
  });
});

/**
 * THE LIST NEVER ANSWERS AN OLDER QUERY (defect C23).
 *
 * The suite above proved the debounce and the abort, and both were true while
 * the control was broken: the stale window is not a race between two
 * responses, it is the quarter second of debounce plus a round trip during
 * which the LAST answer is still rendered and still pickable. On the live
 * stand that was 400–640 ms per reference field, and a fast tap in it wrote
 * somebody else's code.
 *
 * So these resolve two requests OUT OF ORDER against a client that ignores
 * `signal` — the honest model of a client this package does not own.
 */
describe("the list answers the query in the box, or it is blank", () => {
  interface Deferred {
    readonly query: string;
    settle: (terms: readonly VocabularyTerm[]) => void;
  }

  function deferred(): { client: VocabularyClient; pending: Deferred[] } {
    const pending: Deferred[] = [];
    return {
      pending,
      client: client({
        search: (_v, _l, query) =>
          new Promise((resolve) => {
            pending.push({
              query,
              settle: (terms) => {
                resolve(terms);
              },
            });
          }),
      }),
    };
  }

  function type(container: HTMLElement, value: string): void {
    const input = container.querySelector("input");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        globalThis.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, value);
      (input as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function control(container: HTMLElement): HTMLElement {
    return container.querySelector(
      '[data-testid="vocabulary-term-select"]'
    ) as HTMLElement;
  }

  it("stops claiming a match on the keystroke, before the request even leaves", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { client: slow, pending } = deferred();
    const { container } = render(
      wrap(
        <VocabularyTermSelect client={slow} vocabulary="phone-models" level="Vendor" />
      )
    );
    type(container, "a");
    await act(async () => {
      vi.advanceTimersByTime(TERM_SEARCH_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });
    await act(async () => {
      pending[0]?.settle(TERMS);
      await Promise.resolve();
    });
    expect(control(container).getAttribute("data-vocabulary-matched")).toBe("true");

    type(container, "sam");
    await act(async () => {
      await Promise.resolve();
    });
    // Nothing has been requested for "sam" yet — this is the window the live
    // measure caught, and the control is already saying it has no answer.
    expect(pending).toHaveLength(1);
    expect(control(container).getAttribute("data-vocabulary-matched")).toBe("false");
    expect(control(container).getAttribute("data-vocabulary-busy")).toBe("true");
  });

  it("drops an older answer that lands after a newer one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { client: slow, pending } = deferred();
    const { container } = render(
      wrap(
        <VocabularyTermSelect client={slow} vocabulary="phone-models" level="Vendor" />
      )
    );
    type(container, "a");
    await act(async () => {
      vi.advanceTimersByTime(TERM_SEARCH_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });
    type(container, "sam");
    await act(async () => {
      vi.advanceTimersByTime(TERM_SEARCH_DEBOUNCE_MS + 10);
      await Promise.resolve();
    });
    expect(pending.map((one) => one.query)).toEqual(["a", "sam"]);

    await act(async () => {
      pending[1]?.settle([{ code: "samsung", label: "Samsung" }]);
      await Promise.resolve();
    });
    expect(control(container).getAttribute("data-vocabulary-matched")).toBe("true");

    // The client never abandoned the first request, so it answers last.
    await act(async () => {
      pending[0]?.settle(TERMS);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(control(container).getAttribute("data-vocabulary-matched")).toBe("true");
    });
    // "Apple" belonged to "a" and must not be on screen for "sam".
    expect(screen.queryByTitle("Apple")).toBeNull();
  });
});
