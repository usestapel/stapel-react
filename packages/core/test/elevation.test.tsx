/**
 * The elevation seam: minting an identity at the moment of an act, for the
 * acts a deployment named — and for no others.
 *
 * The four properties pinned here are the four ways silent minting goes
 * wrong in production:
 *
 *  1. It mints on render, and the user table fills with crawlers.
 *  2. It mints per click, and a double-tap becomes two accounts.
 *  3. It mints for everything, and the review form's wall quietly disappears.
 *  4. It mints, fails, and does the write anyway — buying a 401 the person
 *     cannot read.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ElevationProvider, useElevation } from "../src/index.js";
import type { ElevationSource } from "../src/index.js";

const FAVORITE = "listings.favorite";
const REVIEW = "reviews.write";

function wrapWith(source: ElevationSource | null) {
  return function Wrapper(props: { children: ReactNode }) {
    return <ElevationProvider source={source}>{props.children}</ElevationProvider>;
  };
}

/**
 * A source that honours the interface's single-flight promise: repeat calls
 * share ONE mint. `mints` counts the flights actually started, so a test can
 * tell "asked twice" from "two accounts".
 */
function countingSource(actions: readonly string[]) {
  let flight: Promise<void> | undefined;
  let settle: (() => void) | undefined;
  let mints = 0;
  const elevate = vi.fn((): Promise<void> => {
    if (flight === undefined) {
      mints += 1;
      flight = new Promise<void>((resolve) => {
        settle = resolve;
      });
    }
    return flight;
  });
  return {
    source: { actions, elevate } satisfies ElevationSource,
    elevate,
    mints: (): number => mints,
    finish: (): void => settle?.(),
  };
}

describe("useElevation", () => {
  it("does not mint on render — only `run` can", async () => {
    const { source, elevate } = countingSource([FAVORITE]);
    renderHook(() => useElevation(FAVORITE), { wrapper: wrapWith(source) });
    // The whole reason `run` takes the work instead of returning a promise:
    // there is no way to reach the mint from a render path.
    expect(elevate).not.toHaveBeenCalled();
  });

  it("covers a listed action and refuses an unlisted one", () => {
    const { source } = countingSource([FAVORITE]);
    const favorite = renderHook(() => useElevation(FAVORITE), {
      wrapper: wrapWith(source),
    });
    const review = renderHook(() => useElevation(REVIEW), {
      wrapper: wrapWith(source),
    });
    expect(favorite.result.current.covers).toBe(true);
    // The judgement the axis exists to carry: a review is not worth an
    // account nobody can trace.
    expect(review.result.current.covers).toBe(false);
  });

  it("elevates once, then performs — and the second click reuses the mint", async () => {
    const { source, mints, finish } = countingSource([FAVORITE]);
    const perform = vi.fn();
    const { result } = renderHook(() => useElevation(FAVORITE), {
      wrapper: wrapWith(source),
    });

    // Two rapid clicks, before the first mint has answered.
    act(() => {
      result.current.run(perform);
      result.current.run(perform);
    });
    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(perform).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.pending).toBe(false));

    // Both clicks did their work, and there is ONE account behind them.
    expect(perform).toHaveBeenCalledTimes(2);
    expect(mints()).toBe(1);
  });

  it("performs without minting when the action is not covered", () => {
    const { source, elevate } = countingSource([FAVORITE]);
    const perform = vi.fn();
    const { result } = renderHook(() => useElevation(REVIEW), {
      wrapper: wrapWith(source),
    });
    act(() => result.current.run(perform));
    // `run` is not a second gate. The gate refused already; if a caller
    // reaches here anyway the write goes out and the server answers.
    expect(perform).toHaveBeenCalledTimes(1);
    expect(elevate).not.toHaveBeenCalled();
  });

  it("does not perform when the mint fails, and surfaces the failure", async () => {
    const boom = new Error("429");
    const source: ElevationSource = {
      actions: [FAVORITE],
      elevate: () => Promise.reject(boom),
    };
    const perform = vi.fn();
    const { result } = renderHook(() => useElevation(FAVORITE), {
      wrapper: wrapWith(source),
    });
    act(() => result.current.run(perform));
    await waitFor(() => expect(result.current.error).toBe(boom));
    expect(result.current.pending).toBe(false);
    expect(perform).not.toHaveBeenCalled();
  });

  it("is inert with no provider — every control refuses exactly as before", () => {
    const perform = vi.fn();
    const { result } = renderHook(() => useElevation(FAVORITE));
    expect(result.current.covers).toBe(false);
    act(() => result.current.run(perform));
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("reports `identified` only once the source says an account exists", () => {
    let minted = false;
    const source: ElevationSource = {
      actions: [FAVORITE],
      elevate: () => {
        minted = true;
        return Promise.resolve();
      },
      hasIdentity: () => minted,
    };
    const { result, rerender } = renderHook(() => useElevation(FAVORITE), {
      wrapper: wrapWith(source),
    });
    // Before the first press: the deployment PERMITS minting for this action,
    // and this visitor still has no account. A read surface must tell those
    // two apart or it opens somebody's saved-listings page for a stranger and
    // buys a 401.
    expect(result.current.covers).toBe(true);
    expect(result.current.identified).toBe(false);

    act(() => result.current.run(() => undefined));
    rerender();
    expect(result.current.identified).toBe(true);
  });

  it("reports `identified: false` for a source that cannot answer", () => {
    const { source } = countingSource([FAVORITE]);
    const { result } = renderHook(() => useElevation(FAVORITE), {
      wrapper: wrapWith(source),
    });
    // The conservative answer: a read surface over somebody's own data stays
    // closed rather than guessing.
    expect(result.current.identified).toBe(false);
  });

  it("is inert for an unnamed action", () => {
    const { source } = countingSource([FAVORITE]);
    const { result } = renderHook(() => useElevation(undefined), {
      wrapper: wrapWith(source),
    });
    expect(result.current.covers).toBe(false);
  });
});
