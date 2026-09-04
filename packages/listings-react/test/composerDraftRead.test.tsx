import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { actionAvailable } from "@stapel/core";
import { ListingComposerPage } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, detail } from "./fixtures.js";

/**
 * `GET /{pk}/draft/` (stapel-listings 0.21.1) — the read `headless/
 * ListingComposer.tsx`'s header used to name as impossible. Two paths:
 *
 *  - the route answers, and a reopened listing seeds from the DRAFT TWIN
 *    (what was actually last typed, published or not) rather than the
 *    published half;
 *  - the route 404s — nothing was ever saved into it, or the backend
 *    predates it — and the composer falls back to the published-half seed
 *    exactly as it always has.
 *
 * Both asserted on the wire, per this file's own convention: the request the
 * composer's own `save` sends afterwards, which is the one place a wrong
 * seed source would show up as a wrong value going back to the server.
 */

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

async function seeded(): Promise<void> {
  await waitFor(() => {
    expect(
      screen
        .getByTestId("listings-composer-publish-gate")
        .getAttribute("data-stapel-gated")
    ).toBe("available");
  });
}

describe("reopening a listing reads the draft twin when the backend has it", () => {
  it("seeds from the draft-twin read, not the published half", async () => {
    const srv = mockServer({
      "/listings/42/": {
        body: detail({ id: 42, status: "published", title: "Bosch GSB 1200" }),
      },
      "/listings/42/draft/": {
        body: {
          ...DRAFT,
          id: 42,
          title_draft: "Bosch GSB 1200 v2",
          description_draft: "Barely used, one owner.",
        },
      },
      "/listings/42/save-draft/": { body: DRAFT },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await seeded();
    expect(srv.matching("/listings/42/draft/")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      const saved = srv.lastBody("/listings/42/save-draft/") as Record<
        string,
        unknown
      >;
      expect(saved["title_draft"]).toBe("Bosch GSB 1200 v2");
    });
  });

  it("falls back to the published-half seed when the draft read 404s", async () => {
    const srv = mockServer({
      "/listings/42/": {
        body: detail({ id: 42, status: "draft", title: "Bosch GSB 1200" }),
      },
      "/listings/42/draft/": { status: 404, body: {} },
      "/listings/42/save-draft/": { body: DRAFT },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage listingId={42} features={[]} images={GALLERY} />
      </TestProviders>
    );
    await seeded();
    // The fallback is not a skip — the read is still ASKED for, and answers.
    expect(srv.matching("/listings/42/draft/")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    await waitFor(() => {
      const saved = srv.lastBody("/listings/42/save-draft/") as Record<
        string,
        unknown
      >;
      expect(saved["title_draft"]).toBe("Bosch GSB 1200");
    });
  });
});
