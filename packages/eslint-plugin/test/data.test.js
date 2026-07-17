import { describe, it, expect } from "vitest";
import {
  loadTokenCatalog,
  loadI18nRegistry,
  loadOperationCatalog,
  loadReservedPathCatalog,
  __resetCaches,
} from "../lib/data.js";

describe("data layer reads generated manifests dynamically", () => {
  it("loads the real @stapel/tokens catalog (not a hardcoded list)", () => {
    __resetCaches();
    const catalog = loadTokenCatalog();
    expect(catalog.loaded).toBe(true);
    // Values that exist because they are in theme.default.json, proving the
    // catalog is read from the generated manifest, not baked into the rule.
    expect(catalog.hasToken("brand")).toBe(true);
    expect(catalog.hasToken("surface")).toBe(true);
    expect(catalog.hasToken("text")).toBe(true);
    expect(catalog.hasRamp("gray")).toBe(true);
    expect(catalog.hasRamp("brand")).toBe(true);
    // A made-up token is absent.
    expect(catalog.hasToken("totally-made-up-token")).toBe(false);
  });

  it("honours a settings override without touching the filesystem", () => {
    const catalog = loadTokenCatalog({
      tokensManifest: { tokens: { core: ["only-this"] }, ramps: { names: ["z"] } },
    });
    expect(catalog.hasToken("only-this")).toBe(true);
    expect(catalog.hasToken("brand")).toBe(false);
    expect(catalog.hasRamp("z")).toBe(true);
  });

  it("discovers workspace i18n keys and derives managed namespaces", () => {
    __resetCaches();
    const registry = loadI18nRegistry();
    // auth-react's manifest ships i18nKeys under the auth.* / error.* / flow.*
    // namespaces — discovered by walking the workspace.
    expect(registry.loaded).toBe(true);
    expect(registry.has("auth.otp.enter_code")).toBe(true);
    expect(registry.manages("auth.made.up")).toBe(true); // managed namespace
    expect(registry.manages("randomhost.key")).toBe(false); // app-local
  });

  it("discovers workspace operation paths from manifest.operations", () => {
    __resetCaches();
    const catalog = loadOperationCatalog();
    // auth-react's manifest ships /auth/api/v1/… operation paths — discovered by
    // walking the workspace, not baked into the rule.
    expect(catalog.loaded).toBe(true);
    expect(catalog.matches("/auth/api/v1/me/")).toBe(true);
    // A client-relative literal matches by trailing-segment suffix and resolves
    // to the catalogued operation id.
    expect(catalog.matches("/me/")).toBe(true);
    expect(catalog.resolve("/me/")?.operation).toBeTruthy();
    // A route path that is not an API operation is absent.
    expect(catalog.matches("/sign-in")).toBe(false);
  });

  it("honours an operation-paths settings override without the filesystem", () => {
    const catalog = loadOperationCatalog({ operationPaths: ["/x/api/thing/"] });
    expect(catalog.matches("/x/api/thing/")).toBe(true);
    expect(catalog.matches("/thing/")).toBe(true);
    expect(catalog.matches("/auth/api/me/")).toBe(false);
  });

  it("degrades to a no-op when reserved-paths.json is absent (never crashes)", () => {
    __resetCaches();
    // No reserved-paths.json exists at the workspace root yet (stapel-tools'
    // generator emits it) — the catalog must come back empty, not throw.
    const catalog = loadReservedPathCatalog();
    expect(catalog.loaded).toBe(false);
    expect(catalog.matches("/admin")).toBeNull();
  });

  it("honours a reserved-paths settings override without the filesystem", () => {
    const catalog = loadReservedPathCatalog({
      reservedPaths: ["/admin", "/calendar/api"],
    });
    expect(catalog.loaded).toBe(true);
    // Bare module root is NOT reserved — only its sub-path is.
    expect(catalog.matches("/calendar")).toBeNull();
    expect(catalog.matches("/calendar/api")).toBe("/calendar/api");
    expect(catalog.matches("/calendar/api/x")).toBe("/calendar/api");
    expect(catalog.matches("/admin")).toBe("/admin");
  });
});
