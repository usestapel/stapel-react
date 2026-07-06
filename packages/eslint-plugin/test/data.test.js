import { describe, it, expect } from "vitest";
import { loadTokenCatalog, loadI18nRegistry, __resetCaches } from "../lib/data.js";

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
});
