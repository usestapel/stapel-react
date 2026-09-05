/**
 * THE SEAM STOPPED AT THIS CONSTRUCTOR.
 *
 * Core's session manager takes two options for the cross-document refresh
 * handoff — how long a previous document's rotation marker counts as live
 * (`refreshHandoffWindowMs`), and a synchronous read of whatever non-httponly
 * evidence the host has that a session already exists (`readSessionHint`).
 * This pair BUILDS that manager, so neither was reachable from a host: the
 * options existed on `createSessionManager` and nowhere else. A host that had
 * measured its own refresh latency, or that keeps its own hint, could only
 * fork the pair.
 *
 * Both are now passed through, and "passed through" is only worth asserting
 * as BEHAVIOUR — a test that read the object back would prove the spread and
 * nothing about the manager. So each case is pinned by what core does
 * differently with the value, against a control that shows the difference is
 * the option's.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { REFRESH_INFLIGHT_MARKER_KEY } from "@stapel/core";
import type { SessionStatus } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { BASE } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A previous document's rotation marker, `ageMs` old. */
function seedMarker(ageMs: number): void {
  sessionStorage.setItem(
    REFRESH_INFLIGHT_MARKER_KEY,
    JSON.stringify({ startedAt: Date.now() - ageMs })
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("refreshHandoffWindowMs reaches core's manager", () => {
  it("ages out a marker the default window would still have honoured", () => {
    // 100 ms old. Core's own default is 3 s, so this marker is LIVE unless
    // the host's much smaller window actually arrived.
    seedMarker(100);
    createAuthRuntime({
      baseUrl: BASE,
      bootstrapProbe: "off",
      refreshHandoffWindowMs: 10,
    });
    // A stale marker is cleared at construction, synchronously, so the next
    // boot does not read it either — which is the observable half of the
    // window having been applied.
    expect(sessionStorage.getItem(REFRESH_INFLIGHT_MARKER_KEY)).toBeNull();
  });

  it("…and the same marker survives when the host says nothing", () => {
    seedMarker(100);
    createAuthRuntime({ baseUrl: BASE, bootstrapProbe: "off" });
    // The control: with core's 3 s default this marker is a live rotation.
    // The difference between the two cases is the option, and only the option.
    expect(sessionStorage.getItem(REFRESH_INFLIGHT_MARKER_KEY)).not.toBeNull();
  });
});

describe("readSessionHint reaches core's manager", () => {
  it("is consulted after the handoff wait, and its answer skips the refresh", async () => {
    let refreshCalls = 0;
    server.use(
      // Cookie mode refreshes with a GET (no body to send); `all` keeps this
      // suite about the handoff rather than about the verb.
      http.all(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_1", refresh: "ref_1" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json({ id: "u_1" }))
    );
    seedMarker(0);
    const readSessionHint = vi.fn((): SessionStatus | null => "authenticated");
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      bootstrapProbe: "always",
      // Short enough that the wait ends on its timer within the test.
      refreshHandoffWindowMs: 50,
      readSessionHint,
    });

    await runtime.session.restore();

    expect(readSessionHint).toHaveBeenCalledTimes(1);
    // The whole point of the hint: the rotation we waited out already
    // produced a session, so presenting the credential it replaced — the one
    // thing that gets sessions revoked — never happens.
    expect(refreshCalls).toBe(0);
    expect(runtime.session.getSessionManager().getStatus()).toBe("authenticated");
  });

  it("…and without it the boot probe refreshes, as it always did", async () => {
    let refreshCalls = 0;
    server.use(
      http.all(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_1", refresh: "ref_1" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json({ id: "u_1" }))
    );
    seedMarker(0);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      bootstrapProbe: "always",
      refreshHandoffWindowMs: 50,
    });

    await runtime.session.restore();

    // No hint seam wired: core waits the window out and then does exactly
    // what it has always done.
    expect(refreshCalls).toBe(1);
  });

  it("a hint that answers `null` does not short-circuit anything", async () => {
    let refreshCalls = 0;
    server.use(
      http.all(`${BASE}/token/refresh/`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "acc_1", refresh: "ref_1" });
      }),
      http.get(`${BASE}/me/`, () => HttpResponse.json({ id: "u_1" }))
    );
    seedMarker(0);
    const readSessionHint = vi.fn((): SessionStatus | null => null);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      bootstrapProbe: "always",
      refreshHandoffWindowMs: 50,
      readSessionHint,
    });

    await runtime.session.restore();

    // "I looked and there is nothing" is not "there is a session": the probe
    // must still run, or a host wiring the seam would lose its cold start.
    expect(readSessionHint).toHaveBeenCalledTimes(1);
    expect(refreshCalls).toBe(1);
  });
});
