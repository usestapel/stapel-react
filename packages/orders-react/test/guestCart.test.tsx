/**
 * The guest-cart seam: a visitor with no session adds through core's
 * elevation (mint first, then the POST), the cart read stays idle until a
 * session exists, and a host with no ElevationProvider sees the old path.
 *
 * One file of its own: the active session manager is module-global, and each
 * test here creates the one it needs.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ElevationProvider,
  I18nProvider,
  createI18n,
  createSessionManager,
} from "@stapel/core";
import type { ElevationSource, SessionManager, SessionStatus } from "@stapel/core";
import {
  AddToCartButton,
  ORDERS_ELEVATION_ACTIONS,
  ORDERS_TESTIDS,
  OrdersProvider,
  createOrdersRuntime,
  registerOrdersI18n,
} from "../src/index.js";
import {
  AddToCartButton as SkinAddToCartButton,
  CartBadge,
  CartPage,
} from "../src/default/index.js";
import { DEMO_CART } from "../demo/_fixtures.js";

const BASE = "https://shop.example/orders/api/v1/";

/** Every request and mint, in the order they happened. */
type Event = string;

function fakeFetch(log: Event[], routes: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = new URL(url).pathname.replace("/orders/api/v1/", "");
    log.push(`${method} ${path}`);
    return new Response(JSON.stringify(routes[`${method} ${path}`] ?? {}), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function session(status: SessionStatus): SessionManager {
  // The last-created manager becomes the active one the pair reads.
  return createSessionManager({ initialStatus: status, doRefresh: async () => null });
}

/** A source that mints a guest the way auth-react's does: once, then adopts. */
function guestSource(manager: SessionManager, log: Event[], gate?: Promise<void>): ElevationSource {
  return {
    actions: [ORDERS_ELEVATION_ACTIONS.addToCart],
    hasIdentity: () => manager.getStatus() === "anonymous",
    elevate: async () => {
      if (manager.getStatus() === "anonymous") return;
      log.push("elevate");
      if (gate !== undefined) await gate;
      manager.markAnonymous();
    },
  };
}

function mount(
  node: ReactElement,
  options: { log: Event[]; elevation?: ElevationSource | undefined }
): void {
  const runtime = createOrdersRuntime({
    baseUrl: BASE,
    fetch: fakeFetch(options.log, { "GET cart/": DEMO_CART, "POST cart/lines/": DEMO_CART }),
  });
  const i18n = createI18n({ locale: "en" });
  registerOrdersI18n(i18n);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (children: ReactNode): ReactElement =>
    options.elevation === undefined ? (
      <>{children}</>
    ) : (
      <ElevationProvider source={options.elevation}>{children}</ElevationProvider>
    );
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <OrdersProvider runtime={runtime}>{wrap(node)}</OrdersProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Let any query that is going to fire, fire. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("orders.add_to_cart elevation", () => {
  it("exports the action name the scaffold lists", () => {
    expect(ORDERS_ELEVATION_ACTIONS).toEqual({ addToCart: "orders.add_to_cart" });
  });

  for (const [label, Button] of [
    ["headless", AddToCartButton],
    ["default skin", SkinAddToCartButton],
  ] as const) {
    it(`${label}: an anonymous click mints a guest first, then POSTs the add`, async () => {
      const log: Event[] = [];
      const manager = session("unauthenticated");
      mount(<Button purchasableType="part" purchasableKey="P-1" />, {
        log,
        elevation: guestSource(manager, log),
      });
      fireEvent.click(await screen.findByTestId(ORDERS_TESTIDS.addToCart));
      await waitFor(() => expect(log).toContain("POST cart/lines/"));
      expect(log.indexOf("elevate")).toBe(0);
      expect(log.indexOf("POST cart/lines/")).toBeGreaterThan(log.indexOf("elevate"));
      // No cart read was sent before the visitor had a session to own it.
      const firstGet = log.indexOf("GET cart/");
      expect(firstGet === -1 || firstGet > log.indexOf("elevate")).toBe(true);
      expect(await screen.findByTestId(ORDERS_TESTIDS.goToCart)).toBeTruthy();
    });

    it(`${label}: a double click during the mint mints once and adds once`, async () => {
      const log: Event[] = [];
      const manager = session("unauthenticated");
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      mount(<Button purchasableType="part" purchasableKey="P-2" />, {
        log,
        elevation: guestSource(manager, log, gate),
      });
      const button = await screen.findByTestId(ORDERS_TESTIDS.addToCart);
      fireEvent.click(button);
      fireEvent.click(button);
      expect(button.getAttribute("aria-busy") === "true" || button.className.includes("loading")).toBe(true);
      await act(async () => {
        release();
        await gate;
      });
      await waitFor(() => expect(log).toContain("POST cart/lines/"));
      await settle();
      expect(log.filter((e) => e === "elevate")).toHaveLength(1);
      expect(log.filter((e) => e === "POST cart/lines/")).toHaveLength(1);
    });
  }

  it("a failed mint shows an alert and sends no add", async () => {
    const log: Event[] = [];
    session("unauthenticated");
    mount(<AddToCartButton purchasableType="part" purchasableKey="P-3" />, {
      log,
      elevation: {
        actions: [ORDERS_ELEVATION_ACTIONS.addToCart],
        elevate: () => Promise.reject(new Error("mint refused")),
      },
    });
    fireEvent.click(await screen.findByTestId(ORDERS_TESTIDS.addToCart));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(log).not.toContain("POST cart/lines/");
  });

  it("without an ElevationProvider the click POSTs at once, exactly as before", async () => {
    const log: Event[] = [];
    session("authenticated");
    mount(<SkinAddToCartButton purchasableType="part" purchasableKey="P-4" />, { log });
    const button = await screen.findByTestId(ORDERS_TESTIDS.addToCart);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(log).toContain("POST cart/lines/"));
    await settle();
    expect(log).not.toContain("elevate");
    expect(log.filter((e) => e === "POST cart/lines/")).toHaveLength(1);
  });
});

describe("no session, no cart read", () => {
  it("CartBadge sends no request when the visitor has no session", async () => {
    const log: Event[] = [];
    session("unauthenticated");
    mount(<CartBadge />, { log });
    await settle();
    expect(log).toEqual([]);
    expect(screen.queryByTestId(ORDERS_TESTIDS.cartBadge)).toBeNull();
  });

  it("CartPage shows an empty cart for no session, without asking the server", async () => {
    const log: Event[] = [];
    session("unauthenticated");
    mount(<CartPage />, { log });
    expect(await screen.findByTestId(ORDERS_TESTIDS.cartEmpty)).toBeTruthy();
    await settle();
    expect(log).toEqual([]);
  });

  it("a guest session reads its cart", async () => {
    const log: Event[] = [];
    session("anonymous");
    mount(<CartBadge />, { log });
    const badge = await screen.findByTestId(ORDERS_TESTIDS.cartBadge);
    expect(badge.getAttribute("data-count")).toBe("2");
    expect(log).toEqual(["GET cart/"]);
  });
});
