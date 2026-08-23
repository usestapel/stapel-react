import { describe, expect, it } from "vitest";
import { StapelApiError } from "@stapel/core";
import {
  formatPresence,
  isInvalidUsagePeriod,
  isScopeUnavailable,
  normalizeScopeUsage,
  usageMonth,
  usageMonthLabels,
  usageTotals,
} from "../src/index.js";
import type { ScopeUsageResponse } from "../src/index.js";
import {
  AUGUST,
  NO_MONTHS_BODY,
  WINDOW_BODY,
} from "./fixtures.js";

const windowAnswer = normalizeScopeUsage(
  WINDOW_BODY as unknown as ScopeUsageResponse
);

describe("normalizeScopeUsage — the one place `absent` becomes `[]`", () => {
  it("keeps the server's own boundaries, verbatim", () => {
    const august = windowAnswer.months[0];
    expect(august?.month).toBe("2026-08");
    // CEST, not UTC midnight: the month is cut at LOCAL midnight in Europe/Berlin.
    expect(august?.periodStart).toBe("2026-07-31T22:00:00Z");
    expect(august?.periodEnd).toBe("2026-08-31T22:00:00Z");
  });

  it("a month that arrived without a `users` key holds no rows", () => {
    const june = windowAnswer.months[2];
    expect(june?.month).toBe("2026-06");
    expect(june?.rows).toEqual([]);
  });

  it("an answer that arrived without a `months` key holds no months", () => {
    const empty = normalizeScopeUsage(
      NO_MONTHS_BODY as unknown as ScopeUsageResponse
    );
    expect(empty.months).toEqual([]);
    expect(usageMonthLabels(empty)).toEqual([]);
  });

  it("echoes the scope and the zone the buckets were cut in", () => {
    expect(windowAnswer.scopeKey).toBe("acme-7f0c");
    expect(windowAnswer.tz).toBe("Europe/Berlin");
  });
});

describe("usageMonth", () => {
  it("returns the named month", () => {
    expect(usageMonth(windowAnswer, "2026-07")?.month).toBe("2026-07");
  });

  it("falls back to the newest month when none is named", () => {
    expect(usageMonth(windowAnswer)?.month).toBe("2026-08");
  });

  it("is `undefined` — not an empty row list — when the answer has no months at all", () => {
    const empty = normalizeScopeUsage(
      NO_MONTHS_BODY as unknown as ScopeUsageResponse
    );
    expect(usageMonth(empty)).toBeUndefined();
    expect(usageMonth(empty, "2026-08")).toBeUndefined();
  });
});

describe("formatPresence — h:mm, hours uncapped", () => {
  it.each([
    [0, "0:00"],
    [59, "0:00"],
    [60, "0:01"],
    [3600, "1:00"],
    [3660, "1:01"],
    [7385, "2:03"],
    [91_800, "25:30"],
  ])("%i seconds → %s", (seconds, expected) => {
    expect(formatPresence(seconds)).toBe(expected);
  });

  it("rounds DOWN, so the report never claims a minute nobody spent", () => {
    expect(formatPresence(119)).toBe("0:01");
  });

  it("refuses to render a nonsense number as a duration", () => {
    expect(formatPresence(Number.NaN)).toBe("0:00");
    expect(formatPresence(-1)).toBe("0:00");
  });
});

describe("usageTotals", () => {
  it("sums presence across people — each row is already unioned, so the sum is person-time", () => {
    const totals = usageTotals(AUGUST.users);
    expect(totals.people).toBe(3);
    expect(totals.presenceSeconds).toBe(7385 + 3600 + 59);
    expect(formatPresence(totals.presenceSeconds)).toBe("3:04");
  });

  it("names the room sum `attendances`, because three people in one call make three", () => {
    expect(usageTotals(AUGUST.users).attendances).toBe(4 + 2 + 1);
    expect(usageTotals(AUGUST.users).connections).toBe(6 + 2 + 1);
  });

  it("an empty month totals to zero rather than throwing", () => {
    expect(usageTotals([])).toEqual({
      people: 0,
      presenceSeconds: 0,
      attendances: 0,
      connections: 0,
    });
  });
});

describe("the two refusals, read by CODE and never by status", () => {
  const apiError = (code: string, status: number): StapelApiError =>
    new StapelApiError({ code, status, message: code, params: {} });

  it("recognises the uniform scope 404", () => {
    expect(isScopeUnavailable(apiError("error.404.video_scope_not_found", 404))).toBe(
      true
    );
  });

  it("does NOT treat every 404 as the scope refusal — a missing room is a different sentence", () => {
    expect(isScopeUnavailable(apiError("error.404.video_room_not_found", 404))).toBe(
      false
    );
    expect(isScopeUnavailable(apiError("error.404.not_found", 404))).toBe(false);
  });

  it("recognises the period 400 separately", () => {
    expect(
      isInvalidUsagePeriod(apiError("error.400.video_invalid_usage_period", 400))
    ).toBe(true);
    expect(
      isScopeUnavailable(apiError("error.400.video_invalid_usage_period", 400))
    ).toBe(false);
  });

  it("a network fault is neither — it is not an answer about the scope", () => {
    expect(isScopeUnavailable(new TypeError("Failed to fetch"))).toBe(false);
    expect(isInvalidUsagePeriod(new TypeError("Failed to fetch"))).toBe(false);
  });
});
