/**
 * The cascading child selector — the control the tile cap hands over to, and
 * the one surface in this pair that walks the tree WITHOUT transferring it.
 *
 * The fixture tree is the defect in miniature. `MAX_TILE_DEPTH` is 1, so tiles
 * reach `electronics` (depth 0) and `phones` (depth 1) and stop; `used_phones`
 * (depth 2) is where the feature schema actually lives. Before this control
 * there was no route from the second row of tiles to the third level of the
 * tree at all — which on a live classified catalogue left 94% of the
 * categories, and every category that has any characteristics, unreachable.
 *
 *   electronics (1)
 *     phones (2)
 *       used-phones (4)   <- the leaf, and where the features are
 *     laptops (3)
 *   vehicles (5)
 *
 * The wire assertions are the point of the hook suite: a ROOTED ladder must
 * never ask for the category list, because that request is the twenty seconds
 * this rewrite exists to delete.
 */
import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  buildCategoryCascade,
  cascadeChainIds,
  cascadeParentIds,
  cascadeReachedLeaf,
  cascadeSelection,
  cascadeTrail,
  categoryAncestorChain,
  useCategoryCascade,
} from "../src/index.js";
import type {
  CatalogStore,
  Category,
  CategoryCascadeBag,
  CategoryCascadeCommit,
  CategoryCascadeSource,
} from "../src/index.js";
import { CategoryCascadeField } from "../src/default/index.js";
import {
  ELECTRONICS,
  FULL_PAGE,
  PHONES,
  ROWS,
  USED_PHONES,
  VEHICLES,
  categoryRow,
} from "./fixtures.js";
import {
  TestProviders,
  mockServer,
  rowRoutes,
  testStore,
} from "./harness.js";

/** What `GET {id}/children/` answers, after the browse projection. */
function childrenOf(id: number | null): readonly Category[] {
  return ROWS.filter(
    (row) =>
      (row.tn_parent ?? null) === id &&
      row.deleted !== true &&
      row.active !== false
  ).sort((a, b) => (b.tn_priority ?? 0) - (a.tn_priority ?? 0) || a.id - b.id);
}

/** The rungs a ladder would have fetched — the hook's input, built by hand. */
function sourcesFor(
  rootId: number | null,
  chainIds: readonly number[]
): readonly CategoryCascadeSource[] {
  return cascadeParentIds(rootId, chainIds).map((parentId) => ({
    parentId,
    parent: parentId === null ? null : (ROWS.find((r) => r.id === parentId) ?? null),
    options: childrenOf(parentId),
  }));
}

describe("cascadeChainIds — the server's own ancestry, cut at the root", () => {
  it("a rootless ladder takes the whole chain", () => {
    expect(
      cascadeChainIds(categoryAncestorChain(USED_PHONES), 4, null)
    ).toEqual([1, 2, 4]);
  });

  it("a ROOT starts the chain below itself — the tiles' handover point", () => {
    expect(cascadeChainIds(categoryAncestorChain(USED_PHONES), 4, 2)).toEqual([
      4,
    ]);
  });

  it("a cursor EQUAL to the root has not started the ladder", () => {
    expect(cascadeChainIds(categoryAncestorChain(PHONES), 2, 2)).toEqual([]);
  });

  it("a cursor outside the root's subtree yields nothing — a stale URL", () => {
    expect(cascadeChainIds(categoryAncestorChain(VEHICLES), 5, 2)).toEqual([]);
  });

  it("the parent list is the root plus every answer — the last one speculative", () => {
    // The trailing entry is what DISCOVERS the leaf: its empty answer is how
    // the ladder learns to stop, and no local column is trusted for it.
    expect(cascadeParentIds(2, [4])).toEqual([2, 4]);
    expect(cascadeParentIds(null, [1, 2])).toEqual([null, 1, 2]);
  });
});

