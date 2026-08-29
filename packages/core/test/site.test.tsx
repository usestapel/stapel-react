/**
 * The host→brand seam (`src/site.tsx`, multibrand spec, frontend decision).
 *
 * Four facts, and every one of them is a thing that went wrong on a real
 * two-domain fleet before the seam existed:
 *
 *  1. the answer replaces the fallback — otherwise the second brand's
 *     visitors read the first brand's name forever;
 *  2. a failed fetch KEEPS the fallback and warns once — a branding document
 *     being unreachable must not blank the page a visitor came for;
 *  3. `<html data-brand>`/`lang` follow the resolved site — that attribute IS
 *     how the scoped token set (`stapel-tokens --scope`) and the
 *     accessibility tree learn which brand this is;
 *  4. `useSite()` outside a provider says so — the alternative, a silent
 *     placeholder brand, is the failure that ships.
 */
import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createStapelClient } from "../src/client.js";
import { fetchSite, SiteProvider, useOptionalSite, useSite } from "../src/site.js";
import type { Site } from "../src/site.js";

const BASE = "https://southgate.test/auth/api/v1/";

const NORTHGATE = {
  host: "northgate.test",
  matched: true,
  primary: false,
  locale: "ru",
  brand: {
    key: "northgate",
    name: "Northgate",
    title: "Northgate — объявления",
    logo: "/brand/northgate/logo.svg",
    theme: "northgate",
    legal: {
      company: "OOO Northgate",
      support_email: "hello@northgate.test",
      privacy_url: "/privacy",
      terms_url: "/terms",
    },
  },
  seo: { index: true, canonical_host: "northgate.test" },
};

const FALLBACK: Site = {
  host: "southgate.test",
  matched: false,
  primary: true,
  locale: "en",
  brand: {
    key: "southgate",
    name: "Southgate",
    title: "Southgate",
    logo: "/brand/southgate/logo.svg",
    theme: "southgate",
    legal: { company: "Southgate" },
  },
  seo: { index: true, canonical_host: "southgate.test" },
};

/** A client whose every call answers with `body` (or fails). */
function clientAnswering(
  body: unknown,
  init: { status?: number } = {}
): ReturnType<typeof createStapelClient> {
  const status = init.status ?? 200;
  return createStapelClient({
    baseUrl: BASE,
    fetch: (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://southgate.test/auth/api/v1/site/");
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof globalThis.fetch,
  });
}

function wrapperFor(client: ReturnType<typeof createStapelClient>) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return (
      <SiteProvider client={client} fallback={FALLBACK}>
        {props.children}
      </SiteProvider>
    );
  };
}

function BrandName(): ReactElement {
  const site = useSite();
  return <span data-testid="brand">{site.brand?.name ?? "—"}</span>;
}

describe("fetchSite", () => {
  it("GETs `site/` relative to the client's baseUrl and reads the document", async () => {
    const site = await fetchSite(clientAnswering(NORTHGATE));
    expect(site.host).toBe("northgate.test");
    expect(site.matched).toBe(true);
    expect(site.primary).toBe(false);
    expect(site.locale).toBe("ru");
    expect(site.brand?.key).toBe("northgate");
    expect(site.brand?.theme).toBe("northgate");
    expect(site.brand?.legal.support_email).toBe("hello@northgate.test");
    expect(site.seo).toEqual({ index: true, canonical_host: "northgate.test" });
  });

  it("reads an empty registry's answer as a brandless site rather than an error", async () => {
    const site = await fetchSite(
      clientAnswering({ host: "localhost", matched: false, brand: null })
    );
    expect(site.brand).toBeNull();
    expect(site.seo.canonical_host).toBe("localhost"); // defaults to the host
  });

  it("rejects a response that is not a site document (an SPA HTML fallback)", async () => {
    await expect(fetchSite(clientAnswering({ detail: "not found" }))).rejects.toThrow(
      /not a site document/
    );
  });
});

describe("SiteProvider", () => {
  it("renders the fallback immediately and replaces it when the fetch resolves", async () => {
    render(<BrandName />, { wrapper: wrapperFor(clientAnswering(NORTHGATE)) });

    // The FIRST frame is the container's own brand — never an empty header.
    expect(screen.getByTestId("brand").textContent).toBe("Southgate");
    await waitFor(() =>
      expect(screen.getByTestId("brand").textContent).toBe("Northgate")
    );
  });

  it("keeps the fallback when the fetch fails, warns once, and never throws into the tree", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BrandName />, {
      wrapper: wrapperFor(clientAnswering({ detail: "gone" }, { status: 502 })),
    });

    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("brand").textContent).toBe("Southgate");
    expect(String(warn.mock.calls[0]?.[0])).toContain("keeping the fallback brand");
    warn.mockRestore();
  });

  it("reflects the resolved brand and locale onto <html> (data-brand + lang)", async () => {
    render(<BrandName />, { wrapper: wrapperFor(clientAnswering(NORTHGATE)) });

    // The fallback's own brand lands on the first frame too — the attribute
    // is never absent while a brand is being shown.
    await waitFor(() =>
      expect(document.documentElement.dataset.brand).toBe("northgate")
    );
    expect(document.documentElement.lang).toBe("ru");
  });

  it("removes data-brand for a deployment with no site registry", async () => {
    document.documentElement.dataset.brand = "stale";
    render(<BrandName />, {
      wrapper: wrapperFor(clientAnswering({ ...NORTHGATE, brand: null })),
    });

    await waitFor(() =>
      expect(document.documentElement.dataset.brand).toBeUndefined()
    );
  });
});

describe("useSite / useOptionalSite outside a provider", () => {
  it("useSite throws an error that names the missing wiring", () => {
    expect(() => renderHook(() => useSite())).toThrowError(
      /useSite\(\) was called outside a <SiteProvider>/
    );
  });

  it("useOptionalSite returns null instead — library code may prefer a site", () => {
    const { result } = renderHook(() => useOptionalSite());
    expect(result.current).toBeNull();
  });
});
