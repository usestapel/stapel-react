import { describe, expect, it } from "vitest";
import { StapelApiError, parseErrorEnvelope } from "../src/errors.js";

describe("parseErrorEnvelope", () => {
  it("parses the full Stapel envelope", () => {
    const error = parseErrorEnvelope(400, {
      localizable_error: "auth.otp.invalid",
      error: "Invalid one-time code",
      params: { attempts_left: 2 },
    });
    expect(error).toBeInstanceOf(StapelApiError);
    expect(error.code).toBe("auth.otp.invalid");
    expect(error.message).toBe("Invalid one-time code");
    expect(error.params).toEqual({ attempts_left: 2 });
    expect(error.status).toBe(400);
  });

  it("falls back to stapel.http.<status> when localizable_error is absent", () => {
    const error = parseErrorEnvelope(500, { error: "boom" });
    expect(error.code).toBe("stapel.http.500");
    expect(error.message).toBe("boom");
    expect(error.params).toEqual({});
  });

  it("uses the code as message when error text is absent", () => {
    const error = parseErrorEnvelope(422, {
      localizable_error: "billing.plan.unknown",
    });
    expect(error.message).toBe("billing.plan.unknown");
  });

  it("tolerates non-envelope bodies", () => {
    const text = parseErrorEnvelope(502, "Bad Gateway");
    expect(text.code).toBe("stapel.http.502");
    expect(text.status).toBe(502);
    expect(text.body).toBe("Bad Gateway");

    const empty = parseErrorEnvelope(404, undefined);
    expect(empty.code).toBe("stapel.http.404");
  });

  it("keeps the raw body for diagnostics", () => {
    const body = { localizable_error: "x.y", extra: { nested: true } };
    expect(parseErrorEnvelope(400, body).body).toBe(body);
  });
});
