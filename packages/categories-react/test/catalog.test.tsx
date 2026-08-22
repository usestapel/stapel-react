/**
 * The three outcomes of every read (`no-flattened-load-state` catches the
 * syntax; this catches the meaning), plus the persistence seam.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  CategoryTree,
  EMPTY_SNAPSHOT,
  createCatalogStore,
  memoryCatalogStore,
} from "../src/index.js";
import type { CatalogStore } from "../src/index.js";
import { BASE, TestProviders, mockServer, testStore } from "./harness.js";
import { FULL_PAGE, page } from "./fixtures.js";

function Probe(props: { store: CatalogStore; slug?: string }): ReactElement {
  return (
    <CategoryTree
      store={props.store}
      {...(props.slug !== undefined ? { slug: props.slug } : {})}
    >
      {(bag) => (
        <div>
          <span data-testid="status">{bag.state.status}</span>
          <span data-testid="truncated">{String(bag.truncated)}</span>
          <span data-testid="unknown">{String(bag.unknownSlug)}</span>
          <span data-testid="rows">
            {bag.state.status === "ready"
              ? bag.state.data.map((n) => n.category.slug).join(",")
              : ""}
          </span>
          <span data-testid="crumbs">
            {bag.breadcrumbs.map((n) => n.category.slug).join("/")}
          </span>
        </div>
      )}
    </CategoryTree>
  );
}

describe("useCategoryCatalog, through <CategoryTree>", () => {
  it("ready: the roots, filtered", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("rows").textContent).toBe("electronics,vehicles");
  });

  it("ready-empty: a catalogue that really has no categories", async () => {
    const server = mockServer({
      "/categories/": { body: page([], { globalMax: 0 }) },
    });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("rows").textContent).toBe("");
  });

  it("failed: a refusal is never an empty catalogue", async () => {
    const server = mockServer({
      "/categories/": {
        status: 503,
        body: { code: "stapel.http.503", message: "down" },
      },
    });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("failed");
    });
  });

  it("loading first, never a flash of empty", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} />
      </TestProviders>
    );
    expect(screen.getByTestId("status").textContent).toBe("loading");
  });

  it("a slug is not 'unknown' until the catalogue has actually loaded", async () => {
    // Otherwise a slow network renders a 404 for a page that exists.
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} slug="nope" />
      </TestProviders>
    );
    expect(screen.getByTestId("unknown").textContent).toBe("false");
    await waitFor(() => {
      expect(screen.getByTestId("unknown").textContent).toBe("true");
    });
  });

  it("resolves /c/:slug against the synced tree and walks its crumbs", async () => {
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} slug="phones" />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("crumbs").textContent).toBe(
        "electronics/phones"
      );
    });
    // A selected category's "level" is its own sub-categories.
    expect(screen.getByTestId("rows").textContent).toBe("used-phones");
  });

  it("does not claim truncation on a complete walk", async () => {
    // `truncated` is a FOURTH condition beside loading/failed/empty, and it
    // must be false unless the page budget actually stopped the walk. The
    // budget itself is exercised in `sync.test.ts`, against the pure walk,
    // where exhausting it costs three requests instead of a thousand.
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });
    render(
      <TestProviders server={server}>
        <Probe store={testStore()} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("truncated").textContent).toBe("false");
  });
});

describe("the catalogue store", () => {
  it("persists a snapshot and re-reads it as a DELTA on the next mount", async () => {
    const store = memoryCatalogStore();
    const server = mockServer({ "/categories/": { body: FULL_PAGE } });

    const first = render(
      <TestProviders server={server}>
        <Probe store={store} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    first.unmount();

    render(
      <TestProviders server={server}>
        <Probe store={store} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });

    const queries = server.queries("/categories/");
    expect(queries[0]?.get("min_revision")).toBeNull();
    // The second mount asked only for what changed — that is the whole point
    // of the store, and without it every storefront page pulls the catalogue.
    expect(queries[queries.length - 1]?.get("min_revision")).toBe("7");
  });

  it("createCatalogStore absorbs a repository that throws on every call", async () => {
    // A cache is an optimization; its failure must not become the page's. The
    // absorbing happens INSIDE createCatalogStore, so this asserts the store
    // rather than the hook — an injected store that rejects is the caller's
    // own contract, and the hook correctly surfaces it as `failed`.
    const throwing = {
      get: () => Promise.reject(new Error("no storage")),
      set: () => Promise.reject(new Error("quota")),
      del: () => Promise.reject(new Error("nope")),
      keys: () => Promise.reject(new Error("nope")),
      clear: () => Promise.reject(new Error("nope")),
    };
    const store: CatalogStore = createCatalogStore({ repository: throwing });
    await expect(store.load()).resolves.toEqual(EMPTY_SNAPSHOT);
    await expect(
      store.save({ version: 1, cursor: 1, rows: [] })
    ).resolves.toBeUndefined();
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it("mounts against the module's own base url", () => {
    expect(BASE.endsWith("/categories/api/v1/")).toBe(true);
  });
});
