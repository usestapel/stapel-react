/**
 * THE POOLED DOOR IS NOT THIS PAIR'S BUTTON'S PRIVATE PROPERTY.
 *
 * `<StartChatButton refusal="pooled">` is one compact card control; a host
 * with its own card geometry composes the headless `<StartDirectChat>` with
 * the skin's `<GatedButton>` itself, and that pairing could not reach the
 * door at all — the portal lived inside this pair's own skin component. A
 * hand-composed pane therefore printed the pooled sentence with nothing to
 * press, which is precisely the half-answer pooling was fixed for.
 *
 * `usePooledRefusal` is that seam. What this suite pins is the invariant, not
 * the shape: ONE door per (pane, reason), no matter which controls are
 * sharing the sentence or who wrote them.
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MandateProvider,
  actionAvailable,
  mandateResolved,
  useActionGate,
} from "@stapel/core";
import type { ActionAvailability, MandatePrincipal, SignInCta } from "@stapel/core";
import { GatedButton, PaneGate } from "@stapel/tokens-antd/skin";
import { SignInLink, StartChatButton, usePooledRefusal } from "../src/default/index.js";
import { StartDirectChat } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";

const SELLER = "u-seller";

function renderAs(principal: MandatePrincipal, node: ReactNode): void {
  render(
    <TestHarness server={mockServer({})} realtime={{ socketUrl: null }}>
      <MandateProvider source={{ state: mandateResolved(principal) }}>
        {node}
      </MandateProvider>
    </TestHarness>
  );
}

/**
 * A host's OWN control: the headless bag, the skin's gated button, and the
 * pooled door claimed through the exported hook. No `<StartChatButton>`
 * anywhere in it — that is the whole point.
 */
function HostControl(props: {
  readonly availability: ActionAvailability;
  readonly start: () => void;
  readonly signIn?: SignInCta;
  readonly testId: string;
}): ReactElement {
  const gate = useActionGate(props.availability);
  const refusal = usePooledRefusal(gate.reason);
  return (
    <>
      <GatedButton
        gate={props.availability}
        whenBlocked="inert"
        testId={props.testId}
        onClick={props.start}
      >
        Message
      </GatedButton>
      {props.signIn !== undefined
        ? refusal.renderDoor(
            <SignInLink cta={props.signIn} testId="host-sign-in" />
          )
        : null}
    </>
  );
}

function HostCard(props: {
  readonly signIn?: SignInCta;
  readonly testId: string;
}): ReactElement {
  return (
    <StartDirectChat sellerId={SELLER}>
      {({ availability, start }) => (
        <HostControl
          availability={availability}
          start={start}
          testId={props.testId}
          {...(props.signIn !== undefined ? { signIn: props.signIn } : {})}
        />
      )}
    </StartDirectChat>
  );
}

describe("a hand-composed pane claims the pane's one door", () => {
  it("gives TWO headless controls exactly one door, in the pooled sentence", async () => {
    renderAs(
      "anonymous",
      <PaneGate gate={actionAvailable()} testId="cards-reasons">
        <HostCard testId="host-a" signIn={{ href: "/login?next=/s" }} />
        <HostCard testId="host-b" signIn={{ href: "/login?next=/s" }} />
      </PaneGate>
    );

    const doors = await screen.findAllByTestId("host-sign-in");
    expect(doors).toHaveLength(1);
    expect(doors[0]?.getAttribute("href")).toBe("/login?next=/s");

    // IN the sentence both buttons are described by — not merely somewhere on
    // the pane. A door the reason does not carry is a door in a different
    // conversation.
    const describedBy = [
      screen.getByTestId("host-a").getAttribute("aria-describedby"),
      screen.getByTestId("host-b").getAttribute("aria-describedby"),
    ];
    expect(new Set(describedBy).size).toBe(1);
    const sentence = document.getElementById(describedBy[0] as string);
    expect(sentence).not.toBeNull();
    expect(sentence?.contains(doors[0] as HTMLElement)).toBe(true);
    // And the reason itself is still said once for the pane.
    expect(
      screen.getByTestId("cards-reasons").querySelectorAll("[data-stapel-gated-reason]")
    ).toHaveLength(1);
  });

  it("shares the claim with this pair's own pooled button — still one door", async () => {
    renderAs(
      "anonymous",
      <PaneGate gate={actionAvailable()} testId="cards-reasons">
        <StartChatButton
          sellerId={SELLER}
          refusal="pooled"
          signIn={{ href: "/login" }}
        />
        <HostCard testId="host-a" signIn={{ href: "/login" }} />
      </PaneGate>
    );

    await screen.findByTestId("host-a");
    // One sentence, one way out of it — whichever of the two controls won the
    // claim. Two doors in one sentence is what the claim exists to prevent,
    // and a mixed pane is the case that would have found a per-component one.
    await waitFor(() => {
      const mine = screen.queryAllByTestId("chat-start-sign-in");
      const theirs = screen.queryAllByTestId("host-sign-in");
      expect(mine.length + theirs.length).toBe(1);
    });
  });

  it("hands the door on when the headless control holding it unmounts", async () => {
    function Shrinking(): ReactElement {
      const [cards, setCards] = useState(2);
      return (
        <>
          <button type="button" data-testid="drop" onClick={() => setCards(1)}>
            drop
          </button>
          <PaneGate gate={actionAvailable()} testId="cards-reasons">
            {Array.from({ length: cards }, (_unused, index) => (
              <HostCard
                key={`card-${String(index)}`}
                testId={`host-${String(index)}`}
                signIn={{ href: "/login" }}
              />
            ))}
          </PaneGate>
        </>
      );
    }
    renderAs("anonymous", <Shrinking />);
    await screen.findByTestId("host-sign-in");

    fireEvent.click(screen.getByTestId("drop"));
    await waitFor(() => {
      expect(screen.queryByTestId("host-1")).toBeNull();
    });
    // The pane must not lose its only way out with the card that scrolled away.
    await waitFor(() => {
      expect(screen.getAllByTestId("host-sign-in")).toHaveLength(1);
    });
  });

  it("renders nothing outside a pane — there is no sentence to stand in", () => {
    renderAs("anonymous", <HostCard testId="host-a" signIn={{ href: "/login" }} />);
    // Outside a `PaneGate` the reason stands beside the control, and so must
    // its door: this hook portals nothing rather than dropping a link at the
    // root of the document.
    expect(screen.queryByTestId("host-sign-in")).toBeNull();
  });

  it("says nothing for a member — the gate is open, there is no refusal", async () => {
    renderAs(
      "member",
      <PaneGate gate={actionAvailable()} testId="cards-reasons">
        <HostCard testId="host-a" signIn={{ href: "/login" }} />
      </PaneGate>
    );
    await screen.findByTestId("host-a");
    expect(screen.queryByTestId("host-sign-in")).toBeNull();
  });
});
