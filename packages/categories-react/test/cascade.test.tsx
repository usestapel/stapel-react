/**
 * The cascading child selector — the control the tile cap hands over to.
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
 */
import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  buildCategoryCascade,
  buildCategoryTree,
  cascadeReachedLeaf,
  cascadeSelection,
  cascadeTrail,
  useCategoryCascade,
} from "../src/index.js";
import type { CatalogStore, CategoryCascadeBag } from "../src/index.js";
import { CategoryCascadeField } from "../src/default/index.js";
import { FULL_PAGE, ROWS } from "./fixtures.js";
import { TestProviders, mockServer, testStore } from "./harness.js";

const INDEX = buildCategoryTree(ROWS);

describe("buildCategoryCascade", () => {
  it("offers the roots, and nothing below them, until one is answered", () => {
    const levels = buildCategoryCascade(INDEX);
    expect(levels).toHaveLength(1);
    expect(levels[0]?.parent).toBeNull();
    expect(levels[0]?.options.map((n) => n.id)).toEqual([1, 5]);
    expect(levels[0]?.chosen).toBeNull();
  });

  it("builds one rung per answered level, ending at the first unanswered one", () => {
    const levels = buildCategoryCascade(INDEX, { cursorId: 2 });
    expect(levels.map((l) => l.chosen?.id ?? null)).toEqual([1, 2, null]);
    expect(levels[2]?.options.map((n) => n.id)).toEqual([4]);
  });

  it("stops at a leaf rather than trailing an empty select", () => {
    const levels = buildCategoryCascade(INDEX, { cursorId: 4 });
    expect(levels.map((l) => l.chosen?.id ?? null)).toEqual([1, 2, 4]);
    expect(cascadeReachedLeaf(levels)).toBe(true);
    expect(cascadeSelection(levels)?.id).toBe(4);
    expect(cascadeTrail(levels).map((n) => n.id)).toEqual([1, 2, 4]);
  });

  it("a ROOT starts the ladder below itself — the tiles' handover point", () => {
    const levels = buildCategoryCascade(INDEX, { rootId: 2, cursorId: 4 });
    expect(levels).toHaveLength(1);
    expect(levels[0]?.parent?.id).toBe(2);
    expect(levels[0]?.chosen?.id).toBe(4);
    // The root is where the person already was; it is not something the
    // cascade chose for them.
    expect(cascadeTrail(levels).map((n) => n.id)).toEqual([4]);
  });

  it("a rooted cascade whose root is a LEAF has no rungs at all", () => {
    expect(buildCategoryCascade(INDEX, { rootId: 4 })).toEqual([]);
  });

  it("a root the index does not hold answers EMPTY, never the whole tree", () => {
    // Offering the catalogue where one branch was asked for is a wrong answer
    // that looks like a working control.
    expect(buildCategoryCascade(INDEX, { rootId: 999 })).toEqual([]);
  });

  it("a cursor outside the root's subtree is treated as unanswered", () => {
    const levels = buildCategoryCascade(INDEX, { rootId: 2, cursorId: 5 });
    expect(levels[0]?.chosen).toBeNull();
  });

  it("truncation is not an operation: a shallower cursor drops every level below", () => {
    const deep = buildCategoryCascade(INDEX, { cursorId: 4 });
    const shallow = buildCategoryCascade(INDEX, { cursorId: 1 });
    expect(deep).toHaveLength(3);
    expect(shallow).toHaveLength(2);
    expect(shallow[1]?.chosen).toBeNull();
  });
});

function Probe(props: {
  readonly onBag: (bag: CategoryCascadeBag) => void;
  readonly store: CatalogStore;
  readonly commit?: "any" | "leaf";
  readonly value?: number | null;
  readonly onChange?: (id: number | null) => void;
}): null {
  props.onBag(
    useCategoryCascade({
      store: props.store,
      ...(props.commit !== undefined ? { commit: props.commit } : {}),
      ...(props.value !== undefined ? { value: props.value } : {}),
      ...(props.onChange !== undefined ? { onChange: props.onChange } : {}),
    })
  );
  return null;
}

