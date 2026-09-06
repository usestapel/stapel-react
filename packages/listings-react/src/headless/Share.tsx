/**
 * Sharing a listing — the verb a classified is judged on and this pair did
 * not have.
 *
 * Measured on the live storefront (owner, 2026-09-06): **no share control of
 * any kind**, on any surface. A person who wanted to send an offer to whoever
 * they are buying it with had the address bar and nothing else, on a phone,
 * where the address bar is the hardest thing on the screen to reach. Every
 * reference classified answers this with one button.
 *
 * ── Two arms, and the device decides which ────────────────────────────────
 *
 * `navigator.share` is the whole answer where it exists: the platform's own
 * sheet, with the person's own apps in it, in their own order. It exists on
 * essentially every phone and on almost no desktop, which is why the second
 * arm is not a fallback for old browsers but the DESKTOP rendering — a small
 * menu with "copy the link" and the three networks a Russian-speaking
 * marketplace actually gets traffic from.
 *
 * ── …AND "HAS A SHEET" IS NOT "SHOULD USE THE SHEET" (§25) ───────────────
 *
 * `navigator.share` is true on desktop Chrome on macOS. Measured on the stand:
 * every share on the storefront opened the OS sheet and the copy-link menu —
 * three networks and a clipboard row, built for exactly that platform — was
 * unreachable there. So the decision takes a second reading, the primary
 * POINTER, and {@link UseShareOptions.prefer} lets a surface state the answer
 * outright. See {@link SharePreference}.
 *
 * `native` is resolved in an EFFECT rather than during render, for the reason
 * `cardGallery.ts`'s `useFinePointer` gives at length: a server render has no
 * `navigator`, and a first client render that disagreed with it is a
 * hydration mismatch on every listing page in the app. It opens `false` — the
 * menu arm — because a menu that appears for one frame and is replaced by a
 * button is invisible, while the reverse is a sheet that fails to open.
 *
 * ── The URL is the HOST'S, never `window.location` ────────────────────────
 *
 * A pair does not own routing (`@stapel/core`'s `ui.ts` argues it). The
 * canonical address of a listing is a route the container built, so it
 * arrives as {@link UseShareOptions.url} and is used verbatim. `location.href`
 * is consulted ONLY when the host supplied nothing — which is honest for a
 * bare mount and wrong the moment an app has a canonical URL, because the
 * address bar on a SERP carries the query, the page, the scroll anchor and
 * whatever tracking parameters the visitor arrived with, and none of that
 * belongs in a link somebody sends to a friend.
 *
 * A RELATIVE `url` ("/l/7" — what every route seam in this fleet speaks) is
 * resolved against the document's own base, so a host hands in the same path
 * it hands `<ListingCard href>` and gets an absolute link out.
 *
 * ── Nothing here renders ──────────────────────────────────────────────────
 *
 * The hook returns hrefs and channel identifiers; the copy lives in the skin.
 * A host drawing its own share menu gets the same three links and the same
 * clipboard write without importing antd.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Where a share went. `"native"` is the platform sheet (which never says
 * WHICH app the person picked — that is the sheet's privacy property, not a
 * gap here), `"copy"` is the clipboard, and the three networks are the
 * explicit links.
 */
export type ShareChannel = "native" | "copy" | "telegram" | "whatsapp" | "vk";

/** The three networks, in the order the menu draws them. */
export const SHARE_NETWORKS = ["telegram", "whatsapp", "vk"] as const;

export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

/** One network's ready-made link. */
export interface ShareLink {
  readonly channel: ShareNetwork;
  /** Absolute, already encoded. Rendered `target="_blank"` with
   * `rel="noopener noreferrer"` — see `<ShareAction>` for why both. */
  readonly href: string;
}

export interface ShareTarget {
  /** The canonical, ABSOLUTE address of what is being shared. */
  readonly url: string;
  /** The listing's title. Empty is a real answer — an untitled listing is
   * still shareable — and then the networks carry the link alone. */
  readonly title?: string | undefined;
}

/**
 * The three networks' share endpoints, as pure functions of the target.
 *
 * Separate from the hook and exported so the encoding is a thing a test can
 * read rather than a thing a rendered `<a href>` implies. Each is the
 * network's own documented endpoint:
 *
 *   Telegram  https://t.me/share/url?url=…&text=…
 *   WhatsApp  https://wa.me/?text=…              (one field: title + url)
 *   VK        https://vk.com/share.php?url=…&title=…
 *
 * `encodeURIComponent` on every field, without exception. A listing title is
 * seller-supplied text — it contains `&`, `#`, `?` and emoji in the wild —
 * and a title pasted raw into a query string does not merely render oddly, it
 * silently truncates the URL the recipient receives at the first `&`.
 */
