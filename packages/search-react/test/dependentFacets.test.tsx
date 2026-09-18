/**
 * STAGED DEPENDENT FACETS, decided by the SERVER (stapel-search 0.18.0).
 *
 * `test/facetChain.test.tsx` covers the rule this pair derives from the
 * category schema's own `optionsRef.parentFeature`, which is what a leaf page
 * with a threaded schema has. This suite covers the half no client can
 * compute: `facet_labels[<slug>].depends_on` / `.gated` / `.parent_missing`
 * and `facet_meta.dependent_facets`, which arrive on a branch page and a text
 * query too, and which the server decides on the SETTLED query.
 *
 * WHAT IS ASSERTED — the OUTCOME, never the wiring:
 *
 *  - which controls a person can press, and what the switched-off one SAYS;
 *  - what goes on the wire when a parent changes, in ONE update rather than
 *    two — a request carrying the new parent and the old child is a request
 *    with an honest answer nobody asked for;
 *  - that `flat` is obeyed: a server that has the rule and declines to apply
 *    it gets a panel that draws what it sent.
 *
 * WHAT IT CANNOT SEE. jsdom lays nothing out, so nothing here is evidence
 * about how a gated group LOOKS. It is evidence about which controls exist,
 * which are reachable, and what the address says afterwards.
 *
 * Nothing here names a car: `parent`/`child` are the fixture's slugs, so a
 * rule that special-cased makes and models would fail this suite.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchResponse } from "../src/index.js";
import { FacetPanelPane, FilterChips } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";

afterEach(cleanup);

/** The rung above — a plain vocabulary axis, nobody's child. */
const PARENT: FeatureDef = {
  slug: "parent",
  name: "Parent axis",
  config: { type: "ref_select", optionsRef: { level: "Parent", vocabulary: "catalog" } },
};

/** The rung below, scoped BY the one above. Declared in the schema too, so
 * the `flat` case proves the ANSWER outranks this declaration. */
const CHILD: FeatureDef = {
  slug: "child",
  name: "Child axis",
  config: {
    type: "ref_select",
    optionsRef: { level: "Child", vocabulary: "catalog", parentFeature: "parent" },
  },
};

const FEATURES: readonly FeatureDef[] = [PARENT, CHILD];

const PARENT_VALUES: Readonly<Record<string, string>> = {
  alfa: "Alfa",
  bravo: "Bravo",
};
const CHILD_VALUES: Readonly<Record<string, string>> = {
  "alfa-one": "Alfa One",
  "alfa-two": "Alfa Two",
};

/**
 * One answer, shaped exactly as a 0.18 server sends it for this query: the
 * child is held shut while the request carries no value for the parent, and
 * comes back counted the moment it does.
 */
function stagedBody(url: string): SearchResponse {
  const params = new URL(url).searchParams;
  const parentChosen = params.getAll("f.parent").length > 0;
  const childChosen = params.getAll("f.child").length > 0;
  const gated = !parentChosen && !childChosen;
  return {
    category_resolved: null,
    items: [],
    facets: {
      parent: { alfa: 90, bravo: 80 },
      // Present and EMPTY while gated — absent would read as "this leaf has
      // no child filter at all".
      child: gated ? {} : { "alfa-one": 40, "alfa-two": 30 },
    },
    facet_meta: {
      approximate: false,
      candidates: 170,
      counted: gated ? ["parent"] : ["parent", "child"],
      skipped: [],
      dropped_filters: [],
      core_ranges: [],
      plan: "category",
      withheld: [],
      categories: [],
      dependent_facets: "staged",
    },
    facet_labels: {
      parent: {
        label: "Марка",
        translatable: false,
        values: PARENT_VALUES,
        depends_on: null,
        gated: false,
      },
      child: {
        label: "Модель",
        translatable: false,
        values: gated ? {} : CHILD_VALUES,
        depends_on: "parent",
        gated,
        // The deep link: the child is filtered, the parent is not. The filter
        // stays applied and the parent is to be drawn open beside it.
        ...(childChosen && !parentChosen ? { parent_missing: true } : {}),
      },
    },
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: 170,
    count_is_lower_bound: false,
    exact_total: true,
    degraded: [],
    backend: "postgres",
    language: "ru",
    sort: "relevance",
    took_ms: 4,
  };
}

