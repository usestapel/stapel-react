import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROOT_ID,
  ADMIN_ROOT_ID,
  gdprQueryKeys,
  gdprI18nBundleEn,
  navEntries,
  registerGdprI18n,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(gdprQueryKeys.all[0]).toBe("gdpr");
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(gdprI18nBundleEn["gdpr.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerGdprI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["gdpr.error.unknown"]).toBeTruthy();
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    // vitest runs from the package root, so a cwd-relative path is stable
    // across node/jsdom (jsdom's import.meta.url is not a file:// URL).
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/gdpr-react");
    expect(manifest.backend.module).toBe("stapel-gdpr");
    // backend.contract (gen:manifest ← MANIFEST_BACKEND_PYPROJECT): the semver
    // range this surface was generated against — a backend minor bump reddens
    // the drift gate (frontend-core §2.4 / §3.4.2).
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });

  it("the manifest lists the whole contract, including what the pair does not call", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    const paths = Object.values(manifest.operations as Record<string, { path: string }>)
      .map((op) => op.path);
    // The service-only part-ready hook is NOT in `GdprApi` (a browser holds no
    // service credential) — but it IS in the contract, and the manifest is the
    // contract's record, not the client's.
    expect(paths.some((path) => path.includes("/internal/export/"))).toBe(true);
  });
});

describe("navigation contract", () => {
  it("declares three screens: the person's, the stranger's, and the operator's", () => {
    expect(navEntries.length).toBe(3);
    const ids = navEntries.map((entry) => entry.id);
    expect(ids).toEqual([
      "account.privacy",
      "public.privacy-request",
      "admin.privacy",
    ]);
  });

  it("hangs each signed-in entry off the container-owned parent for its area", () => {
    expect(navEntries[0]?.placement).toEqual({
      level: "submenu",
      parentId: ACCOUNT_ROOT_ID,
    });
    expect(navEntries[2]?.placement).toEqual({
      level: "submenu",
      parentId: ADMIN_ROOT_ID,
    });
    // Neither parent is declared by this pair: `resolveNav` drops an orphaned
    // submenu entry rather than throwing, so a host with no admin area gets a
    // smaller menu instead of a broken build.
    expect(ACCOUNT_ROOT_ID).toBe("account.root");
    expect(ADMIN_ROOT_ID).toBe("admin.root");
  });

  it("puts the public intake at the top level — it hangs under no section", () => {
    // A person with no session has no account menu and no admin area to nest
    // under, so a submenu placement would be an entry with an unreachable
    // parent. `top` is what "reachable without signing in" looks like in the
    // placement axis.
    expect(navEntries[1]?.placement).toEqual({ level: "top" });
    expect(navEntries[1]?.placement.parentId).toBeUndefined();
  });

  it("names components that the matching subpath actually exports", async () => {
    const member = (await import("../src/default/index.js")) as Record<
      string,
      unknown
    >;
    const admin = (await import("../src/default/admin/index.js")) as Record<
      string,
      unknown
    >;
    expect(navEntries[0]?.component.subpath).toBe("default");
    expect(member[navEntries[0]?.component.export ?? ""]).toBeTypeOf("function");
    expect(navEntries[1]?.component.subpath).toBe("default");
    expect(member[navEntries[1]?.component.export ?? ""]).toBeTypeOf("function");
    expect(navEntries[2]?.component.subpath).toBe("default/admin");
    expect(admin[navEntries[2]?.component.export ?? ""]).toBeTypeOf("function");
  });

  it("declares its surface explicitly — the axis cannot say 'staff'", () => {
    // `NavSurface` is `public | member`. The admin screen is `member` because
    // that is the truest available answer, and the DSAR queue behind it answers
    // error.403.forbidden to a signed-in person who is not staff — which the
    // pane names on screen. Leaving the axis to the
    // `requiresAuth ? "member" : "public"` derivation would make that silently
    // change the day somebody edited requiresAuth for an unrelated reason.
    for (const entry of navEntries) {
      const isPublic = entry.id === "public.privacy-request";
      expect(entry.surface).toBe(isPublic ? "public" : "member");
      expect(entry.requiresAuth).toBe(!isPublic);
    }
  });

  it("mounts the anonymous intake as a ROUTE, not as a menu item", () => {
    // The whole reason it was left out before: listing it would put "make a
    // data-protection request" in a signed-in person's menu twice, the second
    // one pointing at a form asking for the email the session already knows.
    // The route is what was actually missing.
    const intake = navEntries[1];
    expect(intake?.menuVisibleDefault).toBe(false);
    expect(intake?.route.path).toBe("privacy-request");
    // Every OTHER entry is a menu item, so this is a decision, not a default.
    expect(navEntries[0]?.menuVisibleDefault).toBe(true);
    expect(navEntries[2]?.menuVisibleDefault).toBe(true);
  });

  it("keeps the destructive screen last in the account menu", () => {
    // Account settings put "delete my account" at the bottom for the same
    // reason this entry carries a high order: nobody should meet it first.
    expect(navEntries[0]?.order).toBeGreaterThan(navEntries[2]?.order ?? 0);
  });

  it("labels every entry with a KEY that both bundles carry, never a literal", async () => {
    const { gdprI18nBundleRu } = await import("../src/i18n/ru.js");
    const { gdprI18nBundleEs } = await import("../src/i18n/es.js");
    for (const entry of navEntries) {
      expect(entry.labelKey.startsWith("gdpr.")).toBe(true);
      expect(gdprI18nBundleEn[entry.labelKey]).toBeTruthy();
      expect(gdprI18nBundleRu[entry.labelKey]).toBeTruthy();
      expect(gdprI18nBundleEs[entry.labelKey]).toBeTruthy();
    }
  });

  it("the generated nav-manifest.json matches the source of truth", () => {
    const generated = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(generated.package).toBe("@stapel/gdpr-react");
    expect(generated.entries).toEqual(navEntries);
  });
});
