import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStapelClient } from "@stapel/core";
import {
  LISTINGS_ERROR_CODES,
  LISTINGS_FLOWS,
  createListingsApi,
  createListingsRuntime,
  explainListingsError,
  listingsI18nBundleEn,
  listingsQueryKeys,
  navEntries,
  pageKey,
  registerListingsI18n,
} from "../src/index.js";
import { BASE, mockServer } from "./harness.js";
import { CARD, COUNTERS, DRAFT, PAGE, detail, statusInfo } from "./fixtures.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(listingsQueryKeys.all[0]).toBe("listings");
  });

  it("normalizes a page so 'no cursor' cannot cache twice", () => {
    expect(pageKey()).toEqual(pageKey({}));
    expect(pageKey({ limit: 20 })).not.toEqual(pageKey());
    expect(pageKey({ anchor: "a1" })).not.toEqual(pageKey());
  });

  it("keeps the status probe on its OWN key, not folded into the detail", () => {
    // The probe answers for a soft-deleted listing the detail 404s on;
    // sharing a key would let the 404 evict the one read that explains it.
    expect(listingsQueryKeys.status(7)).not.toEqual(listingsQueryKeys.detail(7));
  });
});

describe("the API surface is this pair's SLICE of the contract", () => {
  const api = createListingsApi(
    createStapelClient({ baseUrl: BASE, fetch: mockServer({}).fetch })
  );

  it("exposes the eighteen operations a storefront calls", () => {
    const methods = Object.keys(api).filter((key) => key !== "client").sort();
    expect(methods).toEqual([
      "archive",
      "complete",
      "createDraft",
      // The draft twin, read back (stapel-listings 0.21.1) — what finally
      // lets a reopened listing seed from what was actually typed instead of
      // the published half. Hand-authored: ahead of this pair's pinned
      // schema, the way `children_as` was in categories-react.
      "draft",
      // The per-viewer overlay for a page of cards. It is on the list because
      // a storefront's feed and SERP come from the search index and this is
      // the only way the engagement flags reach them at all.
      "engagement",
      "favorite",
      "list",
      "myCounters",
      "myFavorites",
      "myListings",
      "publish",
      "remove",
      "retrieve",
      "saveDraft",
      "status",
      // ONE route for every edge of the seller's half of the state machine
      // (stapel-listings 0.20.0). `archive` and `complete` stay because they
      // are still on the contract; between them they covered two edges, both
      // exits, which is why a cabinet had no way back out of SOLD.
      "transition",
      "unfavorite",
      "validateDraft",
    ]);
  });

  it("exposes NO PUT and NO PATCH, and that is a safety decision", () => {
    // Every owner operation in stapel-listings routes through
    // `views._get_own` — except `update`/`partial_update`, which are the
    // plain ModelViewSet implementations under `IsAuthenticatedOrReadOnly`
    // over `Listing.objects.all()`. `save-draft` performs the same write
    // WITH the ownership check, so nothing is lost by declining these.
    expect(api).not.toHaveProperty("update");
    expect(api).not.toHaveProperty("partialUpdate");
  });

  it("hits the module's own paths", async () => {
    const server = mockServer({
      "/listings/7/validate-draft/": { body: { valid: true, results: [] } },
      "/listings/7/save-draft/": { body: DRAFT },
      "/listings/7/draft/": { body: DRAFT },
      "/listings/7/publish/": { body: { published: true, listing_id: 7, status: "pending" } },
      "/listings/7/archive/": { body: { success: true, status: "archived" } },
      "/listings/7/complete/": { body: { success: true, status: "sold" } },
      "/listings/7/favorite/": { body: { favorited: true, listing_id: 7 } },
      "/listings/7/unfavorite/": { body: { favorited: false, listing_id: 7 } },
      "/listings/7/status/": { body: statusInfo() },
      "/listings/my/counters/": { body: COUNTERS },
      "/listings/my/favorites/": { body: PAGE },
      "/listings/7/": { body: detail() },
      "/listings/": { body: PAGE },
    });
    const wired = createListingsApi(
      createStapelClient({ baseUrl: BASE, fetch: server.fetch })
    );
    await wired.list();
    await wired.retrieve(7);
    await wired.status(7);
    await wired.myCounters();
    await wired.myFavorites();
    await wired.createDraft({ category_id: "c" });
    await wired.saveDraft(7, { title_draft: "x" });
    await wired.draft(7);
    await wired.validateDraft(7);
    await wired.publish(7);
    await wired.archive(7);
    await wired.complete(7);
    await wired.favorite(7);
    await wired.unfavorite(7);
    await wired.remove(7);

    expect(server.calls.map((call) => `${call.method} ${call.url.replace(BASE, "")}`)).toEqual([
      "GET listings/",
      "GET listings/7/",
      "GET listings/7/status/",
      "GET listings/my/counters/",
      "GET listings/my/favorites/",
      "POST listings/",
      "POST listings/7/save-draft/",
      "GET listings/7/draft/",
      "GET listings/7/validate-draft/",
      "POST listings/7/publish/",
      "POST listings/7/archive/",
      "POST listings/7/complete/",
      "POST listings/7/favorite/",
      "POST listings/7/unfavorite/",
      "DELETE listings/7/",
    ]);
  });
});

