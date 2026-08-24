import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  createReviewsApi,
  createReviewsRuntime,
  DEFAULT_RATING_BOUNDS,
  findOwnReview,
  isModeratedOut,
  registerReviewsI18n,
  reviewsFromPages,
  reviewsI18nBundleEn,
  reviewsQueryKeys,
  reviewVisibility,
} from "../src/index.js";
import { mockServer } from "./harness.js";
import { FIRST_PAGE, SECOND_PAGE, TARGET, review } from "./fixtures.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root and keys on BOTH halves of the target", () => {
    expect(reviewsQueryKeys.all[0]).toBe("reviews");
    // target_key alone is not an identity: the module groups by the pair, and
    // two registries can key different things with the same opaque string.
    expect(reviewsQueryKeys.list(TARGET)).not.toEqual(
      reviewsQueryKeys.list({ targetType: "course", targetKey: "42" })
    );
  });

  it("puts the list and the aggregate under one invalidatable target root", () => {
    const root = reviewsQueryKeys.target(TARGET);
    expect(reviewsQueryKeys.list(TARGET).slice(0, root.length)).toEqual([...root]);
    expect(reviewsQueryKeys.aggregate(TARGET).slice(0, root.length)).toEqual([...root]);
  });
});

describe("the api surface covers the whole contract", () => {
  it("carries one method per endpoint stapel-reviews declares", () => {
    const api = createReviewsApi(
      createReviewsRuntime({ baseUrl: "/reviews/api/v1", fetch: mockServer({}).fetch })
        .client
    );
    // This assertion used to say the opposite — that `moderate` and `respond`
    // were deliberately absent because they belong to consoles the pair does
    // not ship. The consequence was that stapel-reviews' moderation queue and
    // the seller's single reply existed on no screen anywhere in the fleet.
    // The server is the authority (the can_moderate callback is fail-closed),
    // so what the client owes is not omission but a state-gated control.
    expect(Object.keys(api).sort()).toEqual([
      "aggregate",
      "client",
      "createReview",
      "moderate",
      "respond",
      "reviews",
    ]);
  });

  it("addresses one review by id, and escapes the id it was given", async () => {
    const server = mockServer({ "/moderate": { body: review() } });
    const runtime = createReviewsRuntime({
      baseUrl: "/reviews/api/v1",
      fetch: server.fetch,
    });
    await runtime.api.moderate("a b/c", { action: "hide", reason: "spam" });
    expect(server.calls[0]?.url).toContain("/reviews/a%20b%2Fc/moderate");
    expect(server.calls[0]?.method).toBe("POST");
    expect(server.calls[0]?.body).toEqual({ action: "hide", reason: "spam" });
  });

  it("spells an omitted moderation reason ONE way on the wire", async () => {
    const server = mockServer({ "/moderate": { body: review() } });
    const runtime = createReviewsRuntime({
      baseUrl: "/reviews/api/v1",
      fetch: server.fetch,
    });
    await runtime.api.moderate("r1", { action: "publish", reason: "" });
    expect(server.calls[0]?.body).toEqual({ action: "publish" });
  });

  it("addresses the aggregate and the list as two different paths", async () => {
    const server = mockServer({
      "/reviews/aggregate": { body: { avg: 0, count: 0 } },
      "/reviews": { body: FIRST_PAGE },
    });
    const runtime = createReviewsRuntime({
      baseUrl: "/reviews/api/v1",
      fetch: server.fetch,
    });
    await runtime.api.aggregate(TARGET);
    expect(server.calls[0]?.url).toContain("/reviews/aggregate?");
  });
});

describe("the deployment's rating bounds ride on the runtime", () => {
  it("defaults to stapel-reviews' own RATING_MIN/RATING_MAX", () => {
    const runtime = createReviewsRuntime({ baseUrl: "/reviews/api/v1" });
    expect(runtime.ratingBounds).toEqual(DEFAULT_RATING_BOUNDS);
    expect(DEFAULT_RATING_BOUNDS).toEqual({ min: 1, max: 5 });
  });

  it("takes a host's override, because those are settings and not constants", () => {
    const runtime = createReviewsRuntime({
      baseUrl: "/reviews/api/v1",
      ratingBounds: { max: 10 },
    });
    expect(runtime.ratingBounds.max).toBe(10);
    expect(runtime.ratingBounds.min).toBe(1);
  });
});

describe("pure readers over a loaded list", () => {
  it("answers `undefined` for 'not loaded', never an empty array", () => {
    expect(reviewsFromPages(undefined)).toBeUndefined();
    expect(
      reviewsFromPages({ pages: [FIRST_PAGE, SECOND_PAGE], pageParams: [] })
    ).toHaveLength(3);
  });

  it("narrows the three known states and NAMES a fourth", () => {
    expect(reviewVisibility("published")).toBe("published");
    expect(reviewVisibility("pending")).toBe("pending");
    expect(reviewVisibility("hidden")).toBe("hidden");
    expect(reviewVisibility("quarantined")).toBe("unknown");
    expect(isModeratedOut(review({ status: "hidden" }))).toBe(true);
    expect(isModeratedOut(review())).toBe(false);
  });

  it("finds the viewer's own review, and stays silent without a viewer id", () => {
    const rows = [review({ id: "a", author_id: "u1" }), review({ id: "b" })];
    expect(findOwnReview(rows, "u1")?.id).toBe("a");
    expect(findOwnReview(rows, "nobody")).toBeUndefined();
    expect(findOwnReview(rows, null)).toBeUndefined();
    expect(findOwnReview(undefined, "u1")).toBeUndefined();
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(reviewsI18nBundleEn["reviews.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerReviewsI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["reviews.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
      package: string;
      backend: { module: string; contract: string };
      layers: unknown;
    };
    expect(manifest.package).toBe("@stapel/reviews-react");
    expect(manifest.backend.module).toBe("stapel-reviews");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("declares no nav surface, because it has no screen of its own", () => {
    // reviews-react renders INSIDE somebody else's route: the listing detail
    // page and the public seller profile. A nav entry would put a "Reviews"
    // item in a menu that leads nowhere (the cdn-react precedent).
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports).not.toHaveProperty("./nav-manifest");
    expect(pkg.exports).not.toHaveProperty("./nav-manifest.json");
  });

  it("exports no target-type constant, because the registry ships empty", () => {
    // stapel-reviews' BUILTIN_TARGET_TYPES is {} and the host registers its
    // own names; "listing" belongs to the shop composite's preset, not here.
    const surface = readFileSync("src/index.ts", "utf8");
    expect(surface).not.toMatch(/TARGET_TYPE_LISTING|REVIEW_TARGET_LISTING/);
  });
});

describe("logout hook (frontend-core-architecture-v2 §43.7 — pair contract)", () => {
  it("registers a logout hook (no-op by default) on the active SessionManager", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const spy = vi.spyOn(manager, "registerLogoutHook");
    createReviewsRuntime({ baseUrl: "/reviews/api/v1" });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
