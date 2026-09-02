/**
 * THE THIRD VOLUME OF A BLOCKED HEART'S REASON: ON INTERACTION.
 *
 * Measured on a live classified deployment's desktop catalogue: the standing
 * caption — "sign in to do this" plus the door — printed under EVERY card,
 * 24 copies per screen. `"line"` (the reason without the door) and a pooled
 * scope both make it quieter; neither makes it stop being standing copy. The
 * product ruling is that the door belongs on interaction: nothing standing in
 * the card, the reason and the door one gesture away on the heart itself —
 * hover, focus, or tap.
 *
 * The accessibility floor this arm must not trade away: the reason stays in
 * the DOM as visually-hidden text wired to the button via `aria-describedby`,
 * so assistive tech reads the refusal with the control's name, pointer or no
 * pointer.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListingCard, ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD, detail, statusInfo } from "./fixtures.js";

describe("a card heart with blockedReason=\"popover\"", () => {
  it("prints NOTHING standing in the card's layout", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard
          listing={CARD}
          blockedReason="popover"
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-card-favorite")).toBeTruthy();
    expect(screen.queryByTestId("listings-card-favorite-blocked")).toBeNull();
    expect(screen.queryByTestId("listings-card-sign-in")).toBeNull();
  });

  it("keeps the reason reachable without a pointer: aria-describedby to a hidden copy", () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard
          listing={CARD}
          blockedReason="popover"
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.getAttribute("aria-disabled")).toBe("true");
    const describedBy = heart.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const hidden = document.getElementById(describedBy ?? "");
    expect(hidden?.textContent).toBe("Sign in to do this");
  });

  it("opens the reason and the door on click — and fires no request", async () => {
    const srv = mockServer({});
    render(
      <TestProviders server={srv} mandate="anonymous">
        <ListingCard
          listing={CARD}
          blockedReason="popover"
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    const before = srv.calls.length;
    fireEvent.click(screen.getByTestId("listings-card-favorite"));
    await waitFor(() => {
      expect(screen.getByTestId("listings-card-favorite-reason")).toBeTruthy();
    });
    const content = screen.getByTestId("listings-card-favorite-reason");
    expect(content.textContent).toContain("Sign in to do this");
    const door = screen.getByTestId("listings-card-sign-in");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
    expect(srv.calls.length).toBe(before);
  });

  it("opens on focus too — a keyboard has no hover", async () => {
    render(
      <TestProviders server={mockServer({})} mandate="anonymous">
        <ListingCard
          listing={CARD}
          blockedReason="popover"
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    fireEvent.focus(screen.getByTestId("listings-card-favorite"));
    await waitFor(() => {
      expect(screen.getByTestId("listings-card-favorite-reason")).toBeTruthy();
    });
  });

  it("changes nothing for a member, whose heart is live", () => {
    render(
      <TestProviders server={mockServer({})} mandate="member">
        <ListingCard
          listing={CARD}
          blockedReason="popover"
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.getAttribute("aria-disabled")).toBeNull();
    expect(heart.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("listings-card-favorite-reason")).toBeNull();
  });
});

describe("the detail pane's favourite in popover mode", () => {
  function panel(blockedReason?: "text" | "popover") {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ is_favorited: null }) },
    });
    render(
      <TestProviders server={srv} mandate="anonymous">
        <ListingDetailPane
          id={7}
          {...(blockedReason !== undefined ? { blockedReason } : {})}
          signIn={{ href: "/login?next=/l/7" }}
        />
      </TestProviders>
    );
    return srv;
  }

  it("keeps the standing door by default — \"text\" is unchanged", async () => {
    panel();
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(screen.getByTestId("listings-detail-favorite-blocked")).toBeTruthy();
  });

  it("moves the reason and the door onto the heart with \"popover\"", async () => {
    panel("popover");
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-favorite-blocked")).toBeNull();
    // The floor holds here too: while the disclosure is CLOSED the button's
    // aria-describedby points at the visually-hidden copy of the reason.
    // (Open, antd re-points it at the overlay — which contains the same
    // reason, so either way it reaches AT without a pointer.)
    const heart = screen.getByTestId("listings-detail-favorite");
    const hidden = document.getElementById(
      heart.getAttribute("aria-describedby") ?? ""
    );
    expect(hidden?.textContent).toBe("Sign in to do this");
    fireEvent.click(heart);
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite-reason")).toBeTruthy();
    });
    expect(
      screen.getByTestId("listings-detail-sign-in").getAttribute("href")
    ).toBe("/login?next=/l/7");
  });
});
