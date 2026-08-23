// @vitest-environment node
/**
 * The comparison arithmetic, on its own. Every claim the shop makes on screen
 * ("$0.0058 per credit", "save 36%") is produced here, so the rules that make
 * it honest — no division by zero, no cross-currency comparison, no "saving"
 * that is not one — are checked without a DOM.
 */
import { describe, expect, it } from "vitest";
import {
  bestPerCredit,
  formatExpiryDate,
  formatMoney,
  formatPerCredit,
  packageOffer,
  perCreditSavingsPercent,
  planOffer,
} from "../src/index.js";
import { CATALOG } from "./fixtures.js";

const [bigPack, smallPack] = CATALOG.packages ?? [];
const [teamPlan] = CATALOG.plans ?? [];

describe("per-credit price", () => {
  it("divides a package's price by the credits it carries", () => {
    if (!bigPack) throw new Error("fixture");
    expect(packageOffer(bigPack).perCreditCents).toBeCloseTo(0.9, 10);
  });

  it("uses a plan's INCLUDED monthly credits, not its storage", () => {
    if (!teamPlan) throw new Error("fixture");
    const offer = planOffer(teamPlan);
    expect(offer.credits).toBe(5000);
    expect(offer.perCreditCents).toBeCloseTo(0.58, 10);
  });

  it("refuses to price a credit an offer does not sell", () => {
    if (!teamPlan) throw new Error("fixture");
    // A plan sold for storage alone: zero credits is not "free credits".
    const storageOnly = planOffer({ ...teamPlan, monthly_credits_included: 0 });
    expect(storageOnly.perCreditCents).toBeNull();
  });
});

describe("which offer wins", () => {
  it("picks the lowest per-credit rate", () => {
    if (!bigPack || !smallPack || !teamPlan) throw new Error("fixture");
    const offers = [
      packageOffer(smallPack),
      packageOffer(bigPack),
      planOffer(teamPlan),
    ];
    expect(bestPerCredit(offers)?.slug).toBe("team");
  });

  it("ignores offers that price no credits, and answers null for all of them", () => {
    if (!teamPlan) throw new Error("fixture");
    const none = planOffer({ ...teamPlan, monthly_credits_included: 0 });
    expect(bestPerCredit([none])).toBeNull();
  });
});

describe("the savings claim", () => {
  it("states how much cheaper the plan is per credit", () => {
    if (!bigPack || !teamPlan) throw new Error("fixture");
    expect(
      perCreditSavingsPercent(packageOffer(bigPack), planOffer(teamPlan))
    ).toBe(36);
  });

  it("makes no claim when the plan is not actually cheaper", () => {
    if (!smallPack || !teamPlan) throw new Error("fixture");
    const dearPlan = planOffer({ ...teamPlan, price_cents: 100_000 });
    expect(
      perCreditSavingsPercent(packageOffer(smallPack), dearPlan)
    ).toBeNull();
  });

  it("refuses to compare across currencies", () => {
    if (!bigPack || !teamPlan) throw new Error("fixture");
    expect(
      perCreditSavingsPercent(
        packageOffer(bigPack),
        planOffer({ ...teamPlan, currency: "EUR" })
      )
    ).toBeNull();
  });
});

describe("formatting is data, not copy", () => {
  it("prints a price in the offer's own currency", () => {
    expect(formatMoney("en-US", "USD", 1800)).toContain("18");
  });

  it("keeps enough precision for a per-credit rate to differ", () => {
    // At two fraction digits both of these round to $0.01 and the whole
    // comparison disappears.
    expect(formatPerCredit("en-US", "USD", 0.9)).not.toBe(
      formatPerCredit("en-US", "USD", 0.58)
    );
  });

  it("renders an unparseable deadline as nothing, never as 'Invalid Date'", () => {
    expect(formatExpiryDate("en-US", "not-a-date")).toBe("");
    expect(formatExpiryDate("en-US", "2026-09-01T00:00:00Z")).toContain("2026");
  });
});
