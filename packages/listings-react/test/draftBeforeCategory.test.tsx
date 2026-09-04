/**
 * A draft may exist before it has a category (D261).
 *
 * The incident: everything addressed BY the draft id — an analysis job handed
 * the id, an upload filed against it, a link back into an unfinished
 * submission — could not start, because the composer refused to create the row
 * until a category had been picked. The row was the first thing the flow
 * needed and the last thing it made.
 *
 * stapel-listings 0.21.4 settles the question on the server's side:
 * `category_id` is nullable on the draft half, `save-draft` accepts a body
 * without one, a draft read answers `category_id: null`, and `publish` is what
 * refuses — `publish_validation_failed` naming `category_id`. This suite holds
 * the pair to that shape, measured on the WIRE and on the gate's own stamp.
 */
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionAvailable } from "@stapel/core";
import { ListingComposerPage } from "../src/default/index.js";
import type { ListingDraft } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, detail } from "./fixtures.js";

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

/** What 0.21.4 answers for a row created before its category was chosen. The
 * title is what makes the seed OBSERVABLE: an assertion that lands on the
 * empty form would pass against a seed that never ran. */
const UNCATEGORIZED: ListingDraft = {
  ...DRAFT,
  category_id: null,
  title_draft: "Bosch GSB 1200",
};

function server(overrides: Record<string, unknown> = {}) {
  return mockServer({
    "/listings/": { body: UNCATEGORIZED },
    "/listings/42/save-draft/": { body: UNCATEGORIZED },
    "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
    "/listings/42/draft/": { status: 404, body: {} },
    ...overrides,
  });
}

function categoryPicker(slot: { setCategory: (id: string) => void }): ReactElement {
  return (
    <button
      type="button"
      data-testid="listings-composer-category-pick"
      onClick={() => {
        slot.setCategory("tools/power");
      }}
    >
      pick
    </button>
  );
}

function save(): Promise<void> {
  return act(async () => {
    fireEvent.click(screen.getByTestId("listings-composer-save"));
  });
}

/** The publish button's reason, followed the way a screen reader follows it. */
function publishReason(): string {
  const button = screen.getByTestId("listings-composer-publish");
  const id = button.getAttribute("aria-describedby");
  if (id === null) return "";
  return document.getElementById(id)?.textContent ?? "";
}

describe("the row is created before the category is chosen", () => {
  it("POSTs an empty body on the first save and saves into the id it got back", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          renderCategoryPicker={categoryPicker}
          features={[]}
          images={GALLERY}
        />
      </TestProviders>
    );

    fireEvent.change(screen.getByTestId("listings-composer-title"), {
      target: { value: "Bosch GSB 1200" },
    });
    await save();

    await waitFor(() => {
      expect(srv.matching("/listings/42/save-draft/")).toHaveLength(1);
    });
    const created = srv.matching("/listings/").filter((c) => c.method === "POST");
    expect(created).toHaveLength(1);
    // `{}` and not `{category_id: ""}`: an empty id is not "no category", it
    // is a category the serializer refuses.
    expect(created[0]?.body).toEqual({});

    const saved = srv.lastBody("/listings/42/save-draft/") as Record<string, unknown>;
    expect(saved["title_draft"]).toBe("Bosch GSB 1200");
    expect(saved).not.toHaveProperty("category_id");
  });

  it("still refuses to PUBLISH without one, and says which field", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          renderCategoryPicker={categoryPicker}
          features={[]}
          images={GALLERY}
        />
      </TestProviders>
    );

    expect(
      screen
        .getByTestId("listings-composer-publish-gate")
        .getAttribute("data-stapel-gated")
    ).toBe("blocked");
    expect(publishReason()).toBe(
      "Choose a category — the rest of the form depends on it"
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-publish"));
    });
    // Not sent, so the server never has to be the one saying no.
    expect(srv.matching("/listings/42/publish/")).toHaveLength(0);
  });

  it("writes the category into the existing row on the next save", async () => {
    const srv = server();
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          renderCategoryPicker={categoryPicker}
          features={[]}
          images={GALLERY}
        />
      </TestProviders>
    );

    await save();
    await waitFor(() => {
      expect(srv.matching("/listings/42/save-draft/")).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId("listings-composer-category-pick"));
    await save();

    await waitFor(() => {
      expect(srv.matching("/listings/42/save-draft/")).toHaveLength(2);
    });
    // One row, two saves — the category is a field, not a second create.
    expect(srv.matching("/listings/").filter((c) => c.method === "POST")).toHaveLength(1);
    const saved = srv.lastBody("/listings/42/save-draft/") as Record<string, unknown>;
    expect(saved["category_id"]).toBe("tools/power");
  });

  it("reopens a category-less draft instead of crashing on its null", async () => {
    // `category_id: null` on BOTH reads — the draft twin and the published
    // half — is what a row created before the category step answers.
    const srv = server({
      "/listings/42/draft/": { body: UNCATEGORIZED },
      "/listings/42/": {
        body: detail({ id: 42, status: "draft", category_id: null }),
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          listingId={42}
          renderCategoryPicker={categoryPicker}
          features={[]}
          images={GALLERY}
        />
      </TestProviders>
    );

    await waitFor(() => {
      expect(
        (screen.getByTestId("listings-composer-title") as HTMLInputElement).value
      ).toBe("Bosch GSB 1200");
    });
    // The form is usable and the one thing missing is named, rather than the
    // seed having thrown on a `null` where a string was declared.
    expect(screen.getByTestId("listings-composer-category-pick")).toBeTruthy();
    expect(publishReason()).toBe(
      "Choose a category — the rest of the form depends on it"
    );
  });

  it("survives the null on the OTHER seed too — the published half", async () => {
    // The draft-twin read 404s (nothing saved, or a backend older than
    // 0.21.1), so the seed falls back to the detail. That path took
    // `category_id` verbatim, and `null` reached a field declared `string` —
    // the crash is in the first control that measures its length, not in the
    // seed itself.
    const srv = server({
      "/listings/42/": {
        body: detail({ id: 42, status: "draft", category_id: null }),
      },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          listingId={42}
          renderCategoryPicker={categoryPicker}
          features={[]}
          images={GALLERY}
        />
      </TestProviders>
    );

    // Waited on the SEEDED value, not on the empty form: the crash is
    // downstream of the seed, and an assertion that lands before it would
    // pass against the defect.
    await waitFor(() => {
      expect(
        (screen.getByTestId("listings-composer-title") as HTMLInputElement).value
      ).toBe("Bosch GSB 1200");
    });
    expect(publishReason()).toBe(
      "Choose a category — the rest of the form depends on it"
    );
  });
});
