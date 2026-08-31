/**
 * "Finding you…" has an end, even when the browser never answers.
 *
 * Measured on a live classified deployment: the seller taps "Use my position",
 * the browser's prompt is dismissed rather than answered, and the button stays
 * in its loading state for as long as anyone watches it (60 probes at 500ms —
 * still spinning at 30s), over a live map it could have used all along.
 *
 * The cause is in the Geolocation spec and not in the browser: the `timeout`
 * clock does not start until the permission decision is made, so an unanswered
 * prompt fires NEITHER callback, ever. `@stapel/core`'s `usePermission` has
 * carried that bound for four releases; the picker's own button calls the
 * browser directly and so had none.
 *
 * Fake timers throughout: the deadline is 20 seconds, and a test that waits
 * them out is a test nobody runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBrowserPosition } from "../src/headless/useBrowserPosition.js";
import { withGeolocation } from "./helpers.js";

/** A prompt that is never answered: `getCurrentPosition` is called and neither
 * callback is ever invoked, which is exactly what a dismissed prompt does. */
function silentPrompt(): { restore: () => void; calls: () => number } {
  let calls = 0;
  const restore = withGeolocation(() => {
    calls += 1;
  });
  return { restore, calls: () => calls };
}

/** What `navigator.permissions.query` answers at the deadline, or nothing at
 * all — Safari throws on the descriptor and some engines have no such object,
 * both of which have to stay "we do not know". */
function withPermissions(
  query: undefined | (() => Promise<{ state: string }>)
): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, "permissions");
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: query === undefined ? undefined : { query },
  });
  return () => {
    if (original === undefined) Reflect.deleteProperty(navigator, "permissions");
    else Object.defineProperty(navigator, "permissions", original);
  };
}

/** Advance past the deadline AND let the Permissions read settle — the answer
 * arrives one microtask after the timer, not with it. */
async function passTheDeadline(ms = 20_000): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

let restoreGeolocation: (() => void) | undefined;
let restorePermissions: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  restoreGeolocation?.();
  restorePermissions?.();
  restoreGeolocation = undefined;
  restorePermissions = undefined;
});

describe("an unanswered prompt resolves the control instead of spinning", () => {
  it("gives up at the deadline and offers the retry", async () => {
    const prompt = silentPrompt();
    restoreGeolocation = prompt.restore;
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    expect(result.current.state.step).toBe("locating");
    expect(prompt.calls()).toBe(1);

    // One second before the deadline the wait is still legitimate: a slow fix
    // after a real "allow" must not be cut short.
    await passTheDeadline(19_000);
    expect(result.current.state.step).toBe("locating");

    await passTheDeadline(1_000);
    expect(result.current.state).toEqual({ step: "refused", outcome: "timeout" });
  });

  it("says DENIED when the Permissions API knows the site is blocked", async () => {
    restoreGeolocation = silentPrompt().restore;
    restorePermissions = withPermissions(async () => ({ state: "denied" }));
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    await passTheDeadline();
    expect(result.current.state).toEqual({ step: "refused", outcome: "denied" });
  });

  it("keeps 'we do not know' when the Permissions API throws", async () => {
    restoreGeolocation = silentPrompt().restore;
    restorePermissions = withPermissions(() => {
      throw new TypeError("unsupported permission name");
    });
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    await passTheDeadline();
    expect(result.current.state).toEqual({ step: "refused", outcome: "timeout" });
  });

  it("honours a deployment's own deadline", async () => {
    restoreGeolocation = silentPrompt().restore;
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() =>
      useBrowserPosition({ decisionTimeoutMs: 5_000 })
    );

    act(() => {
      result.current.locate();
    });
    await passTheDeadline(5_000);
    expect(result.current.state.step).toBe("refused");
  });
});

describe("the deadline never overrides an answer the browser did give", () => {
  it("a fix that arrives in time wins, and the deadline is disarmed", async () => {
    restoreGeolocation = withGeolocation((onSuccess) => {
      setTimeout(() => {
        onSuccess({ coords: { latitude: 55.75, longitude: 37.62, accuracy: 30 } });
      }, 1_000);
    });
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(result.current.state).toEqual({
      step: "located",
      point: { lat: 55.75, lon: 37.62 },
      accuracyM: 30,
    });

    // Well past the deadline: the located fix is still the answer.
    await passTheDeadline();
    expect(result.current.state.step).toBe("located");
  });

  it("a refusal that arrives in time keeps its own outcome", async () => {
    restoreGeolocation = withGeolocation((_onSuccess, onError) => {
      onError({ code: 1 });
    });
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    expect(result.current.state).toEqual({ step: "refused", outcome: "denied" });
    await passTheDeadline();
    expect(result.current.state).toEqual({ step: "refused", outcome: "denied" });
  });

  it("a callback that arrives AFTER the deadline does not repaint the control", async () => {
    let late: (() => void) | undefined;
    restoreGeolocation = withGeolocation((onSuccess) => {
      late = () => {
        onSuccess({ coords: { latitude: 1, longitude: 2 } });
      };
    });
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    await passTheDeadline();
    expect(result.current.state.step).toBe("refused");

    act(() => {
      late?.();
    });
    expect(result.current.state.step).toBe("refused");
  });

  it("a retry starts a fresh wait", async () => {
    restoreGeolocation = silentPrompt().restore;
    restorePermissions = withPermissions(undefined);
    const { result } = renderHook(() => useBrowserPosition());

    act(() => {
      result.current.locate();
    });
    await passTheDeadline();
    expect(result.current.state.step).toBe("refused");

    act(() => {
      result.current.locate();
    });
    expect(result.current.state.step).toBe("locating");
    await passTheDeadline(19_000);
    expect(result.current.state.step).toBe("locating");
    await passTheDeadline(1_000);
    expect(result.current.state.step).toBe("refused");
  });
});
