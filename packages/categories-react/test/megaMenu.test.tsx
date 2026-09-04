/**
 * `<CategoryMegaMenu>` — the desktop catalogue panel.
 *
 * The four properties worth holding: it does not appear on a narrow viewport
 * however it was mounted; a keyboard can walk the rail and step into the pane
 * without a pointer; a crowded third level ends in a link to the level that
 * holds the rest rather than growing the panel; and Escape or a click outside
 * TELLS THE HOST rather than hiding the panel behind the host's back.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CategoryMegaMenu } from "../src/default/index.js";
import {
  DESKTOP_WIDTH,
  PHONE_WIDTH,
  TestProviders,
  installViewport,
  mockServer,
  resetViewportListeners,
  setViewport,
} from "./harness.js";
import { TREE, TREE_PARTS } from "./fixtures.js";

const OK = { "/tree/": { body: TREE } };

beforeAll(() => {
  installViewport();
});
beforeEach(() => {
  resetViewportListeners();
  setViewport(DESKTOP_WIDTH);
});

async function mountMenu(
  props: Partial<Parameters<typeof CategoryMegaMenu>[0]> = {}
): Promise<void> {
  render(
    <TestProviders server={mockServer(OK)}>
      <CategoryMegaMenu {...props} />
    </TestProviders>
  );
  await waitFor(() => {
    expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();
  });
}

describe("<CategoryMegaMenu>", () => {
  it("does not render below minWidth, and asks the server nothing there", async () => {
    setViewport(PHONE_WIDTH);
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryMegaMenu />
      </TestProviders>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("categories-mega-menu")).toBeNull();
    // A panel nobody may see must not pay for the rows it would hide.
    expect(server.calls.filter((c) => c.url.includes("/tree/"))).toHaveLength(0);
  });

  it("honours a caller's own minWidth", async () => {
    setViewport(PHONE_WIDTH);
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryMegaMenu minWidth={PHONE_WIDTH} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();
    });
  });

  it("draws a rail of roots and the first root's second level", async () => {
    await mountMenu();
    const rail = screen.getByRole("menu");
    const roots = screen.getAllByRole("menuitem");
    expect(rail).toBeTruthy();
    expect(roots).toHaveLength(2);
    expect(roots[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(roots[1]?.getAttribute("aria-expanded")).toBe("false");
    // Transport's two second-level columns, not electronics'.
    expect(screen.getByTestId("categories-mega-menu-column-151")).toBeTruthy();
    expect(screen.getByTestId("categories-mega-menu-column-161")).toBeTruthy();
    expect(screen.queryByTestId("categories-mega-menu-column-2")).toBeNull();
  });

  it("selects a root on hover, without a click", async () => {
    await mountMenu();
    fireEvent.mouseEnter(screen.getByTestId("categories-mega-menu-root-1"));
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu-column-2")).toBeTruthy();
    });
  });

  it("walks the rail with the arrow keys and steps into the pane", async () => {
    await mountMenu();
    const panel = screen.getByTestId("categories-mega-menu");
    const first = screen.getByTestId("categories-mega-menu-root-141");
    act(() => {
      first.focus();
    });

    fireEvent.keyDown(panel, { key: "ArrowDown" });
    await waitFor(() => {
      expect(
        screen.getByTestId("categories-mega-menu-root-1").getAttribute("aria-expanded")
      ).toBe("true");
    });
    expect(document.activeElement).toBe(
      screen.getByTestId("categories-mega-menu-root-1")
    );
    // Roving tabindex: exactly one rail stop in the tab order.
    const stops = screen
      .getAllByRole("menuitem")
      .filter((item) => item.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);

    fireEvent.keyDown(panel, { key: "Home" });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("categories-mega-menu-root-141")
      );
    });

    // ArrowRight leaves the rail for the first link of the disclosed pane.
    fireEvent.keyDown(panel, { key: "ArrowRight" });
    const pane = screen.getByTestId("categories-mega-menu-pane");
    await waitFor(() => {
      expect(pane.contains(document.activeElement)).toBe(true);
    });

    // …and ArrowLeft comes back to the root that opened it.
    fireEvent.keyDown(panel, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("categories-mega-menu-root-141")
      );
    });
  });

  it("ends a crowded column with a link to the node that holds the rest", async () => {
    await mountMenu();
    const column = screen.getByTestId("categories-mega-menu-column-161");
    const links = column.querySelectorAll("a");
    // header + five children + the tail, and no more.
    expect(links).toHaveLength(7);
    expect(TREE_PARTS.children).toHaveLength(7);
    const tail = links[links.length - 1];
    expect(tail?.textContent).toBe("2 more");
    // The tail leads to the SECOND-LEVEL node, whose page lists them all.
    expect(tail?.getAttribute("data-category-id")).toBe("161");
  });

  it("respects maxLinksPerColumn", async () => {
    await mountMenu({ maxLinksPerColumn: 2 });
    const column = screen.getByTestId("categories-mega-menu-column-161");
    expect(column.querySelectorAll("a")).toHaveLength(4);
    expect(column.textContent).toContain("5 more");
  });

  it("builds hrefs from basePath, and from a caller's builder when given", async () => {
    await mountMenu();
    const header = screen
      .getByTestId("categories-mega-menu-column-151")
      .querySelector("a");
    expect(header?.getAttribute("href")).toBe("/c/cars");

    screen.getByTestId("categories-mega-menu").remove();
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryMegaMenu href={(node) => `/search?category=${node.path}`} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();
    });
    const built = screen
      .getByTestId("categories-mega-menu-column-151")
      .querySelector("a");
    expect(built?.getAttribute("href")).toBe("/search?category=141/151");
  });

  it("tells the host on Escape and on a click outside — it never hides itself", async () => {
    const onClose = vi.fn();
    await mountMenu({ onClose });
    fireEvent.keyDown(screen.getByTestId("categories-mega-menu"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Still mounted: the host owns the open state.
    expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(screen.getByTestId("categories-mega-menu-pane"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("asks the server nothing when the host hands the nodes in", async () => {
    const server = mockServer(OK);
    render(
      <TestProviders server={server}>
        <CategoryMegaMenu nodes={TREE} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu")).toBeTruthy();
    });
    expect(server.calls.filter((c) => c.url.includes("/tree/"))).toHaveLength(0);
  });

  it("says the catalogue is empty rather than drawing an empty panel", async () => {
    render(
      <TestProviders server={mockServer(OK)}>
        <CategoryMegaMenu nodes={[]} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu-empty")).toBeTruthy();
    });
  });

  it("reports a refusal with a retry beside it", async () => {
    render(
      <TestProviders
        server={mockServer({
          "/tree/": { status: 503, body: { code: "stapel.http.503", message: "down" } },
        })}
      >
        <CategoryMegaMenu />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu-failed")).toBeTruthy();
    });
  });

  it("fires onSelect for a root, a column header (child) and a third-level link (grandchild)", async () => {
    const onSelect = vi.fn();
    await mountMenu({ onSelect });

    // Root: fired beside the existing hover/arrow selection, not instead of
    // it — the rail still opens electronics' own pane.
    fireEvent.click(screen.getByTestId("categories-mega-menu-root-1"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      "root"
    );
    await waitFor(() => {
      expect(screen.getByTestId("categories-mega-menu-column-2")).toBeTruthy();
    });

    // Child: the column's own header link (phones, id 2).
    const header = document.querySelector('[data-category-id="2"]');
    expect(header).not.toBeNull();
    fireEvent.click(header as Element);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      "child"
    );

    // Grandchild: a third-level link under it (used-phones, id 4).
    const grandchild = document.querySelector('[data-category-id="4"]');
    expect(grandchild).not.toBeNull();
    fireEvent.click(grandchild as Element);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      "grandchild"
    );
  });

  it("fires onSelect for the 'N more' tail link, naming the SAME node as its header", async () => {
    // TREE_PARTS (transport's own second root, mounted by default) has seven
    // children against the default cap of five, which is what makes the tail
    // link exist at all.
    const onSelect = vi.fn();
    await mountMenu({ onSelect });
    const column = screen.getByTestId("categories-mega-menu-column-161");
    const links = column.querySelectorAll("a");
    const tail = links[links.length - 1] as HTMLElement;
    expect(tail.textContent).toBe("2 more");
    fireEvent.click(tail);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 161 }),
      "child"
    );
  });
});
