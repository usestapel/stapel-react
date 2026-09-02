/**
 * D45 ON THE PHONE — the SERP card's refusal is a gesture, not a printed line.
 *
 * The grid card learned this in the desktop fix pack (`blockedReason`), and
 * the phone's one-column card did not: a signed-out walker measured "sign in
 * to do this" printed FOURTEEN times down one search page, once under every
 * card, in the line where a price or a place belongs. The mechanism already
 * exists in this package — `GateReasonPopover`, an interaction disclosure
 * that opens on tap as readily as on hover and keeps the sentence in the
 * accessibility tree — so the phone card gets the same choice the grid has.
 *
 * The default is unchanged: a host that says nothing still gets the standing
 * line, because a reason nobody asked to hide is a reason that stays visible.
 */
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingSerpCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

/** A VISITOR: the state the walker measured this in — the heart is blocked
 * and the gate has a reason to say. */
function providers(children: ReactElement): ReactElement {
  return (
    <TestProviders server={mockServer({})} mandate="anonymous">
      {children}
    </TestProviders>
  );
}

const REASON = "Sign in to do this";

describe("<ListingSerpCard> — the blocked heart's reason", () => {
  it("stands in the layout by default, as it always has", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    expect(screen.queryByText(REASON)).not.toBeNull();
  });

  it('blockedReason="popover" prints nothing in the layout', () => {
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" blockedReason="popover" />
      )
    );
    // Every copy of the sentence that is still in the DOM is the a11y one:
    // clipped out of the layout, so it costs a screen reader nothing and a
    // reader of the page no line. (The fleet's `visuallyHidden` clips with
    // `clip-path: inset(50%)`, which is the marker asserted here.)
    const standing = screen
      .queryAllByText(REASON)
      .filter((node) => !/inset\(50%\)/.test(node.getAttribute("style") ?? ""));
    expect(standing).toEqual([]);
  });

  it('keeps the reason in the accessibility tree, wired to the heart', () => {
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" blockedReason="popover" />
      )
    );
    const heart = screen.getByTestId("listings-serp-favorite");
    const describedBy = heart.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const copy = document.getElementById(describedBy ?? "");
    expect(copy?.textContent).toContain(REASON);
  });

  it("leaves the heart operable so the disclosure can open on tap", () => {
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" blockedReason="popover" />
      )
    );
    const heart = screen.getByTestId("listings-serp-favorite");
    // aria-disabled, never html-disabled: an html-disabled button swallows the
    // very tap the disclosure listens for.
    expect(heart.hasAttribute("disabled")).toBe(false);
    expect(heart.getAttribute("aria-disabled")).toBe("true");
  });
});
