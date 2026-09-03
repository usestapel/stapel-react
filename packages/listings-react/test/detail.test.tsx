import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { OWNER, STRANGER, detail, statusInfo } from "./fixtures.js";

/**
 * Four absences, four sentences — and the two that a single 404 would have
 * merged.
 */

describe("the three outcomes of a read", () => {
  it("loading: a spinner, not an empty page", () => {
    const srv = mockServer({
      "/listings/7/": () => ({ body: detail() }),
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    expect(screen.getByTestId("listings-detail-loading")).toBeTruthy();
  });

  it("ready: the listing", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail() },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title").textContent).toBe(
        "Bosch GSB 1200"
      );
    });
  });

  it("failed: 'we could not load this' plus a retry — never 'nothing here'", async () => {
    const srv = mockServer({
      "/listings/7/status/": { status: 503, body: {} },
      "/listings/7/": { status: 503, body: {} },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-error").textContent).toContain(
        "could not load"
      );
    });
    const before = srv.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText("Try again"));
    });
    await waitFor(() => {
      expect(srv.calls.length).toBeGreaterThan(before);
    });
  });
});

describe("a removed listing is not a typo", () => {
  it("says 'this listing was removed' when the probe finds a deleted row", async () => {
    // `GET /{pk}/` reads `Listing.objects` (soft-deleted excluded) and 404s;
    // `GET /{pk}/status/` reads `Listing.all_objects` and still answers. Two
    // reads in parallel is what turns one 404 into two sentences.
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo({ is_deleted: true, is_active: false, status: "archived" }) },
      "/listings/7/": { status: 404, body: { localizable_error: "error.404.listing_not_found" } },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-removed")).toBeTruthy();
    });
  });

  it("says 'taken down' with no retry when the probe still answers for the row", async () => {
    // The archived-not-deleted case, measured on a live stand: the detail
    // read 404s (its queryset filters the row out) while the AllowAny probe
    // answers 200 — and its whole body there was `{"is_deleted": false}`.
    // The pane used to fall into the generic "could not load / retry" arm: a
    // retry that could never help, on a row that is gone on purpose.
    const srv = mockServer({
      "/listings/7/status/": { body: { is_deleted: false } },
      "/listings/7/": { status: 404, body: { localizable_error: "error.404.listing_not_found" } },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-withdrawn")).toBeTruthy();
    });
    // Not the removed banner, not the generic error, and above all no retry
    // control — there is nothing a retry would change.
    expect(screen.queryByTestId("listings-detail-removed")).toBeNull();
    expect(screen.queryByTestId("listings-detail-error")).toBeNull();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("says 'no listing at this address' when neither read finds one", async () => {
    const srv = mockServer({
      "/listings/7/status/": { status: 404, body: {} },
      "/listings/7/": { status: 404, body: {} },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-error").textContent).toContain(
        "no listing at this address"
      );
    });
  });
});

describe("visibility is reported, not assumed", () => {
  it("warns a stranger that a non-published listing is not on sale", async () => {
    // The detail endpoint has NO published() filter, so a draft answers 200
    // to anyone holding the id. Rendering it as a live shop page would be the
    // pair repeating the server's omission.
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo({ status: "draft", is_active: false }) },
      "/listings/7/": { body: detail({ status: "draft" }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} viewerId={STRANGER} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-not-published")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-owner-view")).toBeNull();
  });

  it("shows the moderation axis to the OWNER and to nobody else", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo({ moderation_status: "pending" }) },
      "/listings/7/": { body: detail({ moderation_status: "pending" }) },
    });
    const { rerender } = render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} viewerId={OWNER} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-moderation-note").textContent).toContain(
        "stays published"
      );
    });
    // The live-edit combination: published to everyone, under review for its
    // owner — the 0.5.0 divergence, on screen.
    expect(
      screen
        .getByTestId("listings-moderation-note")
        .getAttribute("data-listing-live-under-review")
    ).toBe("true");

    rerender(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} viewerId={STRANGER} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.queryByTestId("listings-moderation-note")).toBeNull();
    });
  });
});

