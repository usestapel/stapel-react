/**
 * `<VocabularyTermPicker/>` — the claims a screenshot of the field cannot make.
 *
 *  1. The trigger says the WORD, resolved through the seam, and falls back to
 *     the stored code rather than to nothing.
 *  2. A tap in the sheet answers with a LIST of codes — the wire shape, in
 *     single-select too — and remembers what was picked.
 *  3. A list that does not answer the search box is dimmed AND inert (defect
 *     C23), recents included.
 *  4. The multi footer carries the count it is about to commit, and commits
 *     once.
 *  5. A remembered code the vocabulary can no longer name is dropped from the
 *     Recent section instead of appearing as a slug.
 *  6. No client is a loud notice, not a field that opens an empty sheet.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  I18nProvider,
  createI18n,
  memoryStorage,
  recentsStorageKey,
} from "@stapel/core";
import type { PersistStorage } from "@stapel/core";
import { PICKER_DONE_TESTID } from "@stapel/tokens-antd/skin";
import {
  VocabularyTermPicker,
  termRecentsScope,
} from "../src/default/VocabularyTermPicker.js";
import { registerVocabulariesI18n } from "../src/i18n/keys.js";
import type { VocabularyClient, VocabularyTerm } from "../src/client.js";

const VOCABULARY = "phone-models";
const LEVEL = "Vendor";
const SCOPE = termRecentsScope(VOCABULARY, LEVEL);

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
  { code: "google", label: "Google", has_children: true },
];

function client(overrides: Partial<VocabularyClient> = {}): VocabularyClient {
  return {
    search: () => Promise.resolve(TERMS),
    resolve: (_v, _l, codes) =>
      Promise.resolve(
        Object.fromEntries(
          codes
            .map((code) => [code, TERMS.find((term) => term.code === code)?.label])
            .filter((pair): pair is [string, string] => typeof pair[1] === "string")
        )
      ),
    ...overrides,
  };
}

/** Recents seeded the way a host's storage would already hold them. */
function seeded(codes: readonly string[]): PersistStorage {
  const storage = memoryStorage();
  void storage.set(recentsStorageKey(SCOPE), [...codes]);
  return storage;
}

function trigger(): HTMLElement {
  return screen.getByTestId("vocabulary-term-picker");
}

function row(value: string): HTMLButtonElement | null {
  return document.querySelector(`[data-stapel-picker-row="${value}"]`);
}

function list(): HTMLElement | null {
  return document.querySelector("[data-stapel-picker-list]");
}

describe("the trigger says what is chosen", () => {
  it("resolves a held code to its label", async () => {
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          value={["apple"]}
          recentsStorage={memoryStorage()}
        />
      )
    );
    await waitFor(() => {
      expect(trigger().textContent).toBe("Apple");
    });
  });

  it("shows an unresolvable code rather than emptying the field", async () => {
    render(
      wrap(
        <VocabularyTermPicker
          client={client({ resolve: () => Promise.resolve({}) })}
          vocabulary={VOCABULARY}
          level={LEVEL}
          value={["nokia-3310"]}
          recentsStorage={memoryStorage()}
        />
      )
    );
    await waitFor(() => {
      expect(trigger().textContent).toBe("nokia-3310");
    });
  });

  it("counts instead of listing once there is more than one", async () => {
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          multiple
          value={["apple", "samsung"]}
          recentsStorage={memoryStorage()}
        />
      )
    );
    await waitFor(() => {
      expect(trigger().textContent).toBe("2 chosen");
    });
  });
});

