/**
 * The category seam, in both directions — the defect that made `/new`
 * unmountable (storefront Wave D, G-1).
 *
 * `categorySlot` was a `ReactNode`, and the composer's category moves only
 * through `bag.setCategory`. A node handed in from outside cannot reach it and
 * there was no `onCategoryChange`, so a container could neither set the
 * category nor learn it — which also meant `features`, the schema of the
 * chosen category, was unreachable rather than withheld. The screen rendered
 * and could not be used.
 *
 * So the tests here are container-shaped: a fake picker stands in for
 * `<CategoryPickerField>` (L2 pairs never import each other), and every claim
 * is measured either on the WIRE (`category_id` in the save body) or on what
 * the container was told (the id its schema read would be keyed by).
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionAvailable } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { ListingComposerPage } from "../src/default/index.js";
import type { ComposerCategorySlot } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, FEATURES } from "./fixtures.js";

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

function server() {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/": { body: DRAFT },
  });
}

/** What the container mounts into the slot. It knows only `value` and
 * `setCategory` — exactly what a real picker is given. */
function FakePicker(props: ComposerCategorySlot): ReactElement {
  return (
    <button
      type="button"
      data-testid="picker"
      data-value={props.value}
      onClick={() => props.setCategory("tools/power")}
    >
      pick
    </button>
  );
}

describe("renderCategoryPicker", () => {
  it("hands the picker the value and the only function that changes it", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          features={[]}
          images={GALLERY}
          renderCategoryPicker={(slot) => <FakePicker {...slot} />}
        />
      </TestProviders>
    );

    // Nothing chosen: the publish button says so rather than going grey.
    expect(screen.getByTestId("picker").getAttribute("data-value")).toBe("");
    // The footer pools identical reasons, so the sentence is followed the way
    // a screen reader follows it — through `aria-describedby`.
    const reasonId = screen
      .getByTestId("listings-composer-publish")
      .getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId ?? "")?.textContent).toBeTruthy();

    fireEvent.click(screen.getByTestId("picker"));

    // The value came back DOWN, which is what a node in a slot could never do.
    await waitFor(() => {
      expect(screen.getByTestId("picker").getAttribute("data-value")).toBe(
        "tools/power"
      );
    });

    // …and it reaches the wire: the draft row is created for that category.
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      const created = srv
        .matching("/listings/")
        .filter((call) => call.method === "POST");
      expect(created[0]?.body).toEqual({ category_id: "tools/power" });
    });
  });

  it("replaces the placeholder rather than rendering beside it", () => {
    render(
      <TestProviders server={server()}>
        <ListingComposerPage
          features={[]}
          images={GALLERY}
          renderCategoryPicker={(slot) => <FakePicker {...slot} />}
        />
      </TestProviders>
    );
    // The slot's own region is still there — it is the seam — but the named
    // placeholder that stands in for an unfilled slot is gone, and there is no
    // text box asking anyone to type a category id.
    expect(
      document.querySelector('[data-stapel-slot="renderCategoryPicker"]')
    ).toBeNull();
    expect(
      screen.getByTestId("listings-composer-category").querySelector("input")
    ).toBeNull();
  });
});

describe("the controlled pair", () => {
  /**
   * The container as it really is: it owns the id because its schema read is
   * keyed by it, and it hands the SAME id back down.
   */
  function Container(props: {
    features: readonly FeatureDef[];
    onCategory: (id: string) => void;
  }): ReactElement {
    const [categoryId, setCategoryId] = useState("");
    return (
      <ListingComposerPage
        features={categoryId === "" ? [] : props.features}
        images={GALLERY}
        category={categoryId}
        onCategoryChange={(id) => {
          setCategoryId(id);
          props.onCategory(id);
        }}
        renderCategoryPicker={(slot) => <FakePicker {...slot} />}
      />
    );
  }

  it("tells the container which category to read the schema for", async () => {
    const seen: string[] = [];
    render(
      <TestProviders server={server()}>
        <Container features={FEATURES} onCategory={(id) => seen.push(id)} />
      </TestProviders>
    );

    // No category has been chosen, which is a different statement from "this
    // category asks for nothing" and from "we are fetching what it asks for":
    // nothing is in flight and nothing will be until a category exists.
    expect(
      screen.getByTestId("listings-composer-features-no-category")
    ).toBeTruthy();
    expect(screen.queryByTestId("listings-composer-features-empty")).toBeNull();
    expect(
      screen.queryByTestId("listings-composer-features-loading")
    ).toBeNull();

    fireEvent.click(screen.getByTestId("picker"));

    expect(seen).toEqual(["tools/power"]);
    // The container's read landed, and the chosen category's questions are on
    // screen — the thing G-1 made unreachable.
    await waitFor(() => {
      expect(
        screen.queryByTestId("listings-composer-features-no-category")
      ).toBeNull();
    });
  });

  it("follows the container's value, and does not keep a second one", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        {/* Controlled and PINNED: the container refuses the change. A composer
            holding its own copy would drift from the schema on screen. */}
        <ListingComposerPage
          features={[]}
          images={GALLERY}
          category="tools/hand"
          renderCategoryPicker={(slot) => <FakePicker {...slot} />}
        />
      </TestProviders>
    );

    expect(screen.getByTestId("picker").getAttribute("data-value")).toBe(
      "tools/hand"
    );
    fireEvent.click(screen.getByTestId("picker"));
    expect(screen.getByTestId("picker").getAttribute("data-value")).toBe(
      "tools/hand"
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      const created = srv
        .matching("/listings/")
        .filter((call) => call.method === "POST");
      expect(created[0]?.body).toEqual({ category_id: "tools/hand" });
    });
  });
});

describe("the README's composer example names props this package has", () => {
  it("spells the render prop and the controlled pair", async () => {
    const { readFileSync } = await import("node:fs");
    const readme = readFileSync("README.md", "utf8");
    const source = readFileSync("src/default/ListingComposerPage.tsx", "utf8");
    const found = new Set<string>();
    for (const match of readme.matchAll(/<ListingComposerPage([\s\S]*?)\/>/g)) {
      for (const attr of (match[1] as string).matchAll(
        /^\s{2}([A-Za-z][A-Za-z0-9]*)=/gm
      )) {
        found.add(attr[1] as string);
      }
    }
    expect([...found]).toContain("renderCategoryPicker");
    expect([...found]).toContain("onCategoryChange");
    for (const prop of found) {
      expect(
        new RegExp(`^\\s+readonly ${prop}[?]?:`, "m").test(source),
        `README documents <ListingComposerPage ${prop}={…}> but the props declaration has no ${prop}`
      ).toBe(true);
    }
  });
});
