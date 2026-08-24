/**
 * THE TWO CREDIT POOLS, and the debt that eats the next ones.
 *
 * ── Why a wallet is not one number ────────────────────────────────────────
 *
 * stapel-billing holds a balance as expiry-aware LOTS, and the owner's
 * verdict of 2026-08-23 named what that means to a customer: there are two
 * pools, and they have opposite fates.
 *
 *   PERPETUAL — lots bought with money (`source: "purchase"`,
 *   `expires_at: null`). They sit there until they are spent. Cancelling a
 *   subscription does not touch them.
 *
 *   EXPIRING — lots that come with a plan or a grant and carry a deadline.
 *   They die on their own date whether or not anything is bought, and letting
 *   the subscription lapse forfeits the ones not yet spent.
 *
 * A wallet holding 840 perpetual credits and 400 that die on the 1st is NOT
 * a wallet holding 1,240 credits. The single sum is the more useful-looking
 * number and the less true one, and it is the number that lets a customer
 * plan around credits they are about to lose. **Nothing in this module adds
 * the two pools together, and no surface of this pair does either.**
 *
 * ── What is derived here and what is NOT ──────────────────────────────────
 *
 * Grouping and summing WITHIN a pool is arithmetic on numbers the server
 * sent, and a screen has to do it to have anything to print. The DEADLINE is
 * not: `WalletResponse.expiring_soon` is picked by the backend that will do
 * the expiring, so no caller scans `lots` for a minimum. If the two ever
 * disagree, the server is right and the scan would have been a second
 * implementation of a rule that already has one.
 *
 * The lots keep the server's SPEND order (`expires_at ASC NULLS LAST`)
 * inside each pool — that is the order `debit()` walks, so a "what goes
 * first" reading of the list stays true.
 *
 * ── Debt is not a negative balance ────────────────────────────────────────
 *
 * stapel-billing 0.11.0 added `debts[]` / `debt_outstanding`: credits owed
 * because work was served without cover (`partial_debit`) or because money
 * was taken back after the credits were spent (`clawback`). The balance
 * still counts the credits that EXIST — driving it below zero would make
 * every lot and every `balance_after` untrue — so a wallet that owes credits
 * looks, from the balance alone, exactly like one that does not. The
 * customer then buys 100 credits, the server collects the debt off the top,
 * and the balance afterwards is unexplained. {@link collectedFromPurchase}
 * is the sentence that prevents that, computed the way the server collects:
 * oldest debt first, off the top, before the credits become spendable.
 */
import type { CreditDebt, CreditLot, Wallet } from "../api/types.js";

/** Which fate a pool's credits have. */
export type CreditPoolKind = "perpetual" | "expiring";

/** One side of the wallet: the lots that share a fate, and their total. */
export interface CreditPool {
  readonly kind: CreditPoolKind;
  /** Credits still unspent and unreserved across this pool's lots. */
  readonly credits: number;
  /** The lots themselves, in the server's spend order. */
  readonly lots: readonly CreditLot[];
}

/**
 * The wallet's two pools. There is deliberately no `total` field: the sum is
 * the number this type exists to stop a screen from printing.
 */
export interface CreditPools {
  /** Bought credits — no deadline. */
  readonly perpetual: CreditPool;
  /** Plan / grant credits — each with a date it dies on. */
  readonly expiring: CreditPool;
}

function sumRemaining(lots: readonly CreditLot[]): number {
  let total = 0;
  for (const lot of lots) total += lot.credits_remaining;
  return total;
}

/**
 * Split live lots into the two pools by the only thing that decides their
 * fate: whether they carry a deadline.
 *
 * The split is on `expires_at`, NOT on `source`. A `purchase` lot that a
 * deployment chose to expire is an expiring credit no matter what bought it,
 * and a `grant` with no deadline is as permanent as a purchase. `source`
 * answers "where did this come from", which is a caption; `expires_at`
 * answers "will this still be here next month", which is the question the
 * two-pool display is for.
 */
export function creditPools(lots: readonly CreditLot[]): CreditPools {
  const perpetual: CreditLot[] = [];
  const expiring: CreditLot[] = [];
  for (const lot of lots) {
    if (lot.expires_at === null) perpetual.push(lot);
    else expiring.push(lot);
  }
  return {
    perpetual: {
      kind: "perpetual",
      credits: sumRemaining(perpetual),
      lots: perpetual,
    },
    expiring: {
      kind: "expiring",
      credits: sumRemaining(expiring),
      lots: expiring,
    },
  };
}

/** Credits currently reserved by open holds — already OUT of `balance`, so
 * this number is stated beside it and never added to anything. */
export function heldCredits(wallet: Wallet): number {
  let total = 0;
  for (const hold of wallet.holds ?? []) total += hold.credits;
  return total;
}

/** Total credits this wallet owes (`debt_outstanding`), or 0. */
export function debtOutstanding(wallet: Wallet): number {
  return wallet.debt_outstanding ?? 0;
}

/** The open debts, oldest first — the order the server collects them in. */
export function openDebts(wallet: Wallet): readonly CreditDebt[] {
  return wallet.debts ?? [];
}

/**
 * How many of the next `credits` bought are collected against the
 * outstanding debt before they become spendable — the number that turns "you
 * owe 40" into "40 of these 100 are already spoken for".
 *
 * Clamped at both ends: a debt larger than the purchase eats all of it, and
 * a wallet with no debt eats none. Never negative, so a caller can render
 * the result without re-checking.
 */
export function collectedFromPurchase(
  outstanding: number,
  credits: number
): number {
  if (outstanding <= 0 || credits <= 0) return 0;
  return Math.min(outstanding, credits);
}

/**
 * A wallet with nothing in it: no balance, no lots, no holds AND no debt.
 *
 * Not `balance <= 0`. A wallet whose credits are all reserved by open holds
 * has a zero balance and is emphatically not empty — telling that customer
 * "no credits yet" claims their credits are gone while they are in fact
 * spoken for. A wallet that owes credits is not empty either: it has
 * something to say, and an empty state would swallow it.
 */
export function isEmptyWallet(wallet: Wallet): boolean {
  return (
    wallet.balance <= 0 &&
    (wallet.lots ?? []).length === 0 &&
    (wallet.holds ?? []).length === 0 &&
    debtOutstanding(wallet) === 0
  );
}