describe("the runtime carries the deployment's knowledge", () => {
  it("defaults the ceilings to the library's and lets a host move them", () => {
    const plain = createListingsRuntime({ baseUrl: BASE });
    expect(plain.limits.descriptionMax).toBe(500);
    expect(plain.currency).toBe("RUB");
    const wide = createListingsRuntime({
      baseUrl: BASE,
      limits: { descriptionMax: 4000 },
      currency: "USD",
    });
    expect(wide.limits.descriptionMax).toBe(4000);
    // A partial override leaves the rest at the library defaults.
    expect(wide.limits.descriptionMin).toBe(4);
    expect(wide.currency).toBe("USD");
  });

  it("has no image resolver unless one is supplied", () => {
    expect(createListingsRuntime({ baseUrl: BASE }).resolveImage).toBeUndefined();
  });
});

describe("errors", () => {
  it("carries the whole registry with a remediation each", () => {
    // 69 as of stapel-listings 0.21.2, whose draft_meta sidecar has a size
    // ceiling: error.400.listing_draft_meta_too_large, with ru/es authored in
    // this pair (the module is locale-exempt upstream).
    // 68 as of stapel-listings 0.17.0: the contract-pin bump brought two
    // publish checks with it — error.400.listing_location_required and
    // error.400.listing_zero_price_not_allowed (a price of 0 is an empty
    // field, not "free"). 66 came from 0.10.0's
    // error.400.feature_invalid_rules; 65 from 0.9.0's
    // error.403.listing_anonymous_not_allowed.
    // The number is asserted rather than derived on purpose: a code that
    // vanishes from the registry is a contract change somebody should have to
    // notice, and a code that arrives without a ru/es sentence is caught by
    // the i18n suite next door — which is exactly how these two were found.
    expect(LISTINGS_ERROR_CODES.length).toBe(69);
    expect(LISTINGS_ERROR_CODES).toContain("error.400.feature_invalid_rules");
    expect(LISTINGS_ERROR_CODES).toContain(
      "error.400.listing_draft_meta_too_large"
    );
    expect(LISTINGS_ERROR_CODES).toContain("error.400.listing_location_required");
    expect(LISTINGS_ERROR_CODES).toContain(
      "error.400.listing_zero_price_not_allowed"
    );
    for (const code of LISTINGS_ERROR_CODES) {
      expect(explainListingsError(code)).toBeTruthy();
    }
  });

  it("answers undefined for a code this module does not own", () => {
    expect(explainListingsError("error.418.teapot")).toBeUndefined();
  });
});

