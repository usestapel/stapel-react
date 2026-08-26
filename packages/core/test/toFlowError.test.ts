/**
 * `toFlowError` must be idempotent. A flow machine's refusal state carries a
 * `FlowError`, not the thrown value, so any screen reading a refusal OFF A
 * MACHINE folds an already-folded error a second time. Before this, the second
 * fold collapsed it to the fallback code and every code predicate downstream
 * of a machine answered `false` — the screen silently rendered the generic
 * sentence instead of the one written for that refusal (found by
 * moderation-react, wave D).
 */
import { describe, expect, it } from "vitest";
import { StapelApiError } from "../src/errors.js";
import { createFlowMachine } from "../src/flows/flowMachine.js";
import { isErrorCode, isFlowError, toFlowError } from "../src/flows/flowError.js";
import type { FlowError } from "../src/flows/flowError.js";
import type { FlowStateBase } from "../src/flows/flowMachine.js";

function apiError(): StapelApiError {
  return new StapelApiError({
    code: "moderation.report.already_reported",
    message: "Already reported",
    params: { report_id: 7 },
    status: 409,
    language: "en",
  });
}

describe("toFlowError idempotence", () => {
  it("passes a FlowError through unchanged", () => {
    const once = toFlowError(apiError(), "moderation.error.unknown");
    const twice = toFlowError(once, "moderation.error.unknown");
    expect(twice).toBe(once);
    expect(twice.code).toBe("moderation.report.already_reported");
    expect(twice.params).toEqual({ report_id: 7 });
    expect(twice.status).toBe(409);
    expect(twice.message).toBe("Already reported");
    expect(twice.language).toBe("en");
  });

  it("keeps a fallback-folded error's code across a second fold", () => {
    const once = toFlowError(new TypeError("network down"), "moderation.error.unknown");
    expect(toFlowError(once, "auth.error.unknown")).toBe(once);
    expect(once.code).toBe("moderation.error.unknown");
  });

  it("still folds a StapelApiError, which carries the same field names", () => {
    const folded = toFlowError(apiError());
    expect(folded).not.toBeInstanceOf(Error);
    expect(folded.code).toBe("moderation.report.already_reported");
    expect(folded.status).toBe(409);
  });

  it("collapses an unknown value to the fallback code", () => {
    const folded = toFlowError({ oops: true }, "moderation.error.unknown");
    expect(folded.code).toBe("moderation.error.unknown");
    expect(folded.params).toEqual({});
    expect(folded.status).toBeUndefined();
    expect(folded.message).toBeUndefined();
    expect(folded.language).toBeUndefined();
  });

  it("isFlowError says no to a StapelApiError, a raw envelope and a non-object", () => {
    expect(isFlowError(apiError())).toBe(false);
    expect(isFlowError({ localizable_error: "x", error: "X" })).toBe(false);
    expect(isFlowError(null)).toBe(false);
    expect(isFlowError("boom")).toBe(false);
    expect(isFlowError(toFlowError(apiError()))).toBe(true);
  });
});

type ReportState =
  | (FlowStateBase & { readonly step: "idle" })
  | (FlowStateBase & { readonly step: "sending" })
  | (FlowStateBase & { readonly step: "sent" })
  | (FlowStateBase & { readonly step: "refused"; readonly error: FlowError });

describe("a refusal read off a flow machine", () => {
  it("answers a code predicate true after the host re-folds it", async () => {
    const machine = createFlowMachine<ReportState>({
      id: "moderation.report",
      initial: { step: "idle" },
    });

    await machine.run<null>(
      { step: "sending" },
      () => Promise.reject(apiError()),
      {
        resolve: () => ({ step: "sent" }),
        reject: (error) => ({
          step: "refused",
          error: toFlowError(error, "moderation.error.unknown"),
        }),
      }
    );

    const state = machine.getState();
    expect(state.step).toBe("refused");
    // What a screen does: it takes the refusal off the machine and hands it to
    // the pair's own fold before asking a predicate about it.
    const refused = toFlowError(
      (state as Extract<ReportState, { step: "refused" }>).error,
      "moderation.error.unknown"
    );
    expect(isErrorCode(refused, "moderation.report.already_reported")).toBe(true);
    expect(isErrorCode(refused, "moderation.error.unknown")).toBe(false);
  });
});
