/**
 * `useWallet` after stapel-billing 0.8.0: the balance is a set of lots, and
 * the hook must hand out that structure WITHOUT re-deriving any of it.
 *
 * Three claims are worth a test here, and they are the three ways this could
 * quietly go wrong:
 *
 *   1. the lots arrive in the server's spend order, unsorted by us;
 *   2. `expiringSoon` is the SERVER's `expiring_soon`, not a client-side scan
 *      of `lots` for a minimum date;
 *   3. a failed read leaves `lots` in the FAILED state — never in the empty
 *      one, which is the `data ?? []` lie @stapel/core's LoadState exists to
 *      make unspellable.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useWallet } from "../src/index.js";
import {
  EMPTY_WALLET,
  PURCHASE_LOT,
  SUBSCRIPTION_LOT,
  WALLET,
  WALLET_WITHOUT_LOTS,
} from "./fixtures.js";
import { TestProviders, WALLET_UNAVAILABLE, mockServer } from "./harness.js";
import type { HandlerResult, MockServer } from "./harness.js";

function wrap(server: MockServer): (props: {
  children: ReactNode;
}) => ReactElement {
  return ({ children }) => (
    <TestProviders server={server}>{children}</TestProviders>
  );
}

function walletServer(result: HandlerResult): MockServer {
  return mockServer({ "GET /wallet": result });
}

describe("useWallet — lots, holds and the next deadline", () => {
  it("hands out the lots in the order the server sent them", async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer({ body: WALLET })),
    });
    await waitFor(() => expect(result.current.lots.status).toBe("ready"));
    const lots = result.current.lots;
    if (lots.status !== "ready") throw new Error("lots not ready");
    // The subscription lot expires and therefore spends first; the
    // non-expiring purchase lot is last. Both facts are the SERVER's.
    expect(lots.data.map((lot) => lot.id)).toEqual([
      SUBSCRIPTION_LOT.id,
      PURCHASE_LOT.id,
    ]);
    expect(lots.data[0]?.source).toBe("subscription");
    expect(lots.data[1]?.expires_at).toBeNull();
  });

  it("exposes the open holds", async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer({ body: WALLET })),
    });
    await waitFor(() => expect(result.current.holds.status).toBe("ready"));
    const holds = result.current.holds;
    if (holds.status !== "ready") throw new Error("holds not ready");
    expect(holds.data).toHaveLength(1);
    expect(holds.data[0]?.status).toBe("held");
    expect(holds.data[0]?.credits).toBe(60);
  });

  it("takes expiringSoon from the server's expiring_soon, verbatim", async () => {
    // The body deliberately carries a deadline that a client-side scan of
    // `lots` would also have found — and then a body where the two DIFFER, so
    // "we copied the server" and "we recomputed and got lucky" are told apart.
    const disagreeing = {
      ...WALLET,
      expiring_soon: { credits: 7, expires_at: "2026-12-31T00:00:00Z" },
    };
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer({ body: disagreeing })),
    });
    await waitFor(() => expect(result.current.expiringSoon.status).toBe("ready"));
    const expiring = result.current.expiringSoon;
    if (expiring.status !== "ready") throw new Error("expiringSoon not ready");
    expect(expiring.data).toEqual({
      credits: 7,
      expires_at: "2026-12-31T00:00:00Z",
    });
  });

  it("a wallet with nothing in it is READY and empty, not loading", async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer({ body: EMPTY_WALLET })),
    });
    await waitFor(() => expect(result.current.lots.status).toBe("ready"));
    const { lots, holds, expiringSoon } = result.current;
    if (lots.status !== "ready" || holds.status !== "ready") {
      throw new Error("not ready");
    }
    expect(lots.data).toEqual([]);
    expect(holds.data).toEqual([]);
    expect(expiringSoon.status === "ready" && expiringSoon.data).toBeNull();
  });

  it("a 0.7.x body with no lots key reads as an answered, empty wallet", async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer({ body: WALLET_WITHOUT_LOTS })),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.lots.status).toBe("ready");
    expect(result.current.holds.status).toBe("ready");
    expect(result.current.expiringSoon.status).toBe("ready");
    // The balance is still the balance — an old server is not a broken one.
    expect(result.current.data?.balance).toBe(1240);
  });

  it("a failed read leaves lots FAILED — never empty", async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrap(walletServer(WALLET_UNAVAILABLE)),
    });
    await waitFor(() => expect(result.current.lots.status).toBe("failed"));
    expect(result.current.holds.status).toBe("failed");
    expect(result.current.expiringSoon.status).toBe("failed");
    // There is no `.data` to read on a failed state — that is the mechanism,
    // and this assertion is what keeps a future refactor from adding one.
    expect(result.current.lots).not.toHaveProperty("data");
  });
});