describe("photos say why they are not there", () => {
  it("names the missing resolver rather than drawing a broken image", async () => {
    // No contract in this fleet resolves a stranger's CDN reference, so the
    // pair takes a resolver from the host and states the gap when there is
    // none — instead of inventing a URL convention.
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail() },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-photo-absent").length).toBeGreaterThan(0);
    });
  });

  it("hands the reference to @stapel/image once a resolver is wired", async () => {
    // The assertion is that the "unavailable" branch is GONE — the ladder
    // component itself defers its first paint to a slot measurement and an
    // image decode, neither of which jsdom performs, so asserting on the
    // rendered <img> would be asserting on the environment.
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail() },
    });
    render(
      <TestProviders server={srv} resolveImage>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-photo-absent")).toBeNull();
  });
});

describe("a stored attribute this build cannot key is counted", () => {
  it("reports the unreadable rows instead of rounding them to zero", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": {
        body: detail({
          // A row with no slug: the projection always injects one, so this is
          // a malformed record — and a synthesized index would key a badge to
          // a position that moves whenever the category does.
          features: [{ type: "int", value: 5 }, ...detail().features],
        }),
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-unreadable").textContent).toContain(
        "1"
      );
    });
  });
});

describe("the favourite control is blocked, never hidden", () => {
  it("shows a visitor the control WITH the reason and does not fire", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ is_favorited: null }) },
    });
    render(
      <TestProviders server={srv} mandate="anonymous">
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    // `aria-disabled` with a live handler, never the inert html attribute:
    // the refusal is proved by the request count below, not by the browser
    // swallowing the click.
    expect(
      screen.getByTestId("listings-detail-favorite").getAttribute("aria-disabled")
    ).toBe("true");
    expect(
      screen.getByTestId("listings-detail-favorite").hasAttribute("disabled")
    ).toBe(false);
    // The reason is the shared gate's, rendered as visible text and pointed at
    // by the control's `aria-describedby` — never a hover.
    expect(
      screen
        .getByTestId("listings-detail-favorite-gate")
        .querySelector("[data-stapel-gated-reason]")?.textContent
    ).toBe("Sign in to do this");

    const before = srv.calls.length;
    fireEvent.click(screen.getByTestId("listings-detail-favorite"));
    expect(srv.calls.length).toBe(before);
  });

  it("draws the container's sign-in door beside the blocked heart", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ is_favorited: null }) },
    });
    render(
      <TestProviders server={srv} mandate="anonymous">
        <ListingDetailPane id={7} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    // The reason states WHY; the door says WHERE — the cards' own pattern,
    // and until this prop the pane's heart had the sentence with no door.
    const door = screen.getByTestId("listings-detail-sign-in");
    expect(door.getAttribute("href")).toBe("/login?next=/l/7");
  });

  it("draws no door for a member, whose heart is live", async () => {
    const srv = mockServer({
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ is_favorited: false }) },
    });
    render(
      <TestProviders server={srv} mandate="member">
        <ListingDetailPane id={7} signIn={{ href: "/login?next=/l/7" }} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-favorite")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-sign-in")).toBeNull();
  });

  it("toggles for a member and hits the endpoint the state implies", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
      "/listings/7/": { body: detail({ is_favorited: false }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-detail-favorite-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-detail-favorite"));
    });
    await waitFor(() => {
      expect(srv.matching("/listings/7/favorite/")).toHaveLength(1);
    });
    expect(srv.matching("/listings/7/unfavorite/")).toHaveLength(0);
  });
});

describe("the stock row is a label and a value, not a sentence in the label cell", () => {
  it("renders the quantity in the value cell and no placeholder anywhere", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ stock_quantity: 3 }) },
    });
    const { container } = render(
      <TestProviders server={srv} locale="ru">
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-stock").textContent).toBe("3");
    });
    // The live defect: the whole sentence sat in the label cell, so the page
    // printed the placeholder next to a value cell holding the number.
    expect(container.textContent ?? "").not.toContain("{count}");
    expect(container.textContent ?? "").toContain("В наличии");
  });

  it("omits the row when the backend sends no quantity", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: statusInfo() },
      "/listings/7/": { body: detail({ stock_quantity: null }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-stock")).toBeNull();
  });
});
