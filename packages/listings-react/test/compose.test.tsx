import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { ListingComposerPage } from "../src/default/index.js";
import { LISTINGS_I18N_KEYS } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, FEATURES, detail } from "./fixtures.js";

/**
 * The submission flow, end to end against the WIRE.
 *
 * Everything asserted here is a request body or a rendered sentence — never
 * "the hook was called". The claims that matter about a submission are (1) the
 * right row is created and the right payload saved into it, (2) a publish
 * refusal lands on the control that caused it, and (3) the two publish
 * outcomes are told apart by what the SERVER answered rather than by what we
 * sent.
 */

function server(overrides: Record<string, unknown> = {}) {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/42/publish/": {
      body: { published: true, listing_id: 42, status: "pending" },
    },
    "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    "/listings/": { body: DRAFT },
    ...overrides,
  });
}

/** Wait until the composer has been seeded from the listing it is editing —
 * a submit before that would be publishing over content the form has not read
 * yet, which is exactly what the gate prevents. */
async function seeded(): Promise<void> {
  await waitFor(() => {
    expect(
      screen.getByTestId("listings-composer-publish").hasAttribute("disabled")
    ).toBe(false);
  });
}

/** Choose a category through the form, which is what unblocks everything
 * downstream of it — the composer refuses to submit without one, and says so. */
function chooseCategory(): void {
  fireEvent.change(screen.getByTestId("listings-composer-category"), {
    target: { value: "tools/power" },
  });
}

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

/** The same schema without the mandatory member, so the client mirror has
 * nothing to say and the server's verdict is what reaches the controls. */
const OPTIONAL_FEATURES = FEATURES.filter((feature) => feature.mandatory !== true);

describe("the draft row is created once, then saved into", () => {
  it("POSTs only the category, then sends the form to save-draft", async () => {
    // `perform_create` forces owner and status, and every other field has a
    // model default — so a create that carried the form would be a second
    // write of data the very next save sends anyway, able to fail the whole
    // submission on a field the person could still fix.
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage features={[]} images={GALLERY} />
      </TestProviders>
    );

    fireEvent.change(screen.getByTestId("listings-composer-category"), {
      target: { value: "tools/power" },
    });
    fireEvent.change(screen.getByTestId("listings-composer-title"), {
      target: { value: "Bosch GSB 1200" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });

    await waitFor(() => {
      expect(srv.matching("/listings/42/save-draft/")).toHaveLength(1);
    });

    const created = srv.matching("/listings/").filter((c) => c.method === "POST");
    expect(created).toHaveLength(1);
    expect(created[0]?.body).toEqual({ category_id: "tools/power" });

    const saved = srv.lastBody("/listings/42/save-draft/") as Record<string, unknown>;
    expect(saved["title_draft"]).toBe("Bosch GSB 1200");
    expect(saved["category_id"]).toBe("tools/power");
  });

  it("sends the gallery bag's refs, in order, as images_draft", async () => {
    // `bag.refs` IS the value of `images_draft` — same list, same order, the
    // first tile the cover. Two sources of truth for one list is how a
    // publish sends photos the person removed.
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          listingId={42}
          features={[]}
          images={{
            refs: ["image/aaa", "image/bbb"],
            settled: actionAvailable(),
          }}
        />
      </TestProviders>
    );
    await seeded();
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      const saved = srv.lastBody("/listings/42/save-draft/") as Record<
        string,
        unknown
      >;
      expect(saved["images_draft"]).toEqual(["image/aaa", "image/bbb"]);
    });
  });

  it("saves BEFORE it publishes — publish reads the stored draft", async () => {
    // Publishing without saving would promote whatever was there before the
    // last keystroke, and the person would be told their listing is fine
    // while a field they just fixed is still wrong on the server.
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await seeded();
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-publish"));
    });
    await waitFor(() => {
      expect(srv.matching("/listings/42/publish/")).toHaveLength(1);
    });
    const order = srv.calls
      .filter((c) => c.method === "POST")
      .map((c) => new URL(c.url).pathname);
    expect(order[order.length - 2]).toContain("save-draft");
    expect(order[order.length - 1]).toContain("publish");
  });
});

