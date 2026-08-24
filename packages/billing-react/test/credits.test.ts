/**
 * The two credit pools, the debt, and the formatters — the pure half.
 *
 * These are the claims the wallet screen is built on, tested where they can
 * be tested without a DOM: that the split is on the deadline and not on the
 * source, that nothing here ever produces the SUM of the two pools, that a
 * debt is clamped against the purchase it will eat, and that a count reaches
 * the glass grouped rather than as a bare integer.
 */
import { describe, expect, it } from "vitest";
import {
  collectedFromPurchase,
  creditPools,
  debtOutstanding,
  heldCredits,
  isEmptyWallet,
  openDebts,
} from "../src/model/credits.js";
import {
  daysUntil,
  formatCreditCount,
  formatCreditDelta,
  formatDeadlineRelative,
  formatExpiryDate,
  formatMoney,
  formatTimestamp,
} from "../src/model/money.js";
import { columnsForWidth, TWO_COLUMN_MIN_WIDTH } from "../src/default/elementWidth.js";
import {
  debtReasonKey,
  subscriptionStatusKey,
  titleCaseSlug,
  transactionTypeKey,
} from "../src/default/labels.js";
import { BILLING_I18N_KEYS } from "../src/i18n/keys.js";
import type { CreditLot } from "../src/api/types.js";
import {
  EMPTY_WALLET,
  PURCHASE_LOT,
  SUBSCRIPTION_LOT,
  WALLET,
  WALLET_IN_DEBT,
} from "./fixtures.js";

describe("creditPools — the split is on the DEADLINE, not the source", () => {
  it("puts the non-expiring lot in perpetual and the dated one in expiring", () => {
    const pools = creditPools(WALLET.lots ?? []);
    expect(pools.perpetual.lots.map((l) => l.id)).toEqual([PURCHASE_LOT.id]);
    expect(pools.expiring.lots.map((l) => l.id)).toEqual([SUBSCRIPTION_LOT.id]);
    expect(pools.perpetual.credits).toBe(840);
    expect(pools.expiring.credits).toBe(400);
  });

  it("never reports the sum — the two pools have no total between them", () => {
    const pools = creditPools(WALLET.lots ?? []);
    // 840 + 400 = 1240, which is the number the old wallet printed and the
    // one this whole model exists to stop. There is nowhere to read it from.
    expect(Object.keys(pools).sort()).toEqual(["expiring", "perpetual"]);
    expect(pools).not.toHaveProperty("total");
    expect(pools).not.toHaveProperty("credits");
  });

  it("a PURCHASE lot that carries a deadline is an expiring credit", () => {
    // The fate is what the display is about: a deployment that expires bought
    // credits has expiring credits, whatever paid for them.
    const dated: CreditLot = { ...PURCHASE_LOT, expires_at: "2026-10-01T00:00:00Z" };
    const pools = creditPools([dated]);
    expect(pools.expiring.lots).toHaveLength(1);
    expect(pools.perpetual.lots).toHaveLength(0);
  });

  it("a GRANT with no deadline is as permanent as a purchase", () => {
    const grant: CreditLot = { ...PURCHASE_LOT, source: "grant", expires_at: null };
    expect(creditPools([grant]).perpetual.credits).toBe(grant.credits_remaining);
  });

  it("keeps the server's spend order inside each pool", () => {
    const later: CreditLot = {
      ...SUBSCRIPTION_LOT,
      id: "later",
      expires_at: "2026-12-01T00:00:00Z",
    };
    // Sent soonest-first by the server; nothing re-sorts it.
    const pools = creditPools([SUBSCRIPTION_LOT, later]);
    expect(pools.expiring.lots.map((l) => l.id)).toEqual([SUBSCRIPTION_LOT.id, "later"]);
  });

  it("an empty lot list is two empty pools, not an absent answer", () => {
    const pools = creditPools([]);
    expect(pools.perpetual.credits).toBe(0);
    expect(pools.expiring.credits).toBe(0);
  });
});

describe("debt — not a negative balance", () => {
  it("reads the SERVER's total, not a sum of the rows", () => {
    // The server totals what it will collect. If the rows and the total ever
    // disagree, the total is right — so the pair must not add the rows up.
    const disagreeing = { ...WALLET_IN_DEBT, debt_outstanding: 999 };
    expect(debtOutstanding(disagreeing)).toBe(999);
    expect(openDebts(disagreeing)).toHaveLength(2);
  });

  it("a wallet with no debt keys reads as owing nothing", () => {
    expect(debtOutstanding(WALLET)).toBe(0);
    expect(openDebts(WALLET)).toEqual([]);
  });

  it("collectedFromPurchase clamps at both ends", () => {
    expect(collectedFromPurchase(180, 500)).toBe(180); // debt smaller: all of it
    expect(collectedFromPurchase(500, 180)).toBe(180); // purchase smaller: all of it
    expect(collectedFromPurchase(0, 500)).toBe(0); // nothing owed, nothing said
    expect(collectedFromPurchase(180, 0)).toBe(0); // an offer with no credits
    expect(collectedFromPurchase(-5, 500)).toBe(0); // never negative
  });
});