describe("buildCategoryCascade", () => {
  it("offers the roots, and nothing below them, until one is answered", () => {
    const levels = buildCategoryCascade(sourcesFor(null, []), []);
    expect(levels).toHaveLength(1);
    expect(levels[0]?.parent).toBeNull();
    expect(levels[0]?.options.map((c) => c.id)).toEqual([1, 5]);
    expect(levels[0]?.chosen).toBeNull();
  });

  it("builds one rung per answered level, ending at the first unanswered one", () => {
    const chain = [1, 2];
    const levels = buildCategoryCascade(sourcesFor(null, chain), chain);
    expect(levels.map((l) => l.chosen?.id ?? null)).toEqual([1, 2, null]);
    expect(levels[2]?.options.map((c) => c.id)).toEqual([4]);
  });

  it("stops at a leaf rather than trailing an empty select", () => {
    const chain = [1, 2, 4];
    const levels = buildCategoryCascade(sourcesFor(null, chain), chain);
    expect(levels.map((l) => l.chosen?.id ?? null)).toEqual([1, 2, 4]);
    expect(cascadeReachedLeaf(sourcesFor(null, chain), chain)).toBe(true);
    expect(cascadeSelection(levels)?.id).toBe(4);
    expect(cascadeTrail(levels).map((c) => c.id)).toEqual([1, 2, 4]);
  });

  it("a rung still IN FLIGHT truncates the ladder instead of blanking it", () => {
    // The deepest rung has not answered — the ladder keeps everything above it
    // on screen and grows when it lands. That is what makes a request per rung
    // affordable, and it is why `atLeaf` is false here: nothing has said leaf.
    const chain = [1, 2];
    const partial = sourcesFor(null, chain).slice(0, 2);
    const levels = buildCategoryCascade(partial, chain);
    expect(levels.map((l) => l.chosen?.id ?? null)).toEqual([1, 2]);
    expect(cascadeReachedLeaf(partial, chain)).toBe(false);
  });

  it("a rooted cascade whose root is a LEAF has no rungs at all", () => {
    expect(buildCategoryCascade(sourcesFor(4, []), [])).toEqual([]);
  });

  it("truncation is not an operation: a shallower cursor drops every level below", () => {
    const deep = buildCategoryCascade(sourcesFor(null, [1, 2, 4]), [1, 2, 4]);
    const shallow = buildCategoryCascade(sourcesFor(null, [1]), [1]);
    expect(deep).toHaveLength(3);
    expect(shallow).toHaveLength(2);
    expect(shallow[1]?.chosen).toBeNull();
  });
});

function Probe(props: {
  readonly onBag: (bag: CategoryCascadeBag) => void;
  readonly store: CatalogStore;
  readonly rootId?: number | null;
  readonly commit?: CategoryCascadeCommit;
  readonly value?: number | null;
  readonly roots?: readonly Category[];
  readonly onChange?: (id: number | null) => void;
  readonly partitionChild?: Category | null;
}): null {
  props.onBag(
    useCategoryCascade({
      store: props.store,
      ...(props.rootId !== undefined ? { rootId: props.rootId } : {}),
      ...(props.commit !== undefined ? { commit: props.commit } : {}),
      ...(props.value !== undefined ? { value: props.value } : {}),
      ...(props.roots !== undefined ? { roots: props.roots } : {}),
      ...(props.onChange !== undefined ? { onChange: props.onChange } : {}),
      ...(props.partitionChild !== undefined
        ? { partitionChild: props.partitionChild }
        : {}),
    })
  );
  return null;
}

interface Mounted {
  readonly bag: () => CategoryCascadeBag;
  readonly server: ReturnType<typeof mockServer>;
}

async function mountProbe(props: {
  readonly rootId?: number | null;
  readonly commit?: CategoryCascadeCommit;
  readonly value?: number | null;
  readonly roots?: readonly Category[];
  readonly onChange?: (id: number | null) => void;
  readonly partitionChild?: Category | null;
  /** What `GET /categories/carousel/` answers. Omitted, the route does not
   * exist at all — a deployment with no curated strip, which is the case the
   * catalogue-sync fallback is for. */
  readonly carousel?: readonly Category[];
  /** The catalogue the mock server answers from. Defaults to the fixture's. */
  readonly rows?: readonly Category[];
}): Promise<Mounted> {
  const { carousel, rows, ...probeProps } = props;
  const server = mockServer({
    "/categories/": { body: FULL_PAGE },
    ...(carousel !== undefined
      ? { "/categories/carousel/": { body: carousel } }
      : {}),
    ...rowRoutes(rows ?? ROWS),
  });
  const store = testStore();
  let latest: CategoryCascadeBag | null = null;
  render(
    <TestProviders server={server}>
      <Probe
        {...probeProps}
        store={store}
        onBag={(bag) => {
          latest = bag;
        }}
      />
    </TestProviders>
  );
  await waitFor(() => {
    expect(latest?.state.status).toBe("ready");
  });
  return { bag: () => latest as unknown as CategoryCascadeBag, server };
}