describe("the sheet answers with a list of codes", () => {
  it("opens on the trigger, fetches the first page, and commits one tap", async () => {
    const onChange = vi.fn();
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          onChange={onChange}
          surface="sheet"
          recentsStorage={memoryStorage()}
        />
      )
    );
    expect(screen.queryByTestId("vocabulary-term-picker-sheet")).toBeNull();
    fireEvent.click(trigger());
    await waitFor(() => {
      expect(row("samsung")).not.toBeNull();
    });
    fireEvent.click(row("samsung") as HTMLButtonElement);
    // A LIST, in single-select too: a term value is a list on the wire.
    expect(onChange).toHaveBeenCalledWith(["samsung"]);
    await waitFor(() => {
      expect(screen.queryByTestId("vocabulary-term-picker-sheet")).toBeNull();
    });
  });

  it("remembers the pick, most recent first, and offers it back on top", async () => {
    const storage = seeded(["google"]);
    const { unmount } = render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          onChange={() => undefined}
          surface="sheet"
          recentsStorage={storage}
        />
      )
    );
    fireEvent.click(trigger());
    await waitFor(() => {
      expect(row("samsung")).not.toBeNull();
    });
    fireEvent.click(row("samsung") as HTMLButtonElement);
    await waitFor(async () => {
      expect(await storage.get(recentsStorageKey(SCOPE))).toEqual([
        "samsung",
        "google",
      ]);
    });
    unmount();

    // A second mount reads the same storage: the section is the history, with
    // the labels resolved through the seam.
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          open
          surface="sheet"
          recentsStorage={storage}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByText("Recent")).toBeTruthy();
    });
  });

  it("drops a remembered code the vocabulary can no longer name", async () => {
    const storage = seeded(["nokia-3310", "samsung"]);
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          open
          surface="sheet"
          recentsStorage={storage}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByText("Recent")).toBeTruthy();
    });
    // The Recent section carries Samsung; the retired code is nowhere — not as
    // a row, not as a slug.
    expect(screen.queryByText("nokia-3310")).toBeNull();
  });
});

describe("a list that does not answer the box is not tappable", () => {
  it("dims the recents and refuses the tap while the page is in flight", async () => {
    const onChange = vi.fn();
    const storage = seeded(["samsung"]);
    render(
      wrap(
        <VocabularyTermPicker
          client={client({ search: () => new Promise<never>(() => undefined) })}
          vocabulary={VOCABULARY}
          level={LEVEL}
          onChange={onChange}
          open
          surface="sheet"
          recentsStorage={storage}
        />
      )
    );
    await waitFor(() => {
      expect(row("samsung")).not.toBeNull();
    });
    expect(list()?.getAttribute("data-stapel-picker-list")).toBe("stale");
    const stale = row("samsung") as HTMLButtonElement;
    expect(stale.disabled).toBe(true);
    fireEvent.click(stale);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("the multi footer carries the count it commits", () => {
  it("counts the draft and commits it once", async () => {
    const onChange = vi.fn();
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level={LEVEL}
          multiple
          value={["apple", "samsung"]}
          onChange={onChange}
          open
          surface="sheet"
          recentsStorage={memoryStorage()}
        />
      )
    );
    await waitFor(() => {
      expect(row("google")).not.toBeNull();
    });
    expect(screen.getByTestId(PICKER_DONE_TESTID).textContent).toBe("Done · 2");
    fireEvent.click(row("google") as HTMLButtonElement);
    expect(screen.getByTestId(PICKER_DONE_TESTID).textContent).toBe("Done · 3");
    // Ticking a row is a draft, not an answer.
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(PICKER_DONE_TESTID));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["apple", "samsung", "google"]);
  });
});

describe("no client is a loud state", () => {
  it("draws the notice instead of a field that opens nothing", () => {
    render(
      wrap(
        <VocabularyTermPicker
          client={null}
          vocabulary={VOCABULARY}
          level={LEVEL}
          recentsStorage={memoryStorage()}
        />
      )
    );
    expect(screen.getByTestId("vocabulary-term-picker-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("vocabulary-term-picker")).toBeNull();
  });

  it("draws it for a pointer with no level, too", () => {
    render(
      wrap(
        <VocabularyTermPicker
          client={client()}
          vocabulary={VOCABULARY}
          level=""
          recentsStorage={memoryStorage()}
        />
      )
    );
    expect(screen.getByTestId("vocabulary-term-picker-unavailable")).toBeTruthy();
  });
});
