import { describe, expect, it, vi } from "vitest";
import { isStapelApiError } from "@stapel/core";
import {
  TEXT_TOO_LONG_CODE,
  chunkTexts,
  createTextBatcher,
} from "../src/index.js";
import type { TranslateApi } from "../src/index.js";

/**
 * The fold is the whole point of this layer: a screen's worth of copy must
 * cost ONE provider call. These tests count wire calls, because that is what
 * the money is measured in.
 */

const LIMITS = { maxChars: 20, maxBatchItems: 3, maxBatchChars: 30 };

interface Recorded {
  readonly texts: readonly string[];
}

function apiWith(
  respond: (texts: readonly string[]) => {
    texts: string[];
    cached?: boolean;
  } = (texts) => ({ texts: texts.map((t) => `[${t}]`) })
): { api: TranslateApi; sent: Recorded[] } {
  const sent: Recorded[] = [];
  const api = {
    client: {} as TranslateApi["client"],
    languagesRevision: () => Promise.resolve({ revision: 1 }),
    languageData: () => Promise.resolve({}),
    text: (input: {
      text?: string;
      texts?: readonly string[];
      targetLang: string;
    }) => {
      const texts = input.texts ?? [input.text as string];
      sent.push({ texts });
      const answer = respond(texts);
      return Promise.resolve({
        texts: answer.texts,
        text: answer.texts[0] ?? "",
        source_language: "es",
        target_language: input.targetLang,
        provider: "TestProvider",
        cached: answer.cached ?? false,
      });
    },
  } as unknown as TranslateApi;
  return { api, sent };
}

describe("the batcher folds one tick into one call", () => {
  it("sends three texts asked for in the same tick as ONE request", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    expect(batcher).not.toBeNull();
    if (batcher === null) return;
    const answers = await Promise.all([
      batcher.translate({ text: "uno", targetLang: "en" }),
      batcher.translate({ text: "dos", targetLang: "en" }),
      batcher.translate({ text: "tres", targetLang: "en" }),
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.texts).toEqual(["uno", "dos", "tres"]);
    expect(answers.map((a) => a.text)).toEqual(["[uno]", "[dos]", "[tres]"]);
    expect(batcher.stats().calls).toBe(1);
  });

  it("collapses identical strings to one wire slot and answers both callers", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    const [a, b] = await Promise.all([
      batcher.translate({ text: "same", targetLang: "en" }),
      batcher.translate({ text: "same", targetLang: "en" }),
    ]);
    expect(sent[0]?.texts).toEqual(["same"]);
    expect(a?.text).toBe("[same]");
    expect(b?.text).toBe("[same]");
  });

  it("does NOT fold across different targets, sources or contexts", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    await Promise.all([
      batcher.translate({ text: "a", targetLang: "en" }),
      batcher.translate({ text: "a", targetLang: "fr" }),
      batcher.translate({ text: "a", targetLang: "en", context: "a title" }),
    ]);
    expect(sent).toHaveLength(3);
  });

  it("splits a batch that would breach a ceiling instead of being refused", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    await batcher.translateAll(
      ["a", "b", "c", "d", "e"].map((text) => ({ text, targetLang: "en" }))
    );
    // maxBatchItems is 3 → two calls, never a `batch_too_large` refusal.
    expect(sent.map((call) => call.texts)).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });

  it("remembers an answer in-process — a re-mount spends nothing", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    await batcher.translate({ text: "hola", targetLang: "en" });
    const again = await batcher.translate({ text: "hola", targetLang: "en" });
    expect(sent).toHaveLength(1);
    expect(batcher.stats().memoHits).toBe(1);
    // A remembered answer is marked `cached`: it was not produced for this ask.
    expect(again.cached).toBe(true);
  });
});

describe("the ceilings are mirrored, not discovered on the wire", () => {
  it("refuses a text over the per-text ceiling with the limit in its params", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    const error = await batcher
      .translate({ text: "x".repeat(21), targetLang: "en" })
      .catch((e: unknown) => e);
    expect(sent).toHaveLength(0);
    expect(isStapelApiError(error)).toBe(true);
    if (!isStapelApiError(error)) return;
    expect(error.code).toBe(TEXT_TOO_LONG_CODE);
    expect(error.params["max_chars"]).toBe(20);
  });

  it("answers a same-language ask from the input, with no call at all", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    const answer = await batcher.translate({
      text: "hola",
      sourceLang: "es",
      targetLang: "ES",
    });
    expect(sent).toHaveLength(0);
    expect(answer.text).toBe("hola");
  });

  it("chunkTexts respects both batch ceilings", () => {
    expect(chunkTexts(["a", "b", "c", "d"], LIMITS)).toEqual([
      ["a", "b", "c"],
      ["d"],
    ]);
    expect(
      chunkTexts(["x".repeat(20), "y".repeat(20)], LIMITS)
    ).toEqual([["x".repeat(20)], ["y".repeat(20)]]);
  });
});

describe("a misaligned answer is refused, never zipped", () => {
  it("rejects every waiter when the server returns the wrong count", async () => {
    // Zipping a short array onto the inputs would hand one listing another
    // listing's description — a wrong answer presented as a right one.
    const { api } = apiWith(() => ({ texts: ["only one"] }));
    const batcher = createTextBatcher(api, { limits: LIMITS });
    if (batcher === null) return;
    const results = await Promise.allSettled([
      batcher.translate({ text: "uno", targetLang: "en" }),
      batcher.translate({ text: "dos", targetLang: "en" }),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });

  it("is null — not a rejecting stub — when the api has no text operation", () => {
    const { api } = apiWith();
    const withoutText = { ...api, text: undefined } as TranslateApi;
    expect(createTextBatcher(withoutText)).toBeNull();
  });

  it("flushes on a microtask by default", async () => {
    const { api, sent } = apiWith();
    const batcher = createTextBatcher(api);
    if (batcher === null) return;
    const pending = [
      batcher.translate({ text: "uno", targetLang: "en" }),
      batcher.translate({ text: "dos", targetLang: "en" }),
    ];
    expect(sent).toHaveLength(0); // nothing has gone out synchronously
    await Promise.all(pending);
    expect(sent).toHaveLength(1);
  });

  it("uses an injected scheduler when one is given", async () => {
    const { api, sent } = apiWith();
    const flushes: (() => void)[] = [];
    const batcher = createTextBatcher(api, {
      schedule: (flush) => flushes.push(flush),
    });
    if (batcher === null) return;
    const promise = batcher.translate({ text: "uno", targetLang: "en" });
    expect(sent).toHaveLength(0);
    flushes.forEach((flush) => {
      flush();
    });
    await promise;
    expect(sent).toHaveLength(1);
    expect(vi.isMockFunction(flushes[0])).toBe(false);
  });
});
