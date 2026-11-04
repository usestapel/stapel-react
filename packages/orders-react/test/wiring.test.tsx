/**
 * Wiring tests: every fixed test id is rendered by its page, the add-to-cart
 * control sends the request its props name, and a double click on the
 * checkout submit sends one idempotency key.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  AddToCartButton,
  ORDERS_TESTIDS,
  OrdersProvider,
  createOrdersRuntime,
  registerOrdersI18n,
} from "../src/index.js";
import {
  AddToCartButton as SkinAddToCartButton,
  CartBadge,
  CartPage,
  CheckoutPage,
  OrderDetailPane,
  OrderHistoryPane,
} from "../src/default/index.js";
import { DEMO_CART, DEMO_EMPTY_CART, DEMO_ORDER, DEMO_ORDER_PAGE } from "../demo/_fixtures.js";

const BASE = "https://shop.example/orders/api/v1/";

interface Call {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
}

/** A fetch that answers by `METHOD path-suffix` (longest suffix wins) and records calls. */
function fakeFetch(routes: Record<string, unknown>, calls: Call[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const path = new URL(url).pathname.replace("/orders/api/v1/", "");
    const match = Object.keys(routes)
      .filter((key) => {
        const [m, suffix] = key.split(" ");
        return m === method && path === suffix;
      })
      .sort((a, b) => b.length - a.length)[0];
    const answer = match !== undefined ? routes[match] : {};
    const [status, payload] =
      Array.isArray(answer) && typeof answer[0] === "number" ? answer : [200, answer];
    return new Response(JSON.stringify(payload), {
      status: status as number,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function Harness(props: { routes: Record<string, unknown>; calls: Call[]; children: ReactNode }): ReactElement {
  const runtime = createOrdersRuntime({ baseUrl: BASE, fetch: fakeFetch(props.routes, props.calls) });
  const i18n = createI18n({ locale: "en" });
  registerOrdersI18n(i18n);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <OrdersProvider runtime={runtime}>{props.children}</OrdersProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function mount(node: ReactElement, routes: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  render(
    <Harness routes={routes} calls={calls}>
      {node}
    </Harness>
  );
  return calls;
}

describe("testids are fixed by the pair and rendered by their pages", () => {
  it("CartPage: page-cart, one cart-line per line, cart-total, checkout-link", async () => {
    mount(<CartPage />, { "GET cart/": DEMO_CART });
    expect(await screen.findByTestId(ORDERS_TESTIDS.pageCart)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId(ORDERS_TESTIDS.cartLine)).toHaveLength(2));
    expect(screen.getByTestId(ORDERS_TESTIDS.cartTotal)).toBeTruthy();
    expect(screen.getByTestId(ORDERS_TESTIDS.checkoutLink).getAttribute("href")).toBe("/checkout");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("CartPage: an empty cart renders cart-empty, not a line", async () => {
    mount(<CartPage />, { "GET cart/": DEMO_EMPTY_CART });
    expect(await screen.findByTestId(ORDERS_TESTIDS.cartEmpty)).toBeTruthy();
    expect(screen.queryAllByTestId(ORDERS_TESTIDS.cartLine)).toHaveLength(0);
  });

  it("CheckoutPage: page-checkout, the street-address field and checkout-submit", async () => {
    mount(<CheckoutPage onNavigate={() => undefined} />, { "GET cart/": DEMO_CART });
    expect(await screen.findByTestId(ORDERS_TESTIDS.pageCheckout)).toBeTruthy();
    expect(screen.getByTestId(ORDERS_TESTIDS.checkoutSubmit)).toBeTruthy();
    const line1 = document.querySelector('input[name="line1"]');
    expect(line1?.getAttribute("autocomplete")).toBe("street-address");
    for (const name of ["name", "phone", "city", "country"]) {
      expect(document.querySelector(`input[name="${name}"]`)).not.toBeNull();
    }
  });

  it("OrderHistoryPane: page-orders and one order-row per order", async () => {
    mount(<OrderHistoryPane />, { "GET orders/": DEMO_ORDER_PAGE });
    expect(await screen.findByTestId(ORDERS_TESTIDS.pageOrders)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId(ORDERS_TESTIDS.orderRow)).toHaveLength(2));
    expect(screen.queryByTestId(ORDERS_TESTIDS.ordersLoadMore)).toBeNull();
  });

  it("OrderHistoryPane: load more follows next_anchor", async () => {
    const calls = mount(<OrderHistoryPane />, {
      "GET orders/": { ...DEMO_ORDER_PAGE, items: [DEMO_ORDER], has_next: true, next_anchor: 501 },
    });
    fireEvent.click(await screen.findByTestId(ORDERS_TESTIDS.ordersLoadMore));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("anchor=501") && c.url.includes("direction=next"))).toBe(true)
    );
  });

  it("OrderDetailPane: page-order and order-cancel posts the cancel", async () => {
    const calls = mount(<OrderDetailPane id="501" />, {
      "GET orders/501/": DEMO_ORDER,
      "POST orders/501/cancel/": { ...DEMO_ORDER, status: "cancelled", cancellable: false },
    });
    expect(await screen.findByTestId(ORDERS_TESTIDS.pageOrder)).toBeTruthy();
    fireEvent.click(await screen.findByTestId(ORDERS_TESTIDS.orderCancel));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("orders/501/cancel/"))).toBe(true)
    );
    await waitFor(() => expect(screen.queryByTestId(ORDERS_TESTIDS.orderCancel)).toBeNull());
  });

  it("OrderDetailPane: no cancel button when the order is not cancellable", async () => {
    mount(<OrderDetailPane id="501" />, { "GET orders/501/": { ...DEMO_ORDER, cancellable: false } });
    expect(await screen.findByText(DEMO_ORDER.number, { exact: false })).toBeTruthy();
    expect(screen.queryByTestId(ORDERS_TESTIDS.orderCancel)).toBeNull();
  });

  it("CartBadge: cart-badge carries the count, hidden on an empty cart", async () => {
    mount(<CartBadge />, { "GET cart/": DEMO_CART });
    const badge = await screen.findByTestId(ORDERS_TESTIDS.cartBadge);
    expect(badge.getAttribute("data-count")).toBe("2");
    cleanupAndMountEmptyBadge();
  });
});

