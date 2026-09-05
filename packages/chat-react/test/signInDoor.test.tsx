/**
 * The door beside the reason — storefront Wave D, named gap G-3 — and the gate
 * that produces the reason in the first place.
 *
 * `POST /conversations/` is `IsAuthenticated`, and this button had no mandate
 * gate at all: a visitor could press "message the seller" and collect a 401,
 * which is a refusal delivered at the one moment it is useless. Now the axis
 * is read through core's `MandateSource` seam BEFORE the click, and `signIn`
 * puts the way out next to the sentence.
 *
 * The `unavailable` arm is deliberately NOT a refusal: outside a
 * `<MandateProvider>` core answers `unresolved/unavailable`, and a host that
 * never wired the axis must keep its button — "we could not ask" is not "you
 * may not".
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  MandateProvider,
  mandateAsking,
  mandateResolved,
  mandateUnavailable,
} from "@stapel/core";
import type { MandatePrincipal, MandateState } from "@stapel/core";
import { PaneGate } from "@stapel/tokens-antd/skin";
import { actionAvailable } from "@stapel/core";
import { StartChatButton } from "../src/default/index.js";
import { TestHarness, mockServer } from "./harness.js";

const SELLER = "u-seller";

function withMandate(state: MandateState, children: ReactNode): ReactNode {
  return <MandateProvider source={{ state }}>{children}</MandateProvider>;
}

function renderAs(
  principal: MandatePrincipal | "asking" | "unavailable",
  node: ReactNode
): void {
  const state =
    principal === "asking"
      ? mandateAsking()
      : principal === "unavailable"
        ? mandateUnavailable(new Error("no /me"))
        : mandateResolved(principal);
  render(
    <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
      {withMandate(state, node)}
    </TestHarness>
  );
}

describe("a visitor", () => {
  it("sees the button, switched off, with the reason AND the door", () => {
    renderAs(
      "anonymous",
      <StartChatButton sellerId={SELLER} signIn={{ href: "/login?next=/l/7" }} />
    );

    // Never hidden: a control that disappears teaches nobody that messaging
    // the seller is possible at all.
    const button = screen.getByTestId("chat-start-button");
    expect(button).toHaveProperty("disabled", true);

    const blocked = screen.getByTestId("chat-start-blocked");
    expect(blocked.textContent).toContain("Sign in to message the seller.");

    const door = screen.getByTestId("chat-start-sign-in");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
    // One sentence, not two screens.
    expect(blocked.contains(door)).toBe(true);
  });

  it("takes a callback instead, for a host that opens a modal", () => {
    const onSignIn = vi.fn();
    renderAs("anonymous", <StartChatButton sellerId={SELLER} signIn={{ onSignIn }} />);

    const door = screen.getByTestId("chat-start-sign-in");
    expect(door.hasAttribute("href")).toBe(false);
    fireEvent.click(door);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("gets the reason alone when the host has no sign-in route", () => {
    renderAs("anonymous", <StartChatButton sellerId={SELLER} />);
    expect(screen.queryByTestId("chat-start-sign-in")).toBeNull();
    expect(screen.getByTestId("chat-start-blocked").textContent).toBe(
      "Sign in to message the seller."
    );
  });
});

describe("the other four arms of the axis", () => {
  it("lets a member write", () => {
    renderAs("member", <StartChatButton sellerId={SELLER} />);
    expect(screen.getByTestId("chat-start-button")).toHaveProperty(
      "disabled",
      false
    );
  });

  it("waits while we are still asking — that is not 'you may not'", () => {
    renderAs("asking", <StartChatButton sellerId={SELLER} />);
    expect(screen.getByTestId("chat-start-blocked").textContent).toBe(
      "Checking your session…"
    );
  });

  it("keeps the button for a host that never wired the axis", () => {
    // `unavailable` is what core answers outside a MandateProvider too. A
    // refusal here would take the button away from every such host, and the
    // module still answers 401 honestly if the guess turns out wrong.
    renderAs("unavailable", <StartChatButton sellerId={SELLER} />);
    expect(screen.getByTestId("chat-start-button")).toHaveProperty(
      "disabled",
      false
    );
    expect(screen.queryByTestId("chat-start-blocked")).toBeNull();
  });

  it("still names the seller-shaped reasons ahead of nothing", () => {
    renderAs("member", <StartChatButton sellerId={null} />);
    expect(screen.getByTestId("chat-start-blocked").textContent).toBe(
      "This listing has no seller to write to."
    );
  });
});

/**
 * FOURTEEN CARDS, FOURTEEN COPIES OF ONE SENTENCE.
 *
 * Measured on the host's phone results page: the same "sign in to message the
 * seller" printed once per listing down a column — the reason has not changed,
 * only the number of places it is printed. The rule "a switched-off control
 * says why" is right for ONE control and wrong for a list of them.
 *
 * Every arm below keeps the sentence reachable. `"pooled"` moves it into the
 * pane's own footnote and leaves each button's `aria-describedby` pointing at
 * that copy, so a screen reader still reads the reason WITH the control —
 * which is the difference between pooling and hiding. `"none"` is the one arm
 * that may leave a control unexplained, and it is opt-in for exactly that
 * reason: the host has said it somewhere else.
 */
describe("where the refusal sentence goes", () => {
  it("prints it beside the button by default — one control, one sentence", () => {
    renderAs("anonymous", <StartChatButton sellerId={SELLER} />);
    expect(screen.getByTestId("chat-start-blocked")).toBeTruthy();
  });

  it("prints it once for the PANE when pooled, not once per button", () => {
    renderAs(
      "anonymous",
      <PaneGate gate={actionAvailable()} testId="cards-reasons">
        <StartChatButton sellerId={SELLER} refusal="pooled" />
        <StartChatButton sellerId={SELLER} refusal="pooled" />
        <StartChatButton sellerId={SELLER} refusal="pooled" />
      </PaneGate>
    );
    // Three buttons…
    expect(screen.getAllByTestId("chat-start-button")).toHaveLength(3);
    // …and the sentence is not standing beside any of them.
    expect(screen.queryAllByTestId("chat-start-blocked")).toHaveLength(0);
    // Every one of them still POINTS at a reason: the sentence moved, it did
    // not disappear.
    for (const button of screen.getAllByTestId("chat-start-button")) {
      expect(button.getAttribute("aria-describedby")).toBeTruthy();
    }
    // …at the same one.
    const ids = new Set(
      screen
        .getAllByTestId("chat-start-button")
        .map((button) => button.getAttribute("aria-describedby"))
    );
    expect(ids.size).toBe(1);
  });

  it("says nothing at all when the host has taken the sentence on", () => {
    renderAs("anonymous", <StartChatButton sellerId={SELLER} refusal="none" />);
    // The button is still switched off — what is dropped is the copy, not the
    // gate.
    expect(
      (screen.getByTestId("chat-start-button") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.queryByTestId("chat-start-blocked")).toBeNull();
  });

  it("keeps the button pressable for a signed-in member under every arm", () => {
    renderAs("member", <StartChatButton sellerId={SELLER} refusal="pooled" />);
    expect(
      (screen.getByTestId("chat-start-button") as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