export function shareLinks(target: ShareTarget): readonly ShareLink[] {
  const url = encodeURIComponent(target.url);
  const title = target.title ?? "";
  const text = encodeURIComponent(title);
  // WhatsApp takes ONE field, so the title and the link travel together in
  // it; the other two carry the address in its own parameter.
  const whatsapp = encodeURIComponent(
    title.length > 0 ? `${title} ${target.url}` : target.url
  );
  return [
    { channel: "telegram", href: `https://t.me/share/url?url=${url}&text=${text}` },
    { channel: "whatsapp", href: `https://wa.me/?text=${whatsapp}` },
    { channel: "vk", href: `https://vk.com/share.php?url=${url}&title=${text}` },
  ];
}

/**
 * Resolve what the host handed in into an absolute address.
 *
 * Three cases and no guessing: an absolute URL is returned as it came, a path
 * is resolved against the document's base, and nothing at all falls back to
 * the address bar (see the file header for why that is the last resort and
 * not the default).
 */
export function resolveShareUrl(url: string | undefined): string | undefined {
  if (typeof window === "undefined") return url;
  const base = window.document.baseURI;
  if (url === undefined || url.length === 0) return window.location.href;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Is this environment able to open the platform's own share sheet? */
export function hasNativeShare(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function";
}

/**
 * The media query that asks "is this a thumb" — the second half of the arm
 * decision (§25).
 *
 * `(pointer: coarse)` describes the PRIMARY input device, which is exactly the
 * question: a phone and a tablet match, a mouse and a trackpad do not, and a
 * touchscreen laptop being driven with its trackpad reports the trackpad.
 */
export const SHARE_COARSE_MEDIA = "(pointer: coarse)";

/** Does the primary pointer look like a finger? `false` wherever the question
 * cannot be asked — a server, an engine without `matchMedia` — because the
 * fallback arm is the one that draws something. */
export function hasCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia(SHARE_COARSE_MEDIA).matches;
  } catch {
    return false;
  }
}

/**
 * WHICH ARM A SURFACE WANTS, and why `navigator.share` alone was the wrong
 * question.
 *
 * The capability probe is true on desktop Chrome on macOS — measured on the
 * stand (§25), where every share on the storefront opened the OS sheet and the
 * copy-link menu was therefore unreachable on the platform it was BUILT for.
 * "Has a share sheet" and "is a device whose share sheet is the better answer"
 * turned out to be two questions, and the pair was only asking the first.
 *
 *   `"auto"`   (default) the platform sheet only where the primary pointer is
 *              COARSE and the API exists; a mouse gets the menu, with its
 *              copy-link row and its three networks.
 *   `"menu"`   always this pair's menu, whatever the device offers. For a
 *              host whose desktop and mobile web are one build and which
 *              wants one answer.
 *   `"native"` the platform sheet wherever the API exists, pointer ignored —
 *              the behaviour every version before this one had, kept
 *              reachable by name rather than deleted.
 *
 * In all three, a missing `navigator.share` is the menu: an arm that cannot
 * open is not an arm.
 */
export type SharePreference = "auto" | "menu" | "native";

/**
 * Resolve the arm from the preference and what the device actually answered.
 *
 * Pure, and separate from the hook, so the decision is a thing a test reads
 * rather than a thing a rendered `data-share-mode` implies.
 */
export function preferNativeShare(
  prefer: SharePreference,
  capability: { readonly native: boolean; readonly coarse: boolean }
): boolean {
  if (prefer === "menu") return false;
  if (!capability.native) return false;
  return prefer === "native" || capability.coarse;
}

export interface UseShareOptions {
  /** The canonical address, absolute or a path. Absent: the address bar,
   * which is the honest answer only for a host with no route seam. */
  readonly url?: string | undefined;
  /** The listing's title — the sheet's heading and the networks' text. */
  readonly title?: string | undefined;
  /** A sentence under the title in the platform sheet (the price, say). */
  readonly text?: string | undefined;
  /** Analytics. Fired once per completed share, with the channel it went
   * through; `"native"` never says which app, because the sheet does not
   * tell the page. */
  readonly onShared?: ((channel: ShareChannel) => void) | undefined;
  /**
   * Which arm this surface wants — see {@link SharePreference}. Default
   * `"auto"`: the platform sheet on a coarse pointer, this pair's menu on a
   * mouse, the menu wherever `navigator.share` is missing.
   */
  readonly prefer?: SharePreference | undefined;
}

