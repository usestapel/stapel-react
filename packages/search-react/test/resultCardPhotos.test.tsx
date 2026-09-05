/**
 * THE PHOTO ON THE GENERIC CARD — the defect this suite exists for.
 *
 * The default card read `card.image` as an object with a `url` key and fell
 * back to `card.image_url`. The fleet emits neither: `stapel-classified`'s
 * search projection stores a plain `<type>/<hash>` CDN reference in `image`
 * and, since 0.7.0, the whole seller-ordered gallery in `images[]`; the one
 * rich shape that exists (chat's subject card, which serves the same CDN
 * render descriptor its attachments carry) has `ref` + `variants[]` and NO
 * top-level `url`, so the `"url" in rich` guard rejected it too. Every
 * consumer that did not pass its own `renderCard` therefore got a card with no
 * photo at all.
 *
 * The assertions are about SHAPES and about what reaches the DOM — never
 * about a loaded `<img>`. `@stapel/image` commits a source only after the
 * slot is measured and the bytes decode, and jsdom does neither; a suite that
 * asserted on `src` would be asserting on the test environment.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  SearchProvider,
  createSearchRuntime,
  registerSearchI18n,
} from "../src/index.js";
import type { SearchImageResolver, SearchItem } from "../src/index.js";
import { SearchResultCard } from "../src/default/SearchResultCard.js";
import { readCardPhotos } from "../src/default/cardPhotos.js";
import { BASE, mockServer } from "./harness.js";

/** A deployment's `resolveImage`: it knows `image/*` and nothing else. */
const resolveImage: SearchImageResolver = (ref) =>
  ref.startsWith("image/")
    ? {
        source: "cdn",
        url: `https://cdn.test/${ref}/720w.webp`,
        mime: "image/webp",
        width: 720,
        height: 540,
        aspect: 4 / 3,
        square: false,
        preview_b64: null,
        variants: [
          {
            tier: "320",
            branch: null,
            url: `https://cdn.test/${ref}/320.webp`,
            width: 320,
            height: 240,
          },
          {
            tier: "720",
            branch: "w",
            url: `https://cdn.test/${ref}/720w.webp`,
            width: 720,
            height: 540,
          },
        ],
      }
    : undefined;

/** The rich shape the fleet actually has: a CDN render descriptor. */
const RENDER_META = {
  ref: "image/abc123",
  mime: "image/webp",
  width: 1200,
  height: 900,
  aspect: 4 / 3,
  square: false,
  preview_b64: "data:image/png;base64,AAAA",
  variants: [
    { tier: 320, branch: null, url: "https://cdn.test/320.webp", width: 320, height: 240 },
    { tier: 720, branch: "w", url: "https://cdn.test/720.webp", width: 720, height: 540 },
    {
      tier: "original",
      branch: null,
      url: "https://cdn.test/original.webp",
      width: 1200,
      height: 900,
    },
  ],
};

function item(card: Record<string, unknown>): SearchItem {
  return { key: "l-1", score: 1, promoted: false, owner_key: "", distance_km: null, card };
}

