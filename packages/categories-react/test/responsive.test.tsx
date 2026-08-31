/**
 * Every shipped surface, drawn at BOTH widths and on BOTH sides of the theme.
 *
 * The visual pass scored this pair 1/5 for aesthetics and 1/5 for UX with a
 * one-line explanation: the antd skin on disk had never been rendered in a
 * story, so nothing photographed it and nothing protected it. The demos now
 * do the photographing; this file is the machine half of the same claim —
 * a surface that renders only on a desktop, or only in light mode, fails here
 * rather than in somebody's browser.
 *
 * The viewport and the theme are mocked at the ENVIRONMENT edge (a real
 * `matchMedia` over a real `innerWidth`, a real `data-theme` attribute), never
 * by stubbing `useDialogSurface`/`useThemeMode` — a stub would keep passing if
 * a hook's query and `@stapel/tokens`' breakpoints ever disagreed.
 */
import type { ReactElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CatalogPage,
  CategoryBreadcrumbsBar,
  CategoryCarouselStrip,
  CategoryFeatureList,
  CategoryPage,
  CategoryPickerField,
  CategoryTreePane,
} from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setDocumentTheme,
  setViewport,
} from "./harness.js";
import { ELECTRONICS, FEATURES, FULL_PAGE } from "./fixtures.js";

const OK = {
  "/categories/carousel/": { body: [ELECTRONICS] },
  "/features/": { body: FEATURES },
  "/categories/": { body: FULL_PAGE },
};

/** Every `/default` surface the pair ships, with the props that make it real. */
const SURFACES: readonly {
  readonly name: string;
  readonly testId: string;
  readonly render: () => ReactElement;
}[] = [
  {
    name: "CatalogPage",
    testId: "categories-catalog-page",
    render: () => <CatalogPage />,
  },
  {
    name: "CategoryPage",
    testId: "categories-category-page",
    render: () => <CategoryPage slug="phones" />,
  },
  {
    name: "CategoryTreePane",
    testId: "categories-tree",
    render: () => <CategoryTreePane />,
  },
  {
    name: "CategoryCarouselStrip",
    testId: "categories-carousel",
    render: () => <CategoryCarouselStrip />,
  },
  {
    name: "CategoryBreadcrumbsBar",
    testId: "categories-breadcrumbs",
    render: () => <CategoryBreadcrumbsBar slug="used-phones" />,
  },
  {
    name: "CategoryPickerField",
    testId: "categories-picker",
    render: () => <CategoryPickerField value={null} />,
  },
  {
    name: "CategoryFeatureList",
    testId: "categories-features",
    render: () => <CategoryFeatureList categoryId={2} />,
  },
];

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
});
afterEach(async () => {
  await setDocumentTheme(null);
});

describe.each([
  ["phone", PHONE_WIDTH],
  ["desktop", DESKTOP_WIDTH],
] as const)("%s", (_label, width) => {
  describe.each(["light", "dark"] as const)("%s", (mode) => {
    for (const surface of SURFACES) {
      it(`renders <${surface.name}> on the ${mode} side`, async () => {
        setViewport(width);
        await setDocumentTheme(mode);
        const { container } = render(
          <TestProviders server={mockServer(OK)}>
            {surface.render()}
          </TestProviders>
        );
        await waitFor(() => {
          expect(screen.getByTestId(surface.testId)).toBeTruthy();
        });
        // The skin painted ITS OWN surface on the side the document declares —
        // the defect this replaces was a light-themed panel on a dark page.
        const root = container.querySelector("[data-stapel-skin-root]");
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe(mode);
      });
    }
  });
});

describe("the phone shape is a different shape, not a narrower one", () => {
  it("<CategoryPickerField> is a trigger + bottom sheet on a phone", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    // Closed: the drill-down is NOT inline — that is the whole point.
    const open = await screen.findByTestId("categories-picker-open");
    expect(screen.queryByTestId("categories-picker-list")).toBeNull();

    fireEvent.click(open);
    await waitFor(() => {
      expect(screen.getByTestId("categories-picker-list")).toBeTruthy();
    });
    expect(
      document
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
  });

  it("names the trigger without printing a second heading over it", async () => {
    // The composer's form item already prints "Category". A second visible
    // copy underneath reads as two stacked controls — but dropping the word
    // from the ACCESSIBILITY TREE would leave a button whose only name is the
    // value, with nothing saying what it is a choice of. So: named, joined to
    // the value, and off the screen.
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    const trigger = await screen.findByTestId("categories-picker-open");
    const ids = (trigger.getAttribute("aria-labelledby") ?? "").split(" ");
    // Both halves are in the tree, in reading order: the name and the
    // current answer.
    expect(ids).toHaveLength(2);
    const named = ids.map((id) => document.getElementById(id));
    expect(named.map((node) => node?.textContent)).toEqual([
      "Category",
      "Choose a category",
    ]);
    // …and the name is CLIPPED rather than removed: `display: none` would
    // take it out of the accessibility tree along with the screen, which is
    // the whole distinction this change rests on.
    expect(named[0]?.getAttribute("style")).toContain("clip-path");
    expect(named[0]?.getAttribute("style")).not.toContain("display: none");
  });

  it("keeps the sheet's own visible title, which duplicates nothing", async () => {
    // A dialog with no header is a panel that appeared. The key is shared
    // with the trigger's hidden name on purpose — one word, one translation.
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} defaultOpen />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-picker-list")).toBeTruthy();
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Category");
  });

  it("choosing a leaf closes the sheet — the journey is over", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    fireEvent.click(await screen.findByTestId("categories-picker-open"));
    // "vehicles" is a root with no children: a leaf, so it selects.
    const leaf = await screen.findByTestId("categories-picker-option-5");
    fireEvent.click(leaf);
    await waitFor(() => {
      expect(screen.queryByTestId("categories-picker-list")).toBeNull();
    });
  });

  it("<CategoryPickerField> keeps the inline list on a desktop", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-picker-list")).toBeTruthy();
    });
    expect(screen.queryByTestId("categories-picker-open")).toBeNull();
  });

  it("`surface` pins the shape for a host that is not the viewport", async () => {
    setViewport(DESKTOP_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryPickerField value={null} surface="sheet" />
      </TestProviders>
    );
    expect(await screen.findByTestId("categories-picker-open")).toBeTruthy();
  });
});