/** Requests to the CATALOGUE LIST — the twenty-second one. */
function listCalls(server: ReturnType<typeof mockServer>): number {
  return server.calls.filter((call) =>
    new URL(call.url).pathname.endsWith("/categories/")
  ).length;
}

describe("useCategoryCascade — one small request per rung", () => {
  it("a ROOTED ladder never asks for the catalogue", async () => {
    const { bag, server } = await mountProbe({ rootId: 2, value: 4 });
    expect(bag().trail.map((c) => c.id)).toEqual([4]);
    expect(bag().atLeaf).toBe(true);
    // The whole point: the list endpoint is not touched. On a live catalogue
    // that request is 36 pages and 1.4 MB before the first select can draw.
    expect(listCalls(server)).toBe(0);
    // One `children/` per rung the ladder has, plus the speculative one that
    // discovers the leaf — and the cursor's own row for its ancestry.
    const children = server.calls.filter((c) => c.url.includes("/children/"));
    expect(children.map((c) => new URL(c.url).pathname)).toEqual([
      "/categories/api/v1/categories/2/children/",
      "/categories/api/v1/categories/4/children/",
    ]);
  });

  it("host-supplied roots keep a ROOTLESS ladder off the catalogue too", async () => {
    const { bag, server } = await mountProbe({
      roots: [ELECTRONICS, VEHICLES],
    });
    const state = bag().state;
    expect(state.status === "ready" ? state.data[0]?.options.length : 0).toBe(2);
    expect(listCalls(server)).toBe(0);
  });

  it("a rootless ladder takes its TOP rung from the carousel — one cached request", async () => {
    // The measured defect: with no rootId and no host roots, this rung read
    // the whole table. On a live catalogue of 3583 categories that was 36
    // requests, 1.4 MB, and 19.9 seconds before the composer's FIRST select
    // existed — while everything below it costs one `children/` per rung.
    const { bag, server } = await mountProbe({
      commit: "any",
      carousel: [ELECTRONICS, VEHICLES],
    });
    const state = bag().state;
    expect(
      state.status === "ready"
        ? state.data[0]?.options.map((o) => o.category.id)
        : []
    ).toEqual([1, 5]);
    expect(listCalls(server)).toBe(0);
  });

  it("reads the carousel as ROOTS, not as a tree — a flagged child is not one", async () => {
    // `carousel_enabled` is a strip a deployment curates, and a deployment may
    // flag a category at any depth. The top rung is the roots, so the rows are
    // projected to those with no ancestors; the rest are not top-level and are
    // not offered as if they were.
    const { bag } = await mountProbe({
      commit: "any",
      carousel: [ELECTRONICS, PHONES, VEHICLES],
    });
    const state = bag().state;
    expect(
      state.status === "ready"
        ? state.data[0]?.options.map((o) => o.category.id)
        : []
    ).toEqual([1, 5]);
  });

  it("falls through to the catalogue when the carousel names no roots", async () => {
    // A deployment that curates nothing behaves exactly as it did before the
    // fast path existed — the fallback is the whole reason it can be a default.
    const { bag, server } = await mountProbe({ commit: "any", carousel: [PHONES] });
    const state = bag().state;
    expect(
      state.status === "ready"
        ? state.data[0]?.options.map((o) => o.category.id)
        : []
    ).toEqual([1, 5]);
    expect(listCalls(server)).toBeGreaterThan(0);
  });

  it("without a carousel at all, a rootless ladder falls back to the catalogue for its TOP rung only", async () => {
    const { bag, server } = await mountProbe({ commit: "any" });
    const state = bag().state;
    expect(
      state.status === "ready"
        ? state.data[0]?.options.map((o) => o.category.id)
        : []
    ).toEqual([1, 5]);
    expect(listCalls(server)).toBeGreaterThan(0);
  });

  it("commit:any reports every choice — the FILTER's rule", async () => {
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      roots: [ELECTRONICS, VEHICLES],
      commit: "any",
      onChange: (id) => seen.push(id),
    });
    act(() => {
      bag().choose(0, ELECTRONICS);
    });
    // "Everything under Electronics" is the commonest narrowing there is, and
    // the index matches a category path as a prefix precisely for it.
    expect(seen).toEqual([1]);
    expect(bag().selected?.id).toBe(1);
    expect(bag().atLeaf).toBe(false);
  });

  it("commit:leaf withholds a non-leaf and still advances the ladder", async () => {
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      roots: [ELECTRONICS, VEHICLES],
      commit: "leaf",
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, ELECTRONICS);
    });
    // Not reported: a listing under `electronics` inherits the wrong schema.
    expect(seen).toEqual([null]);
    // But the ladder moved, which is the point — the cursor is not the value.
    await waitFor(() => {
      const advanced = bag().state;
      expect(advanced.status === "ready" ? advanced.data.length : 0).toBe(2);
    });
    expect(bag().blockedReason).toBe("not_a_leaf");

    act(() => {
      bag().choose(1, PHONES);
    });
    await waitFor(() => {
      expect(bag().state.status).toBe("ready");
    });
    act(() => {
      bag().choose(2, USED_PHONES);
    });
    await waitFor(() => {
      expect(bag().atLeaf).toBe(true);
    });
    expect(seen).toEqual([null, null, 4]);
    expect(bag().blockedReason).toBeNull();
  });

  it("a chosen row is SEEDED into the per-id cache — a click costs one request", async () => {
    const { bag, server } = await mountProbe({
      roots: [ELECTRONICS, VEHICLES],
      commit: "any",
    });
    const before = server.calls.length;
    act(() => {
      bag().choose(0, ELECTRONICS);
    });
    await waitFor(() => {
      const state = bag().state;
      expect(state.status === "ready" ? state.data.length : 0).toBe(2);
    });
    // The new rung, and nothing else: the chosen row's ancestry came from the
    // row itself rather than from a second `GET {id}/`.
    const added = server.calls.slice(before).map((c) => new URL(c.url).pathname);
    expect(added).toEqual(["/categories/api/v1/categories/1/children/"]);
  });

  it("popping a crumb un-answers that level and everything under it", async () => {
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      roots: [ELECTRONICS, VEHICLES],
      commit: "any",
      onChange: (id) => seen.push(id),
    });
    act(() => {
      bag().choose(0, ELECTRONICS);
    });
    await waitFor(() => {
      expect(bag().state.status).toBe("ready");
    });
    act(() => {
      bag().choose(1, PHONES);
    });
    await waitFor(() => {
      expect(bag().trail.map((c) => c.id)).toEqual([1, 2]);
    });

    act(() => {
      bag().clearFrom(1);
    });
    expect(bag().trail.map((c) => c.id)).toEqual([1]);
    expect(seen[seen.length - 1]).toBe(1);

    act(() => {
      bag().clearFrom(0);
    });
    expect(bag().trail).toEqual([]);
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("an incoming value wins over the cursor — the browser's Back button", async () => {
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    const store = testStore();
    let latest: CategoryCascadeBag | null = null;
    const view = render(
      <TestProviders server={server}>
        <Probe
          value={4}
          commit="any"
          store={store}
          roots={[ELECTRONICS, VEHICLES]}
          onBag={(bag) => {
            latest = bag;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        (latest as unknown as CategoryCascadeBag).trail.map((c) => c.id)
      ).toEqual([1, 2, 4]);
    });

    view.rerender(
      <TestProviders server={server}>
        <Probe
          value={1}
          commit="any"
          store={store}
          roots={[ELECTRONICS, VEHICLES]}
          onBag={(bag) => {
            latest = bag;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        (latest as unknown as CategoryCascadeBag).trail.map((c) => c.id)
      ).toEqual([1]);
    });
  });
});

