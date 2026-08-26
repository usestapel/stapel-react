import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  createFormat,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  toDate,
  useFormat,
} from "../src/i18n/format.js";
import { I18nProvider, createI18n } from "../src/i18n.js";
import type { I18nEngine } from "../src/i18n.js";

const NOW = new Date("2026-08-24T12:00:00Z");

function at(offsetSeconds: number): Date {
  return new Date(NOW.getTime() + offsetSeconds * 1000);
}

describe("toDate — what an unreadable instant answers", () => {
  it("reads ISO strings, epoch milliseconds and Dates alike", () => {
    expect(toDate("2026-08-24T12:00:00Z")?.getTime()).toBe(NOW.getTime());
    expect(toDate(NOW.getTime())?.getTime()).toBe(NOW.getTime());
    expect(toDate(NOW)?.getTime()).toBe(NOW.getTime());
  });

  it("answers null for absent, empty and unparseable — never throws, never NaN", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate("not a date")).toBeNull();
  });
});

describe("formatDate / formatDateTime", () => {
  it("names the month, so it cannot be read in the wrong order", () => {
    const rendered = formatDate("2026-08-24T12:00:00Z", "en-GB");
    expect(rendered).toBeTruthy();
    expect(rendered).toMatch(/Aug/);
    expect(rendered).toMatch(/2026/);
  });

  it("renders the APP's locale, not the runtime's", () => {
    const en = formatDate("2026-08-24T12:00:00Z", "en-GB");
    const ru = formatDate("2026-08-24T12:00:00Z", "ru-RU");
    expect(ru).not.toBe(en);
    expect(ru).toMatch(/2026/);
  });

  it("adds a time of day, and only the date without it", () => {
    const withTime = formatDateTime("2026-08-24T12:00:00Z", "en-GB");
    const dateOnly = formatDate("2026-08-24T12:00:00Z", "en-GB");
    expect(withTime).toBeTruthy();
    expect(withTime).not.toBe(dateOnly);
    expect(withTime).toContain(dateOnly as string);
  });

  it("takes a per-call shape override", () => {
    expect(formatDate("2026-08-24T12:00:00Z", "en-GB", { year: "numeric" })).toBe(
      "2026"
    );
  });

  it("answers null rather than putting raw ISO on the glass", () => {
    expect(formatDate(null, "en")).toBeNull();
    expect(formatDate("", "en")).toBeNull();
    expect(formatDateTime("nonsense", "en")).toBeNull();
  });

  it("degrades a malformed locale tag instead of throwing", () => {
    expect(() => formatDate(NOW, "en_US")).not.toThrow();
    expect(formatDate(NOW, "en_US")).toBeTruthy();
  });
});

describe("formatRelative", () => {
  it("says how far, in the platform's own words", () => {
    expect(formatRelative(at(-3 * 3600), "en", { now: NOW })).toBe("3 hours ago");
    expect(formatRelative(at(2 * 86_400), "en", { now: NOW })).toBe("in 2 days");
  });

  it("does not count seconds at a reader", () => {
    expect(formatRelative(at(-5), "en", { now: NOW })).toBe("now");
    expect(formatRelative(at(-59), "en", { now: NOW })).toBe("now");
  });

  it("hands back to a date past the cutoff — 'in 4 years' is not actionable", () => {
    const far = at(4 * 31_536_000);
    expect(formatRelative(far, "en-GB", { now: NOW })).toBe(
      formatDate(far, "en-GB")
    );
  });

  it("stays relative when the caller says to", () => {
    expect(
      formatRelative(at(4 * 31_536_000), "en", {
        now: NOW,
        absoluteAfterSeconds: Infinity,
      })
    ).toBe("in 4 years");
  });

  it("answers null for an unreadable instant", () => {
    expect(formatRelative(undefined, "en", { now: NOW })).toBeNull();
  });
});

describe("formatDuration", () => {
  it("clocks a media position, dropping an empty hour", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(123)).toBe("2:03");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("says a length in the reader's units when it is a fact, not a scrub position", () => {
    const spoken = formatDuration(3723, "en", "units");
    expect(spoken).toBeTruthy();
    expect(spoken).toMatch(/1/);
    expect(spoken).toMatch(/hr|hour/);
  });

  it("answers null for absent and non-finite, never '-1:00' or 'NaN:NaN'", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDuration(-30)).toBe("0:00");
  });
});

describe("formatNumber", () => {
  it("separates thousands the way the reader's language does", () => {
    expect(formatNumber(1240, "en-US")).toBe("1,240");
    expect(formatNumber(1240, "de-DE")).toBe("1.240");
  });

  it("answers null for a non-finite value, so NaN never reaches the page", () => {
    expect(formatNumber(Number.NaN, "en")).toBeNull();
    expect(formatNumber(null, "en")).toBeNull();
  });
});

describe("createFormat", () => {
  it("binds every method to one locale", () => {
    const fmt = createFormat("en-GB");
    expect(fmt.locale).toBe("en-GB");
    expect(fmt.date("2026-08-24T12:00:00Z")).toBe(
      formatDate("2026-08-24T12:00:00Z", "en-GB")
    );
    expect(fmt.number(1240)).toBe("1,240");
  });

  it("timestamp carries the near phrase AND the exact instant", () => {
    const fmt = createFormat("en-GB");
    const stamp = fmt.timestamp(at(-3 * 3600), { now: NOW });
    expect(stamp).toContain("3 hours ago");
    expect(stamp).toContain(fmt.dateTime(at(-3 * 3600)) as string);
  });

  it("timestamp is null when the instant is unreadable", () => {
    expect(createFormat("en").timestamp(null)).toBeNull();
  });
});

function host(i18n: I18nEngine): (props: { children: ReactNode }) => ReactElement {
  return function Host(props: { children: ReactNode }): ReactElement {
    return <I18nProvider i18n={i18n}>{props.children}</I18nProvider>;
  };
}

describe("useFormat", () => {
  it("follows a runtime language switch, so dates move with the sentences", async () => {
    const i18n = createI18n({ locale: "en-GB" });
    const { result } = renderHook(() => useFormat(), { wrapper: host(i18n) });
    const english = result.current.date("2026-08-24T12:00:00Z");
    expect(english).toMatch(/Aug/);

    await act(async () => {
      await i18n.setLocale("ru-RU");
    });

    expect(result.current.locale).toBe("ru-RU");
    expect(result.current.date("2026-08-24T12:00:00Z")).not.toBe(english);
  });

  it("renders outside an I18nProvider instead of throwing — a date is not a key", () => {
    const { result } = renderHook(() => useFormat());
    expect(result.current.locale).toBeUndefined();
    expect(result.current.date("2026-08-24T12:00:00Z")).toBeTruthy();
  });

  it("is stable across renders while the locale holds", () => {
    const i18n = createI18n({ locale: "en" });
    const { result, rerender } = renderHook(() => useFormat(), {
      wrapper: host(i18n),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
