/**
 * SHARING A LISTING, and the two controls a reader has.
 *
 * The owner's finding (2026-09-06): the storefront had **no share control of
 * any kind**, and the favourite heart was a 152px button with a word in it on
 * a page where the reference classified draws a 44px glyph. Every claim below
 * is one half of that.
 *
 *  1. On a device with `navigator.share` the press opens the PLATFORM sheet,
 *     with the title, the text and the canonical url — and nothing of ours is
 *     drawn at all.
 *  2. Without one, the press opens a menu: copy the link (with the
 *     confirmation standing IN the menu and repeated as a toast), and the
 *     three networks, each `target="_blank"` with BOTH halves of `rel`.
 *  3. The URL shared is the host's canonical route, never the address bar,
 *     whenever the host supplied one.
 *  4. Both controls are real touch targets — asserted through the class
 *     contract, because a jsdom layout has no pixels to measure.
 *  5. The heart says which state it is in (`aria-pressed`, a label that
 *     changes) and says the outcome out loud.
 *  6. A card's heart is reachable without opening the listing: on the
 *     photograph, outside every anchor, and it does not let the press through
 *     to the card behind it.
 *  7. A host can switch either action off.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { App, Button } from "antd";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  LISTING_ACTION_CLASS,
  LISTING_ACTION_HIT,
  LISTING_ACTION_SPECIFICITY,
  LISTING_CARD_ACTION_CLASS,
  LISTING_CARD_ACTION_HIT,
  ListingCard,
  ListingDetailPane,
  ShareAction,
  actionRowCss,
} from "../src/default/index.js";
import {
  SHARE_COARSE_MEDIA,
  hasCoarsePointer,
  preferNativeShare,
  shareLinks,
} from "../src/index.js";
import type { ShareChannel } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

/** The listing page, wired for a reader who can act. */
function pane(node: ReactNode, server?: MockServer): MockServer {
  const srv =
    server ??
    mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
      "/listings/7/": { body: detail({ is_favorited: false }) },
    });
  render(
    <TestProviders server={srv} resolveImage>
      <App>{node}</App>
    </TestProviders>
  );
  return srv;
}

/** jsdom ships neither API; both are installed per test and removed after, so
 * one test's platform is never another's. */
function withShare(impl: () => Promise<void>): ReturnType<typeof vi.fn> {
  const share = vi.fn(impl);
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  return share;
}

/**
 * A device whose PRIMARY POINTER is a finger.
 *
 * jsdom answers every media query `false`, which is the honest reading of a
 * headless DOM and also the fine-pointer arm — so a test about the platform
 * sheet has to say which device it is standing on. `pointer: coarse` is the
 * only query stubbed true; everything else keeps jsdom's answer, so a
 * component reading a different query is not silently handed a phone.
 */
function withCoarsePointer(coarse = true): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        media: query,
        matches: coarse && query.includes("pointer: coarse"),
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

function withClipboard(impl: () => Promise<void>): ReturnType<typeof vi.fn> {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

const REAL_MATCH_MEDIA = window.matchMedia;

beforeEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: REAL_MATCH_MEDIA,
  });
  vi.restoreAllMocks();
});

// ── 1. the platform's own sheet ──────────────────────────────────────────────

describe("a device with a share sheet AND a thumb uses the platform's", () => {
  it("hands navigator.share the title, the text and the canonical url", async () => {
    withCoarsePointer();
    const share = withShare(async () => undefined);
    const onShared = vi.fn();
    render(
      <TestProviders server={mockServer({})}>
        <ShareAction
          url="/l/7"
          title="Bosch GSB 1200"
          text="4500 ₽"
          onShared={onShared}
        />
      </TestProviders>
    );
    // The arm settles in an effect — a server render has no `navigator`, and
    // a first client render that disagreed would be a hydration mismatch.
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-share").getAttribute("data-share-mode")
      ).toBe("native");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-share"));
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toEqual({
      url: `${window.location.origin}/l/7`,
      title: "Bosch GSB 1200",
      text: "4500 ₽",
    });
    // Reported once the sheet resolved — the sheet never says WHICH app.
    await waitFor(() => {
      expect(onShared).toHaveBeenCalledWith("native");
    });
    // And nothing of ours is on the page: no menu, ever.
    expect(screen.queryByTestId("listings-share-menu")).toBeNull();
  });

  it("says nothing when the person closes the sheet — an abort is not a failure", async () => {
    withCoarsePointer();
    const onShared = vi.fn();
    withShare(async () => {
      throw new DOMException("share canceled", "AbortError");
    });
    render(
      <TestProviders server={mockServer({})}>
        <ShareAction url="/l/7" onShared={onShared} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-share").getAttribute("data-share-mode")
      ).toBe("native");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-share"));
    });
    expect(onShared).not.toHaveBeenCalled();
  });
});