describe("<CategoryCascadeField>", () => {
  it("draws one select per rung, and grows one as the ladder descends", async () => {
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    render(
      <TestProviders server={server}>
        <CategoryCascadeField commit="leaf" store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-select-0")).toBeTruthy();
    });
    // One rung while nothing is answered: the deeper ones are not yet
    // questions the catalogue can ask.
    expect(screen.queryByTestId("categories-cascade-select-1")).toBeNull();
    // And the composer's gate is stated, not left silent.
    expect(screen.getByTestId("categories-cascade-blocked")).toBeTruthy();
  });

  it("a rooted field whose root is a leaf says so instead of drawing an empty box", async () => {
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    render(
      <TestProviders server={server}>
        <CategoryCascadeField rootId={4} store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-exhausted")).toBeTruthy();
    });
  });

  it("mounted at a leaf, each rung carries its own answer and nothing restates the path", async () => {
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    const { container } = render(
      <TestProviders server={server}>
        <CategoryCascadeField commit="leaf" value={4} store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-selected")).toBeTruthy();
    });
    expect(screen.getByTestId("categories-cascade").dataset["atLeaf"]).toBe("true");

    // Every answered level reads its answer in the control that can CHANGE
    // it — one rung, one printing.
    for (const [depth, caption] of [
      [0, "category.electronics"],
      [1, "category.phones"],
      [2, "category.used_phones"],
    ] as const) {
      expect(
        screen
          .getByTestId(`categories-cascade-level-${String(depth)}`)
          .textContent
      ).toContain(caption);
    }

    // …and NOTHING above them says it a second time. There used to be a row of
    // closable crumb tags here, redundant with the selects by construction: on
    // the phone's filter sheet it printed the chosen path and then the selects
    // printed it again, half a screen spent on one fact before the first
    // control (walker D103, and D89 in the composer). The clear button inside
    // each select pops a level in the same one tap the tag was kept for.
    expect(screen.queryByTestId("categories-cascade-trail")).toBeNull();
    expect(
      container.querySelectorAll('[data-testid^="categories-cascade-crumb-"]')
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(".ant-select-allow-clear").length
    ).toBeGreaterThanOrEqual(3);
  });

  it("prints each name in the path exactly once", async () => {
    // The count, not the shape — because the shape kept changing while the
    // count stayed at three. Crumb tags were one printing and the selects a
    // second; removing the tags left the third, which is subtler and was what
    // the phone actually showed: every rung below the top labelled itself with
    // its PARENT's name, and the parent is the rung above's chosen value. So a
    // three-level path read "Electronics / Electronics / Phones / Phones /
    // Mobile phones" (walker D103, D89).
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    render(
      <TestProviders server={server}>
        <CategoryCascadeField
          commit="leaf"
          verdict={false}
          value={4}
          store={testStore()}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("categories-cascade").dataset["atLeaf"]
      ).toBe("true");
    });
    const text = screen.getByTestId("categories-cascade").textContent ?? "";
    for (const caption of [
      "category.electronics",
      "category.phones",
      "category.used_phones",
    ]) {
      expect(text.split(caption).length - 1, caption).toBe(1);
    }
  });
});

