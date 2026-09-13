/**
 * THE IDENTITY DISC: the same person always gets the same tint, and the
 * initials on it are legible in both themes.
 *
 * WHAT THIS ASSERTS, and why in this shape.
 *
 * The contrast is computed as a RATIO BETWEEN THE TWO VALUES THE FUNCTION
 * ACTUALLY RETURNS — the disc and the ink of one call, never a token read
 * separately and paired with an assumed partner. That is deliberate and it is
 * this file's whole reason for existing in this form: a contrast claim with
 * one measured operand and one assumed one is the shape that passes a gate and
 * fails on screen. `identityTint()` hands over both halves in one object
 * precisely so a caller (and a test) cannot mix a measured half with a guess.
 *
 * The TOKEN is read for both algorithms out of antd itself, not restated here,
 * because the dark palette is DERIVED: the algorithm regenerates every preset
 * family, so a dark-mode claim made against the light token is a claim about a
 * colour nothing paints.
 *
 * WHAT IT CANNOT SEE: this file computes ratios over colour values, which is
 * arithmetic, not rendering. That the element actually PAINTS these two values
 * — that no class or algorithm derives a different shade between here and the
 * glass — is a browser fact, and it is proved in headless Chromium on the
 * rendered avatars of both packages that use this (see the changeset). The
 * disc's contrast against the PAGE is not asserted at all: it is 1.04:1 at its
 * worst and the module's header says so and says why the identity rides on the
 * initials instead.
 */
import { describe, expect, it } from "vitest";
import { theme as antdTheme } from "antd";
import type { GlobalToken } from "antd";
import {
  IDENTITY_TINT_FAMILIES,
  identityTint,
  identityTintFamily,
} from "../src/skin.js";

/** WCAG's relative luminance, and its ratio. The one formula, written once. */
function channels(hex: string): readonly [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((one) => `${one}${one}`)
          .join("")
      : raw;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as unknown as readonly [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  }) as unknown as readonly [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const hi = Math.max(first, second);
  const lo = Math.min(first, second);
  return (hi + 0.05) / (lo + 0.05);
}

/** The bar. Body text, both themes, every family. */
const AA = 4.5;

/** The two palettes an algorithm produces, read from antd rather than copied. */
const THEMES: Readonly<Record<string, GlobalToken>> = {
  light: antdTheme.getDesignToken(),
  dark: antdTheme.getDesignToken({ algorithm: antdTheme.darkAlgorithm }),
};

/** A key that lands on a named family, so every family can be exercised by a
 * real call rather than by reaching into the table. */
function keyFor(family: string): string {
  for (let n = 0; n < 5000; n += 1) {
    const key = `seed-${String(n)}`;
    if (identityTintFamily(key) === family) return key;
  }
  throw new Error(`no key hashes to ${family}`);
}

describe("the contrast of the formula itself", () => {
  it("proves the luminance maths on the two colours everybody knows", () => {
    // Black on white is 21:1 and a colour against itself is 1:1. Without this
    // the ratios below could all be wrong in the same direction and still
    // agree with each other.
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("initials are legible on their own disc", () => {
  for (const [themeName, token] of Object.entries(THEMES)) {
    it(`clears ${String(AA)}:1 for every family in the ${themeName} algorithm`, () => {
      const measured: string[] = [];
      for (const family of IDENTITY_TINT_FAMILIES) {
        const tint = identityTint(keyFor(family), token);
        expect(tint.family).toBe(family);
        // BOTH operands come out of the one call — the disc it returns and the
        // ink it returns. Neither is read from anywhere else.
        expect(tint.background).toMatch(/^#[0-9a-f]{6}$/i);
        expect(tint.color).toMatch(/^#[0-9a-f]{6}$/i);
        const ratio = contrast(tint.background, tint.color);
        measured.push(`${family} ${ratio.toFixed(2)}`);
        expect(ratio, `${themeName}/${family} = ${ratio.toFixed(2)}:1 (${measured.join(", ")})`)
          .toBeGreaterThanOrEqual(AA);
      }
      // All thirteen were actually measured — a loop that silently ran zero
      // times is the other way this assertion could mean nothing.
      expect(measured).toHaveLength(IDENTITY_TINT_FAMILIES.length);
    });
  }

  it("puts the dark algorithm's own palette on a dark page", () => {
    // If the dark arm were reading the light token, these would be identical
    // and the dark claim above would be about a colour nothing paints.
    const key = "same-person";
    const light = identityTint(key, THEMES.light as GlobalToken);
    const dark = identityTint(key, THEMES.dark as GlobalToken);
    expect(light.family).toBe(dark.family);
    expect(light.background).not.toBe(dark.background);
    expect(light.color).not.toBe(dark.color);
  });
});

describe("the tint is derived from the key and from nothing else", () => {
  it("gives one person the same tint however often it is asked", () => {
    const token = THEMES.light as GlobalToken;
    const first = identityTint("57e55075-6b60-4f9a-962e-38d9a6bd8389", token);
    for (let n = 0; n < 50; n += 1) {
      expect(identityTint("57e55075-6b60-4f9a-962e-38d9a6bd8389", token)).toEqual(first);
    }
    // …and it does not depend on what was asked before it: the order of a
    // list must not decide a face's colour.
    identityTint("someone-else", token);
    identityTint("a-third-person", token);
    expect(identityTint("57e55075-6b60-4f9a-962e-38d9a6bd8389", token)).toEqual(first);
  });

  it("spreads a realistic set of ids over the whole palette", () => {
    // Distinguishable in practice, not merely in principle: thirty ids must
    // not all land on two colours.
    const seen = new Set(
      Array.from({ length: 30 }, (_, n) => identityTintFamily(`user-${String(n)}`))
    );
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it("is stable arithmetic, not a moving implementation detail", () => {
    // Pinned: the same person must wear the same colour in the next release.
    // If this changes, every avatar on every deployment changes with it.
    expect(identityTintFamily("57e55075-6b60-4f9a-962e-38d9a6bd8389")).toBe("blue");
    expect(identityTintFamily("")).toBe(identityTintFamily(""));
  });
});
