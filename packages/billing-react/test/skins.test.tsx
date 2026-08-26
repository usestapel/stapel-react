/**
 * The five default-skin surfaces, rendered against real wire bodies.
 *
 * What these assertions protect, in one sentence each:
 *
 *   - the TWO POOLS reach the screen as two lines and their sum reaches it
 *     as none (the finding this wave exists to close);
 *   - a debt is stated together with what the next purchase will eat;
 *   - the shop does not offer the plan the caller is already on, and says
 *     why the button is off IN TEXT beside it;
 *   - the destructive exit is not the primary, and takes a confirmation;
 *   - a switched-off control always carries its reason;
 *   - nothing machine-shaped (an enum, an ISO instant, a bare integer) is
 *     printed anywhere a person reads.
 */
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  BuyOptions,
  SubscriptionCard,
  TransactionHistory,
  WalletPanel,
  WalletSettings,
} from "../src/default/index.js";
import { PricingTable } from "../src/index.js";
import {
  CATALOG,
  EMPTY_WALLET,
  SUBSCRIPTION_ACTIVE,
  SUBSCRIPTION_CANCELLED,
  SUBSCRIPTION_FREE,
  SUBSCRIPTION_PAST_DUE,
  TRANSACTIONS,
  TRANSACTIONS_EMPTY,
  TRANSACTIONS_PAGE_2,
  WALLET,
  WALLET_IN_DEBT,
} from "./fixtures.js";
import { TestProviders, mockServer } from "./harness.js";
import type { HandlerResult, MockServer } from "./harness.js";

/** A server answering every route the billing page reads. Declaration order
 * matters: `/wallet/transactions` shares a prefix with `/wallet`. */
function billingServer(over: Record<string, HandlerResult> = {}): MockServer {
  return mockServer({
    "GET /wallet/transactions": { body: TRANSACTIONS },
    "GET /wallet": { body: WALLET },
    "PATCH /wallet": { body: WALLET },
    "GET /products": { body: CATALOG },
    "GET /subscription": { body: SUBSCRIPTION_FREE },
    "POST /subscription/cancel": { body: SUBSCRIPTION_CANCELLED },
    "GET /portal": { body: { portal_url: "https://portal.test/s/1" } },
    "POST /checkout": { body: { checkout_url: "https://pay.test/session/1" } },
    ...over,
  });
}

function mount(server: MockServer, ui: ReactElement) {
  return render(<TestProviders server={server}>{ui}</TestProviders>);
}