function cleanupAndMountEmptyBadge(): void {
  const { container } = render(
    <Harness routes={{ "GET cart/": DEMO_EMPTY_CART }} calls={[]}>
      <div data-probe="empty-badge">
        <CartBadge />
      </div>
    </Harness>
  );
  expect(container.querySelector(`[data-testid="${ORDERS_TESTIDS.cartBadge}"]`)).toBeNull();
}

describe("AddToCartButton owns its request", () => {
  for (const [label, Button] of [
    ["headless", AddToCartButton],
    ["default skin", SkinAddToCartButton],
  ] as const) {
    it(`${label}: POSTs cart/lines/ with the props it was given, then offers Go to cart`, async () => {
      const calls = mount(<Button purchasableType="part" purchasableKey="P-77" quantity={3} />, {
        "GET cart/": DEMO_CART,
        "POST cart/lines/": DEMO_CART,
      });
      const button = await screen.findByTestId(ORDERS_TESTIDS.addToCart);
      fireEvent.click(button);
      await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
      const post = calls.find((c) => c.method === "POST");
      expect(post?.url).toBe(`${BASE}cart/lines/`);
      expect(post?.body).toEqual({ purchasable_type: "part", purchasable_key: "P-77", quantity: 3 });
      const go = await screen.findByTestId(ORDERS_TESTIDS.goToCart);
      expect(go.getAttribute("href")).toBe("/cart");
    });
  }

  it("renders add-to-cart even when disabled", async () => {
    mount(<AddToCartButton purchasableType="listing" purchasableKey="1" disabled />, {
      "GET cart/": DEMO_CART,
    });
    const button = await screen.findByTestId(ORDERS_TESTIDS.addToCart);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("checkout", () => {
  async function fillAndDoubleSubmit(): Promise<void> {
    await screen.findByTestId(ORDERS_TESTIDS.pageCheckout);
    const set = (name: string, value: string): void => {
      const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      fireEvent.change(input, { target: { value } });
    };
    set("name", "Alex Doe");
    set("phone", "+1 555 0100");
    set("line1", "1 Main Street");
    set("city", "Springfield");
    set("country", "us");
    const submit = screen.getByTestId(ORDERS_TESTIDS.checkoutSubmit);
    fireEvent.click(submit);
    fireEvent.click(submit);
  }

  it("a double click sends one idempotency key and navigates to the order", async () => {
    const navigated: string[] = [];
    const calls = mount(<CheckoutPage onNavigate={(href) => navigated.push(href)} />, {
      "GET cart/": DEMO_CART,
      "POST checkout/": [201, DEMO_ORDER],
    });
    await fillAndDoubleSubmit();
    await waitFor(() => expect(navigated).toEqual(["/orders/501"]));
    const posts = calls.filter((c) => c.method === "POST");
    const keys = new Set(posts.map((c) => (c.body as { idempotency_key: string }).idempotency_key));
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(keys.size).toBe(1);
    const body = posts[0]?.body as Record<string, unknown>;
    expect(body.shipping_address).toEqual({ line1: "1 Main Street", city: "Springfield", country: "US" });
    expect(body.contact).toEqual({ name: "Alex Doe", phone: "+1 555 0100" });
  });

  it("a price change keeps the key, shows the notice, and the resubmit reuses the key", async () => {
    const calls = mount(<CheckoutPage onNavigate={() => undefined} />, {
      "GET cart/": DEMO_CART,
      "POST checkout/": [
        409,
        { code: "error.409.cart_price_changed", localizable_error: "error.409.cart_price_changed", params: { cart: DEMO_CART } },
      ],
    });
    await fillAndDoubleSubmit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    fireEvent.click(screen.getByTestId(ORDERS_TESTIDS.checkoutSubmit));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST").length).toBeGreaterThanOrEqual(2));
    const keys = new Set(
      calls.filter((c) => c.method === "POST").map((c) => (c.body as { idempotency_key: string }).idempotency_key)
    );
    expect(keys.size).toBe(1);
  });
});
