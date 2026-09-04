/**
 * THE HISTORY POLICY (D344) — Back has to unwind a filter one press at a
 * time, and it cannot do that unless the change that applied the filter
 * opened its own history entry. `DEFAULT_HISTORY_MODE` states which change
 * gets which; these tests drive every mutator on `SearchStateBag` against a
 * fake history (`useTestParams`, the same fake `pagination.test.tsx` and
 * `urlSync.test.tsx` use) and read `history.length` — a push grows it, a
 * replace does not.
 *
 * No `SearchProvider` / query client is needed: `SearchStateProvider` reads
 * only the adapter and holds no query of its own.
 */
import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  DEFAULT_HISTORY_MODE,
  SearchStateProvider,
  useSearchState,
} from "../src/index.js";
import type { SearchStateBag } from "../src/index.js";
import { useTestParams } from "./harness.js";

function Probe(props: { onReady: (bag: SearchStateBag) => void }): ReactElement | null {
  const bag = useSearchState();
  props.onReady(bag);
  return null;
}

function Harness(props: {
  adapter: ReturnType<typeof useTestParams>;
  onReady: (bag: SearchStateBag) => void;
}): ReactElement {
  return (
    <SearchStateProvider adapter={props.adapter} defaultType="listing">
      <Probe onReady={props.onReady} />
    </SearchStateProvider>
  );
}

/** Renders the harness, hands back the live bag and the fake history's
 * current length, refreshed after every act(). */
function mount(initial?: string) {
  let bag!: SearchStateBag;
  const adapterRef: { current: ReturnType<typeof useTestParams> | null } = {
    current: null,
  };

  function Root(): ReactElement {
    const adapter = useTestParams(initial ?? "type=listing");
    adapterRef.current = adapter;
    return <Harness adapter={adapter} onReady={(b) => (bag = b)} />;
  }

  render(<Root />);
  return {
    bag: () => bag,
    length: () => adapterRef.current?.history.length ?? 0,
  };
}

describe("DEFAULT_HISTORY_MODE states the policy this pair follows", () => {
  it("facet values, ranges and the partition/category push", () => {
    expect(DEFAULT_HISTORY_MODE.filter).toBe("push");
    expect(DEFAULT_HISTORY_MODE.range).toBe("push");
    expect(DEFAULT_HISTORY_MODE.category).toBe("push");
  });

  it("the search box and the pagination cursor replace", () => {
    expect(DEFAULT_HISTORY_MODE.text).toBe("replace");
    expect(DEFAULT_HISTORY_MODE.page).toBe("replace");
  });
});

describe("applying or removing a facet value pushes (D344)", () => {
  it("toggleFilter opens a new history entry", () => {
    const h = mount("type=listing");
    expect(h.length()).toBe(1);
    act(() => h.bag().toggleFilter("brand", "bosch"));
    expect(h.length()).toBe(2);
    // Removing the same value is a change of the same kind, and pushes too.
    act(() => h.bag().toggleFilter("brand", "bosch"));
    expect(h.length()).toBe(3);
  });

  it("setFilter opens a new history entry", () => {
    const h = mount("type=listing");
    act(() => h.bag().setFilter("brand", ["makita"]));
    expect(h.length()).toBe(2);
  });
});

describe("applying or removing a range pushes (D344)", () => {
  it("setRange opens a new history entry, both applying and clearing", () => {
    const h = mount("type=listing");
    act(() => h.bag().setRange("price", { from: "100", to: "500" }));
    expect(h.length()).toBe(2);
    act(() => h.bag().setRange("price", null));
    expect(h.length()).toBe(3);
  });
});

describe("choosing a partition/category pushes (D344)", () => {
  it("setCategory opens a new history entry — the seam PartitionChips and OtherCategoriesLine use", () => {
    const h = mount("type=listing");
    act(() => h.bag().setCategory("cars"));
    expect(h.length()).toBe(2);
  });
});

describe("typing in the search box replaces (D344)", () => {
  it("setText overwrites the current history entry, keystroke after keystroke", () => {
    const h = mount("type=listing");
    act(() => h.bag().setText("d"));
    expect(h.length()).toBe(1);
    act(() => h.bag().setText("dr"));
    expect(h.length()).toBe(1);
    act(() => h.bag().setText("drill"));
    expect(h.length()).toBe(1);
  });
});

describe("a keyset page move replaces, so Back leaves the pager instead of paging backwards forever (D344)", () => {
  it("goToAnchor overwrites the current history entry", () => {
    const h = mount("type=listing");
    act(() => h.bag().goToAnchor("a2", "next"));
    expect(h.length()).toBe(1);
    act(() => h.bag().goToAnchor("a3", "next"));
    expect(h.length()).toBe(1);
  });

  it("a facet click after paging still pushes its own entry", () => {
    const h = mount("type=listing");
    act(() => h.bag().goToAnchor("a2", "next"));
    expect(h.length()).toBe(1);
    act(() => h.bag().toggleFilter("brand", "bosch"));
    expect(h.length()).toBe(2);
  });
});

describe("a page size preference replaces (unchanged)", () => {
  it("setLimit overwrites the current history entry", () => {
    const h = mount("type=listing");
    act(() => h.bag().setLimit(48));
    expect(h.length()).toBe(1);
  });
});

describe("clear-all pushes, like the filters it removes", () => {
  it("clearAll opens a new history entry", () => {
    const h = mount("type=listing&f.brand=bosch");
    act(() => h.bag().clearAll());
    expect(h.length()).toBe(2);
  });
});