// ── 2 & 3. the menu, its three links, and the clipboard ──────────────────────

describe("a device without one — or with a mouse — gets the menu", () => {
  async function openMenu(props: {
    url?: string;
    title?: string;
    onShared?: (channel: ShareChannel) => void;
  }): Promise<void> {
    render(
      <TestProviders server={mockServer({})}>
        <App>
          <ShareAction
            {...(props.url !== undefined ? { url: props.url } : {})}
            {...(props.title !== undefined ? { title: props.title } : {})}
            {...(props.onShared !== undefined
              ? { onShared: props.onShared }
              : {})}
          />
        </App>
      </TestProviders>
    );
    expect(
      screen.getByTestId("listings-share").getAttribute("data-share-mode")
    ).toBe("menu");
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-share"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-share-menu")).toBeTruthy();
    });
  }

  it("draws the three networks, each opening safely in a new tab", async () => {
    await openMenu({ url: "/l/7", title: "Bosch GSB 1200" });
    const origin = window.location.origin;
    const expected: Readonly<Record<string, string>> = {
      telegram:
        `https://t.me/share/url?url=${encodeURIComponent(`${origin}/l/7`)}` +
        `&text=${encodeURIComponent("Bosch GSB 1200")}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `Bosch GSB 1200 ${origin}/l/7`
      )}`,
      vk:
        `https://vk.com/share.php?url=${encodeURIComponent(`${origin}/l/7`)}` +
        `&title=${encodeURIComponent("Bosch GSB 1200")}`,
    };
    for (const [channel, href] of Object.entries(expected)) {
      const link = screen.getByTestId(`listings-share-${channel}`);
      expect(link.getAttribute("href"), channel).toBe(href);
      expect(link.getAttribute("target"), channel).toBe("_blank");
      // BOTH halves, on all three: `noopener` is a navigation hijack the
      // opened page could otherwise perform on this tab, `noreferrer` keeps
      // the visitor's exact listing url out of the network's referer log.
      expect(link.getAttribute("rel"), channel).toBe("noopener noreferrer");
    }
  });

  it("reports the channel a person actually followed", async () => {
    const onShared = vi.fn();
    await openMenu({ url: "/l/7", onShared });
    fireEvent.click(screen.getByTestId("listings-share-telegram"));
    expect(onShared).toHaveBeenCalledWith("telegram");
  });

  it("copies the link, confirms IN the menu, and repeats it as a toast", async () => {
    const writeText = withClipboard(async () => undefined);
    await openMenu({ url: "/l/7", title: "Bosch GSB 1200" });

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-share-copy"));
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/l/7`);
    // The standing confirmation: a toast can land under a thumb, and a
    // confirmation a person did not happen to be looking at is not one.
    await waitFor(() => {
      expect(screen.getByTestId("listings-share-copied").textContent).toBe(
        "Link copied"
      );
    });
    // And the amplifier, through the message seam.
    await waitFor(() => {
      expect(document.querySelector(".ant-message")?.textContent).toContain(
        "Link copied"
      );
    });
  });

  it("says so when the clipboard refuses, rather than swallowing it", async () => {
    withClipboard(async () => {
      throw new Error("denied");
    });
    await openMenu({ url: "/l/7" });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-share-copy"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("listings-share-copy-error")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-share-copied")).toBeNull();
  });

  it("shares the HOST's canonical route, never the address bar", async () => {
    window.history.replaceState(null, "", "/search?q=drill&page=3#card-7");
    await openMenu({ url: "/l/7", title: "Bosch GSB 1200" });
    const href = screen
      .getByTestId("listings-share-telegram")
      .getAttribute("href");
    expect(href).toContain(encodeURIComponent(`${window.location.origin}/l/7`));
    expect(href).not.toContain("q%3Ddrill");
    window.history.replaceState(null, "", "/");
  });
});

describe("the link builders encode every field", () => {
  it("survives a seller's title full of query-string punctuation", () => {
    const links = shareLinks({
      url: "https://shop.test/l/7",
      title: "Drill & bits ? #1",
    });
    const telegram = links.find((link) => link.channel === "telegram")?.href;
    // A raw `&` in the text would truncate the link the recipient receives.
    expect(telegram).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fshop.test%2Fl%2F7" +
        "&text=Drill%20%26%20bits%20%3F%20%231"
    );
    expect(links.map((link) => link.channel)).toEqual([
      "telegram",
      "whatsapp",
      "vk",
    ]);
  });

  it("carries the title AND the address in WhatsApp's single field", () => {
    const whatsapp = shareLinks({
      url: "https://shop.test/l/7",
      title: "Drill",
    }).find((link) => link.channel === "whatsapp")?.href;
    expect(whatsapp).toBe(
      "https://wa.me/?text=Drill%20https%3A%2F%2Fshop.test%2Fl%2F7"
    );
  });
});

// ── 4. the hit targets, through the class contract ──────────────────────────

describe("both controls are targets a thumb can actually hit", () => {
  /** The class repeated as the sheet writes it. */
  function sel(className: string): string {
    return `.${className}`.repeat(LISTING_ACTION_SPECIFICITY);
  }
  /** Both spellings of one floor, as the sheet writes them. */
  function floor(px: number): string {
    const size = `${String(px)}px`;
    return (
      `min-inline-size:${size};min-block-size:${size};` +
      `min-width:${size};min-height:${size}`
    );
  }

  it("states 44px for the page cluster and 36/44 for a card, from the token", () => {
    const css = actionRowCss();
    expect(LISTING_ACTION_HIT).toBe(44);
    expect(LISTING_CARD_ACTION_HIT).toBe(36);
    expect(css).toContain(`${sel(LISTING_ACTION_CLASS)}{${floor(44)};`);
    expect(css).toContain(`${sel(LISTING_CARD_ACTION_CLASS)}{${floor(36)};`);
    // …and there is no such thing as a small touch target: on a phone the
    // card's control goes back to the same 44.
    expect(css).toContain(
      `@media (max-width:767px){${sel(LISTING_CARD_ACTION_CLASS)}{${floor(44)}}}`
    );
  });

  // ── D450: the sheet has to WIN, and against a named opponent ──────────────

  it("outranks antd's circle rule without an !important", () => {
    const css = actionRowCss();
    // antd ships `:where(…).ant-btn.ant-btn-circle.ant-btn{min-width:…}` —
    // three classes, and `:where()` contributes nothing. Four repeats clear
    // it; three would tie and lose on source order, which is antd's.
    expect(LISTING_ACTION_SPECIFICITY).toBeGreaterThan(3);
    expect(css).not.toContain("!important");
  });

  it("computes 44px on an antd circle button that antd is also styling", () => {
    // The cascade, run rather than reasoned about: antd's real rule text and
    // this pair's, in one document, over one antd-rendered circle button.
    const style = document.createElement("style");
    style.textContent =
      ":where(.css-x).ant-btn.ant-btn-circle.ant-btn{min-width:32px;min-height:32px}" +
      actionRowCss();
    document.head.appendChild(style);
    try {
      render(
        <TestProviders server={mockServer({})}>
          <Button
            className={`css-x ${LISTING_ACTION_CLASS}`}
            shape="circle"
            data-testid="hit-probe"
          />
        </TestProviders>
      );
      const probe = screen.getByTestId("hit-probe");
      const computed = window.getComputedStyle(probe);
      // Both axes and both spellings: the pair's floor wins each of them.
      expect(computed.getPropertyValue("min-inline-size")).toBe("44px");
      expect(computed.getPropertyValue("min-block-size")).toBe("44px");
      expect(computed.getPropertyValue("min-width")).toBe("44px");
      expect(computed.getPropertyValue("min-height")).toBe("44px");
    } finally {
      style.remove();
    }
  });

  it("puts the class on the controls a person presses", async () => {
    pane(<ListingDetailPane id={7} shareUrl="/l/7" />);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(
      screen.getByTestId("listings-detail-favorite").className
    ).toContain(LISTING_ACTION_CLASS);
    expect(
      screen.getByTestId("listings-detail-reader-actions-share").className
    ).toContain(LISTING_ACTION_CLASS);

    render(
      <TestProviders server={mockServer({})}>
        <ListingCard listing={CARD} href="/l/7" />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite").className).toContain(
      LISTING_CARD_ACTION_CLASS
    );
  });
});

// ── 5. the heart on the listing page ────────────────────────────────────────

describe("the listing page's heart states itself and says the outcome", () => {
  it("is icon-only, names the action, and flips both name and aria-pressed", async () => {
    const srv = pane(<ListingDetailPane id={7} shareUrl="/l/7" />);
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-detail-favorite-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    const heart = screen.getByTestId("listings-detail-favorite");
    // Icon-only (§23): the word is the accessible name, not painted copy.
    expect(heart.getAttribute("aria-label")).toBe("Save to favourites");
    expect(heart.textContent).toBe("");
    expect(heart.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      fireEvent.click(heart);
    });
    await waitFor(() => {
      expect(srv.matching("/listings/7/favorite/")).toHaveLength(1);
    });
    await waitFor(() => {
      const after = screen.getByTestId("listings-detail-favorite");
      expect(after.getAttribute("aria-pressed")).toBe("true");
      expect(after.getAttribute("aria-label")).toBe("Remove from favourites");
    });
    // The outcome, out loud — the half a glyph in a corner cannot carry.
    await waitFor(() => {
      expect(document.querySelector(".ant-message")?.textContent).toContain(
        "Added to favourites"
      );
    });
  });

  it("sits beside the title, with the share button next to it", async () => {
    pane(<ListingDetailPane id={7} shareUrl="/l/7" />);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-reader-actions")).toBeTruthy();
    });
    const cluster = screen.getByTestId("listings-detail-reader-actions");
    expect(cluster.contains(screen.getByTestId("listings-detail-favorite"))).toBe(
      true
    );
    expect(
      cluster.contains(screen.getByTestId("listings-detail-reader-actions-share"))
    ).toBe(true);
    // The heading row holds both — the reference's placement (§23) — and the
    // buy box keeps its own primary and nothing of ours.
    const title = screen.getByTestId("listings-detail-title");
    expect(title.parentElement?.contains(cluster)).toBe(true);
    expect(
      screen.getByTestId("listings-detail-actions").contains(cluster)
    ).toBe(false);
  });

  it("pins the cluster over the photographs when the host asks", async () => {
    pane(<ListingDetailPane id={7} shareUrl="/l/7" actionsPlacement="gallery" />);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-reader-actions")).toBeTruthy();
    });
    const cluster = screen.getByTestId("listings-detail-reader-actions");
    expect(cluster.getAttribute("data-placement")).toBe("overlay");
    expect(
      screen.getByTestId("listings-detail-gallery").contains(cluster)
    ).toBe(true);
  });

  it("keeps the old buy-box position available for a host laid out around it", async () => {
    pane(<ListingDetailPane id={7} shareUrl="/l/7" actionsPlacement="buy-box" />);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-reader-actions")).toBeTruthy();
    });
    expect(
      screen
        .getByTestId("listings-detail-actions")
        .contains(screen.getByTestId("listings-detail-reader-actions"))
    ).toBe(true);
  });
});

// ── 6. the card's heart, and the card behind it ─────────────────────────────

describe("a card's heart is reachable without opening the listing", () => {
  it("sits on the photograph, outside every anchor", () => {
    render(
      <TestProviders server={mockServer({})} resolveImage>
        <ListingCard listing={CARD} href="/l/7" />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    const overlay = screen.getByTestId("listings-card-favorite-overlay");
    expect(overlay.contains(heart)).toBe(true);
    // Not inside the card's reading anchor, and not inside a photo link
    // either — a link may not contain a control.
    expect(screen.getByTestId("listings-card-open").contains(heart)).toBe(false);
    for (const link of screen.queryAllByTestId("listings-photo-link")) {
      expect(link.contains(heart)).toBe(false);
    }
  });

  it("does not let the press reach the card behind it", () => {
    const cardClick = vi.fn();
    render(
      <TestProviders server={mockServer({})}>
        {/* Stands in for whatever the container wrapped the grid in — a row
            handler, a tracked() wrapper, a tile that navigates. */}
        <div onClick={cardClick} data-testid="host-row">
          <ListingCard listing={CARD} href="/l/7" />
        </div>
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("listings-card-favorite"));
    expect(cardClick).not.toHaveBeenCalled();
    // A click on the card itself still reaches the host, so the stop is
    // about the heart and not about the card being inert.
    fireEvent.click(screen.getByTestId("listings-card-open"));
    expect(cardClick).toHaveBeenCalledTimes(1);
  });

  it("draws the filled accent when saved and the outline when not", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ListingCard listing={{ ...CARD, is_favorited: true }} href="/l/7" />
      </TestProviders>
    );
    const svg = screen.getByTestId("listings-card-favorite").querySelector("svg");
    expect(svg?.getAttribute("fill")).not.toBe("none");
    expect(
      screen.getByTestId("listings-card-favorite").getAttribute("data-favorited")
    ).toBe("true");
  });
});

// ── 7. a host switching either action off ───────────────────────────────────

describe("a host decides which of the two the page offers", () => {
  it("hides the share button with actions={{ share: false }}", async () => {
    pane(<ListingDetailPane id={7} actions={{ share: false }} />);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(
      screen.queryByTestId("listings-detail-reader-actions-share")
    ).toBeNull();
  });

  it("hides the heart with actions={{ favorite: false }} and keeps sharing", async () => {
    pane(<ListingDetailPane id={7} actions={{ favorite: false }} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-detail-reader-actions-share")
      ).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-favorite")).toBeNull();
  });

  it("still takes a NODE — the prop's original arm is untouched", async () => {
    pane(
      <ListingDetailPane
        id={7}
        actions={<button type="button" data-testid="host-chrome">Report</button>}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-chrome")).toBeTruthy();
    });
    // The node goes where it always went — the buy box — and the cluster is
    // still drawn beside the title.
    expect(
      screen
        .getByTestId("listings-detail-actions")
        .contains(screen.getByTestId("host-chrome"))
    ).toBe(true);
    expect(
      screen.getByTestId("listings-detail-reader-actions-share")
    ).toBeTruthy();
  });
});

// ── 8. WHICH ARM, and the reading that decides it (§25) ─────────────────────

describe("the arm is chosen by the pointer, not by the capability alone", () => {
  /** `data-share-mode` once the effect has settled. */
  async function armOf(prefer?: "auto" | "menu" | "native"): Promise<string> {
    render(
      <TestProviders server={mockServer({})}>
        <App>
          <ShareAction
            url="/l/7"
            testId={`share-${prefer ?? "default"}`}
            {...(prefer !== undefined ? { prefer } : {})}
          />
        </App>
      </TestProviders>
    );
    const id = `share-${prefer ?? "default"}`;
    await waitFor(() => {
      expect(screen.getByTestId(id)).toBeTruthy();
    });
    return screen.getByTestId(id).getAttribute("data-share-mode") ?? "";
  }

  it("decides with the pure rule, so the three values are readable", () => {
    // The measured case: a desktop that HAS the API. `auto` refuses it.
    expect(preferNativeShare("auto", { native: true, coarse: false })).toBe(false);
    expect(preferNativeShare("auto", { native: true, coarse: true })).toBe(true);
    // `native` is the old behaviour by name: the capability, and nothing else.
    expect(preferNativeShare("native", { native: true, coarse: false })).toBe(true);
    // `menu` is this pair's menu on every device, sheet or no sheet.
    expect(preferNativeShare("menu", { native: true, coarse: true })).toBe(false);
    // An arm that cannot open is not an arm, whatever was asked for.
    expect(preferNativeShare("native", { native: false, coarse: true })).toBe(false);
    expect(preferNativeShare("auto", { native: false, coarse: true })).toBe(false);
  });

  it("asks (pointer: coarse), and nothing else", () => {
    const asked: string[] = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => {
        asked.push(query);
        return { matches: false, media: query } as unknown as MediaQueryList;
      },
    });
    expect(hasCoarsePointer()).toBe(false);
    expect(asked).toEqual([SHARE_COARSE_MEDIA]);
    expect(SHARE_COARSE_MEDIA).toBe("(pointer: coarse)");
  });

  it("draws the MENU on a fine pointer that has navigator.share (D: §25)", async () => {
    withShare(async () => undefined);
    withCoarsePointer(false);
    expect(await armOf()).toBe("menu");
  });

  it("draws the platform sheet on a coarse pointer", async () => {
    withShare(async () => undefined);
    withCoarsePointer();
    expect(await armOf()).toBe("native");
  });

  it('prefer="menu" keeps the menu on a phone', async () => {
    withShare(async () => undefined);
    withCoarsePointer();
    expect(await armOf("menu")).toBe("menu");
  });

  it('prefer="native" takes the sheet on a desktop that has one', async () => {
    withShare(async () => undefined);
    withCoarsePointer(false);
    expect(await armOf("native")).toBe("native");
  });

  it('prefer="native" is still the menu where there is no sheet to open', async () => {
    withCoarsePointer();
    expect(await armOf("native")).toBe("menu");
  });

  it("reaches the control through the cluster and the pane", async () => {
    withShare(async () => undefined);
    withCoarsePointer(false);
    pane(<ListingDetailPane id={7} shareUrl="/l/7" sharePrefer="native" />);
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-detail-reader-actions-share")
      ).toBeTruthy();
    });
    // The host's word travels pane → cluster → control: without the
    // pass-through the prop is unreachable from the page a storefront mounts.
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-detail-reader-actions-share")
          .getAttribute("data-share-mode")
      ).toBe("native");
    });
  });
});
