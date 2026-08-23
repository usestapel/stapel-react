/**
 * `<WalletPanel/>` — the `/default` skin, rendered against real wire bodies.
 *
 * What the assertions are actually protecting:
 *
 *   - the deadline reaches the SCREEN. A wallet that expires credits silently
 *     is, from the holder's side, a wallet that loses them.
 *   - loading ≠ empty ≠ failed. The three arms are asserted separately, and
 *     the failed arm is asserted NOT to render the empty one — that
 *     substitution (a 503 drawn as "you have no credits") is the fleet's
 *     most-repeated defect class.
 *   - both ways to buy stand side by side with the SAME derived number under
 *     each, and the plan's is the lower one, said out loud.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WalletPanel } from "../src/default/index.js";
import { CATALOG, EMPTY_WALLET, WALLET } from "./fixtures.js";
import { TestProviders, WALLET_UNAVAILABLE, mockServer } from "./harness.js";
import type { HandlerResult, MockServer } from "./harness.js";

function panel(server: MockServer, onCheckoutUrl?: (url: string) => void) {
  return render(
    <TestProviders server={server}>
      <WalletPanel
        mode="light"
        {...(onCheckoutUrl ? { onCheckoutUrl } : {})}
      />
    </TestProviders>
  );
}

function shop(wallet: HandlerResult): MockServer {
  return mockServer({
    "GET /products": { body: CATALOG },
    "POST /checkout": { body: { checkout_url: "https://pay.test/session/1" } },
    "GET /wallet": wallet,
  });
}

describe("<WalletPanel/> — the balance and its deadline", () => {
  it("states the balance and when the expiring credits die", async () => {
    panel(shop({ body: WALLET }));
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-balance")).toBeTruthy()
    );
    expect(screen.getByTestId("billing-wallet-balance").textContent).toContain(
      "1,240"
    );
    const expiring = screen.getByTestId("billing-wallet-expiring");
    // 400 credits, and the date the SERVER named — localized by Intl, so the
    // assertion is on the year rather than on one locale's punctuation.
    expect(expiring.textContent).toContain("400");
    expect(expiring.textContent).toContain("2026");
    // The reserved credits are stated separately: `balance` already excludes
    // them, so adding them anywhere would be double-counting.
    expect(screen.getByTestId("billing-wallet-held").textContent).toContain(
      "60"
    );
  });

  it("says nothing about expiry when nothing expires", async () => {
    panel(
      shop({
        body: { ...WALLET, expiring_soon: null },
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-balance")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-wallet-expiring")).toBeNull();
  });
});

describe("<WalletPanel/> — loading, empty and failed are three different screens", () => {
  it("renders the loading arm before an answer", () => {
    // Never resolves within this assertion: the first paint is the skeleton,
    // not an empty wallet.
    panel(shop({ body: WALLET }));
    expect(screen.getByTestId("billing-wallet-loading")).toBeTruthy();
    expect(screen.queryByTestId("billing-wallet-empty")).toBeNull();
    expect(screen.queryByTestId("billing-wallet-failed")).toBeNull();
  });

  it("an answered, genuinely empty wallet renders the empty arm", async () => {
    panel(shop({ body: EMPTY_WALLET }));
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-empty")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-wallet-failed")).toBeNull();
    // And the shop is STILL there — an empty wallet is the one that most
    // needs to see how to stop being empty.
    expect(screen.getByTestId("billing-buy-packages")).toBeTruthy();
  });

  it("a 503 renders the refusal, NOT the empty wallet", async () => {
    panel(shop(WALLET_UNAVAILABLE));
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-wallet-empty")).toBeNull();
    expect(screen.queryByTestId("billing-wallet-balance")).toBeNull();
    // The catalogue read is independent: a broken wallet must not take the
    // way to buy credits down with it.
    expect(screen.getByTestId("billing-buy-plans")).toBeTruthy();
  });

  it("a catalogue outage renders the shop's refusal, not 'nothing on sale'", async () => {
    panel(
      mockServer({
        "GET /products": { status: 503, body: { localizable_error: "error.503.service_unavailable" } },
        "GET /wallet": { body: WALLET },
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-buy-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-buy-empty")).toBeNull();
  });

  it("an answered catalogue with no products renders the empty shop", async () => {
    panel(
      mockServer({
        "GET /products": { body: { packages: [], plans: [] } },
        "GET /wallet": { body: WALLET },
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-buy-empty")).toBeTruthy()
    );
  });
});

describe("<WalletPanel/> — the two ways to buy, compared", () => {
  it("prints a per-credit price for packages AND plans, and the plan's is lower", async () => {
    panel(shop({ body: WALLET }));
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-rate-credits-2000")).toBeTruthy()
    );
    // $18.00 / 2000 credits = $0.009; $29.00 / 5000 = $0.0058. Both are
    // printed, under the same label, so the comparison needs no calculator.
    expect(
      screen.getByTestId("billing-offer-rate-credits-2000").textContent
    ).toContain("0.009");
    expect(screen.getByTestId("billing-offer-rate-team").textContent).toContain(
      "0.0058"
    );
    // And the claim is made in words, against the best PACKAGE (36% cheaper).
    expect(
      screen.getByTestId("billing-offer-savings-team").textContent
    ).toContain("36");
    // The cheaper side is the one carrying the badge.
    expect(
      screen.getByTestId("billing-offer-team").getAttribute("data-billing-best")
    ).toBe("true");
    expect(
      screen
        .getByTestId("billing-offer-credits-2000")
        .getAttribute("data-billing-best")
    ).toBe("false");
  });

  it("both columns are on screen at once", async () => {
    panel(shop({ body: WALLET }));
    await waitFor(() =>
      expect(screen.getByTestId("billing-buy-packages")).toBeTruthy()
    );
    expect(screen.getByTestId("billing-buy-plans")).toBeTruthy();
    // Two packages and one plan, each with its own buy affordance.
    expect(screen.getByTestId("billing-offer-buy-credits-500")).toBeTruthy();
    expect(screen.getByTestId("billing-offer-buy-credits-2000")).toBeTruthy();
    expect(screen.getByTestId("billing-offer-buy-team")).toBeTruthy();
  });

  it("buying a plan posts the PLAN slug and redirects to the hosted URL", async () => {
    const server = shop({ body: WALLET });
    const go = vi.fn();
    panel(server, go);
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-buy-team")).toBeTruthy()
    );
    screen.getByTestId("billing-offer-buy-team").click();
    await waitFor(() =>
      expect(go).toHaveBeenCalledWith("https://pay.test/session/1")
    );
    const checkout = server.calls.find((call) => call.method === "POST");
    expect(checkout?.body).toBe(JSON.stringify({ plan: "team" }));
  });

  it("buying a package posts the PACKAGE slug", async () => {
    const server = shop({ body: WALLET });
    const go = vi.fn();
    panel(server, go);
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-buy-credits-500")).toBeTruthy()
    );
    screen.getByTestId("billing-offer-buy-credits-500").click();
    await waitFor(() => expect(go).toHaveBeenCalled());
    const checkout = server.calls.find((call) => call.method === "POST");
    expect(checkout?.body).toBe(JSON.stringify({ package: "credits-500" }));
  });
});