describe("<WalletPanel/> — the two pools, stated separately", () => {
  it("draws the perpetual and expiring pools as two lines", async () => {
    mount(billingServer(), <WalletPanel mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-pool-perpetual")).toBeTruthy()
    );
    const perpetual = screen.getByTestId("billing-wallet-pool-perpetual");
    const expiring = screen.getByTestId("billing-wallet-pool-expiring");
    // 840 bought credits that survive anything; 400 that die on the 1st.
    expect(perpetual.textContent).toContain("840");
    expect(expiring.textContent).toContain("400");
    // Each says what happens to it — a number with no fate is the old wallet.
    expect(perpetual.textContent).toMatch(/never expire/i);
    expect(expiring.textContent).toMatch(/deadline/i);
  });

  it("never prints the SUM of the two pools", async () => {
    mount(billingServer(), <WalletPanel mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-pools")).toBeTruthy()
    );
    // 840 + 400 = 1240 — the single number the old panel showed. The balance
    // above may legitimately be 1,240 (it is the server's own `balance`), but
    // the POOLS block must never restate it as a total of the two.
    expect(screen.getByTestId("billing-wallet-pools").textContent).not.toContain(
      "1,240"
    );
  });

  it("states the nearest deadline in words, from the SERVER's expiring_soon", async () => {
    // A body whose expiring_soon disagrees with any client-side scan of lots:
    // if the panel recomputed, this would print 400 / September.
    mount(
      billingServer({
        "GET /wallet": {
          body: {
            ...WALLET,
            expiring_soon: { credits: 7, expires_at: "2026-12-31T00:00:00Z" },
          },
        },
      }),
      <WalletPanel mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-expiring")).toBeTruthy()
    );
    const text = screen.getByTestId("billing-wallet-expiring").textContent ?? "";
    expect(text).toContain("7");
    expect(text).toContain("2026");
    // A date, never the ISO instant it came from.
    expect(text).not.toContain("T00:00:00Z");
  });

  it("says nothing about expiry when nothing expires", async () => {
    mount(
      billingServer({ "GET /wallet": { body: { ...WALLET, expiring_soon: null } } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-balance")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-wallet-expiring")).toBeNull();
  });

  it("announces the balance politely for assistive tech", async () => {
    const { container } = mount(billingServer(), <WalletPanel mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-balance")).toBeTruthy()
    );
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("<WalletPanel/> — a debt is what the next purchase will eat", () => {
  it("states the total owed, the reason for each debt, and what happens next", async () => {
    mount(
      billingServer({ "GET /wallet": { body: WALLET_IN_DEBT } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-wallet-debt")).toBeTruthy());
    const debt = screen.getByTestId("billing-wallet-debt");
    expect(debt.textContent).toContain("180");
    // The mechanism, in words: the next credits are collected against it.
    expect(debt.textContent).toMatch(/collected against this/i);
    // Both reasons named — never `partial_debit` / `clawback`.
    expect(debt.textContent).toMatch(/without enough credits/i);
    expect(debt.textContent).toMatch(/refund or dispute/i);
    expect(debt.textContent).not.toContain("partial_debit");
  });

  it("states the debt ONCE for the shop, not once per offer card", async () => {
    mount(
      billingServer({ "GET /wallet": { body: WALLET_IN_DEBT } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-buy-debt")).toBeTruthy());
    // The debt belongs to the wallet, so the shop says it once, above the
    // offers. Three cards each repeating "180 of these settle what you owe"
    // was one sentence printed three times (visual class VC-B1).
    expect(screen.getByTestId("billing-buy-debt").textContent).toContain("180");
    expect(screen.getAllByTestId("billing-buy-debt")).toHaveLength(1);
  });

  it("tells each offer what it would LEAVE — a different number on every card", async () => {
    mount(
      billingServer({ "GET /wallet": { body: WALLET_IN_DEBT } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-debt-credits-500")).toBeTruthy()
    );
    // 180 owed: a 500-credit package leaves 320, a 2000-credit one 1,820,
    // the 5000-credit plan 4,820. THAT is what differs offer to offer, and
    // it is the number a buyer is actually deciding on.
    expect(
      screen.getByTestId("billing-offer-debt-credits-500").textContent
    ).toContain("320");
    expect(
      screen.getByTestId("billing-offer-debt-credits-2000").textContent
    ).toContain("1,820");
    expect(screen.getByTestId("billing-offer-debt-team").textContent).toContain(
      "4,820"
    );
  });

  it("says nothing about debt when nothing is owed", async () => {
    mount(billingServer(), <WalletPanel mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-balance")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-wallet-debt")).toBeNull();
    expect(screen.queryByTestId("billing-buy-debt")).toBeNull();
    expect(screen.queryByTestId("billing-offer-debt-credits-500")).toBeNull();
  });
});

describe("nothing machine-shaped reaches the glass", () => {
  it("a 503 the pair has no key for renders a SENTENCE, never the error code", async () => {
    // `error.503.service_unavailable` is not in stapel-billing's registry, and
    // the shop printed it raw — wrapped mid-token as `service_unava/ilable`.
    // Core's HTTP status floor answers for any untranslated `error.<status>.*`;
    // this is the assertion that keeps a raw key off a customer's screen.
    mount(
      billingServer({
        "GET /products": {
          status: 503,
          body: { localizable_error: "error.503.service_unavailable" },
        },
      }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-buy-failed")).toBeTruthy());
    const text = screen.getByTestId("billing-buy-failed").textContent ?? "";
    expect(text).not.toContain("error.503");
    expect(text).not.toContain("service_unavailable");
    expect(text).toMatch(/temporarily unavailable/i);
  });

  it("no rendered surface prints an `error.` key or a snake_case enum", async () => {
    const { container } = mount(
      billingServer({
        "GET /wallet": { body: WALLET_IN_DEBT },
        "GET /subscription": { body: SUBSCRIPTION_PAST_DUE },
      }),
      <WalletPanel mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-status")).toBeTruthy()
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\berror\.\d{3}\./);
    // The enums this page carries, each of which has a label table entry.
    for (const raw of ["past_due", "partial_debit", "clawback", "credit_purchase"]) {
      expect(text, raw).not.toContain(raw);
    }
  });
});

describe("<WalletPanel/> — loading, empty and failed stay three screens", () => {
  it("renders the loading arm before an answer, never the empty one", () => {
    mount(billingServer(), <WalletPanel mode="light" />);
    expect(screen.getByTestId("billing-wallet-loading")).toBeTruthy();
    expect(screen.queryByTestId("billing-wallet-empty")).toBeNull();
    expect(screen.queryByTestId("billing-wallet-failed")).toBeNull();
  });

  it("an answered, genuinely empty wallet renders the empty arm WITH a door", async () => {
    mount(
      billingServer({ "GET /wallet": { body: EMPTY_WALLET } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-wallet-empty")).toBeTruthy());
    // An empty state with no way out of it is the gdpr defect; the shop is
    // still below, and the empty state itself points at it.
    expect(screen.getByTestId("billing-wallet-empty").textContent).toMatch(/buy a package/i);
    expect(screen.getByTestId("billing-buy-packages")).toBeTruthy();
  });

  it("a 503 on the wallet renders the refusal and leaves the shop standing", async () => {
    mount(
      billingServer({
        "GET /wallet": {
          status: 503,
          body: { localizable_error: "error.503.service_unavailable" },
        },
      }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-wallet-failed")).toBeTruthy());
    expect(screen.queryByTestId("billing-wallet-empty")).toBeNull();
    // A dead wallet must never take the way to PAY down with it.
    expect(screen.getByTestId("billing-buy-plans")).toBeTruthy();
  });

  it("a catalogue outage renders the shop's refusal, not 'nothing on sale'", async () => {
    mount(
      billingServer({
        "GET /products": {
          status: 503,
          body: { localizable_error: "error.503.service_unavailable" },
        },
      }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-buy-failed")).toBeTruthy());
    expect(screen.queryByTestId("billing-buy-empty")).toBeNull();
  });

  it("an answered catalogue with no products renders the empty shop", async () => {
    mount(
      billingServer({ "GET /products": { body: { packages: [], plans: [] } } }),
      <WalletPanel mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-buy-empty")).toBeTruthy());
  });
});

describe("<BuyOptions/> — the comparison, and the plan you already hold", () => {
  function shop(over: Record<string, HandlerResult> = {}, currentPlan?: string | null) {
    return mount(
      billingServer(over),
      <PricingTable>
        {(bag) => (
          <BuyOptions
            mode="light"
            state={bag.state}
            isCheckingOut={bag.isCheckingOut}
            {...(currentPlan !== undefined ? { currentPlan } : {})}
            onChoose={bag.checkout}
            onRetry={bag.refetch}
          />
        )}
      </PricingTable>
    );
  }

  it("prints a per-credit price for packages AND plans, and the plan's is lower", async () => {
    shop();
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-rate-credits-2000")).toBeTruthy()
    );
    expect(
      screen.getByTestId("billing-offer-rate-credits-2000").textContent
    ).toContain("0.009");
    expect(screen.getByTestId("billing-offer-rate-team").textContent).toContain("0.0058");
    expect(screen.getByTestId("billing-offer-savings-team").textContent).toContain("36");
    expect(
      screen.getByTestId("billing-offer-team").getAttribute("data-billing-best")
    ).toBe("true");
  });

  it("lays out from the ELEMENT's width, not the viewport's", async () => {
    const { container } = shop();
    await waitFor(() => expect(screen.getByTestId("billing-buy-columns")).toBeTruthy());
    // Unmeasured (jsdom's ResizeObserver is a no-op) answers the wide layout;
    // the decision is an attribute rather than an antd viewport breakpoint.
    expect(
      container.querySelector("[data-billing-columns]")?.getAttribute("data-billing-columns")
    ).toBe("2");
    expect(screen.getByTestId("billing-buy-packages")).toBeTruthy();
    expect(screen.getByTestId("billing-buy-plans")).toBeTruthy();
  });

  it("does not offer the plan the caller is already on, and says why", async () => {
    shop({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } });
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-current-team")).toBeTruthy()
    );
    const button = screen.getByTestId("billing-offer-buy-team") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    // The reason is TEXT beside the control, and the control points at it.
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toMatch(
      /the plan you are on/i
    );
    // The package column is untouched — a plan holder may still top up.
    expect(
      (screen.getByTestId("billing-offer-buy-credits-500") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("a cancelled subscription is NOT 'the plan you are on' — re-subscribing stays open", async () => {
    shop({ "GET /subscription": { body: SUBSCRIPTION_CANCELLED } });
    await waitFor(() => expect(screen.getByTestId("billing-offer-team")).toBeTruthy());
    expect(
      (screen.getByTestId("billing-offer-buy-team") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("a public pricing page can say 'nobody is signed in' and skip the question", async () => {
    shop({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } }, null);
    await waitFor(() => expect(screen.getByTestId("billing-offer-team")).toBeTruthy());
    expect(
      (screen.getByTestId("billing-offer-buy-team") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("keeps the 'Best value' badge INSIDE the card, not hanging off its edge", async () => {
    shop();
    await waitFor(() => expect(screen.getByTestId("billing-offer-best-team")).toBeTruthy());
    // As an antd `Badge.Ribbon` the badge sat outside the card's right edge
    // and a 390px viewport clipped it away entirely.
    const badge = screen.getByTestId("billing-offer-best-team");
    const card = screen.getByTestId("billing-offer-team");
    expect(card.contains(badge)).toBe(true);
    // And only the winner carries it.
    expect(screen.queryByTestId("billing-offer-best-credits-500")).toBeNull();
  });

  it("makes the purchase the biggest target on the card", async () => {
    shop();
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-buy-credits-500")).toBeTruthy()
    );
    // A commerce screen whose Buy is a 30px outline button in the corner has
    // its priorities upside down.
    expect(
      screen.getByTestId("billing-offer-buy-credits-500").className
    ).toContain("ant-btn-lg");
  });

  it("buying posts the right slug", async () => {
    const server = billingServer();
    const go = vi.fn();
    mount(
      server,
      <WalletPanel mode="light" onCheckoutUrl={go} />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-offer-buy-credits-500")).toBeTruthy()
    );
    screen.getByTestId("billing-offer-buy-credits-500").click();
    await waitFor(() => expect(go).toHaveBeenCalledWith("https://pay.test/session/1"));
    const checkout = server.calls.find((c) => c.method === "POST");
    expect(checkout?.body).toBe(JSON.stringify({ package: "credits-500" }));
  });
});

describe("<SubscriptionCard/> — four states, and a quiet way out", () => {
  it("names the plan, its status and its next date", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-plan")).toBeTruthy()
    );
    // The catalogue's own display name, not the slug.
    expect(screen.getByTestId("billing-subscription-plan").textContent).toBe("Team");
    expect(screen.getByTestId("billing-subscription-status").textContent).toMatch(
      /active/i
    );
    const period = screen.getByTestId("billing-subscription-period").textContent ?? "";
    expect(period).toMatch(/renews on/i);
    expect(period).not.toContain("T00:00:00Z");
  });

  it("makes 'Manage billing' the primary and Cancel the quiet one", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-manage")).toBeTruthy()
    );
    const manage = screen.getByTestId("billing-subscription-manage");
    const cancel = screen.getByTestId("billing-subscription-cancel");
    expect(manage.className).toContain("ant-btn-primary");
    // The destructive exit is NOT a primary — the defect the visual pass named.
    expect(cancel.className).not.toContain("ant-btn-primary");
    // And it comes after it in the document, not before.
    expect(
      manage.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("cancelling takes a confirmation that says what survives it", async () => {
    const server = billingServer({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } });
    mount(server, <SubscriptionCard mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-cancel")).toBeTruthy()
    );
    // Pressing Cancel sends nothing on its own.
    screen.getByTestId("billing-subscription-cancel").click();
    expect(server.calls.some((c) => c.url.includes("/subscription/cancel"))).toBe(false);
    await waitFor(() => expect(screen.getByTestId("stapel-confirm-ok")).toBeTruthy());
    const dialog = screen.getByTestId("billing-subscription-cancel-confirm");
    expect(dialog.textContent).toMatch(/credits you bought stay/i);
    screen.getByTestId("stapel-confirm-ok").click();
    await waitFor(() =>
      expect(server.calls.some((c) => c.url.includes("/subscription/cancel"))).toBe(true)
    );
  });

  it("the free row is 'no subscription', with no dead controls beside it", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_FREE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-none")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-subscription-cancel")).toBeNull();
    expect(screen.queryByTestId("billing-subscription-manage")).toBeNull();
    // And never the raw slug.
    expect(screen.getByTestId("billing-subscription").textContent).not.toContain("free");
  });

  it("a cancelled subscription runs UNTIL a date and cannot be cancelled again", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_CANCELLED } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-period")).toBeTruthy()
    );
    expect(screen.getByTestId("billing-subscription-period").textContent).toMatch(
      /runs until/i
    );
    const cancel = screen.getByTestId("billing-subscription-cancel") as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    const describedBy = cancel.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy ?? "")?.textContent).toMatch(
      /already cancelled/i
    );
  });

  it("draws 'Payment overdue' in the ERROR tone, never the success one", async () => {
    // The card asked "is it cancelled?" and painted everything else green, so
    // a bounced payment shipped a green chip over the words "Payment overdue"
    // (visual class VC-B4). The tone now comes from the state.
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_PAST_DUE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-status")).toBeTruthy()
    );
    const tag = screen.getByTestId("billing-subscription-status");
    expect(tag.getAttribute("data-billing-tone")).toBe("error");
    expect(tag.className).not.toContain("ant-tag-success");
  });

  it("an active subscription still reads as a success", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_ACTIVE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-status")).toBeTruthy()
    );
    expect(
      screen.getByTestId("billing-subscription-status").getAttribute("data-billing-tone")
    ).toBe("success");
  });

  it("a bounced payment says what it costs and what fixes it", async () => {
    mount(
      billingServer({ "GET /subscription": { body: SUBSCRIPTION_PAST_DUE } }),
      <SubscriptionCard mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-subscription-past-due")).toBeTruthy()
    );
    expect(
      screen.getByTestId("billing-subscription-past-due").textContent
    ).toMatch(/update your payment method/i);
    expect(screen.getByTestId("billing-subscription").textContent).not.toContain(
      "past_due"
    );
  });
});

describe("<WalletSettings/> — auto-recharge, with both refusals in words", () => {
  it("saves the whole settings patch", async () => {
    const server = billingServer();
    mount(server, <WalletSettings mode="light" />);
    await waitFor(() => expect(screen.getByTestId("billing-wallet-save")).toBeTruthy());
    screen.getByTestId("billing-wallet-save").click();
    await waitFor(() => expect(server.calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = server.calls.find((c) => c.method === "PATCH");
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({
      auto_recharge_enabled: false,
      auto_recharge_threshold: 100,
      auto_recharge_package: null,
      low_balance_alert: 50,
    });
  });

  it("switches auto-recharge off — with the reason — when the shop sells no packages", async () => {
    mount(
      billingServer({ "GET /products": { body: { packages: [], plans: CATALOG.plans } } }),
      <WalletSettings mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-auto-recharge")).toBeTruthy()
    );
    const toggle = screen.getByTestId("billing-wallet-auto-recharge") as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    const describedBy = toggle.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy ?? "")?.textContent).toMatch(
      /nothing to buy automatically/i
    );
  });

  it("switches the whole top-up group off, and states the reason ONCE", async () => {
    mount(
      billingServer({ "GET /products": { body: { packages: [], plans: CATALOG.plans } } }),
      <WalletSettings mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-threshold")).toBeTruthy()
    );
    // A live trigger and an empty select beside "there is nothing to buy
    // automatically" was a form offering a setting it had just refused.
    expect(
      (screen.getByTestId("billing-wallet-threshold") as HTMLInputElement).disabled
    ).toBe(true);
    // And the description of what auto-recharge WOULD do is gone, so the card
    // does not contradict itself in consecutive sentences.
    const card = screen.getByTestId("billing-wallet-settings");
    expect(card.textContent).not.toMatch(/we buy this package for you/i);
    expect(
      card.textContent?.match(/nothing to buy automatically/gi)?.length
    ).toBe(1);
    // The low-balance warning is not the shop's business and stays live.
    expect(
      (screen.getByTestId("billing-wallet-alert") as HTMLInputElement).disabled
    ).toBe(false);
  });

  it("a catalogue OUTAGE does not switch the form off — the alert threshold is not the shop's business", async () => {
    mount(
      billingServer({
        "GET /products": {
          status: 503,
          body: { localizable_error: "error.503.service_unavailable" },
        },
      }),
      <WalletSettings mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-auto-recharge")).toBeTruthy()
    );
    expect(
      (screen.getByTestId("billing-wallet-auto-recharge") as HTMLButtonElement).disabled
    ).toBe(false);
    expect(
      (screen.getByTestId("billing-wallet-save") as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("refuses to save auto-recharge ON with no package chosen, and says so", async () => {
    mount(billingServer(), <WalletSettings mode="light" />);
    await waitFor(() =>
      expect(screen.getByTestId("billing-wallet-auto-recharge")).toBeTruthy()
    );
    await act(async () => {
      screen.getByTestId("billing-wallet-auto-recharge").click();
      await Promise.resolve();
    });
    const save = screen.getByTestId("billing-wallet-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const describedBy = save.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy ?? "")?.textContent).toMatch(
      /choose the package/i
    );
  });
});

describe("<TransactionHistory/> — where the credits went", () => {
  it("names the movement, signs the delta and dates it in words", async () => {
    mount(billingServer(), <TransactionHistory mode="light" />);
    await waitFor(() =>
      expect(
        screen.getByTestId("billing-tx-1a000000-0000-4000-8000-000000000001")
      ).toBeTruthy()
    );
    const purchase = screen.getByTestId("billing-tx-1a000000-0000-4000-8000-000000000001");
    expect(purchase.textContent).toMatch(/credits bought/i);
    expect(purchase.textContent).not.toContain("credit_purchase");
    expect(purchase.textContent).not.toContain("T09:12:00Z");
    // The direction is the point of a ledger row.
    expect(
      within(purchase).getByTestId(
        "billing-tx-delta-1a000000-0000-4000-8000-000000000001"
      ).textContent
    ).toContain("+");
    const charge = screen.getByTestId("billing-tx-1a000000-0000-4000-8000-000000000002");
    expect(
      within(charge).getByTestId("billing-tx-delta-1a000000-0000-4000-8000-000000000002")
        .textContent
    ).toMatch(/[-−]/);
    // Where the balance landed, grouped.
    expect(purchase.textContent).toContain("2,840");
  });

  it("pages forward on the server's own cursor", async () => {
    const server = mockServer({
      "GET /wallet/transactions?cursor=": { body: TRANSACTIONS_PAGE_2 },
      "GET /wallet/transactions": { body: TRANSACTIONS },
    });
    mount(server, <TransactionHistory mode="light" />);
    await waitFor(() => expect(screen.getByTestId("billing-tx-more")).toBeTruthy());
    screen.getByTestId("billing-tx-more").click();
    await waitFor(() =>
      expect(
        screen.getByTestId("billing-tx-1a000000-0000-4000-8000-000000000003")
      ).toBeTruthy()
    );
    // The first page is still on screen — paging adds, it does not replace.
    expect(
      screen.getByTestId("billing-tx-1a000000-0000-4000-8000-000000000001")
    ).toBeTruthy();
    expect(
      server.calls.some((c) => c.url.includes("cursor=cursor-page-2"))
    ).toBe(true);
  });

  it("an answered, empty ledger renders the empty state — a failed one does not", async () => {
    mount(
      billingServer({ "GET /wallet/transactions": { body: TRANSACTIONS_EMPTY } }),
      <TransactionHistory mode="light" />
    );
    await waitFor(() => expect(screen.getByTestId("billing-tx-empty")).toBeTruthy());
    expect(screen.queryByTestId("billing-tx-more")).toBeNull();
  });

  it("a ledger outage states the refusal, never 'no credits have moved'", async () => {
    mount(
      billingServer({
        "GET /wallet/transactions": {
          status: 503,
          body: { localizable_error: "error.503.service_unavailable" },
        },
      }),
      <TransactionHistory mode="light" />
    );
    await waitFor(() =>
      expect(screen.getByTestId("billing-tx-page-first-failed")).toBeTruthy()
    );
    expect(screen.queryByTestId("billing-tx-empty")).toBeNull();
  });
});

describe("every surface renders on both sides of the theme", () => {
  const surfaces: readonly (readonly [string, ReactElement])[] = [
    ["WalletPanel", <WalletPanel key="w" />],
    ["SubscriptionCard", <SubscriptionCard key="s" />],
    ["WalletSettings", <WalletSettings key="g" />],
    ["TransactionHistory", <TransactionHistory key="t" />],
  ];

  for (const [name, ui] of surfaces) {
    it(`${name} follows the document's live data-theme`, async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      try {
        const { container } = mount(billingServer(), ui);
        await act(async () => {
          await Promise.resolve();
        });
        const root = container.querySelector("[data-stapel-skin-mode]");
        // The shared SkinTheme, subscribed to the document — not a
        // `mode = "light"` literal and not a once-sampled resolveThemeMode().
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe("dark");
      } finally {
        document.documentElement.removeAttribute("data-theme");
      }
    });
  }

  it("light is the answer when the document says so", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    try {
      const { container } = mount(billingServer(), <WalletPanel />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(
        container
          .querySelector("[data-stapel-skin-mode]")
          ?.getAttribute("data-stapel-skin-mode")
      ).toBe("light");
    } finally {
      document.documentElement.removeAttribute("data-theme");
    }
  });
});
