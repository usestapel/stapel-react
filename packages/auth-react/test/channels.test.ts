/**
 * Pure unit coverage for the default skin's zone math (owner directive
 * tuning §54's pilot, points 1/3/4): `computeZones`'s two paths (plan-driven
 * vs the pre-0.6.0 fallback) and `resolveInteraction`'s modal/redirect
 * split. No React, no antd — see `../src/default/channels.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHANNEL_PRIORITY,
  computeZones,
  enabledChannels,
  resolveInteraction,
} from "../src/default/channels.js";
import type { ChannelId } from "../src/default/channels.js";
import type { LoginCapabilities } from "../src/api/types.js";

function caps(overrides: Partial<LoginCapabilities> = {}): LoginCapabilities {
  return {
    email: false,
    phone: false,
    password: false,
    oauth: [],
    sso: false,
    qr: false,
    passkey: false,
    magic_link: false,
    ...overrides,
  };
}

describe("enabledChannels", () => {
  it("keeps only enabled channels, in priority order", () => {
    const c = caps({ phone: true, email: true, sso: true });
    expect(enabledChannels(c)).toEqual(["email", "phone", "sso"]);
  });

  it("treats oauth as enabled iff at least one provider is configured", () => {
    const none = caps({ oauth: [] });
    const some = caps({ oauth: [{ id: "google", name: "Google" }] });
    expect(enabledChannels(none)).not.toContain("oauth");
    expect(enabledChannels(some)).toContain("oauth");
  });

  it("honours a custom priority override", () => {
    const c = caps({ email: true, phone: true });
    const custom: ChannelId[] = ["phone", "email"];
    expect(enabledChannels(c, custom)).toEqual(["phone", "email"]);
  });
});

describe("computeZones — no plan (pre-0.6.0 fallback)", () => {
  it("puts the first 3 non-SSO/OAuth channels in main, caps at 3", () => {
    const zones = computeZones(["email", "phone", "passkey", "qr", "password"]);
    expect(zones.main).toEqual(["email", "phone", "passkey"]);
  });

  it("NEVER puts sso or oauth in main, even when they'd be first by priority", () => {
    const zones = computeZones(["oauth", "sso", "email"]);
    expect(zones.main).not.toContain("oauth");
    expect(zones.main).not.toContain("sso");
    expect(zones.main).toEqual(["email"]);
  });

  it("routes oauth/qr/passkey overflow into the bottom icon row", () => {
    const zones = computeZones(["email", "phone", "passkey", "qr", "oauth"]);
    expect(zones.main).toEqual(["email", "phone", "passkey"]);
    expect(zones.bottom.sort()).toEqual(["oauth", "qr"].sort());
    expect(zones.overflow).toEqual([]);
  });

  it("routes everything else (password, magic_link, sso) to overflow", () => {
    const zones = computeZones(["email", "phone", "passkey", "password", "sso", "magic_link"]);
    expect(zones.overflow.sort()).toEqual(["magic_link", "password", "sso"].sort());
  });

  it("a single enabled channel is main with no bottom/overflow", () => {
    const zones = computeZones(["email"]);
    expect(zones).toEqual({ main: ["email"], bottom: [], overflow: [] });
  });

  it("matches DEFAULT_CHANNEL_PRIORITY's full list shape (regression anchor)", () => {
    const zones = computeZones(DEFAULT_CHANNEL_PRIORITY);
    expect(zones.main).toEqual(["email", "phone", "passkey"]);
    expect(zones.bottom.sort()).toEqual(["oauth", "qr"].sort());
    expect(zones.overflow.sort()).toEqual(["magic_link", "password", "sso"].sort());
  });
});

describe("computeZones — plan-driven (stapel-auth ≥0.6.0)", () => {
  it("places a channel per its explicit plan placement", () => {
    const zones = computeZones(["email", "password", "qr"], {
      email: { placement: "main" },
      password: { placement: "main" },
      qr: { placement: "overflow" },
    });
    expect(zones.main).toEqual(["email", "password"]);
    expect(zones.overflow).toEqual(["qr"]);
    expect(zones.bottom).toEqual([]);
  });

  it("clamps an explicit main placement for sso/oauth to bottom/overflow", () => {
    const zones = computeZones(["oauth", "sso", "email"], {
      oauth: { placement: "main" },
      sso: { placement: "main" },
    });
    expect(zones.main).not.toContain("oauth");
    expect(zones.main).not.toContain("sso");
    expect(zones.bottom).toContain("oauth");
    expect(zones.overflow).toContain("sso");
  });

  it("falls back to the per-channel default for a channel missing from a partial plan", () => {
    const zones = computeZones(["email", "qr"], {
      email: { placement: "main" },
      // qr absent from the plan — defaults to bottom, same as the no-plan path.
    });
    expect(zones.bottom).toEqual(["qr"]);
  });

  it("still caps main at 3 even if the plan sends more (skin-level guarantee)", () => {
    const zones = computeZones(["email", "phone", "password", "magic_link"], {
      email: { placement: "main" },
      phone: { placement: "main" },
      password: { placement: "main" },
      magic_link: { placement: "main" },
    });
    expect(zones.main).toHaveLength(3);
    expect(zones.overflow).toContain("magic_link");
  });
});

describe("resolveInteraction", () => {
  it("is always inline for main", () => {
    expect(resolveInteraction("email", "main")).toBe("inline");
  });

  it("defaults oauth to redirect (a direct provider link, no dialog)", () => {
    expect(resolveInteraction("oauth", "bottom")).toBe("redirect");
    expect(resolveInteraction("oauth", "overflow")).toBe("redirect");
  });

  it("defaults every other non-main channel to modal", () => {
    expect(resolveInteraction("qr", "bottom")).toBe("modal");
    expect(resolveInteraction("sso", "overflow")).toBe("modal");
    expect(resolveInteraction("password", "overflow")).toBe("modal");
  });

  it("an explicit plan interaction wins over the default (except a nonsensical inline-outside-main)", () => {
    expect(resolveInteraction("oauth", "overflow", "modal")).toBe("modal");
    expect(resolveInteraction("qr", "bottom", "redirect")).toBe("redirect");
    expect(resolveInteraction("qr", "bottom", "inline")).toBe("modal");
  });
});