/** The same deployment with `DEPENDENT_FACETS = "flat"`: it HAS the rule and
 * declines to apply it, and says so under that value. */
function flatBody(): SearchResponse {
  const staged = stagedBody("https://search.test/search/api/v1/query?type=listing");
  return {
    ...staged,
    facets: { parent: { alfa: 90, bravo: 80 }, child: { "alfa-one": 40, "alfa-two": 30 } },
    facet_meta: {
      ...staged.facet_meta,
      counted: ["parent", "child"],
      dependent_facets: "flat",
    },
    facet_labels: {
      parent: { label: "Марка", translatable: false, values: PARENT_VALUES },
      child: { label: "Модель", translatable: false, values: CHILD_VALUES },
    },
  };
}

function stagedServer(): ReturnType<typeof mockServer> {
  return mockServer({ "/query": (call) => ({ body: stagedBody(call.url) }) });
}

function pane(): ReactElement {
  return <FacetPanelPane categoryFilter={false} categoryFeatures={FEATURES} />;
}

/** The addresses the pair wrote, newest last. */
let addresses: readonly string[] = [];

function mount(node: ReactElement, search: string, server = stagedServer()): void {
  addresses = [];
  render(
    <TestHarness
      server={server}
      locale="ru"
      initialSearch={search}
      onAdapter={(adapter) => {
        addresses = adapter.history;
      }}
    >
      {node}
    </TestHarness>
  );
}

function group(slug: string): HTMLElement {
  return screen.getByTestId(`facet-group-${slug}`);
}

describe("a group the answer holds shut is drawn, inert, and names the way in", () => {
  it("offers no option, no count and no focus stop — and says which control to use first", async () => {
    mount(pane(), "type=listing");
    await waitFor(() => group("child"));

    // The axis is ON the rail: a rail is a map of what a category narrows by,
    // and an axis that vanishes and reappears is a rail that moves.
    expect(group("child").dataset["gated"]).toBe("true");
    // Nothing to press, and no number over nothing.
    expect(screen.queryByTestId("facet-option-child-alfa-one")).toBeNull();
    expect(screen.queryByTestId("facet-toggle-count-child")).toBeNull();

    const toggle = screen.getByTestId("facet-toggle-child") as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.tabIndex).toBe(-1);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // The reason is on screen, in the catalogue's own words for the parent —
    // never "unavailable", never a bare greyed box.
    const hint = screen.getByTestId("facet-parent-first-child");
    expect(hint.textContent).toContain("Марка");
    expect(hint.dataset["parent"]).toBe("parent");

    // The parent itself is untouched.
    expect(group("parent").dataset["gated"]).toBeUndefined();
    expect(screen.getByTestId("facet-option-parent-alfa")).toBeTruthy();
  });

  it("un-gates on the NEXT answer once the parent carries a value", async () => {
    mount(pane(), "type=listing");
    await waitFor(() => screen.getByTestId("facet-option-parent-alfa"));
    // Shut to begin with: the whole point of the next line is the change.
    expect(screen.queryByTestId("facet-option-child-alfa-one")).toBeNull();

    fireEvent.click(screen.getByTestId("facet-option-parent-alfa"));

    // The group the reader has just unlocked is the group they are reaching
    // for, so it comes back OPEN rather than as a header they must press.
    await waitFor(() => {
      expect(screen.queryByTestId("facet-option-child-alfa-one")).not.toBeNull();
    });
    expect(group("child").dataset["gated"]).toBeUndefined();
    expect(screen.queryByTestId("facet-parent-first-child")).toBeNull();
  });
});