/**
 * `commit: "stage"` — the composer's rule as the BROWSE CONTRACT states it.
 *
 * The fixture adds the shape the flat rows above have none of: a PARTITION.
 *
 *   cars (51, children_as: "chips")
 *     cars-new (52)
 *     cars-used (53)
 *
 * `New`/`Used` are one attribute template split by a value their name
 * expresses, so `cars` is a feed page with a chip row and NOT a level of the
 * tree. Under `commit: "leaf"` the cascade refuses `cars` and goes on asking
 * for one of the two — presenting a filter as a rung, which is the disagreement
 * about what a category is that the contract settled. Under `"stage"` it
 * commits `cars` and offers nothing below; the host draws the partition as its
 * own required select, out of the same rows.
 */
const CARS = categoryRow(51, "cars", "category.cars", null, "", "52,53", {
  children_as: "chips",
});
const CARS_NEW = categoryRow(52, "cars-new", "category.cars_new", 51, "51", "");
const CARS_USED = categoryRow(53, "cars-used", "category.cars_used", 51, "51", "");
const STAGE_ROWS: readonly Category[] = [...ROWS, CARS, CARS_NEW, CARS_USED];

/** Let every request the choice could have fired actually fire. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function rungCount(bag: CategoryCascadeBag): number {
  return bag.state.status === "ready" ? bag.state.data.length : 0;
}

describe('useCategoryCascade — commit: "stage"', () => {
  it("commits a chips parent and offers NO rung under it", async () => {
    const seen: (number | null)[] = [];
    const { bag, server } = await mountProbe({
      roots: [CARS, ELECTRONICS],
      commit: "stage",
      rows: STAGE_ROWS,
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, CARS);
    });
    // Reported: `cars` owns the feed the person's listing belongs on.
    expect(seen).toEqual([51]);
    expect(bag().blockedReason).toBeNull();

    await settle();
    // No second select, and — the point of the stop — no request for one:
    // the partition is the host's control, not a rung.
    expect(rungCount(bag())).toBe(1);
    expect(
      server.calls.filter((call) => call.url.includes("/51/children/"))
    ).toHaveLength(0);
  });

  it("echoes back the host's own partition pick, unfetched and unchosen", async () => {
    // The stop drops the request for `cars`'s own children (the assertion
    // above) — so a chip picked from the host's OWN select over those rows
    // has nowhere else to land. `partitionChild` is pure pass-through: no
    // extra request, no change to the ladder or `blockedReason`.
    const { bag: bagWithNone } = await mountProbe({
      roots: [CARS, ELECTRONICS],
      commit: "stage",
      rows: STAGE_ROWS,
    });
    expect(bagWithNone().partitionChild).toBeNull();

    const { bag: bagWithPick } = await mountProbe({
      roots: [CARS, ELECTRONICS],
      commit: "stage",
      rows: STAGE_ROWS,
      partitionChild: CARS_NEW,
    });
    expect(bagWithPick().partitionChild).toEqual(CARS_NEW);
  });

  it("offers the rung under a TILES parent and refuses to commit it", async () => {
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      roots: [CARS, ELECTRONICS],
      commit: "stage",
      rows: STAGE_ROWS,
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, ELECTRONICS);
    });
    // Withheld: `electronics` has real subcategories, so the ladder is not
    // finished and a listing filed here inherits the wrong schema.
    expect(seen).toEqual([null]);
    await waitFor(() => {
      expect(rungCount(bag())).toBe(2);
    });
    expect(bag().blockedReason).toBe("has_subcategories");
  });

  it("commits a LEAF, and still waits for the server to verify it", async () => {
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      rootId: 2,
      commit: "stage",
      rows: STAGE_ROWS,
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, USED_PHONES);
    });
    expect(seen).toEqual([4]);
    // A leaf keeps its speculative rung: the empty answer is the server
    // VERIFYING the leaf, which is what `atLeaf` is made of. Only a partition
    // skips the request.
    await waitFor(() => {
      expect(bag().atLeaf).toBe(true);
    });
    expect(bag().blockedReason).toBeNull();
    expect(rungCount(bag())).toBe(1);
  });

  it('commit: "leaf" still descends into the partition — the rules differ', async () => {
    // The same fixture under the old rule, so the two are readable side by
    // side: `leaf` withholds `cars` and asks for New or Used.
    const seen: (number | null)[] = [];
    const { bag } = await mountProbe({
      roots: [CARS, ELECTRONICS],
      commit: "leaf",
      rows: STAGE_ROWS,
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, CARS);
    });
    expect(seen).toEqual([null]);
    await waitFor(() => {
      expect(rungCount(bag())).toBe(2);
    });
    expect(bag().blockedReason).toBe("not_a_leaf");
  });
});

/**
 * A one-rung IMPORT WRAPPER — the census addendum's `/c/uslugi` shape in
 * miniature: a root whose only child («offer») exists purely to hold the
 * real groups underneath it.
 */