describe("flows", () => {
  it("keeps the zero-flow shape stapel-listings declares", () => {
    // docs/flows.json is `[]`: the module annotates no @flow_step, and
    // submitting a listing is multi-step on the CLIENT only. Inventing a
    // funnel would be a frontend fiction in a machine-readable artifact.
    expect(Object.keys(LISTINGS_FLOWS)).toEqual([]);
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(listingsI18nBundleEn["listings.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerListingsI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["listings.error.unknown"]).toBeTruthy();
  });
});

describe("nav manifest (the pair's public surface)", () => {
  it("declares unique ids under the module namespace", () => {
    const ids = navEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("listings.")).toBe(true);
  });

  it("declares surface EXPLICITLY on every entry", () => {
    for (const entry of navEntries) expect(entry.surface).toBeDefined();
  });

  it("keeps the detail public and everything else behind a mandate", () => {
    // `/l/:id` is the page a shared link opens; a marketplace whose listing
    // page needs a session has no shop window.
    const bySurface = Object.fromEntries(
      navEntries.map((entry) => [entry.id, entry.surface])
    );
    expect(bySurface["listings.detail"]).toBe("public");
    expect(bySurface["listings.compose"]).toBe("member");
    expect(bySurface["listings.mine"]).toBe("member");
    expect(bySurface["listings.favorites"]).toBe("member");
  });

  it("claims no route for the CARD — a card is a slot, not a page", () => {
    expect(navEntries.map((entry) => entry.route.path)).toEqual([
      "/l/:id",
      "/new",
      "listings",
      "favorites",
    ]);
  });

  it("keeps the parameterized route out of the menu", () => {
    expect(
      navEntries.find((entry) => entry.id === "listings.detail")?.menuVisibleDefault
    ).toBe(false);
  });

  it("nests the cabinet entries under the container-owned account root", () => {
    // `account.root` belongs to no module — the cabinet has none — so the
    // container declares it and `resolveNav` drops an orphan rather than
    // throwing.
    for (const id of ["listings.mine", "listings.favorites"]) {
      const entry = navEntries.find((candidate) => candidate.id === id);
      expect(entry?.placement.level).toBe("submenu");
      expect(entry?.placement.parentId).toBe("account.root");
    }
  });

  it("every component it names is actually exported from ./default", async () => {
    // Otherwise the failure surfaces only when a container is assembled —
    // two weeks later, in somebody else's repository.
    const skin = (await import("../src/default/index.js")) as Record<string, unknown>;
    for (const entry of navEntries) {
      expect(entry.component.subpath).toBe("default");
      expect(skin[entry.component.export]).toBeTypeOf("function");
    }
  });

  it("labels every entry with a key the pair's own bundle carries", () => {
    for (const entry of navEntries) {
      expect(listingsI18nBundleEn[entry.labelKey]).toBeTruthy();
    }
  });

  it("matches the generated nav-manifest.json", () => {
    const emitted = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(emitted.package).toBe("@stapel/listings-react");
    expect(emitted.entries.map((entry: { id: string }) => entry.id)).toEqual(
      navEntries.map((entry) => entry.id)
    );
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/listings-react");
    expect(manifest.backend.module).toBe("stapel-listings");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("lists the WHOLE contract, including the two writes this pair declines", () => {
    // Nothing is hidden by the surface split: the manifest is the contract,
    // `ListingsApi` is this pair's slice of it.
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const ops = Object.keys(manifest.operations);
    expect(ops.length).toBeGreaterThanOrEqual(12);
    expect(ops.some((op) => op.toLowerCase().includes("partial_update"))).toBe(true);
  });
});

describe("the card the search slot receives", () => {
  it("carries its badges as a stored projection, slug and all", () => {
    // The schema's FeatureDao omits `slug`; the JSONField passes it through.
    expect(CARD.features_badges[0]).toHaveProperty("slug", "power");
    expect(CARD.features_badges[0]).toHaveProperty("postfix", "W");
  });
});
