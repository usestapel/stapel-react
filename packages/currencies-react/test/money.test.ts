import { describe, expect, it } from "vitest";
import {
  catalogOf,
  convert,
  crossRate,
  formatMoney,
  formatRate,
  isValidAmount,
  minorUnitsOf,
  parseDecimal,
  quantize,
  formatDecimal,
} from "../src/model/money.js";
import type { Currency } from "../src/api/types.js";

/**
 * Parity with the server, case for case.
 *
 * The fixtures below are `stapel-currencies/tests/test_convert.py`'s own —
 * base EUR, USD 1.08, GBP 0.85 — because a money converter that agrees with
 * itself proves nothing. If the client rounds a cross-rate one way and
 * `services.convert` the other, a listing's price changes when the buyer
 * reaches checkout, and only one of the two numbers is the one that is charged.
 */
const row = (code: string, value: string, symbol = ""): Currency => ({
  code,
  display_name: `currency.${code.toLowerCase()}`,
  value,
  symbol,
  is_active: true,
});

const EUR_BASE = catalogOf([row("EUR", "1"), row("USD", "1.08"), row("GBP", "0.85")]);
const opts = { base: "EUR", places: 2 };

describe("decimal parsing (floats never)", () => {
  it("round-trips a decimal string", () => {
    expect(formatDecimal(parseDecimal("1500.10") as never)).toBe("1500.10");
  });

  it("refuses what is not a decimal string", () => {
    for (const bad of ["", "1e3", "1 500", "abc", "1,5", "--1"]) {
      expect(parseDecimal(bad), bad).toBeUndefined();
      expect(isValidAmount(bad), bad).toBe(false);
    }
  });

  it("keeps precision a double would lose", () => {
    // 9007199254740993 is the first integer Number cannot represent.
    expect(formatDecimal(parseDecimal("9007199254740993.01") as never)).toBe(
      "9007199254740993.01"
    );
  });

  it("quantizes ROUND_HALF_UP — ties away from zero, not to even", () => {
    expect(formatDecimal(quantize(parseDecimal("0.005") as never, 2))).toBe("0.01");
    expect(formatDecimal(quantize(parseDecimal("0.015") as never, 2))).toBe("0.02");
    expect(formatDecimal(quantize(parseDecimal("-0.005") as never, 2))).toBe("-0.01");
  });
});

describe("convert — parity with services.convert", () => {
  it("base to currency", () => {
    expect(convert("100", "EUR", "USD", EUR_BASE, opts)).toBe("108.00");
  });

  it("currency to base", () => {
    expect(convert("108", "USD", "EUR", EUR_BASE, opts)).toBe("100.00");
  });

  it("cross rate, non-base to non-base", () => {
    // 100 USD -> 92.592... EUR -> 78.7037... GBP -> 78.70
    expect(convert("100", "USD", "GBP", EUR_BASE, opts)).toBe("78.70");
  });

  it("cross rate, reversed", () => {
    expect(convert("100", "GBP", "USD", EUR_BASE, opts)).toBe("127.06");
  });

  it("same currency is identity, quantized", () => {
    expect(convert("10.567", "USD", "USD", EUR_BASE, opts)).toBe("10.57");
  });

  it("rounds half up at the quantize step", () => {
    const catalog = catalogOf([row("EUR", "1"), row("GBP", "0.005")]);
    expect(convert("1", "EUR", "GBP", catalog, opts)).toBe("0.01");
  });

  it("honours CONVERSION_DECIMAL_PLACES", () => {
    expect(convert("100", "USD", "GBP", EUR_BASE, { base: "EUR", places: 4 })).toBe(
      "78.7037"
    );
    expect(convert("100", "USD", "GBP", EUR_BASE, { base: "EUR", places: 0 })).toBe("79");
  });

  it("reads the base from options, not from the base row's stored value", () => {
    // Base USD: the USD row's own `value` is deliberately drifted to 5 and must
    // be ignored — the base converts at 1 by definition (Currency.to_base).
    const usdBase = catalogOf([row("USD", "5"), row("EUR", "0.93")]);
    expect(convert("100", "USD", "EUR", usdBase, { base: "USD", places: 2 })).toBe(
      "93.00"
    );
    expect(convert("93", "EUR", "USD", usdBase, { base: "USD", places: 2 })).toBe(
      "100.00"
    );
  });

  it("uses 8-decimal rates without going through a double", () => {
    const catalog = catalogOf([row("USD", "1.00000000"), row("RUB", "92.59000000")]);
    expect(convert("1500.00", "USD", "RUB", catalog, { base: "USD", places: 2 })).toBe(
      "138885.00"
    );
  });
});

describe("convert — the absence of a rate is not a rate", () => {
  it("returns undefined for an unknown source", () => {
    expect(convert("1", "ZZZ", "EUR", EUR_BASE, opts)).toBeUndefined();
  });

  it("returns undefined for an unknown target", () => {
    expect(convert("1", "EUR", "ZZZ", EUR_BASE, opts)).toBeUndefined();
  });

  it("returns undefined for an unknown currency converted to itself", () => {
    expect(convert("1", "ZZZ", "ZZZ", EUR_BASE, opts)).toBeUndefined();
  });

  it("returns undefined for an amount that is not a decimal string", () => {
    expect(convert("1 500", "EUR", "USD", EUR_BASE, opts)).toBeUndefined();
  });

  it("returns undefined for a zero rate rather than dividing by it", () => {
    const broken = catalogOf([row("EUR", "1"), row("XAU", "0")]);
    expect(convert("1", "XAU", "EUR", broken, opts)).toBeUndefined();
  });

  it("is case-insensitive about codes", () => {
    expect(convert("100", "eur", "usd", EUR_BASE, opts)).toBe("108.00");
  });
});