async function mountProbe(props: {
  readonly commit?: "any" | "leaf";
  readonly value?: number | null;
  readonly onChange?: (id: number | null) => void;
}): Promise<() => CategoryCascadeBag> {
  const server = mockServer({ "/categories/": { body: FULL_PAGE } });
  const store = testStore();
  let latest: CategoryCascadeBag | null = null;
  render(
    <TestProviders server={server}>
      <Probe
        {...props}
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
  return () => latest as unknown as CategoryCascadeBag;
}

describe("useCategoryCascade", () => {
  it("commit:any reports every choice — the FILTER's rule", async () => {
    const seen: (number | null)[] = [];
    const bag = await mountProbe({
      commit: "any",
      onChange: (id) => seen.push(id),
    });
    act(() => {
      bag().choose(0, INDEX.byId.get(1) ?? null);
    });
    // "Everything under Electronics" is the commonest narrowing there is, and
    // the index matches a category path as a prefix precisely for it.
    expect(seen).toEqual([1]);
    expect(bag().selected?.id).toBe(1);
    expect(bag().atLeaf).toBe(false);
  });

  it("commit:leaf withholds a non-leaf and still advances the ladder", async () => {
    const seen: (number | null)[] = [];
    const bag = await mountProbe({
      commit: "leaf",
      onChange: (id) => seen.push(id),
    });

    act(() => {
      bag().choose(0, INDEX.byId.get(1) ?? null);
    });
    // Not reported: a listing under `electronics` inherits the wrong schema.
    expect(seen).toEqual([null]);
    // But the ladder moved, which is the point — the cursor is not the value.
    const advanced = bag().state;
    expect(advanced.status === "ready" ? advanced.data.length : 0).toBe(2);
    expect(bag().blockedReason).toBe("not_a_leaf");

    act(() => {
      bag().choose(1, INDEX.byId.get(2) ?? null);
    });
    act(() => {
      bag().choose(2, INDEX.byId.get(4) ?? null);
    });
    expect(seen).toEqual([null, null, 4]);
    expect(bag().atLeaf).toBe(true);
    expect(bag().blockedReason).toBeNull();
  });

  it("popping a crumb un-answers that level and everything under it", async () => {
    const seen: (number | null)[] = [];
    const bag = await mountProbe({
      commit: "any",
      onChange: (id) => seen.push(id),
    });
    act(() => {
      bag().choose(0, INDEX.byId.get(1) ?? null);
    });
    act(() => {
      bag().choose(1, INDEX.byId.get(2) ?? null);
    });
    expect(bag().trail.map((n) => n.id)).toEqual([1, 2]);

    act(() => {
      bag().clearFrom(1);
    });
    expect(bag().trail.map((n) => n.id)).toEqual([1]);
    expect(seen[seen.length - 1]).toBe(1);

    act(() => {
      bag().clearFrom(0);
    });
    expect(bag().trail).toEqual([]);
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("an incoming value wins over the cursor — the browser's Back button", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    const store = testStore();
    let latest: CategoryCascadeBag | null = null;
    const view = render(
      <TestProviders server={server}>
        <Probe
          value={4}
          commit="any"
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
    expect((latest as unknown as CategoryCascadeBag).trail.map((n) => n.id)).toEqual([
      1, 2, 4,
    ]);

    view.rerender(
      <TestProviders server={server}>
        <Probe
          value={1}
          commit="any"
          store={store}
          onBag={(bag) => {
            latest = bag;
          }}
        />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        (latest as unknown as CategoryCascadeBag).trail.map((n) => n.id)
      ).toEqual([1]);
    });
  });
});

describe("<CategoryCascadeField>", () => {
  it("draws one select per rung, and grows one as the ladder descends", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
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
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
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
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
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