const WRAPPER_ROOT = categoryRow(100, "uslugi", "category.uslugi", null, "", "101");
const WRAPPER = categoryRow(101, "offer", "category.offer", 100, "100", "102,103");
const WRAPPER_GROUP_A = categoryRow(
  102,
  "group-a",
  "category.group_a",
  101,
  "100,101",
  ""
);
const WRAPPER_GROUP_B = categoryRow(
  103,
  "group-b",
  "category.group_b",
  101,
  "100,101",
  ""
);
const WRAPPER_ROWS: readonly Category[] = [
  ...ROWS,
  WRAPPER_ROOT,
  WRAPPER,
  WRAPPER_GROUP_A,
  WRAPPER_GROUP_B,
];

describe("useCategoryCascade — the one-rung import wrapper is invisible", () => {
  it("a cold ladder shows the wrapper's own children, never the wrapper itself", async () => {
    const { bag } = await mountProbe({ rootId: 100, rows: WRAPPER_ROWS });
    // The wrapper's own children need one extra eager read the ordinary
    // chain does not — wait for it to land rather than catching the first
    // (transient) render, which still shows the one-option wrapper rung.
    await waitFor(() => {
      const state = bag().state;
      const options = state.status === "ready" ? state.data[0]?.options : [];
      expect(options?.map((o) => o.category.id)).toEqual([102, 103]);
    });
    expect(rungCount(bag())).toBe(1);
  });

  it("a ladder already past the wrapper shows one rung, not two", async () => {
    const { bag } = await mountProbe({
      rootId: 100,
      value: 102,
      rows: WRAPPER_ROWS,
    });
    expect(bag().trail.map((c) => c.id)).toEqual([102]);
    expect(bag().selected?.id).toBe(102);
    expect(bag().atLeaf).toBe(true);
    expect(rungCount(bag())).toBe(1);
  });
});

