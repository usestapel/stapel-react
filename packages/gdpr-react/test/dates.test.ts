import { describe, expect, it } from "vitest";
import { formatDeletionDate, formatInstant } from "../src/index.js";

/**
 * The one arithmetic-free thing this pair does with a date.
 *
 * Every deadline on this surface is computed by the SERVER, by rules a client
 * does not hold — `ack_due_at` is three BUSINESS days, `fully_erased_by` is a
 * maximum over a host-configured subprocessor table. A browser that turned any
 * of them into "in 5 days" would be publishing a second answer to a legal
 * deadline, and the two would disagree the first time a device clock was wrong.
 */
const ISO = "2026-09-23T09:00:00Z";

describe("a server instant reaches the screen as a readable date", () => {
  it("formats, and does not hand back the raw wire value", () => {
    const out = formatDeletionDate(ISO, "en");
    expect(out).not.toBe(ISO);
    expect(out).toContain("2026");
    expect(out).toContain("September");
  });

  it("follows the reader's locale", () => {
    expect(formatDeletionDate(ISO, "ru")).not.toBe(formatDeletionDate(ISO, "en"));
    expect(formatDeletionDate(ISO, "ru")).toContain("2026");
  });

  it("the operational format keeps the time, because a receipt needs one", () => {
    const out = formatInstant(ISO, "en");
    expect(out).toContain("2026");
    // "when did this owner last answer" is not a question a date alone answers.
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("an unparseable instant renders as itself", () => {
  it.each([
    ["not-a-date"],
    [""],
    ["2026-13-45T99:99:99Z"],
  ])("%j comes back unchanged rather than as 'Invalid Date'", (value) => {
    expect(formatDeletionDate(value, "en")).toBe(value);
    expect(formatInstant(value, "en")).toBe(value);
  });

  it("never prints the string a person would read as a bug", () => {
    // On a screen whose subject is when your data disappears, "Invalid Date"
    // is worse than an ISO string: one is unreadable, the other is wrong.
    expect(formatDeletionDate("nonsense", "en")).not.toContain("Invalid");
    expect(formatInstant("nonsense", "en")).not.toContain("Invalid");
  });
});

describe("nothing here derives a duration", () => {
  it("a deadline a month out is still stated as a date", () => {
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const out = formatDeletionDate(soon, "en");
    // No "in 30 days" / "30 days left": a relative phrase would be this pair
    // computing a deadline it does not own.
    expect(out.toLowerCase()).not.toMatch(/\d+\s*(day|days|week|month)/);
    expect(out.toLowerCase()).not.toContain("ago");
    expect(out).toContain(String(new Date(soon).getFullYear()));
  });
});
