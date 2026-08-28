/**
 * Auto-anonymous: the guest account nobody was asked about.
 *
 * The four hazards this pins are the four ways a silent mint goes wrong once
 * it is in front of real traffic — a crawler-filled user table, a
 * double-tapped heart that becomes two accounts, a reload that abandons the
 * first guest along with everything they saved, and a mint that fails while
 * the write goes out regardless.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PersistStorage } from "@stapel/core";
import { createAuthRuntime } from "../src/model/runtime.js";
import { createAnonymousElevation } from "../src/model/anonymousElevation.js";
import { BASE, authResponse, testUser } from "./helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FAVORITE = "listings.favorite";
const REVIEW = "reviews.write";

function memoryStorage(): PersistStorage {
  const map = new Map<string, unknown>();
  return {
    get: (k) => Promise.resolve(map.get(k)),
    set: (k, v) => {
      map.set(k, v);
      return Promise.resolve();
    },
    del: (k) => {
      map.delete(k);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...map.keys()]),
  };
}

/** The guest the server hands back from `POST /anonymous/`. */
function guestResponse() {
  return {
    ...authResponse("REGISTERED"),
    user: testUser({
      id: "u_anon_1",
      username: "anon_1a2b3c4d",
      email: null,
      auth_type: "anonymous",
      is_email_verified: false,
      is_anonymous: true,
    }),
  };
}

/**
 * Records every `POST /anonymous/` and the `device_id` it carried, so a test
 * can tell "one account" from "one request".
 */
function mintRecorder() {
  const deviceIds: (string | undefined)[] = [];
  const handler = http.post(`${BASE}/anonymous/`, async ({ request }) => {
    const body = (await request.json()) as { device_id?: string };
    deviceIds.push(body.device_id);
    return HttpResponse.json(guestResponse(), { status: 201 });
  });
  return { deviceIds, handler };
}

describe("createAuthRuntime({ autoAnonymous })", () => {
  it("is null when the host did not ask — no minting, no behaviour change", () => {
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    expect(runtime.elevation).toBeNull();
  });

  it("carries the host's action list verbatim — the library picks nothing", () => {
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      autoAnonymous: { actions: [FAVORITE] },
    });
    expect(runtime.elevation?.actions).toEqual([FAVORITE]);
    // The judgement the axis carries: a review is not on the list, so the
    // review form keeps its wall no matter how many hearts were pressed.
    expect(runtime.elevation?.actions).not.toContain(REVIEW);
  });

  it("does not touch the network until something calls elevate()", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      autoAnonymous: { actions: [FAVORITE] },
    });
    await Promise.resolve();
    // Constructing the runtime is what a page load does. A crawler that
    // never clicks must never cost a User row.
    expect(deviceIds).toHaveLength(0);
  });
});

