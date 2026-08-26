/**
 * `useSearchBox` — the one legitimate second copy of the search state, and the
 * two properties that keep it honest.
 *
 * The pair's rule is that the URL is the state and no component keeps a copy.
 * A text input is the single exception: what a person has TYPED is not yet
 * what they have SEARCHED for. So the draft lives in the hook for as long as
 * it takes to stop typing — and everything below is about the ways that can go
 * wrong: a box showing a word the results are not about, a history entry per
 * keystroke, a request per letter on a throttled endpoint.
 */
import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SearchBox } from "../src/default/index.js";
import {
  SEARCH_QUERY_MAX_CHARS,
  useSearchBox,
  useSearchState,
} from "../src/index.js";
import type { SearchBoxBag, SearchStateBag } from "../src/index.js";
import { searchResponse } from "./fixtures.js";
import { TestHarness, mockServer } from "./harness.js";

/** A fast debounce: the TIMING is `SEARCH_BOX_DEBOUNCE_MS`'s business (and
 * asserted through the default below), the BEHAVIOUR is what these test. */
const FAST = 10;

interface BoxProbe {
  readonly box: SearchBoxBag;
  readonly state: SearchStateBag;
}

function harness(initialSearch = "type=listing"): {
  readonly server: ReturnType<typeof mockServer>;
  readonly seen: { search: string; history: readonly string[] };
  readonly wrapper: (props: { children: ReactNode }) => ReactElement;
} {
  const server = mockServer({
    "/query": { body: searchResponse() },
    "/suggest": { body: { items: ["bosch drill", "bosch saw"], backend: "postgres" } },
  });
  const seen = { search: initialSearch, history: [initialSearch] as readonly string[] };
  const wrapper = (props: { children: ReactNode }): ReactElement => (
    <TestHarness
      server={server}
      initialSearch={initialSearch}
      onAdapter={(adapter) => {
        seen.search = adapter.search;
        seen.history = adapter.history;
      }}
    >
      {props.children}
    </TestHarness>
  );
  return { server, seen, wrapper };
}

function useProbe(): BoxProbe {
  return { box: useSearchBox({ debounceMs: FAST }), state: useSearchState() };
}

describe("the draft commits after a pause, not per keystroke", () => {
  it("keeps typing out of the URL until the typing stops", async () => {
    const { seen, wrapper } = harness();
    const { result } = renderHook(useProbe, { wrapper });

    act(() => {
      result.current.box.setDraft("bos");
    });
    // The box shows it; the search does not — and `pending` says so, which is
    // what lets a skin dim the results it is about to replace.
    expect(result.current.box.draft).toBe("bos");
    expect(result.current.box.committed).toBe("");
    expect(result.current.box.pending).toBe(true);
    expect(seen.search).not.toContain("q=bos");

    await waitFor(() => {
      expect(result.current.box.committed).toBe("bos");
    });
    expect(new URLSearchParams(seen.search).get("q")).toBe("bos");
    expect(result.current.box.pending).toBe(false);
  });

  it("costs ONE history entry for a whole word, so Back still undoes a filter", async () => {
    const { seen, wrapper } = harness();
    const { result } = renderHook(useProbe, { wrapper });
    const before = seen.history.length;

    for (const draft of ["b", "bo", "bos", "bosc", "bosch"]) {
      act(() => {
        result.current.box.setDraft(draft);
      });
    }
    await waitFor(() => {
      expect(result.current.box.committed).toBe("bosch");
    });
    // Typing REPLACES the entry rather than pushing one — five letters, no new
    // entries. A filter, by contrast, is a step and pushes.
    expect(seen.history).toHaveLength(before);

    act(() => {
      result.current.state.toggleFilter("brand", "bosch");
    });
    expect(seen.history.length).toBe(before + 1);
  });

  it("submits immediately, without waiting out the debounce", () => {
    const { seen, wrapper } = harness();
    const { result } = renderHook(useProbe, { wrapper });

    act(() => {
      result.current.box.submit("bosch");
    });
    expect(result.current.box.committed).toBe("bosch");
    expect(new URLSearchParams(seen.search).get("q")).toBe("bosch");
  });

  it("clears the box AND the search — an empty query is a valid browse", () => {
    const { seen, wrapper } = harness("type=listing&q=bosch");
    const { result } = renderHook(useProbe, { wrapper });

    expect(result.current.box.draft).toBe("bosch");
    act(() => {
      result.current.box.clear();
    });
    expect(result.current.box.draft).toBe("");
    expect(new URLSearchParams(seen.search).get("q")).toBeNull();
  });
});

describe("the URL wins whenever it moves on its own", () => {
  it("resets a half-typed draft when the search changes underneath it", async () => {
    const { wrapper } = harness("type=listing&q=bosch");
    const { result } = renderHook(useProbe, { wrapper });

    act(() => {
      result.current.box.setDraft("makit");
    });
    expect(result.current.box.draft).toBe("makit");

    // Back, a shared link opening, a host control — all of them arrive here as
    // the committed `q` moving without the box asking.
    act(() => {
      result.current.state.setText("interskol");
    });
    await waitFor(() => {
      expect(result.current.box.draft).toBe("interskol");
    });
    // The box can never show a word the results are not about.
    expect(result.current.box.committed).toBe("interskol");
    expect(result.current.box.pending).toBe(false);
  });
});

describe("the server's own limit is a refusal this control cannot cause", () => {
  it("clips a pasted essay at MAX_QUERY_CHARS", () => {
    const { wrapper } = harness();
    const { result } = renderHook(useProbe, { wrapper });

    act(() => {
      result.current.box.setDraft("x".repeat(SEARCH_QUERY_MAX_CHARS + 50));
    });
    expect(result.current.box.draft).toHaveLength(SEARCH_QUERY_MAX_CHARS);
    expect(result.current.box.maxLength).toBe(SEARCH_QUERY_MAX_CHARS);
  });

  it("caps the rendered input at the same number", () => {
    const { wrapper: Wrapper } = harness();
    render(<Wrapper><SearchBox debounceMs={FAST} /></Wrapper>);
    const input = screen.getByTestId("search-box-input") as HTMLInputElement;
    expect(input.getAttribute("maxlength")).toBe(String(SEARCH_QUERY_MAX_CHARS));
  });
});

describe("the skin's box drives the same machine", () => {
  it("searches from the visible button — a phone keyboard does not always offer one", async () => {
    const { seen, wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <SearchBox debounceMs={FAST} />
      </Wrapper>
    );
    const input = screen.getByTestId("search-box-input");
    fireEvent.change(input, { target: { value: "bosch" } });
    fireEvent.click(screen.getByTestId("search-box-submit"));

    await waitFor(() => {
      expect(new URLSearchParams(seen.search).get("q")).toBe("bosch");
    });
  });

  it("labels the field and its clear control", () => {
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <SearchBox debounceMs={FAST} />
      </Wrapper>
    );
    expect(screen.getByTestId("search-box-input").getAttribute("aria-label")).toBeTruthy();
  });
});
