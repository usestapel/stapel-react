import { describe, it, expect } from "vitest";
import {
  loadTokenCatalog,
  loadI18nRegistry,
  loadOperationCatalog,
  __resetCaches,
} from "../lib/data.js";

describe("data layer reads generated manifests dynamically", () => {
  it("loads the real @stapel/tokens catalog (not a hardcoded list)", () => {
    __resetCaches();
    const catalog = loadTokenCatalog();
    expect(catalog.loaded).toBe(true);
    // Values that exist because they are in theme.default.json, proving the
    // catalog is read from the generated manifest, not baked into the rule.
    expect(catalog.hasToken("accent")).toBe(true);
    expect(catalog.hasToken("background-primary")).toBe(true);
    expect(catalog.hasToken("button-primary-bg")).toBe(true);
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
    expect(catalog.hasToken("accent")).toBe(false);
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
    // auth-react's manifest ships /auth/api/… operation paths — discovered by
    // walking the workspace, not baked into the rule.
    expect(catalog.loaded).toBe(true);
    expect(catalog.matches("/auth/api/me/")).toBe(true);
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
});
