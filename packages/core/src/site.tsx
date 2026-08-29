/**
 * The host→brand seam: which SITE is this browser looking at?
 *
 * One build, one backend, N hosts (southgate/northgate multibrand spec §0). A fleet
 * that serves two brands from one image cannot bake the brand in at build
 * time — `index.html`'s `<title>`, the wordmark, the legal footer and the
 * token set would all be the FIRST brand's, on both domains. Nor can nginx
 * inject it: a per-host header would be a fleet fork of the one thing that
 * must stay identical across deployments (the container).
 *
 * So the brand is RESOLVED AT RUNTIME, from the backend that already knows
 * every host it answers for: `GET <baseUrl>/site/` (public, cacheable,
 * `stapel_core.sites` → `SiteBootstrapView`). This module is the frontend
 * half of that contract and nothing more — it fetches one document, puts it
 * in context, and reflects two facts onto `<html>` so that CSS and the
 * accessibility tree can read them without React:
 *
 *   `data-brand="<brand.theme>"`  the scoped token set (`stapel-tokens
 *                                 --scope <key>` emits
 *                                 `:root[data-brand="…"]`), so a runtime
 *                                 brand switch reaches antd through
 *                                 `@stapel/tokens-antd`'s live-var reader.
 *   `lang="<locale>"`             the document language, which a screen
 *                                 reader and a hyphenation engine read and
 *                                 no `<meta>` tag replaces.
 *
 * ── The fallback is the FIRST FRAME, not an error state ────────────────────
 *
 * {@link SiteProvider} renders `fallback` immediately and replaces it when
 * the fetch resolves. A storefront therefore paints its own brand's name and
 * logo on the very first frame — no empty header, no flash of a generic
 * shell — and a person on the primary host never sees anything change. A
 * failure (offline, 502, a fleet whose backend predates `site/`) KEEPS the
 * fallback and reports it once on the console: the page a visitor came for
 * must not turn into a blank error because a branding document was
 * unreachable. This provider never throws into the tree.
 *
 * ── Two readers, deliberately ──────────────────────────────────────────────
 *
 * {@link useSite} throws outside a provider — a screen that renders the
 * brand's name has no honest thing to draw without one, and a silent
 * placeholder would ship the wrong brand to production unnoticed.
 * {@link useOptionalSite} returns `null` instead, for the LIBRARY code that
 * merely prefers a site if one is configured — `@stapel/shell-react`'s
 * `<PublicShell/>` uses it to pick its default brand slot, and a host that
 * never mounts a provider keeps the old behaviour rather than a crash.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import type { StapelClient } from "./client.js";

/** The visual + legal identity of one host. */
export interface SiteBrand {
  /** Registry key, `[a-z0-9-]+` (`"northgate"`). Stable; addresses the brand. */
  readonly key: string;
  /** Display name — the wordmark's text ("Northgate"). */
  readonly name: string;
  /** Document title base ("Northgate â classifieds"). */
  readonly title: string;
  /** Logo URL: a path inside this origin, or an absolute https URL. */
  readonly logo: string;
  /** Token-set key: the value of `<html data-brand>`. Usually `key`. */
  readonly theme: string;
  /**
   * Legal strings, open-ended on purpose: `company`, `support_email`,
   * `privacy_url`, `terms_url` are what the fleet ships today, and a
   * deployment that needs an OGRN line adds a key without a library release.
   * `@stapel/shell-react`'s `<SiteLegalFooter/>` renders the four it knows
   * and ignores the rest.
   */
  readonly legal: Readonly<Record<string, string>>;
}

/** The resolved site document — `GET <baseUrl>/site/`. */
export interface Site {
  /** The host this answer is about (no port). */
  readonly host: string;
  /** Did the registry actually know this host? `false` ⇒ the primary site's
   * brand is being shown as a stand-in (or the registry is empty). */
  readonly matched: boolean;
  /** Is this the fleet's primary site? */
  readonly primary: boolean;
  /** BCP-47 language for `<html lang>` and the i18n engine. */
  readonly locale: string;
  /** `null` when the deployment configures no site registry at all. */
  readonly brand: SiteBrand | null;
  readonly seo: {
    /** May search engines index this host? */
    readonly index: boolean;
    /** The host `<link rel="canonical">` should point at (an apex, when the
     * request arrived on a `www.` alias). */
    readonly canonical_host: string;
  };
}

/**
 * The bootstrap path, relative to the client's `baseUrl`. Mounted by
 * `stapel_core.sites.get_site_urls()` inside the auth service's `urls_v1`, so
 * in every fleet the address is `<auth-prefix>/api/v1/site/` — which is
 * exactly the `baseUrl` a storefront already gives `createAuthRuntime`.
 */
const SITE_PATH = "site/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * A brand is all-or-nothing: a half-read brand would render a nameless
 * wordmark and a `data-brand` pointing at a token set nobody emitted, which
 * is worse than the fallback's honest one. `key`, `name` and `theme` are the
 * three the UI cannot invent; the rest degrade to empty and simply do not
 * render.
 */