describe("a parent change takes its children with it, in the same update", () => {
  it("drops the child's filter when the parent CHANGES", async () => {
    const server = stagedServer();
    mount(pane(), "type=listing&f.parent=alfa&f.child=alfa-one", server);
    await waitFor(() => screen.getByTestId("facet-option-parent-bravo"));
    const before = addresses.length;

    fireEvent.click(screen.getByTestId("facet-option-parent-bravo"));

    await waitFor(() => {
      expect(new URLSearchParams(addresses[addresses.length - 1]).getAll("f.parent")).toEqual([
        "alfa",
        "bravo",
      ]);
    });
    const written = new URLSearchParams(addresses[addresses.length - 1]);
    expect(written.getAll("f.child")).toEqual([]);
    // ONE update, not two: the parent's change and the child's removal are a
    // single commit, so a single history entry and a single request.
    expect(addresses.length).toBe(before + 1);
    await waitFor(() => {
      expect(server.lastQuery("/query")?.getAll("f.child")).toEqual([]);
    });
  });

  it("drops it when the parent is CLEARED to nothing", async () => {
    mount(pane(), "type=listing&f.parent=alfa&f.child=alfa-one");
    await waitFor(() => screen.getByTestId("facet-option-parent-alfa"));

    // Pressing the only chosen value again removes it — the parent goes back
    // to unanswered, so the child cannot stand.
    fireEvent.click(screen.getByTestId("facet-option-parent-alfa"));

    await waitFor(() => {
      const written = new URLSearchParams(addresses[addresses.length - 1]);
      expect(written.getAll("f.parent")).toEqual([]);
      expect(written.getAll("f.child")).toEqual([]);
    });
  });

  it("cascades when the parent's CHIP is removed", async () => {
    mount(
      <FilterChips mode="applied" categoryFeatures={FEATURES} />,
      "type=listing&f.parent=alfa&f.child=alfa-one"
    );
    await waitFor(() => screen.getByTestId("search-applied-chip-parent-alfa"));
    expect(screen.getByTestId("search-applied-chip-child-alfa-one")).toBeTruthy();

    fireEvent.click(screen.getByTestId("search-applied-chip-parent-alfa"));

    await waitFor(() => {
      const written = new URLSearchParams(addresses[addresses.length - 1]);
      expect(written.getAll("f.parent")).toEqual([]);
      expect(written.getAll("f.child")).toEqual([]);
    });
    // The child's chip goes with it — a chip for a filter that is no longer
    // applied is a filter the reader cannot remove.
    await waitFor(() => {
      expect(screen.queryByTestId("search-applied-chip-child-alfa-one")).toBeNull();
    });
  });
});

describe("the deep link keeps its filter and opens the parent beside it", () => {
  it("draws the child with its selection and forces the parent group open", async () => {
    mount(pane(), "type=listing&f.child=alfa-one");
    await waitFor(() => group("child"));

    // The filter the link asked for is APPLIED and drawable: dropping it
    // would answer a wider page than the address asked for.
    expect(group("child").dataset["parentMissing"]).toBe("true");
    expect(group("child").dataset["gated"]).toBeUndefined();
    const chosen = screen.getByTestId("facet-option-child-alfa-one") as HTMLInputElement;
    expect(chosen.checked).toBe(true);

    // …and the parent is open beside it, so the reader can see what their
    // selection is a child of.
    expect(
      screen.getByTestId("facet-toggle-parent").getAttribute("aria-expanded")
    ).toBe("true");
  });
});

describe("`flat` is a server answer, not a gap the client fills", () => {
  it("gates nothing and strips nothing, although the schema declares the chain", async () => {
    const server = mockServer({ "/query": { body: flatBody() } });
    // The child is filtered and the parent is NOT — the exact shape the
    // schema-derived rule would hold shut. This server says it counted the
    // child independently, so the panel draws what it sent.
    mount(pane(), "type=listing&f.child=alfa-one", server);
    await waitFor(() => screen.getByTestId("facet-option-child-alfa-one"));

    expect(group("child").dataset["gated"]).toBeUndefined();
    expect(screen.queryByTestId("facet-parent-first-child")).toBeNull();
    expect(
      (screen.getByTestId("facet-option-child-alfa-one") as HTMLInputElement).checked
    ).toBe(true);

    fireEvent.click(screen.getByTestId("facet-option-parent-alfa"));

    await waitFor(() => {
      expect(new URLSearchParams(addresses[addresses.length - 1]).getAll("f.parent")).toEqual([
        "alfa",
      ]);
    });
    // The child's filter SURVIVES a parent change: there is no chain to
    // cascade along on a server that declined to declare one.
    expect(new URLSearchParams(addresses[addresses.length - 1]).getAll("f.child")).toEqual([
      "alfa-one",
    ]);
  });
});