describe("isEmptyWallet — three ways a wallet is NOT empty", () => {
  it("a genuinely new wallet is empty", () => {
    expect(isEmptyWallet(EMPTY_WALLET)).toBe(true);
  });

  it("a wallet whose credits are all HELD is not empty", () => {
    const reserved = { ...EMPTY_WALLET, holds: WALLET.holds ?? [] };
    expect(isEmptyWallet(reserved)).toBe(false);
  });

  it("a wallet that owes credits is not empty — it has something to say", () => {
    const owing = { ...EMPTY_WALLET, debts: WALLET_IN_DEBT.debts ?? [], debt_outstanding: 180 };
    expect(isEmptyWallet(owing)).toBe(false);
  });

  it("counts the held credits separately from the balance", () => {
    // `balance` already excludes them, so adding them anywhere double-counts.
    expect(heldCredits(WALLET)).toBe(60);
  });
});

describe("formatters — nothing machine-shaped reaches the glass", () => {
  it("groups a credit count and adds no currency", () => {
    const printed = formatCreditCount("en-US", 1240);
    expect(printed).toBe("1,240");
    expect(printed).not.toContain("USD");
  });

  it("signs a delta so the direction is visible", () => {
    expect(formatCreditDelta("en-US", 2000)).toContain("+");
    expect(formatCreditDelta("en-US", -120)).toMatch(/[-−]/);
  });

  it("prints money as money", () => {
    expect(formatMoney("en-US", "USD", 1800)).toBe("$18.00");
  });

  it("renders a date and a timestamp, never an ISO string", () => {
    const date = formatExpiryDate("en-US", "2026-09-01T00:00:00Z");
    expect(date).toContain("2026");
    expect(date).not.toContain("T00:00");
    expect(formatTimestamp("en-US", "2026-08-23T09:12:00Z")).toContain("2026");
  });

  it("an unparseable instant is the empty string, never 'Invalid Date'", () => {
    expect(formatExpiryDate("en-US", "not-a-date")).toBe("");
    expect(formatTimestamp("en-US", "not-a-date")).toBe("");
    expect(daysUntil("not-a-date")).toBeNull();
    expect(formatDeadlineRelative("en-US", "not-a-date")).toBeNull();
  });

  it("counts a deadline in whole days from the given now", () => {
    const now = Date.parse("2026-08-24T00:00:00Z");
    expect(daysUntil("2026-09-01T00:00:00Z", now)).toBe(8);
    expect(daysUntil("2026-08-20T00:00:00Z", now)).toBe(-4);
  });

  it("says the deadline in words a person plans around", () => {
    const now = Date.parse("2026-08-24T00:00:00Z");
    const phrase = formatDeadlineRelative("en-US", "2026-09-01T00:00:00Z", now);
    expect(phrase).toBe("in 8 days");
  });
});

describe("element width, not viewport width", () => {
  it("an unmeasured element gets the WIDE layout", () => {
    // A first paint that settles from two columns to one is a reflow; the
    // other way round is a jump on every desktop load.
    expect(columnsForWidth(undefined)).toBe(2);
  });

  it("splits on the element's own width at the tablet breakpoint", () => {
    expect(columnsForWidth(TWO_COLUMN_MIN_WIDTH)).toBe(2);
    expect(columnsForWidth(TWO_COLUMN_MIN_WIDTH - 1)).toBe(1);
    // The case antd's viewport grid got wrong: a narrow panel on a wide screen.
    expect(columnsForWidth(380)).toBe(1);
  });
});

describe("labels — a wire enum is never the copy", () => {
  it("names every transaction type the backend defines", () => {
    for (const type of [
      "credit_purchase",
      "transcription_charge",
      "ai_charge",
      "subscription_bonus",
      "refund",
      "adjustment",
      "expiration",
    ]) {
      expect(transactionTypeKey(type), type).toBeTruthy();
    }
  });

  it("returns undefined for a type this release has no word for", () => {
    // Deliberate: the ledger row falls back to the server's own description,
    // which beats any generic label the pair could invent.
    expect(transactionTypeKey("quantum_charge")).toBeUndefined();
  });

  it("names both debt reasons and refuses to guess a third", () => {
    expect(debtReasonKey("partial_debit")).toBeTruthy();
    expect(debtReasonKey("clawback")).toBeTruthy();
    expect(debtReasonKey("something_new")).toBeUndefined();
  });

  it("maps every subscription status, and an unknown one to Inactive", () => {
    expect(subscriptionStatusKey("active")).toBe(BILLING_I18N_KEYS.subActive);
    expect(subscriptionStatusKey("past_due")).toBe(BILLING_I18N_KEYS.subPastDue);
    expect(subscriptionStatusKey("who_knows")).toBe(BILLING_I18N_KEYS.subInactive);
  });

  it("title-cases a slug rather than shipping it lowercase", () => {
    expect(titleCaseSlug("team_plus")).toBe("Team plus");
    expect(titleCaseSlug("pro")).toBe("Pro");
  });
});
