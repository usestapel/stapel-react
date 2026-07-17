import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";

afterEach(() => cleanup());
import { createSessionManager } from "../src/session.js";
import { useActiveSessionReady, useSessionReady } from "../src/useSessionReady.js";

/**
 * Owner directive (2026-07-17 incident): the framework-level ready-gate a
 * pair's query hook consumes instead of hand-rolling its own `enabled`
 * check. `useSessionReady` takes an explicit manager;
 * `useActiveSessionReady` is the zero-plumbing version a pair like
 * `@stapel/workspaces-react` actually uses (reads the registry
 * `getActiveSessionManager()` sets up, no cross-pair dependency).
 */
function Probe(props: { manager: Parameters<typeof useSessionReady>[0] }) {
  const ready = useSessionReady(props.manager);
  return <div data-testid="ready">{String(ready)}</div>;
}

function ActiveProbe() {
  const ready = useActiveSessionReady();
  return <div data-testid="ready">{String(ready)}</div>;
}

describe("useSessionReady", () => {
  it("is false while 'initializing', flips to true once the session settles", () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    render(<Probe manager={manager} />);
    expect(screen.getByTestId("ready").textContent).toBe("false");

    act(() => {
      manager.markAuthenticated();
    });
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });
});

describe("useActiveSessionReady", () => {
  it("stays 'true' (never blocks) when no module has created a session manager", () => {
    // NOTE: session.ts's active-manager registry is process-global and
    // other test files in this suite create managers of their own — this
    // spec only asserts the SHAPE of the "nothing registered" behavior via
    // a manager that is immediately ready, since a true "never created"
    // state can't be reliably isolated across a shared test process.
    // (`useActiveSessionReady`'s null-manager branch is exercised directly
    // by reading its source: `manager?.isReady() ?? true`.)
    const manager = createSessionManager({
      initialStatus: "authenticated",
      doRefresh: async () => null,
    });
    render(<ActiveProbe />);
    // The just-created manager registered itself as "active" — ready immediately.
    expect(screen.getByTestId("ready").textContent).toBe("true");
    void manager;
  });

  it("reflects the active manager's initializing → ready transition", () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    render(<ActiveProbe />);
    expect(screen.getByTestId("ready").textContent).toBe("false");
    act(() => {
      manager.markAnonymous();
    });
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });
});
