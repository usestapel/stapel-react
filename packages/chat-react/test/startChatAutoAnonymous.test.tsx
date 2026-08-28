/**
 * "Message the seller" for somebody who never registered.
 *
 * Contacting a seller is the act a marketplace exists for, and it was behind
 * a registration form. With auto-anonymous wired the press mints an identity
 * and opens the thread; without it, nothing about this control changes.
 *
 * The pinned properties are the ones that decide whether the feature is safe:
 * nothing is minted on render, the thread is never opened before the account
 * that owns it exists, and a failed mint takes the write down with it rather
 * than sending it into a 401.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import {
  ElevationProvider,
  MandateProvider,
  mandateResolved,
  useActionGate,
} from "@stapel/core";
import type { ElevationSource } from "@stapel/core";
import { CHAT_ELEVATION_ACTIONS, StartDirectChat } from "../src/index.js";
import type { StartDirectChatBag } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { SELLER, conversation } from "./fixtures.js";

function Screen(props: {
  bag: StartDirectChatBag;
  onBag: (bag: StartDirectChatBag) => void;
}): ReactElement {
  const gate = useActionGate(props.bag.availability);
  props.onBag(props.bag);
  return (
    <div>
      <span data-testid="reason">{gate.reason ?? ""}</span>
      <span data-testid="disabled">{String(gate.disabled)}</span>
    </div>
  );
}

/** An anonymous visitor, with whatever elevation the test wires. */
function renderAnonymous(options: {
  elevation: ElevationSource | null;
  routes?: Parameters<typeof mockServer>[0];
}): { server: MockServer; bag: () => StartDirectChatBag } {
  const server = mockServer(options.routes ?? {});
  let latest: StartDirectChatBag | undefined;
  const wrap = (children: ReactNode): ReactElement => (
    <MandateProvider source={{ state: mandateResolved("anonymous") }}>
      <ElevationProvider source={options.elevation}>
        <TestHarness server={server} realtime={{ socketUrl: null }}>
          {children}
        </TestHarness>
      </ElevationProvider>
    </MandateProvider>
  );
  render(
    wrap(
      <StartDirectChat sellerId={SELLER}>
        {(bag) => (
          <Screen
            bag={bag}
            onBag={(b) => {
              latest = b;
            }}
          />
        )}
      </StartDirectChat>
    )
  );
  return {
    server,
    bag: () => {
      if (!latest) throw new Error("bag not rendered");
      return latest;
    },
  };
}

function autoAnonymous(actions: readonly string[] = [
  CHAT_ELEVATION_ACTIONS.startDirect,
]) {
  const elevate = vi.fn((): Promise<void> => Promise.resolve());
  return { source: { actions, elevate } satisfies ElevationSource, elevate };
}

describe("messaging a seller with auto-anonymous wired", () => {
  it("offers the control to an anonymous visitor instead of refusing", () => {
    const { source } = autoAnonymous();
    renderAnonymous({ elevation: source });
    expect(screen.getByTestId("disabled").textContent).toBe("false");
    expect(screen.getByTestId("reason").textContent).toBe("");
  });

  it("does not mint on render", () => {
    const { source, elevate } = autoAnonymous();
    renderAnonymous({ elevation: source });
    expect(elevate).not.toHaveBeenCalled();
  });

  it("mints first, then opens the thread", async () => {
    const order: string[] = [];
    const source: ElevationSource = {
      actions: [CHAT_ELEVATION_ACTIONS.startDirect],
      elevate: () => {
        order.push("mint");
        return Promise.resolve();
      },
    };
    const { server, bag } = renderAnonymous({
      elevation: source,
      routes: {
        "POST /conversations": () => {
          order.push("conversation");
          return { status: 201, body: conversation() };
        },
      },
    });

    act(() => bag().start());

    await waitFor(() =>
      expect(server.calls.filter((call) => call.method === "POST")).toHaveLength(1)
    );
    expect(order[0]).toBe("mint");
    expect(order).toContain("conversation");
    expect(order.indexOf("mint")).toBeLessThan(order.indexOf("conversation"));
  });

  it("opens nothing when the mint fails", async () => {
    const source: ElevationSource = {
      actions: [CHAT_ELEVATION_ACTIONS.startDirect],
      elevate: () => Promise.reject(new Error("429")),
    };
    const { server, bag } = renderAnonymous({
      elevation: source,
      routes: { "POST /conversations": { status: 201, body: conversation() } },
    });
    act(() => bag().start());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      server.calls.filter((call) => call.method === "POST")
    ).toHaveLength(0);
  });

  it("keeps the wall when the host did not list this action", () => {
    const { source } = autoAnonymous(["listings.favorite"]);
    renderAnonymous({ elevation: source });
    expect(screen.getByTestId("disabled").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toBe(
      "Sign in to message the seller."
    );
  });

  it("changes nothing with no elevation wired", () => {
    renderAnonymous({ elevation: null });
    expect(screen.getByTestId("disabled").textContent).toBe("true");
  });
});
