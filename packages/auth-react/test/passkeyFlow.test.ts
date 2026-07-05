import { describe, expect, it, vi } from "vitest";
import {
  createPasskeyLoginFlow,
  createPasskeyRegistrationFlow,
} from "../src/flows/passkeyFlow.js";
import type { AuthApi } from "../src/api/authApi.js";
import { authResponse } from "./helpers.js";

/**
 * Lifecycle tests for the passkey machines' WebAuthn auto-drive — the same
 * stale-prompt guard the verification controller carries (52ae5ac): a native
 * `navigator.credentials.*` prompt can settle AFTER the machine moved on
 * (reset, re-begin). Its late result must neither be submitted against the
 * newer ceremony nor clobber the newer state with `error`.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush pending microtasks so late prompt settlements propagate. */
const tick = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("passkey login: stale native prompt guard", () => {
  it("a stale assertion is not submitted against a NEWER ceremony's session_key", async () => {
    const complete = vi.fn(() => Promise.resolve(authResponse()));
    let session = 0;
    const api = {
      passkeyAuthenticateBegin: vi.fn(() => {
        session += 1;
        return Promise.resolve({ session_key: `sk_${String(session)}`, options: {} });
      }),
      passkeyAuthenticateComplete: complete,
    } as unknown as AuthApi;

    const prompts: Deferred<unknown>[] = [];
    const flow = createPasskeyLoginFlow({
      api,
      webauthnGet: () => {
        const d = deferred<unknown>();
        prompts.push(d);
        return d.promise;
      },
    });

    const first = flow.begin();
    await tick();
    expect(flow.machine.getState().step).toBe("awaitingAssertion");

    // The user abandons the hung prompt and starts over.
    flow.reset();
    const second = flow.begin();
    await tick();
    const s = flow.machine.getState();
    expect(s.step).toBe("awaitingAssertion");

    // The FIRST prompt settles late — it must NOT be submitted against sk_2.
    prompts[0]?.resolve({ id: "stale-credential" });
    await first;
    expect(complete).not.toHaveBeenCalled();
    expect(flow.machine.getState()).toBe(s); // untouched

    // The live prompt still completes normally.
    prompts[1]?.resolve({ id: "fresh-credential" });
    await second;
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("sk_2", { id: "fresh-credential" });
    expect(flow.machine.getState().step).toBe("authenticated");
  });

  it("a stale prompt rejection does not clobber the state after reset", async () => {
    const api = {
      passkeyAuthenticateBegin: vi.fn(() =>
        Promise.resolve({ session_key: "sk_1", options: {} })
      ),
      passkeyAuthenticateComplete: vi.fn(),
    } as unknown as AuthApi;

    const prompt = deferred<unknown>();
    const flow = createPasskeyLoginFlow({ api, webauthnGet: () => prompt.promise });

    const begun = flow.begin();
    await tick();
    expect(flow.machine.getState().step).toBe("awaitingAssertion");

    flow.reset();
    expect(flow.machine.getState().step).toBe("idle");

    // The abandoned native prompt times out AFTER the reset.
    prompt.reject(new DOMException("timed out", "NotAllowedError"));
    await begun;
    expect(flow.machine.getState().step).toBe("idle"); // not "error"
  });
});

describe("passkey registration: stale native prompt guard", () => {
  it("a stale created credential is not submitted after re-begin", async () => {
    const complete = vi.fn(() =>
      Promise.resolve({ id: "pk_1", device_name: "mbp", created_at: "", last_used_at: null })
    );
    const api = {
      passkeyRegisterBegin: vi.fn(() => Promise.resolve({ options: {} })),
      passkeyRegisterComplete: complete,
    } as unknown as AuthApi;

    const prompts: Deferred<unknown>[] = [];
    const flow = createPasskeyRegistrationFlow({
      api,
      webauthnCreate: () => {
        const d = deferred<unknown>();
        prompts.push(d);
        return d.promise;
      },
    });

    const first = flow.begin("old-device");
    await tick();
    flow.reset();
    const second = flow.begin("new-device");
    await tick();
    const s = flow.machine.getState();
    expect(s.step).toBe("awaitingCredential");

    prompts[0]?.resolve({ id: "stale" });
    await first;
    expect(complete).not.toHaveBeenCalled();
    expect(flow.machine.getState()).toBe(s);

    prompts[1]?.resolve({ id: "fresh" });
    await second;
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({ id: "fresh" }, "new-device");
    expect(flow.machine.getState().step).toBe("registered");
  });

  it("a stale creation rejection does not clobber a terminal state", async () => {
    const api = {
      passkeyRegisterBegin: vi.fn(() => Promise.resolve({ options: {} })),
      passkeyRegisterComplete: vi.fn(() =>
        Promise.resolve({ id: "pk_1", device_name: null, created_at: "", last_used_at: null })
      ),
    } as unknown as AuthApi;

    const prompt = deferred<unknown>();
    const flow = createPasskeyRegistrationFlow({
      api,
      webauthnCreate: () => prompt.promise,
    });

    const begun = flow.begin();
    await tick();
    expect(flow.machine.getState().step).toBe("awaitingCredential");

    // The host drives the ceremony manually (the injected prompt hangs) …
    await flow.submitCredential({ id: "manual" });
    expect(flow.machine.getState().step).toBe("registered");

    // … then the hung prompt rejects late. Success must not become "error".
    prompt.reject(new Error("late timeout"));
    await begun;
    expect(flow.machine.getState().step).toBe("registered");
  });
});
