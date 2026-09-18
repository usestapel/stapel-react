import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane } from "../src/default/index.js";
import { isOwnerStatus } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { publicStatusInfo, statusInfo } from "./fixtures.js";

/**
 * `GET /{pk}/status/` answers two bodies since stapel-listings 0.23.0, and
 * `scope` is the discriminator. Listing ids are sequential, so the full body
 * under `AllowAny` handed a stranger the owner and the moderation verdict of
 * every listing in the fleet, drafts and rejections included. The CAPABILITY
 * a stranger needs — "this listing was removed", not the 404 a made-up id
 * also produces — survives; the disclosure does not.
 */
describe("the status probe is scoped", () => {
  it("narrows the owner body and refuses the public one", () => {
    const owner = statusInfo();
    expect(isOwnerStatus(owner)).toBe(true);
    // Reading `owner_id` COMPILES only inside the narrowing — that is the
    // point of the helper, and TypeScript is the assertion.
    if (isOwnerStatus(owner)) expect(owner.owner_id).toBeTypeOf("string");

    const stranger = publicStatusInfo({ is_deleted: true });
    expect(isOwnerStatus(stranger)).toBe(false);
    expect(Object.keys(stranger).sort()).toEqual(["is_deleted", "scope"]);
  });

  it("still says 'removed' from a public body that carries nothing else", async () => {
    const srv = mockServer({
      "/listings/7/status/": { body: publicStatusInfo({ is_deleted: true }) },
      "/listings/7/": {
        status: 404,
        body: { localizable_error: "error.404.listing_not_found" },
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingDetailPane id={7} />
      </TestProviders>
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-removed")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-error")).toBeNull();
  });
});
