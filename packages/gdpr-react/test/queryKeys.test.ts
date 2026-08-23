import { describe, expect, it } from "vitest";
import { gdprQueryKeys } from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces everything under the module root", () => {
    expect(gdprQueryKeys.all).toEqual(["gdpr"]);
    for (const key of [
      gdprQueryKeys.closure,
      gdprQueryKeys.erasures,
      gdprQueryKeys.myErasures,
      gdprQueryKeys.exportStatus,
      gdprQueryKeys.dsar,
      gdprQueryKeys.dsarQueue,
      gdprQueryKeys.ownersHealth,
      gdprQueryKeys.erasure(17),
      gdprQueryKeys.dsarOne(5),
    ]) {
      expect(key[0]).toBe("gdpr");
    }
  });

  it("`all` is a prefix of every entry — one invalidation clears the module", () => {
    // The writes rely on this: closing an account creates an erasure at grace
    // end, and a matched DSAR starts a closure or an export, so a mutation
    // invalidates the ROOT rather than pretending to know which screen moved.
    const root = gdprQueryKeys.all;
    for (const key of [
      gdprQueryKeys.closure,
      gdprQueryKeys.myErasures,
      gdprQueryKeys.exportStatus,
      gdprQueryKeys.dsarQueue,
      gdprQueryKeys.ownersHealth,
      gdprQueryKeys.erasure(17),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root]);
    }
  });

  it("the erasures root is a prefix of both the list and one request", () => {
    const erasures = gdprQueryKeys.erasures;
    expect(gdprQueryKeys.myErasures.slice(0, erasures.length)).toEqual([
      ...erasures,
    ]);
    expect(gdprQueryKeys.erasure(17).slice(0, erasures.length)).toEqual([
      ...erasures,
    ]);
  });

  it("the DSAR root is a prefix of the queue and of one request", () => {
    const dsar = gdprQueryKeys.dsar;
    expect(gdprQueryKeys.dsarQueue.slice(0, dsar.length)).toEqual([...dsar]);
    expect(gdprQueryKeys.dsarOne(5).slice(0, dsar.length)).toEqual([...dsar]);
  });

  it("two ids never share an entry", () => {
    expect(gdprQueryKeys.erasure(17)).not.toEqual(gdprQueryKeys.erasure(18));
    expect(gdprQueryKeys.dsarOne(5)).not.toEqual(gdprQueryKeys.dsarOne(6));
  });

  it("the list and a single request are different entries", () => {
    expect(gdprQueryKeys.myErasures).not.toEqual(gdprQueryKeys.erasure(17));
    expect(gdprQueryKeys.dsarQueue).not.toEqual(gdprQueryKeys.dsarOne(5));
  });

  it("carries no user id — the server decides whose data this is", () => {
    // Every read here is "mine" or staff-wide. A key carrying a user id would
    // be a second, client-side answer to a question the session already
    // answered, and the two disagreeing means one person's deletion state
    // served under another's cache entry.
    const flat = JSON.stringify([
      gdprQueryKeys.closure,
      gdprQueryKeys.myErasures,
      gdprQueryKeys.exportStatus,
    ]);
    expect(flat).not.toMatch(/user|me\b|uid/i);
  });
});
