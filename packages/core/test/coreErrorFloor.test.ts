/**
 * Core mints two families of error codes no backend registry ever generates a
 * catalogue for — `stapel.http.<status>` (a failed response with no error
 * envelope) and `stapel.transport.failed` (a request that never landed). With
 * nothing to translate them, `formatFlowError`'s chain ended at step 3 and a
 * user saw the raw key; a skin that skipped the chain entirely showed
 * `StapelApiError.message`, which for a bodiless failure is
 * `parseErrorEnvelope`'s own `"Request failed with status 500"` (owner report
 * 2026-08-09). This suite pins the floor that closes it.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "../src/i18n.js";
import { describeFlowError, formatFlowError, toFlowError } from "../src/flows/flowError.js";
import { parseErrorEnvelope, toStapelApiError } from "../src/errors.js";
import type { StapelApiError } from "../src/errors.js";
import type { FlowErrorDisplay } from "../src/flows/flowError.js";
import {
  CORE_ERROR_LOCALES,
  DETAIL_ERROR_KEY,
  coreErrorBundle,
  coreErrorKeyCandidates,
} from "../src/i18n/coreErrors.js";

/** What the wire actually delivers for a Django 500 under DEBUG=False. */
const bodiless500 = (): StapelApiError =>
  parseErrorEnvelope(500, "<!doctype html><h1>Server Error (500)</h1>");

function shownFor(error: StapelApiError, locale: string): FlowErrorDisplay {
  const engine = createI18n({ locale });
  return describeFlowError(toFlowError(error), engine.getBundle(), {
    locale: engine.locale,
  });
}

function textFor(error: StapelApiError, locale: string): string {
  return shownFor(error, locale).message;
}

describe("core's error floor", () => {
  it("is seeded by createI18n with no host wiring at all", () => {
    const engine = createI18n({ locale: "en" });
    expect(engine.t("stapel.http.500")).not.toBe("stapel.http.500");
    expect(engine.t("stapel.transport.failed")).not.toBe("stapel.transport.failed");
    expect(engine.t("stapel.error.unknown")).not.toBe("stapel.error.unknown");
  });

  it("turns a bodiless 500 into honest copy instead of the transport's message", () => {
    const error = bodiless500();
    // The shape the defect rode in on, unchanged — this is what a skin used
    // to render straight to the user.
    expect(error.message).toBe("Request failed with status 500");
    expect(error.code).toBe("stapel.http.500");

    const text = textFor(error, "en");
    expect(text).not.toContain("Request failed with status");
    expect(text).toContain("on our side");
  });

  it("keeps the protocol number OUT of every sentence a person reads", () => {
    // The owner's rejection, pinned: a product writes "something went wrong",
    // not "500". Sweeping the whole floor, not just the entries that had it —
    // a new one must not reintroduce the pattern.
    for (const locale of CORE_ERROR_LOCALES) {
      for (const [key, sentence] of Object.entries(coreErrorBundle(locale))) {
        if (key === DETAIL_ERROR_KEY) continue;
        expect(sentence, `${locale}/${key} reads a protocol number to a user`).not.toMatch(
          /\d|\{status\}/
        );
      }
    }
  });

  it("moves the status to a separate technical detail, so support keeps its handle", () => {
    // The whole point of not simply deleting `{status}`: it is the ONLY
    // correlation handle in the fleet today.
    const shown = shownFor(bodiless500(), "en");
    expect(shown.detail).toBe("HTTP 500");
    expect(shown.message).not.toContain("500");

    // Same handle on a Russian UI — the detail is technical, not prose.
    expect(shownFor(bodiless500(), "ru").detail).toBe("HTTP 500");
  });

  it("shows no technical detail where there is nothing worth quoting", () => {
    const engine = createI18n({ locale: "en" });
    const bundle = engine.getBundle();

    // A request that never reached a backend. `toStapelApiError` marks that
    // with `status: 0`, so the guard is not "is status set" — quoting
    // `HTTP 0` back at support would be a lie about what the server said.
    const transportError = toStapelApiError(new TypeError("Failed to fetch"));
    expect(transportError.status).toBe(0);
    const transport = describeFlowError(toFlowError(transportError), bundle, {
      locale: "en",
    });
    expect(transport.message).toContain("Could not reach the server");
    expect(transport.detail).toBeUndefined();

    // A fault that is not an API error at all: no status to begin with.
    expect(
      describeFlowError(toFlowError(new TypeError("boom")), bundle, { locale: "en" }).detail
    ).toBeUndefined();

    // A real backend code: the sentence already says what happened, so
    // stamping `HTTP 400` under it would be noise.
    engine.registerBundle("en", { "error.400.display_name_emoji": "No emoji, please." });
    const specific = describeFlowError(
      toFlowError(
        parseErrorEnvelope(400, {
          localizable_error: "error.400.display_name_emoji",
          error: "no emoji",
        })
      ),
      engine.getBundle(),
      { locale: "en" }
    );
    expect(specific.message).toBe("No emoji, please.");
    expect(specific.detail).toBeUndefined();
  });

  it("lets a host override the detail template like any other key", () => {
    const engine = createI18n({ locale: "en" });
    engine.registerBundle("en", { [DETAIL_ERROR_KEY]: "code {status} / build 42" });
    expect(
      describeFlowError(toFlowError(bodiless500()), engine.getBundle(), { locale: "en" }).detail
    ).toBe("code 500 / build 42");
  });

  it("speaks the host's locale, not the transport's English", () => {
    const text = textFor(bodiless500(), "ru");
    expect(text).toContain("На нашей стороне");
    expect(text).not.toContain("Request failed");
  });

  it("resolves a regional locale through its base language", () => {
    expect(coreErrorBundle("ru-RU")["stapel.http.500"]).toBe(
      coreErrorBundle("ru")["stapel.http.500"]
    );
    // An unshipped locale degrades to English, never to a raw key.
    expect(coreErrorBundle("fi")["stapel.http.500"]).toBe(
      coreErrorBundle("en")["stapel.http.500"]
    );
  });

  it("widens an unlisted status to its class, and ONLY for core's own codes", () => {
    expect(coreErrorKeyCandidates("stapel.http.507")).toEqual([
      "stapel.http.507",
      "stapel.http.5xx",
    ]);
    // Two different backend 404s stay two different states — the whole point
    // of `errorCodePredicate`. Widening them would collapse that.
    expect(coreErrorKeyCandidates("error.404.meeting_not_found")).toEqual([
      "error.404.meeting_not_found",
    ]);
    expect(textFor(parseErrorEnvelope(507, ""), "en")).toContain("on our side");
  });

  it("is a floor: a pair or host bundle registered later wins the same key", () => {
    const engine = createI18n({ locale: "en" });
    engine.registerBundle("en", { "stapel.http.500": "Our bad, try again." });
    expect(engine.t("stapel.http.500")).toBe("Our bad, try again.");
  });

  it("floors a locale reached only via setLocale", async () => {
    const engine = createI18n({ locale: "en" });
    await engine.setLocale("ru");
    expect(engine.t("stapel.http.503")).toContain("недоступен");
  });

  it("still prefers a real backend code over the status fallback", () => {
    const engine = createI18n({ locale: "en" });
    engine.registerBundle("en", { "error.500.internal": "The importer crashed." });
    const error = parseErrorEnvelope(500, {
      localizable_error: "error.500.internal",
      error: "boom",
    });
    expect(
      formatFlowError(toFlowError(error), engine.getBundle(), { locale: "en" })
    ).toBe("The importer crashed.");
  });
});
