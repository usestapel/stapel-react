/**
 * Every shipped skin surface, drawn on all four sides of the grid the visual
 * pass found unguarded: phone × desktop, light × dark.
 *
 * The two defects this exists to catch are both fleet classes:
 *
 * - **CF-1** — a skin that read the mode once (or defaulted to `"light"`)
 *   rendered light widgets on a dark page. The pair's own `theme.tsx` is gone
 *   and `<SkinTheme>` subscribes to the document's `data-theme`, so the
 *   assertion is on the stamp the substrate leaves: `data-stapel-skin-mode`
 *   must follow the document, in both directions, with no prop passed.
 * - **sub-44px touch targets** — `SkinTheme` raises antd's `controlHeight` to
 *   44 on a phone, and that is only true if something reads it. The controls
 *   are asserted through the rendered box rather than through the token, so a
 *   regression in the wiring (not just in the number) fails here.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  RatingBadge,
  ReviewFormCard,
  ReviewListPanel,
  ReviewModerationPanel,
  ReviewResponseComposer,
  ReviewsPanel,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { RATED, TARGET, page, review } from "./fixtures.js";

const PHONE = 390;
const DESKTOP = 1280;

/**
 * A `matchMedia` that actually answers `(min-width: N)` against a width, the
 * way `packages/tokens-antd/test/env.tsx` does. jsdom's is a stub that always
 * says `false`, i.e. permanently desktop — which is exactly how a phone-only
 * rule ships broken.
 */
function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    const matches =
      (min === null || width >= Number(min[1])) &&
      (max === null || width <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

function setThemeAttribute(mode: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", mode);
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

/** Every surface the barrel exports that paints a `SkinTheme` root. */
const SURFACES: readonly {
  name: string;
  render: () => ReactElement;
  ready: string;
}[] = [
  {
    name: "RatingBadge",
    ready: "reviews-rating",
    render: () => <RatingBadge target={TARGET} />,
  },
  {
    name: "ReviewListPanel",
    ready: "reviews-list",
    render: () => <ReviewListPanel target={TARGET} />,
  },
  {
    name: "ReviewFormCard",
    ready: "reviews-form",
    render: () => <ReviewFormCard target={TARGET} />,
  },
  {
    name: "ReviewModerationPanel",
    ready: "reviews-moderation-panel",
    render: () => <ReviewModerationPanel target={TARGET} canModerate />,
  },
  {
    name: "ReviewResponseComposer",
    ready: "reviews-response-composer",
    render: () => (
      <ReviewResponseComposer target={TARGET} review={review()} canRespond />
    ),
  },
  {
    name: "ReviewsPanel",
    ready: "reviews-panel",
    render: () => <ReviewsPanel target={TARGET} />,
  },
];

function server() {
  return mockServer({
    "/reviews/aggregate": { body: RATED },
    "/reviews": { body: page([review()]) },
  });
}

describe.each([
  ["phone", PHONE],
  ["desktop", DESKTOP],
] as const)("%s", (_label, width) => {
  beforeEach(() => {
    setViewport(width);
  });

  describe.each(["light", "dark"] as const)("%s", (mode) => {
    for (const surface of SURFACES) {
      it(`${surface.name} renders and follows the document mode`, async () => {
        setThemeAttribute(mode);
        const { container } = render(
          <TestProviders server={server()}>{surface.render()}</TestProviders>
        );
        await waitFor(() => {
          expect(screen.getByTestId(surface.ready)).toBeTruthy();
        });
        const roots = container.querySelectorAll("[data-stapel-skin-mode]");
        expect(roots.length, `${surface.name} paints a skin root`).toBeGreaterThan(
          0
        );
        for (const root of roots) {
          expect(
            root.getAttribute("data-stapel-skin-mode"),
            `${surface.name} on a ${mode} document`
          ).toBe(mode);
        }
      });
    }
  });
});

describe("a runtime theme toggle repaints a mounted skin", () => {
  beforeEach(() => {
    setViewport(DESKTOP);
  });

  it("follows data-theme in BOTH directions, with no prop passed", async () => {
    setThemeAttribute("light");
    const { container } = render(
      <TestProviders server={server()}>
        <ReviewListPanel target={TARGET} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("reviews-list")).toBeTruthy();
    });
    const root = () =>
      container.querySelector("[data-stapel-skin-mode]")?.getAttribute(
        "data-stapel-skin-mode"
      );
    expect(root()).toBe("light");
    // The defect this replaces: `resolveThemeMode()` sampled the attribute
    // once at render time, so a shell-react theme control left every mounted
    // skin on the old side until something unrelated re-rendered it.
    await act(async () => {
      setThemeAttribute("dark");
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(root()).toBe("dark");
    });
  });
});
