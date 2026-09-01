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
  readonly commit?: "any" | "leaf";
  readonly value?: number | null;
  readonly roots?: readonly Category[];
  readonly onChange?: (id: number | null) => void;
}): null {
  props.onBag(
    useCategoryCascade({
      store: props.store,
      ...(props.rootId !== undefined ? { rootId: props.rootId } : {}),
      ...(props.commit !== undefined ? { commit: props.commit } : {}),
      ...(props.value !== undefined ? { value: props.value } : {}),
      ...(props.roots !== undefined ? { roots: props.roots } : {}),
      ...(props.onChange !== undefined ? { onChange: props.onChange } : {}),
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
  readonly commit?: "any" | "leaf";
  readonly value?: number | null;
  readonly roots?: readonly Category[];
  readonly onChange?: (id: number | null) => void;
  /** What `GET /categories/carousel/` answers. Omitted, the route does not
   * exist at all — a deployment with no curated strip, which is the case the
   * catalogue-sync fallback is for. */
  readonly carousel?: readonly Category[];
}): Promise<Mounted> {
  const { carousel, ...probeProps } = props;
  const server = mockServer({
    "/categories/": { body: FULL_PAGE },
    ...(carousel !== undefined
      ? { "/categories/carousel/": { body: carousel } }
      : {}),
    ...rowRoutes(ROWS),
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

  it("mounted at a leaf, it reports the leaf and every crumb above it", async () => {
    const server = mockServer({
      "/categories/": { body: FULL_PAGE },
      ...rowRoutes(ROWS),
    });
    render(
      <TestProviders server={server}>
        <CategoryCascadeField commit="leaf" value={4} store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-cascade-selected")).toBeTruthy();
    });
    expect(screen.getByTestId("categories-cascade").dataset["atLeaf"]).toBe("true");
    expect(screen.getByTestId("categories-cascade-crumb-1")).toBeTruthy();
    expect(screen.getByTestId("categories-cascade-crumb-2")).toBeTruthy();
    expect(screen.getByTestId("categories-cascade-crumb-4")).toBeTruthy();
  });
});
