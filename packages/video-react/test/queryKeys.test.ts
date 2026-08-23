import { describe, expect, it } from "vitest";
import { usageQueryKeys, videoQueryKeys } from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces everything under the module root", () => {
    expect(videoQueryKeys.all).toEqual(["video"]);
    expect(usageQueryKeys.all).toEqual(["video", "usage"]);
    expect(usageQueryKeys.scope("acme-7f0c")[0]).toBe("video");
  });

  it("a scope's key is a prefix of both of its reads, so one invalidation clears the screen", () => {
    const scope = usageQueryKeys.scope("acme-7f0c");
    const windowKey = usageQueryKeys.window("acme-7f0c", 6, "UTC");
    const monthKey = usageQueryKeys.month("acme-7f0c", "2026-08", "UTC");
    expect(windowKey.slice(0, scope.length)).toEqual([...scope]);
    expect(monthKey.slice(0, scope.length)).toEqual([...scope]);
  });

  it("the time zone is part of the key — the same month is different numbers in two zones", () => {
    expect(usageQueryKeys.month("acme-7f0c", "2026-08", "UTC")).not.toEqual(
      usageQueryKeys.month("acme-7f0c", "2026-08", "Europe/Berlin")
    );
    expect(usageQueryKeys.window("acme-7f0c", 6, "UTC")).not.toEqual(
      usageQueryKeys.window("acme-7f0c", 6, "Europe/Berlin")
    );
  });

  it("the window and a month are different entries", () => {
    expect(usageQueryKeys.window("acme-7f0c", 6, "UTC")).not.toEqual(
      usageQueryKeys.month("acme-7f0c", "2026-08", "UTC")
    );
  });

  it("two scopes never share an entry", () => {
    expect(usageQueryKeys.window("acme-7f0c", 6, "UTC")).not.toEqual(
      usageQueryKeys.window("acme-0000", 6, "UTC")
    );
  });

  it("a wider window is its own entry — six months is not twelve", () => {
    expect(usageQueryKeys.window("acme-7f0c", 6, "UTC")).not.toEqual(
      usageQueryKeys.window("acme-7f0c", 12, "UTC")
    );
  });
});