/**
 * An AUTHORED `children_as: "transparent"` child, sitting among two ordinary
 * siblings — the case the structural wrapper rule above never covered,
 * because it has more than one sibling.
 */
const SIBLING_ROOT = categoryRow(200, "siblings", "category.siblings", null, "", "201,202,203");
const SIBLING_A = categoryRow(201, "sib-a", "category.sib_a", 200, "200", "");
const TRANSPARENT_SIBLING = categoryRow(202, "offer", "category.offer", 200, "200", "210,211", {
  children_as: "transparent",
});
const SIBLING_B = categoryRow(203, "sib-b", "category.sib_b", 200, "200", "");
const TRANSPARENT_GROUP_A = categoryRow(210, "group-a", "category.group_a", 202, "200,202", "");
const TRANSPARENT_GROUP_B = categoryRow(211, "group-b", "category.group_b", 202, "200,202", "");
const SIBLING_ROWS: readonly Category[] = [
  ...ROWS,
  SIBLING_ROOT,
  SIBLING_A,
  TRANSPARENT_SIBLING,
  SIBLING_B,
  TRANSPARENT_GROUP_A,
  TRANSPARENT_GROUP_B,
];

describe("useCategoryCascade — a transparent child among several siblings is invisible too", () => {
  it("splices its own children into the rung, in place, order kept", async () => {
    const { bag } = await mountProbe({ rootId: 200, rows: SIBLING_ROWS });
    await waitFor(() => {
      const state = bag().state;
      const options = state.status === "ready" ? state.data[0]?.options : [];
      expect(options?.map((o) => o.category.id)).toEqual([201, 210, 211, 203]);
    });
    expect(rungCount(bag())).toBe(1);
  });

  it("a ladder already past it shows one rung, not two", async () => {
    const { bag } = await mountProbe({ rootId: 200, value: 210, rows: SIBLING_ROWS });
    expect(bag().trail.map((c) => c.id)).toEqual([210]);
    expect(bag().selected?.id).toBe(210);
    expect(bag().atLeaf).toBe(true);
    expect(rungCount(bag())).toBe(1);
  });
});
