/**
 * The mandate seam: reading the axis without importing whatever derives it.
 *
 * Three properties are pinned, and each is the difference between a public
 * surface that works and one that has to depend on the tenant machinery to
 * render a header:
 *
 *  1. A source is anything with a `state` — the storefront's two-line source
 *     and workspaces-react's query-backed one are interchangeable here.
 *  2. No provider is an OUTAGE, not a verdict and not a crash: `unresolved /
 *     unavailable`, carrying an error that names the missing wiring.
 *  3. That fallback is one stable object, so a wiring bug cannot become a
 *     render loop in the effects that watch the axis.
 */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  MandateProvider,
  isMandateResolved,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
  matchMandate,
  toStapelApiError,
  useMandate,
  useMandatePrincipal,
} from "../src/index.js";
import type { MandateSource, MandateState } from "../src/index.js";

function wrapWith(source: MandateSource) {
  return function Wrapper(props: { children: ReactNode }) {
    return <MandateProvider source={source}>{props.children}</MandateProvider>;
  };
}

describe("MandateProvider / useMandate", () => {
  it("hands down whatever source it is given — no derivation of its own", () => {
    // The storefront's whole implementation: a session, therefore a member.
    // No workspace list, no `is_guest`, no query.
    const storefront: MandateSource = { state: mandateResolved("member") };
    const { result } = renderHook(() => useMandate(), {
      wrapper: wrapWith(storefront),
    });
    expect(result.current).toEqual({ mandate: "member" });
  });

  it("carries the two unresolved arms through unchanged", () => {
    const asking = renderHook(() => useMandate(), {
      wrapper: wrapWith({ state: mandateAsking() }),
    });
    expect(asking.result.current).toEqual({ mandate: "unresolved", reason: "asking" });

    const boom = new Error("502 from /workspaces/");
    const down = renderHook(() => useMandate(), {
      wrapper: wrapWith({ state: mandateUnavailable(boom) }),
    });
    const state: MandateState = down.result.current;
    expect(isMandateResolved(state)).toBe(false);
    expect(
      matchMandate(state, {
        anonymous: () => "hide",
        guest: () => "hide",
        member: () => "show",
        asking: () => "wait",
        unavailable: (error) => (error as Error).message,
      })
    ).toBe("502 from /workspaces/");
  });

  it("reports a missing provider as an outage, not as a principal", () => {
    const { result } = renderHook(() => useMandate());

    // Not a crash (a nav item must not be able to blank the page) and not a
    // guess: there is no principal to read off it in either direction.
    expect(isMandateResolved(result.current)).toBe(false);
    expect(result.current).toMatchObject({ mandate: "unresolved", reason: "unavailable" });

    const error = toStapelApiError(
      matchMandate(result.current, {
        anonymous: () => new Error("wrong arm: anonymous"),
        guest: () => new Error("wrong arm: guest"),
        member: () => new Error("wrong arm: member"),
        asking: () => new Error("wrong arm: asking"),
        unavailable: (e) => e,
      })
    );
    // Rendered through the one dialect, with a code the error floor has a
    // sentence for — never a raw key on screen.
    expect(error.code).toBe("stapel.error.unknown");
    expect(error.message).toContain("<MandateProvider>");
  });

  it("republishes only when the answer actually changed", () => {
    // The real sources rebuild their state object every render — a TanStack
    // query result is a new object each time — so the reader's stability has
    // to be the provider's guarantee, not the source's promise.
    const { result, rerender } = renderHook(() => useMandate(), {
      wrapper: (props: { children: ReactNode }) => (
        <MandateProvider source={{ state: mandateResolved("member") }}>
          {props.children}
        </MandateProvider>
      ),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("republishes when it changed, including between the two unresolved arms", () => {
    let source: MandateSource = { state: mandateAsking() };
    const { result, rerender } = renderHook(() => useMandate(), {
      wrapper: (props: { children: ReactNode }) => (
        <MandateProvider source={source}>{props.children}</MandateProvider>
      ),
    });
    expect(result.current).toMatchObject({ reason: "asking" });

    // Same `mandate`, different reason: a wait becoming an outage is a change
    // the screen must see — that is the arm where it stops spinning and says
    // what happened.
    const boom = new Error("502");
    source = { state: mandateUnavailable(boom) };
    rerender();
    expect(result.current).toMatchObject({ reason: "unavailable", error: boom });

    // Same arm, a NEW error: also a change (a second outage is a second
    // outage), so the reader is not left rendering a stale one.
    const again = new Error("503");
    source = { state: mandateUnavailable(again) };
    rerender();
    expect(result.current).toMatchObject({ error: again });

    source = { state: mandateResolved("member") };
    rerender();
    expect(result.current).toEqual({ mandate: "member" });
  });

  it("keeps the mandate-less state stable across renders", () => {
    const { result, rerender } = renderHook(() => useMandate());
    const first = result.current;
    rerender();
    // Identity, not equality: an effect keyed on the axis must not re-fire
    // forever just because nobody wired a provider.
    expect(result.current).toBe(first);
  });
});

describe("useMandatePrincipal", () => {
  it("narrows a known mandate and answers null for an unknown one", () => {
    const guest = renderHook(() => useMandatePrincipal(), {
      wrapper: wrapWith({ state: mandateResolved("guest") }),
    });
    expect(guest.result.current).toBe("guest");

    const asking = renderHook(() => useMandatePrincipal(), {
      wrapper: wrapWith({ state: mandateAsking() }),
    });
    expect(asking.result.current).toBeNull();

    const missing = renderHook(() => useMandatePrincipal());
    expect(missing.result.current).toBeNull();
  });
});