describe("a publish refusal lands on the control that caused it", () => {
  it("routes a ValidationBatchResult body onto the feature's field", async () => {
    // The 400 body is a BARE batch — no `localizable_error`, no envelope —
    // which core wraps as `stapel.http.400` with the batch on `.body`. A
    // caller that branched on the status alone would put a per-field verdict
    // in a page banner.
    const srv = mockServer({
      "/listings/42/save-draft/": { body: DRAFT },
      "/listings/42/publish/": {
        status: 400,
        body: {
          valid: false,
          results: [
            {
              slug: "power",
              status: "validation_failed",
              error: "above_maximum",
              localizable_error: "error.400.feature_above_maximum",
              ref_value: 5000,
              params: { feature: "Power", slug: "power" },
            },
          ],
        },
      },
      "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    });

    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          listingId={42}
          features={OPTIONAL_FEATURES}
          images={GALLERY}
        />
      </TestProviders>
    );

    // The mirror lets this through: the value is within the config's bounds,
    // and only the SERVER knows the rule that refuses it. That is the whole
    // point of the mirror never being the verdict.
    await seeded();

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-publish"));
    });

    await waitFor(() => {
      // The summary counts the failed rows…
      expect(screen.getByTestId("listings-composer-invalid").textContent).toContain(
        "1"
      );
    });
    // …and the sentence is the ENGINE's key, interpolated with the feature —
    // the same sentence the client mirror would have produced, because it is
    // the same key.
    expect(document.body.textContent).toContain("Power");
  });
});

describe("the two publish outcomes come from the server's answer", () => {
  it("says 'sent for review' when the lifecycle moved to pending", async () => {
    const srv = mockServer({
      "/listings/42/save-draft/": { body: DRAFT },
      "/listings/42/publish/": {
        body: { published: true, listing_id: 42, status: "pending" },
      },
      "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await seeded();
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-publish"));
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-composer-published").getAttribute("data-outcome")
      ).toBe("submitted_for_review");
    });
  });

  it("says 'stays published' when the lifecycle did NOT move", async () => {
    // The 0.5.0 semantics, observed rather than assumed: `publish_listing`
    // leaves a LIVE listing at status=published and moves only the
    // moderation axis. A client that predicted "pending" would tell a seller
    // their listing had gone offline while buyers were reading it.
    const srv = mockServer({
      "/listings/42/save-draft/": { body: DRAFT },
      "/listings/42/publish/": {
        body: { published: true, listing_id: 42, status: "published" },
      },
      "/listings/42/": { body: detail({ id: 42, status: "published" }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await seeded();
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-publish"));
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-composer-published").getAttribute("data-outcome")
      ).toBe("live_edit_under_review");
    });
  });
});

describe("every blocked publish states which reason it is", () => {
  it("blocks a visitor with the sign-in reason, and does not hide the button", async () => {
    const srv = server();
    render(
      <TestProviders server={srv} mandate="anonymous">
        <ListingComposerPage features={[]} images={GALLERY} />
      </TestProviders>
    );
    chooseCategory();
    const button = screen.getByTestId("listings-composer-publish");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("listings-composer-publish-blocked").textContent).toBe(
      "Sign in to do this"
    );
  });

  it("does NOT refuse while the mandate is merely being asked", async () => {
    // "We could not ask" and "we have not finished asking" are not "you may
    // not" — the spec's own negative leg (§7.4).
    const srv = server();
    render(
      <TestProviders server={srv} mandate="asking">
        <ListingComposerPage features={[]} images={GALLERY} />
      </TestProviders>
    );
    chooseCategory();
    expect(
      screen.getByTestId("listings-composer-publish-blocked").textContent
    ).toContain("could not check");
  });

  it("blocks on photos still in flight, with the gallery's own sentence", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          features={[]}
          images={{
            refs: [],
            settled: actionBlocked(LISTINGS_I18N_KEYS.composeBlockedPhotosPending),
          }}
        />
      </TestProviders>
    );
    chooseCategory();
    expect(
      screen.getByTestId("listings-composer-publish-blocked").textContent
    ).toContain("photos");
  });

  it("blocks on a value type this build cannot draw, naming the type", async () => {
    // A category can legally carry a type this build has no editor for.
    // Drawing nothing would silently drop a possibly-MANDATORY attribute and
    // the person would be refused for a field they never saw.
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          features={[
            { slug: "size_grid", name: "Size grid", config: { type: "size_grid" } },
          ]}
          images={GALLERY}
        />
      </TestProviders>
    );
    chooseCategory();
    const blocked = screen.getByTestId("listings-composer-publish-blocked");
    expect(blocked.textContent).toContain("size_grid");
    // …and the field itself is drawn loudly rather than skipped.
    expect(screen.getByTestId("attributes-unsupported-type")).toBeTruthy();
  });

  it("blocks while the category schema could not be loaded", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          features={[]}
          featuresError={new Error("boom")}
          images={GALLERY}
        />
      </TestProviders>
    );
    chooseCategory();
    expect(
      screen.getByTestId("listings-composer-publish-blocked").textContent
    ).toContain("could not load");
    expect(screen.getByTestId("listings-composer-features-failed")).toBeTruthy();
  });
});

describe("the button says what it will do", () => {
  it("reads 'Send changes' when editing something already published", async () => {
    const srv = mockServer({
      "/listings/42/": { body: detail({ id: 42, status: "published" }) },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-composer-publish").textContent).toBe(
        "Send changes"
      );
    });
  });
});