/** `null` means "this deployment wired no resolver" — the live defect. */
function renderCard(
  value: SearchItem,
  resolve: SearchImageResolver | null = resolveImage
): void {
  const server = mockServer({});
  const runtime = createSearchRuntime({
    baseUrl: BASE,
    fetch: server.fetch,
    ...(resolve === null ? {} : { resolveImage: resolve }),
  });
  const i18n = createI18n({ locale: "en" });
  registerSearchI18n(i18n);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree: ReactElement = (
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <SearchProvider runtime={runtime}>
          <SearchResultCard item={value} />
        </SearchProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  render(tree);
}

/** The slides the card actually drew. */
function slides(): readonly Element[] {
  const strip = screen.queryByTestId("search-result-photos");
  return strip === null ? [] : Array.from(strip.querySelectorAll("li"));
}

// ── the three stored shapes, read as data ───────────────────────────────────

describe("readCardPhotos reads the shapes the fleet emits", () => {
  it("resolves a string CDN reference through the seam, and only that way", () => {
    const asked: string[] = [];
    const photos = readCardPhotos({ image: "image/abc123" }, (ref) => {
      asked.push(ref);
      return resolveImage(ref);
    });
    // The reference is opaque: nothing in the pair builds a URL out of it, so
    // what is drawable can only have come from the deployment's resolver.
    expect(asked).toEqual(["image/abc123"]);
    expect(photos.images).toHaveLength(1);
    expect(photos.images[0]?.url).toBe("https://cdn.test/image/abc123/720w.webp");
  });

  it("names an unresolvable reference as stored-but-not-drawable", () => {
    const photos = readCardPhotos({ image: "image/gone" }, () => undefined);
    // The two are different facts and the card draws them differently: one
    // reserves a well and says why, the other reserves nothing.
    expect(photos.stored).toBe(1);
    expect(photos.images).toHaveLength(0);
  });

  it("needs no resolver for a URL a doc type stored itself", () => {
    // A CDN reference is `<type>/<hash>`: no scheme, no leading slash. So the
    // two are told apart by shape, never by a guess.
    for (const url of ["https://pics.test/a.jpg", "/media/a.jpg", "data:image/png;base64,AA"]) {
      const photos = readCardPhotos({ image: url }, undefined);
      expect(photos.images[0]?.url).toBe(url);
      expect(photos.images[0]?.source).toBe("link");
    }
  });

  it("draws a ref-shaped object — it carries `ref` and `variants`, not `url`", () => {
    // The old guard was `"url" in rich`, which is exactly the key this shape
    // does not have, so the one rich shape in the fleet drew nothing.
    const photos = readCardPhotos({ image: RENDER_META }, undefined);
    expect(photos.images).toHaveLength(1);
    const image = photos.images[0];
    // Past the top of the ladder there is no tier that avoids an upscale, so
    // `original` is the honest display URL.
    expect(image?.url).toBe("https://cdn.test/original.webp");
    // The whole ladder survives: that is what lets `<Image>` pick a tier.
    expect(image?.variants.map((v) => v.tier)).toEqual(["320", "720", "original"]);
    expect(image?.preview_b64).toBe("data:image/png;base64,AAAA");
    expect(image?.aspect).toBe(4 / 3);
  });

  it("falls back to the largest rung, then to the inline preview", () => {
    const noOriginal = { ...RENDER_META, variants: RENDER_META.variants.slice(0, 2) };
    expect(readCardPhotos({ image: noOriginal }, undefined).images[0]?.url).toBe(
      "https://cdn.test/720.webp"
    );
    const noVariants = { ...RENDER_META, variants: [] };
    expect(readCardPhotos({ image: noVariants }, undefined).images[0]?.url).toBe(
      "data:image/png;base64,AAAA"
    );
  });

  it("prefers `images[]` and never reads the singular after it", () => {
    // `image` IS `images[0]` in the projection, so reading both would draw
    // the first photo twice.
    const photos = readCardPhotos(
      { images: ["image/a", "image/b"], image: "image/a" },
      resolveImage
    );
    expect(photos.images).toHaveLength(2);
  });
});

// ── and what that becomes on the card ───────────────────────────────────────

describe("the gallery, not just the first photo", () => {
  function gallery(count: number): SearchItem {
    const images = Array.from({ length: count }, (_, i) => `image/g${String(i)}`);
    return item({ title: "Bosch", images, image: images[0] });
  }

  it("draws one slide for one photo, and no peek or dots for it", () => {
    renderCard(gallery(1));
    expect(slides()).toHaveLength(1);
    // A sliver of a next slide is an affordance for something that is there.
    expect(
      screen.getByTestId("search-result-photos").querySelectorAll(".stapel-carousel-dot")
    ).toHaveLength(0);
  });

  it("draws three slides for three photos, with the position indicator", () => {
    renderCard(gallery(3));
    expect(slides()).toHaveLength(3);
    expect(
      screen.getByTestId("search-result-photos").querySelectorAll(".stapel-carousel-dot")
    ).toHaveLength(3);
  });

  it("draws ten slides for the projection's CARD_IMAGES_LIMIT default", () => {
    renderCard(gallery(10));
    expect(slides()).toHaveLength(10);
  });

  it("names each photo by its place in the strip", () => {
    renderCard(gallery(3));
    const alts = Array.from(
      screen.getByTestId("search-result-photos").querySelectorAll("[alt]")
    ).map((node) => node.getAttribute("alt") ?? "");
    // Three identical announcements would be worse than none.
    expect(new Set(alts).size).toBe(alts.length);
  });
});

describe("a reference nothing resolves is a state, not silence", () => {
  it("draws the well and says the photo is unavailable", () => {
    renderCard(item({ title: "Bosch", image: "image/gone" }), () => undefined);
    expect(screen.getByTestId("search-result-photo-absent")).toBeTruthy();
    expect(screen.queryByTestId("search-result-photos")).toBeNull();
  });

  it("does the same when the deployment wired no resolver at all", () => {
    // The live defect, exactly: a projection full of references and a pair
    // with no way to render one. It must be VISIBLE, not silent.
    renderCard(item({ title: "Bosch", image: "image/abc123" }), null);
    expect(screen.getByTestId("search-result-photo-absent")).toBeTruthy();
  });
});

describe("a card with no photo at all", () => {
  it("reserves no well — a text corpus is not a gallery with holes in it", () => {
    renderCard(item({ title: "A document", price: "0" }));
    expect(screen.queryByTestId("search-result-photos")).toBeNull();
    expect(screen.queryByTestId("search-result-photo-absent")).toBeNull();
  });

  it("treats an empty `images` list the same as no photo field", () => {
    renderCard(item({ title: "A document", images: [] }));
    expect(screen.queryByTestId("search-result-photos")).toBeNull();
    expect(screen.queryByTestId("search-result-photo-absent")).toBeNull();
  });
});

describe("the strip is not inside the card's link", () => {
  it("keeps the swipeable strip a SIBLING of the anchor", () => {
    // A horizontal swipe that ends inside an `<a>` can be delivered as a
    // click: inside the anchor, every look at photo two would navigate away.
    renderCard(item({ title: "Bosch", images: ["image/a", "image/b"], url: "/l/1" }));
    const link = screen.getByTestId("search-result-link");
    expect(link.querySelector('[data-testid="search-result-photos"]')).toBeNull();
    expect(slides()).toHaveLength(2);
  });
});

describe("the resolver is asked once per reference, not once per render", () => {
  it("does not manufacture a new descriptor identity on a re-render", () => {
    const calls: string[] = [];
    const counting: SearchImageResolver = (ref) => {
      calls.push(ref);
      return resolveImage(ref);
    };
    renderCard(item({ title: "Bosch", images: ["image/a", "image/b"] }), counting);
    // A card in a result page re-renders on every state change around it; a
    // fresh `StapelImage` per render is a load `<Image>` has to re-decide.
    expect(calls).toEqual(["image/a", "image/b"]);
  });
});