export interface ShareBag {
  /** The absolute address every arm shares. `undefined` only on a server. */
  readonly url: string | undefined;
  /**
   * IS THE PLATFORM SHEET THE ARM ON SCREEN — the resolved answer, not the
   * raw capability. `prefer` and the primary pointer are both in it (see
   * {@link SharePreference}); `hasNativeShare()` is the capability alone, for
   * a caller that wants to ask that question itself. Settles in an effect —
   * see the file header.
   */
  readonly native: boolean;
  /** The three networks' links, already encoded. */
  readonly links: readonly ShareLink[];
  /**
   * The clipboard write LANDED, and this is what the confirmation is drawn
   * from. It clears itself after {@link SHARE_COPIED_MS} so a menu reopened a
   * minute later is not still congratulating the person.
   */
  readonly copied: boolean;
  /** The clipboard refused (no permission, an insecure origin, a browser
   * without the API). Stated, never swallowed: a person who pressed "copy"
   * and pastes nothing has to be told the press did not work. */
  readonly copyFailed: boolean;
  /** Open the platform sheet. A no-op where there is none — callers branch on
   * {@link ShareBag.native} rather than discovering it here. */
  shareNatively(): void;
  /** Write the address to the clipboard. */
  copy(): void;
  /** Report a network link the person actually followed. The anchor does the
   * navigating; this is the analytics half. */
  report(channel: ShareChannel): void;
}

/** How long the "copied" confirmation stands. Long enough to read, short
 * enough that a reopened menu is not still showing it. */
export const SHARE_COPIED_MS = 2400;

export function useShare(options: UseShareOptions = {}): ShareBag {
  const { url: given, title, text, onShared } = options;
  const prefer = options.prefer ?? "auto";
  const [native, setNative] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // See the header: resolved in an effect so a server render and the
  // hydration pass that must agree with it draw the same arm. Both halves of
  // the question are asked in the SAME effect — the capability and the
  // pointer — so there is never a frame in which one has landed and the
  // other has not and the button changes arm twice.
  useEffect(() => {
    setNative(
      preferNativeShare(prefer, {
        native: hasNativeShare(),
        coarse: hasCoarsePointer(),
      })
    );
  }, [prefer]);

  const url = useMemo(() => resolveShareUrl(given), [given]);
  const links = useMemo(
    () => (url === undefined ? [] : shareLinks({ url, title })),
    [url, title]
  );

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, SHARE_COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const report = useCallback(
    (channel: ShareChannel): void => {
      onShared?.(channel);
    },
    [onShared]
  );

  const shareNatively = useCallback((): void => {
    if (url === undefined) return;
    const share = typeof navigator === "undefined" ? undefined : navigator.share;
    if (typeof share !== "function") return;
    // The rejection a share sheet ALWAYS produces is `AbortError` — the
    // person closed it — and that is not a failure to report. Nothing is
    // said either way; the sheet is the feedback.
    void Promise.resolve(
      share.call(navigator, {
        url,
        ...(title !== undefined && title.length > 0 ? { title } : {}),
        ...(text !== undefined && text.length > 0 ? { text } : {}),
      })
    )
      .then(() => {
        report("native");
      })
      .catch(() => undefined);
  }, [url, title, text, report]);

  const copy = useCallback((): void => {
    if (url === undefined) return;
    setCopyFailed(false);
    const clipboard =
      typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") {
      setCopyFailed(true);
      return;
    }
    void Promise.resolve(clipboard.writeText(url))
      .then(() => {
        setCopied(true);
        report("copy");
      })
      .catch(() => {
        setCopyFailed(true);
      });
  }, [url, report]);

  return {
    url,
    native,
    links,
    copied,
    copyFailed,
    shareNatively,
    copy,
    report,
  };
}

/** Renderless: the bag, handed to a render prop — the shape every headless
 * component in this pair takes. */
export function Share(
  props: UseShareOptions & {
    children: (bag: ShareBag) => ReactNode;
  }
): ReactElement {
  const bag = useShare(props);
  return <>{props.children(bag)}</>;
}