describe("createAnonymousElevation", () => {
  it("mints on the first elevate and adopts the guest session", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });

    await runtime.elevation?.elevate();

    expect(deviceIds).toHaveLength(1);
    expect(runtime.session.getState().user?.is_anonymous).toBe(true);
    // The mandate axis must NOT read this as a member: an anonymous session
    // and no session open the same doors, which is what keeps the review
    // form's wall standing after a heart was pressed.
    expect(runtime.session.getSessionManager().getStatus()).toBe("anonymous");
  });

  it("mints once for two concurrent elevates — a double tap is one account", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });

    await Promise.all([
      runtime.elevation?.elevate(),
      runtime.elevation?.elevate(),
    ]);

    expect(deviceIds).toHaveLength(1);
  });

  it("does not mint again once an identity is in hand", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });

    await runtime.elevation?.elevate();
    await runtime.elevation?.elevate();
    await runtime.elevation?.elevate();

    expect(deviceIds).toHaveLength(1);
  });

  it("does not mint at all for somebody already signed in", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });
    runtime.session.adopt(authResponse("LOGGED_IN"));

    await runtime.elevation?.elevate();

    expect(deviceIds).toHaveLength(0);
  });

  it("reuses the persisted device id across a reload", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const storage = memoryStorage();

    const first = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage,
      autoAnonymous: { actions: [FAVORITE] },
    });
    await first.elevation?.elevate();

    // A reload: a brand-new runtime over the same browser storage, with no
    // session restored. Without a stable device id the server would mint a
    // SECOND guest and the first one's saved listings would be orphaned.
    const second = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage,
      autoAnonymous: { actions: [FAVORITE] },
    });
    await second.elevation?.elevate();

    expect(deviceIds).toHaveLength(2);
    expect(deviceIds[0]).toBeTypeOf("string");
    expect(deviceIds[1]).toBe(deviceIds[0]);
  });

  it("rejects when the server refuses, and stays retryable", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/anonymous/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { localizable_error: "error.429.rate_limited" },
              { status: 429 }
            )
          : HttpResponse.json(guestResponse(), { status: 201 });
      })
    );
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });

    // A refusal is a refusal: it must reach the caller so the write that was
    // waiting on it is abandoned rather than sent without a session.
    await expect(runtime.elevation?.elevate()).rejects.toBeDefined();
    expect(runtime.session.getSessionManager().getStatus()).not.toBe("anonymous");

    // …and the next press tries again rather than being wedged by the
    // failed flight.
    await expect(runtime.elevation?.elevate()).resolves.toBeUndefined();
    expect(runtime.session.getSessionManager().getStatus()).toBe("anonymous");
    expect(calls).toBe(2);
  });

  it("surfaces a closed AUTH_ANONYMOUS axis as a failure, not a silent no-op", async () => {
    server.use(
      http.post(`${BASE}/anonymous/`, () =>
        HttpResponse.json({ localizable_error: "error.403.forbidden" }, { status: 403 })
      )
    );
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });
    await expect(runtime.elevation?.elevate()).rejects.toBeDefined();
  });

  it("reports hasIdentity only after a mint — the read side of the seam", async () => {
    const { source, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({
      baseUrl: BASE,
      cookieMode: false,
      storage: memoryStorage(),
      autoAnonymous: { actions: [FAVORITE] },
    });

    // A stranger who has never pressed anything. A page showing "your saved
    // listings" must be able to tell this apart from a guest who has.
    expect(runtime.elevation?.hasIdentity?.()).toBe(false);
    await runtime.elevation?.elevate();
    expect(runtime.elevation?.hasIdentity?.()).toBe(true);
    void source;
  });

  it("mints a device id the server will accept, WebCrypto or not", async () => {
    // The server refuses a device_id under 16 chars or outside this charset
    // (stapel-auth `error.400.device_id_weak`), because the id is a dedup
    // handle it hands a session back for. If the client can emit a weaker
    // one, the mint 400s and a visitor sees a heart that does nothing.
    const ACCEPTED = /^[A-Za-z0-9\-._~:+/=]{16,}$/;
    const realCrypto = globalThis.crypto;

    async function mintedDeviceId(): Promise<string | undefined> {
      const { deviceIds, handler } = mintRecorder();
      server.use(handler);
      const runtime = createAuthRuntime({
        baseUrl: BASE,
        cookieMode: false,
        storage: memoryStorage(),
        autoAnonymous: { actions: [FAVORITE] },
      });
      await runtime.elevation?.elevate();
      return deviceIds[0];
    }

    expect(await mintedDeviceId()).toMatch(ACCEPTED);

    // The same again with no WebCrypto — an old browser, a stripped runtime.
    // The fallback path is the one that could drift under the floor, so it is
    // exercised many times: its length used to depend on how `Math.random()
    // .toString(36)` happened to round.
    Object.defineProperty(globalThis, "crypto", {
      value: {},
      configurable: true,
    });
    try {
      for (let i = 0; i < 200; i += 1) {
        expect(await mintedDeviceId()).toMatch(ACCEPTED);
      }
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: realCrypto,
        configurable: true,
      });
    }
  });

  it("works with an api handed in directly (no runtime)", async () => {
    const { deviceIds, handler } = mintRecorder();
    server.use(handler);
    const runtime = createAuthRuntime({ baseUrl: BASE, cookieMode: false });
    const elevation = createAnonymousElevation({
      api: runtime.api,
      session: runtime.session,
      actions: [FAVORITE],
      storage: memoryStorage(),
    });
    await elevation.elevate();
    expect(deviceIds).toHaveLength(1);
  });
});