describe("crossRate", () => {
  it("gives a rate more places than a price, so a small currency is not 0.00", () => {
    const catalog = catalogOf([row("USD", "1"), row("HUF", "365.74")]);
    expect(crossRate("HUF", "USD", catalog, { base: "USD", places: 2 })).toBe("0.0027");
  });
});

describe("formatMoney — the locale is the point", () => {
  it("formats the same amount three different ways", () => {
    expect(formatMoney("1234.5", "USD", { locale: "en-US" })).toBe("$1,234.50");
    // es-ES does NOT group a four-digit integer (1234,50 — no thousands dot)
    // and puts the symbol after the number: exactly the kind of rule a template
    // literal gets wrong and Intl gets right. Non-breaking spaces vary by ICU
    // build, so the assertions match digits and separators, not whitespace.
    expect(formatMoney("1234.5", "USD", { locale: "es-ES" })).toMatch(/^1234,50\s?US\$$/);
    expect(formatMoney("1234.5", "RUB", { locale: "ru-RU" })).toMatch(/1\s?234,50/);
  });

  it("puts the symbol where the locale puts it", () => {
    expect(formatMoney("10", "EUR", { locale: "en-US" }).startsWith("€")).toBe(true);
    expect(formatMoney("10", "EUR", { locale: "ru-RU" }).endsWith("€")).toBe(true);
  });

  it("honours symbolDisplay", () => {
    expect(formatMoney("10", "USD", { locale: "en-US", symbolDisplay: "code" })).toMatch(
      /USD/
    );
  });

  it("uses the currency's own minor units", () => {
    expect(formatMoney("1234", "JPY", { locale: "en-US" })).toBe("¥1,234");
    expect(minorUnitsOf("JPY")).toBe(0);
    expect(minorUnitsOf("USD")).toBe(2);
  });

  it("falls back to the catalogue's symbol when Intl refuses the code", () => {
    // A host-seeded non-ISO token: Intl throws RangeError on anything that is
    // not three ASCII letters, and a price must still render.
    const shown = formatMoney("1234.5", "PTS1", {
      locale: "en-US",
      fallbackSymbol: "✦",
    });
    expect(shown).toContain("✦");
    expect(shown).toContain("1,234.50");
  });

  it("falls back to the code itself when there is no symbol either", () => {
    expect(formatMoney("10", "PTS1", { locale: "en-US" })).toContain("PTS1");
  });

  it("prefers the catalogue's glyph where the locale has no symbol of its own", () => {
    // en-US has no ₽: Intl renders the ISO code for RUB while rendering € for
    // euros, so one screen printed `€1,500.00` beside `RUB 1,500.00`. The
    // catalogue carries the glyph; the LOCALE still decides the slot.
    const shown = formatMoney("1500", "RUB", { locale: "en-US", fallbackSymbol: "₽" });
    expect(shown).toContain("₽");
    expect(shown).not.toContain("RUB");
    expect(shown).toContain("1,500.00");
  });

  it("leaves a glyph Intl already knows alone", () => {
    expect(formatMoney("10", "EUR", { locale: "en-US", fallbackSymbol: "E" })).toBe(
      "€10.00"
    );
  });

  it("still spells the code when the caller asked for the code", () => {
    expect(
      formatMoney("1500", "RUB", {
        locale: "en-US",
        symbolDisplay: "code",
        fallbackSymbol: "₽",
      })
    ).toContain("RUB");
  });

  it("returns an amount it cannot parse verbatim rather than inventing one", () => {
    expect(formatMoney("about ten", "USD", { locale: "en-US" })).toBe("about ten");
  });

  it("has no minor units for a code Intl does not know", () => {
    expect(minorUnitsOf("PTS1")).toBeUndefined();
  });
});

describe("formatRate — a rate is read, not stored", () => {
  it("trims the wire's Decimal(20, 8) to places a person reads", () => {
    expect(formatRate("92.59000000", { locale: "en-US" })).toBe("92.59");
    expect(formatRate("1.00000000", { locale: "en-US" })).toBe("1.00");
    expect(formatRate("0.93000000", { locale: "en-US" })).toBe("0.93");
  });

  it("keeps four places where the rate needs them, and groups", () => {
    expect(formatRate("0.00270000", { locale: "en-US" })).toBe("0.0027");
    expect(formatRate("1234.50000000", { locale: "en-US" })).toBe("1,234.50");
  });

  it("is the locale's grouping, not en's", () => {
    expect(formatRate("1234.50000000", { locale: "ru-RU" })).toMatch(/1\s?234,50/);
  });

  it("attaches no currency token — a ratio is not an amount of money", () => {
    expect(formatRate("92.59000000", { locale: "en-US" })).not.toMatch(/[$€₽]/);
  });

  it("returns a value it cannot parse verbatim", () => {
    expect(formatRate("n/a", { locale: "en-US" })).toBe("n/a");
  });
});