function parseBrand(value: unknown): SiteBrand | null {
  if (!isRecord(value)) return null;
  const key = str(value.key, "");
  const name = str(value.name, "");
  const theme = str(value.theme, key);
  if (key === "" || name === "" || theme === "") return null;
  const legal: Record<string, string> = {};
  if (isRecord(value.legal)) {
    for (const [k, v] of Object.entries(value.legal)) {
      if (typeof v === "string" && v.length > 0) legal[k] = v;
    }
  }
  return {
    key,
    name,
    title: str(value.title, name),
    logo: str(value.logo, ""),
    theme,
    legal,
  };
}

/**
 * Read the wire document into a {@link Site}.
 *
 * Lenient about what it may omit, strict about the one field that identifies
 * the answer at all: no `host` string means this is not a site document (an
 * SPA fallback HTML page served for an unknown path is the realistic way to
 * get here), and the caller is better served by the throw — {@link
 * SiteProvider} turns it into "keep the fallback" rather than into a wrong
 * brand.
 */
function parseSite(raw: unknown): Site {
  if (!isRecord(raw) || typeof raw.host !== "string" || raw.host.length === 0) {
    throw new Error("site/: response is not a site document (no host)");
  }
  const seo = isRecord(raw.seo) ? raw.seo : {};
  return {
    host: raw.host,
    matched: bool(raw.matched, false),
    primary: bool(raw.primary, false),
    locale: str(raw.locale, ""),
    brand: parseBrand(raw.brand),
    seo: {
      index: bool(seo.index, true),
      canonical_host: str(seo.canonical_host, raw.host),
    },
  };
}

/**
 * Fetch the site document through an existing {@link StapelClient} — no auth
 * header, no session: the endpoint is public by construction (a bot's first
 * hit must not mint a cookie, multibrand spec, public-read decision).
 *
 * Rejects like any other client call; `SiteProvider` is where that becomes a
 * policy rather than an exception.
 */
export async function fetchSite(client: StapelClient): Promise<Site> {
  return parseSite(await client.get<unknown>(SITE_PATH));
}

const SiteContext = createContext<Site | null>(null);

export interface SiteProviderProps {
  /** The client whose `baseUrl` carries `site/` (the auth API base). */
  readonly client: StapelClient;
  /**
   * The site rendered on the first frame and kept if the fetch fails — the
   * container's own brand default, never an empty shell. This is a REQUIRED
   * prop: "what do we show before the answer arrives" has no library answer,
   * and a `null` default would put an unbranded frame on every cold load.
   */
  readonly fallback: Site;
  readonly children: ReactNode;
}

/**
 * Resolve the site once, publish it, and reflect it onto `<html>`.
 *
 * Refetching is deliberately not a feature: a host never changes identity
 * without a navigation, and the document is `Cache-Control: public,
 * max-age=300` at the edge anyway.
 */
export function SiteProvider(props: SiteProviderProps): ReactElement {
  const { client, fallback } = props;
  const [site, setSite] = useState<Site>(fallback);
  //: One console line per provider, not one per render: a fleet whose
  //: `site/` is down would otherwise fill the console with the same
  //: sentence and bury whatever else the page reported.
  const warned = useRef(false);

  useEffect(() => {
    let live = true;
    void fetchSite(client)
      .then((resolved) => {
        if (live) setSite(resolved);
      })
      .catch((error: unknown) => {
        if (!live || warned.current) return;
        warned.current = true;
        console.warn(
          "SiteProvider: could not resolve site/ — keeping the fallback brand",
          error
        );
      });
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    // SSR / non-DOM renderers: nothing to reflect onto, and reading
    // `document` would throw before the page ever reached a browser.
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const theme = site.brand?.theme;
    if (theme !== undefined && theme !== "") {
      root.dataset.brand = theme;
    } else {
      delete root.dataset.brand;
    }
    if (site.locale !== "") root.lang = site.locale;
  }, [site]);

  return createElement(SiteContext.Provider, { value: site }, props.children);
}

/**
 * The resolved site. Throws outside a {@link SiteProvider} — see this
 * module's header for why the alternative (a silent placeholder brand) is
 * the failure that ships.
 */
export function useSite(): Site {
  const site = useContext(SiteContext);
  if (site === null) {
    throw new Error(
      "useSite() was called outside a <SiteProvider>. Wrap the app in " +
        "<SiteProvider client={authClient} fallback={DEFAULT_SITE}> — or use " +
        "useOptionalSite() if the caller can do without one."
    );
  }
  return site;
}

/**
 * The resolved site, or `null` when no provider is mounted.
 *
 * For library code that PREFERS a site and must not require one: a shell
 * that draws the brand when a site is configured and keeps its host-supplied
 * slots otherwise. Never for a screen whose whole content is the brand.
 */
export function useOptionalSite(): Site | null {
  return useContext(SiteContext);
}
