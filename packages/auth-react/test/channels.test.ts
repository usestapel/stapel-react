/**
 * Pure unit coverage for the default skin's zone math (owner directive
 * tuning §54's pilot, points 1/3/4; stapel-auth 0.6.0's `AuthCapabilities.
 * methods`): `computeZones`'s methods-driven placement, its hard error when
 * `methods[]` is missing/empty on a non-empty channel list (alpha-canon: no
 * supported older backend), and `resolveInteraction`'s modal/redirect split.
 * No React, no antd — see `../src/default/channels.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHANNEL_PRIORITY,
  computeZones,
  enabledChannels,
  enabledRegistrationChannels,
  methodCapabilityLabel,
  methodIconSvg,
  methodInteraction,
  resolveInteraction,
} from "../src/default/channels.js";
import type { ChannelId } from "../src/default/channels.js";
import { AUTH_I18N_KEYS } from "../src/i18n/keys.js";
import type { AuthMethodInfo, ChannelInteraction, ChannelPlacement, LoginCapabilities } from "../src/api/types.js";

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

function method(
  id: ChannelId,
  placement: ChannelPlacement,
  order: number,
  interaction: ChannelInteraction = placement === "main" ? "inline" : id === "oauth" ? "redirect" : "modal",
  opts: { can_login?: boolean; can_register?: boolean } = {}
): AuthMethodInfo {
  return {
    id,
    enabled: true,
    placement,
    order,
    interaction,
    icon_svg: `<svg data-id="${id}"/>`,
    can_login: opts.can_login ?? true,
    can_register: opts.can_register ?? false,
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

describe("computeZones — missing methods[] is a hard config error (alpha-canon: no old backends)", () => {
  it("throws when methods[] is entirely absent and there are enabled channels", () => {
    expect(() => computeZones(["email", "phone"])).toThrow(/stapel-auth 0.6.0/);
  });

  it("throws when methods[] is an empty array and there are enabled channels", () => {
    expect(() => computeZones(["email"], [])).toThrow(/stapel-auth 0.6.0/);
  });

  it("does NOT throw when the channel list itself is empty (e.g. capabilities still loading)", () => {
    expect(computeZones([])).toEqual({ main: [], bottom: [], overflow: [] });
    expect(computeZones([], [])).toEqual({ main: [], bottom: [], overflow: [] });
  });
});

describe("computeZones — methods-driven (stapel-auth ≥0.6.0)", () => {
  it("places a channel per its explicit methods[] placement, ordered by `order`", () => {
    const zones = computeZones(
      ["email", "password", "qr"],
      [method("password", "main", 1), method("email", "main", 0), method("qr", "overflow", 0)]
    );
    expect(zones.main).toEqual(["email", "password"]);
    expect(zones.overflow).toEqual(["qr"]);
    expect(zones.bottom).toEqual([]);
  });

  it("clamps an explicit main placement for sso/oauth to their fixed defaults (bottom)", () => {
    const zones = computeZones(
      ["oauth", "sso", "email"],
      [method("oauth", "main", 0), method("sso", "main", 1), method("email", "main", 0)]
    );
    expect(zones.main).not.toContain("oauth");
    expect(zones.main).not.toContain("sso");
    expect(zones.bottom).toContain("oauth");
    expect(zones.bottom).toContain("sso");
  });

  it("does NOT clamp qr (or any channel other than oauth/sso) — an explicit main placement is honoured", () => {
    const zones = computeZones(
      ["email", "qr"],
      [method("email", "main", 0), method("qr", "main", 1)]
    );
    expect(zones.main).toEqual(["email", "qr"]);
    expect(zones.bottom).toEqual([]);
  });

  it("falls back to DEFAULT_PLACEMENT for a channel missing from a partial methods[] list", () => {
    const zones = computeZones(["email", "qr"], [method("email", "main", 0)]);
    // qr absent from methods[] — defaults to bottom (DEFAULT_PLACEMENT's fallback).
    expect(zones.bottom).toEqual(["qr"]);
  });

  it("still caps main at 3 even if methods[] sends more (skin-level guarantee)", () => {
    const zones = computeZones(
      ["email", "phone", "password", "magic_link"],
      [
        method("email", "main", 0),
        method("phone", "main", 1),
        method("password", "main", 2),
        method("magic_link", "main", 3),
      ]
    );
    expect(zones.main).toHaveLength(3);
    expect(zones.overflow).toContain("magic_link");
  });

  it("matches DEFAULT_CHANNEL_PRIORITY's full list shape when methods[] mirrors DEFAULT_PLACEMENT (regression anchor)", () => {
    const methods = DEFAULT_CHANNEL_PRIORITY.map((id, i) =>
      method(
        id,
        id === "email" || id === "phone"
          ? "main"
          : id === "password" || id === "magic_link"
            ? "overflow"
            : "bottom",
        i
      )
    );
    const zones = computeZones(DEFAULT_CHANNEL_PRIORITY, methods);
    expect(zones.main).toEqual(["email", "phone"]);
    expect(zones.bottom.sort()).toEqual(["oauth", "passkey", "qr", "sso"].sort());
    expect(zones.overflow.sort()).toEqual(["magic_link", "password"].sort());
  });
});

describe("methodIconSvg / methodInteraction", () => {
  it("look up a channel's descriptor from methods[] by id", () => {
    const methods = [method("email", "main", 0), method("qr", "bottom", 0, "modal")];
    expect(methodIconSvg("email", methods)).toBe('<svg data-id="email"/>');
    expect(methodInteraction("qr", methods)).toBe("modal");
  });

  it("return undefined for a missing channel or absent methods[]", () => {
    expect(methodIconSvg("email", undefined)).toBeUndefined();
    expect(methodInteraction("email", [])).toBeUndefined();
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

  it("an explicit methods[] interaction wins over the default (except a nonsensical inline-outside-main)", () => {
    expect(resolveInteraction("oauth", "overflow", "modal")).toBe("modal");
    expect(resolveInteraction("qr", "bottom", "redirect")).toBe("redirect");
    expect(resolveInteraction("qr", "bottom", "inline")).toBe("modal");
  });
});

describe("enabledRegistrationChannels", () => {
  it("keeps only can_register===true channels, in priority order", () => {
    const methods = [
      method("email", "main", 0, "inline", { can_register: true }),
      method("phone", "main", 1, "inline", { can_register: true }),
      method("password", "overflow", 7, "modal", { can_register: false }),
      method("passkey", "bottom", 2, "modal", { can_register: false }),
      method("qr", "bottom", 5, "modal", { can_register: false }),
      method("magic_link", "overflow", 6, "modal", { can_register: false }),
      method("oauth", "bottom", 3, "redirect", { can_register: true }),
      method("sso", "bottom", 4, "redirect", { can_register: false }),
    ];
    expect(enabledRegistrationChannels(methods)).toEqual(["email", "phone", "oauth"]);
  });

  it("never includes passkey/qr/magic_link even if a method entry is missing (no can_register data at all)", () => {
    expect(enabledRegistrationChannels(undefined)).toEqual([]);
    expect(enabledRegistrationChannels([])).toEqual([]);
  });

  it("honours a custom priority override", () => {
    const methods = [
      method("email", "main", 0, "inline", { can_register: true }),
      method("phone", "main", 1, "inline", { can_register: true }),
    ];
    expect(enabledRegistrationChannels(methods, ["phone", "email"])).toEqual(["phone", "email"]);
  });

  it("NEVER includes password even when the backend sends can_register:true (THE IDENTITY MODEL — password is a credential, not an anchor; it does not deanonymize)", () => {
    const methods = [method("password", "overflow", 7, "modal", { can_register: true })];
    expect(enabledRegistrationChannels(methods)).toEqual([]);
  });

  it("keeps the anchor channels and drops a non-anchor even when both claim can_register", () => {
    const methods = [
      method("email", "main", 0, "inline", { can_register: true }),
      method("password", "overflow", 7, "modal", { can_register: true }),
      method("oauth", "bottom", 3, "redirect", { can_register: true }),
    ];
    expect(enabledRegistrationChannels(methods)).toEqual(["email", "oauth"]);
  });

  it("HONOURS a custom anchor set that opts password in (90s-style login/password deployment)", () => {
    const methods = [
      method("email", "main", 0, "inline", { can_register: true }),
      method("password", "overflow", 7, "modal", { can_register: true }),
    ];
    // Deployment wires this from its app env + backend AUTH_PASSWORD_DEANONYMIZES.
    expect(
      enabledRegistrationChannels(methods, DEFAULT_CHANNEL_PRIORITY, ["email", "password"])
    ).toEqual(["email", "password"]);
    // Still gated by can_register: a custom anchor the backend hasn't enabled
    // for registration does not appear.
    expect(
      enabledRegistrationChannels(
        [method("password", "overflow", 7, "modal", { can_register: false })],
        DEFAULT_CHANNEL_PRIORITY,
        ["password"]
      )
    ).toEqual([]);
  });
});

describe("methodCapabilityLabel", () => {
  it("returns undefined when the method isn't in methods[]", () => {
    expect(methodCapabilityLabel("email", [], false)).toBeUndefined();
    expect(methodCapabilityLabel("email", undefined, false)).toBeUndefined();
  });

  it("both login and register -> secMethodCapBoth", () => {
    const methods = [method("email", "main", 0, "inline", { can_login: true, can_register: true })];
    expect(methodCapabilityLabel("email", methods, false)).toBe(AUTH_I18N_KEYS.secMethodCapBoth);
  });

  it("register only -> secMethodCapRegister", () => {
    const methods = [method("oauth", "bottom", 3, "redirect", { can_login: false, can_register: true })];
    expect(methodCapabilityLabel("oauth", methods, false)).toBe(AUTH_I18N_KEYS.secMethodCapRegister);
  });

  it("login only, non-anonymous viewer -> secMethodCapLogin", () => {
    const methods = [method("passkey", "bottom", 2, "modal", { can_login: true, can_register: false })];
    expect(methodCapabilityLabel("passkey", methods, false)).toBe(AUTH_I18N_KEYS.secMethodCapLogin);
  });

  it("password + anonymous viewer -> secMethodCapPortableAnon, overriding the generic label", () => {
    const methods = [method("password", "overflow", 7, "modal", { can_login: true, can_register: true })];
    expect(methodCapabilityLabel("password", methods, true)).toBe(
      AUTH_I18N_KEYS.secMethodCapPortableAnon
    );
  });

  it("password + non-anonymous viewer gets the generic label, not the portable-anon framing", () => {
    const methods = [method("password", "overflow", 7, "modal", { can_login: true, can_register: false })];
    expect(methodCapabilityLabel("password", methods, false)).toBe(AUTH_I18N_KEYS.secMethodCapLogin);
  });

  it("a non-password channel + anonymous viewer is unaffected by the portable-anon special case", () => {
    const methods = [method("email", "main", 0, "inline", { can_login: true, can_register: true })];
    expect(methodCapabilityLabel("email", methods, true)).toBe(AUTH_I18N_KEYS.secMethodCapBoth);
  });

  it("neither login nor register -> undefined (nothing meaningful to show)", () => {
    const methods = [method("qr", "bottom", 5, "modal", { can_login: false, can_register: false })];
    expect(methodCapabilityLabel("qr", methods, false)).toBeUndefined();
  });
});
