import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mapLoad, matchList } from "@stapel/core";
import type { ReactElement, ReactNode } from "react";
import { createBillingRuntime } from "../src/model/runtime.js";
import type { BillingRuntime } from "../src/model/runtime.js";
import { BillingProvider } from "../src/headless/BillingProvider.js";
import { Wallet } from "../src/headless/Wallet.js";
import { PricingTable } from "../src/headless/PricingTable.js";
import { Subscription } from "../src/headless/Subscription.js";
import { useWallet } from "../src/model/queries.js";
import { useCreateCheckout } from "../src/model/mutations.js";

/** Base the msw handlers mount on (mirrors stapel-billing `/billing/api`). */
const BASE = "https://billing.stapel.test/billing/api/v1";

const WALLET = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  balance: 1240,
  currency: "USD",
  auto_recharge_enabled: false,
  auto_recharge_threshold: 100,
  auto_recharge_package: null,
  low_balance_alert: 50,
  updated_at: "2026-06-01T00:00:00Z",
};

const CATALOG = {
  packages: [
    { slug: "pro", name: "Pro", credits: 2000, price_cents: 1800, currency: "USD" },
  ],
  plans: [],
};

const SUBSCRIPTION = {
  plan: "pro",
  status: "active",
  stripe_subscription_id: "sub_1",
  current_period_start: "2026-06-01T00:00:00Z",
  current_period_end: "2026-07-01T00:00:00Z",
  cancelled_at: null,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: BillingRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <BillingProvider runtime={runtime}>{children}</BillingProvider>
    </QueryClientProvider>
  );
}

describe("useWallet (happy path)", () => {
  it("fetches and returns the caller's wallet", async () => {
    server.use(http.get(`${BASE}/wallet`, () => HttpResponse.json(WALLET)));
    const runtime = createBillingRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.balance).toBe(1240);
    expect(result.current.data?.currency).toBe("USD");
  });
});

describe("<Wallet> (view + settings save)", () => {
  it("loads the wallet and flips to saved after a PATCH", async () => {
    server.use(
      http.get(`${BASE}/wallet`, () => HttpResponse.json(WALLET)),
      http.patch(`${BASE}/wallet`, async ({ request }) => {
        const patch = (await request.json()) as { auto_recharge_enabled?: boolean };
        return HttpResponse.json({ ...WALLET, ...patch });
      })
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <Wallet>
          {({ balance, autoRechargeEnabled, isSaved, save }) => (
            <div>
              <span data-testid="balance">{balance ?? "none"}</span>
              <span data-testid="auto">{String(autoRechargeEnabled)}</span>
              <span data-testid="saved">{String(isSaved)}</span>
              <button onClick={() => save({ auto_recharge_enabled: true })}>
                save
              </button>
            </div>
          )}
        </Wallet>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("balance").textContent).toBe("1240")
    );
    screen.getByText("save").click();
    await waitFor(() =>
      expect(screen.getByTestId("saved").textContent).toBe("true")
    );
    expect(screen.getByTestId("auto").textContent).toBe("true");
  });
});

describe("<PricingTable> (checkout happy path — payment mutation)", () => {
  it("loads the catalogue and resolves a checkout URL", async () => {
    server.use(
      http.get(`${BASE}/products`, () => HttpResponse.json(CATALOG)),
      http.post(`${BASE}/checkout`, () =>
        HttpResponse.json({
          checkout_url: "https://checkout.stripe.test/session/cs_1",
          session_id: "cs_1",
        })
      )
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <PricingTable>
          {({ state, checkoutUrl, checkout }) => (
            <div>
              <span data-testid="count">
                {matchList(
                  mapLoad(state, (catalog) => catalog.packages),
                  {
                    loading: () => "loading",
                    empty: () => "0",
                    failed: () => "failed",
                    ready: (packages) => String(packages.length),
                  }
                )}
              </span>
              <span data-testid="url">{checkoutUrl ?? "none"}</span>
              <button onClick={() => checkout({ package: "pro" })}>buy</button>
            </div>
          )}
        </PricingTable>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
    screen.getByText("buy").click();
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe(
        "https://checkout.stripe.test/session/cs_1"
      )
    );
  });
});

describe("useCreateCheckout (localizable error — payment mutation negative case)", () => {
  it("surfaces a StapelApiError code on a rejected checkout", async () => {
    server.use(
      http.post(`${BASE}/checkout`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.invalid_package",
            error: "Invalid credit package",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useCreateCheckout(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    result.current.mutate({ package: "ghost" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.400.invalid_package");
  });
});

describe("<Subscription> (status + cancel)", () => {
  it("shows the active subscription and cancels it", async () => {
    server.use(
      http.get(`${BASE}/subscription`, () => HttpResponse.json(SUBSCRIPTION)),
      http.post(`${BASE}/subscription/cancel`, () =>
        HttpResponse.json({ ...SUBSCRIPTION, status: "cancelled" })
      )
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <Subscription>
          {({ status, isActive, cancel }) => (
            <div>
              <span data-testid="status">{status ?? "loading"}</span>
              <span data-testid="active">{String(isActive)}</span>
              <button onClick={cancel}>cancel</button>
            </div>
          )}
        </Subscription>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("active")
    );
    screen.getByText("cancel").click();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("cancelled")
    );
    expect(screen.getByTestId("active").textContent).toBe("false");
  });
});

/**
 * The three answers a catalogue read can give, kept apart — the regression the
 * `LoadState` cutover exists for. Before it the bag handed skins
 * `packages: []` for BOTH "the shop sells nothing" and "the pricing endpoint
 * is down", so a failed read rendered as a shop that sells nothing. msw drives
 * the real transport, so the failed case is produced by an actual 500 (mock
 * the wire, not the module).
 */
const PRICING_LOADING = "loading pricing";
const PRICING_EMPTY = "nothing on sale";
const PRICING_FAILED = "pricing unavailable";

function PricingSkin(): ReactElement {
  return (
    <PricingTable>
      {({ state }) =>
        matchList(
          mapLoad(state, (catalog) => catalog.packages),
          {
            loading: () => <span>{PRICING_LOADING}</span>,
            empty: () => <span>{PRICING_EMPTY}</span>,
            failed: () => <span>{PRICING_FAILED}</span>,
            ready: (packages) => (
              <span data-testid="rows">{packages.length}</span>
            ),
          }
        )
      }
    </PricingTable>
  );
}

describe("<PricingTable> load states (loading / empty / failed)", () => {
  // These three assert on ABSENCE as much as presence, so each case needs a
  // DOM of its own (this package's setup registers no auto-cleanup).
  afterEach(cleanup);

  it("shows the loading copy while the catalogue is in flight", async () => {
    server.use(http.get(`${BASE}/products`, () => HttpResponse.json(CATALOG)));
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PricingSkin />));
    expect(screen.getByText(PRICING_LOADING)).toBeDefined();
    expect(screen.queryByText(PRICING_EMPTY)).toBeNull();
    await waitFor(() => expect(screen.getByTestId("rows")).toBeDefined());
  });

  it("says the shop is empty only when the read actually answered empty", async () => {
    server.use(
      http.get(`${BASE}/products`, () =>
        HttpResponse.json({ packages: [], plans: [] })
      )
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PricingSkin />));
    await waitFor(() =>
      expect(screen.getByText(PRICING_EMPTY)).toBeDefined()
    );
  });

  it("shows the failure — and NEVER the empty copy — when the read fails", async () => {
    server.use(
      http.get(`${BASE}/products`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.500.internal",
            error: "Pricing is down",
            params: {},
          },
          { status: 500 }
        )
      )
    );
    const runtime = createBillingRuntime({ baseUrl: BASE });
    render(wrap(runtime, <PricingSkin />));
    await waitFor(() =>
      expect(screen.getByText(PRICING_FAILED)).toBeDefined()
    );
    expect(screen.queryByText(PRICING_EMPTY)).toBeNull();
    expect(screen.queryByTestId("rows")).toBeNull();
  });
});
