import { afterEach, describe, expect, it, vi } from "vitest";
import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
  defaultWebauthnCreate,
  defaultWebauthnGet,
  encodeAssertion,
  encodeAttestation,
  isWebauthnSupported,
  resolveWebauthnCreate,
  resolveWebauthnGet,
  toCreationOptions,
  toRequestOptions,
} from "../src/webauthn.js";
import {
  createPasskeyLoginFlow,
  createPasskeyRegistrationFlow,
} from "../src/flows/passkeyFlow.js";
import type { AuthApi } from "../src/api/authApi.js";
import { authResponse } from "./helpers.js";

/**
 * The DEFAULT browser WebAuthn binding (MODULE.md "WebAuthn binding"): the
 * pair drives `navigator.credentials.*` itself, converting the base64url wire
 * format stapel-auth speaks (`mfa/services.py`
 * `_build_registration_credential` / `_build_authentication_credential`) to
 * and from the ArrayBuffers the browser API speaks. An injected binding still
 * wins, and an environment with no API keeps the old thin behaviour.
 */

// ── jsdom `navigator.credentials` double ─────────────────────────────────────

interface CredentialsMock {
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function installCredentials(mock: Partial<CredentialsMock> = {}): CredentialsMock {
  const impl: CredentialsMock = {
    create: mock.create ?? vi.fn(),
    get: mock.get ?? vi.fn(),
  };
  Object.defineProperty(navigator, "credentials", {
    value: impl,
    configurable: true,
    writable: true,
  });
  // `isWebauthnSupported` also gates on the global the spec pairs with it.
  (globalThis as Record<string, unknown>)["PublicKeyCredential"] = {
    // Only its PRESENCE is what `isWebauthnSupported` reads.
    isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
  };
  return impl;
}

function uninstallCredentials(): void {
  Reflect.deleteProperty(navigator, "credentials");
  Reflect.deleteProperty(globalThis as Record<string, unknown>, "PublicKeyCredential");
}

afterEach(() => {
  uninstallCredentials();
  vi.restoreAllMocks();
});

const bytes = (...values: number[]): ArrayBuffer => new Uint8Array(values).buffer;
const view = (buffer: unknown): Uint8Array => new Uint8Array(buffer as ArrayBuffer);

/** Minimal stand-in for a browser `PublicKeyCredential`. */
function attestationCredential(): unknown {
  return {
    id: "cred-id",
    rawId: bytes(1, 2, 3),
    type: "public-key",
    authenticatorAttachment: "platform",
    getClientExtensionResults: () => ({ credProps: { rk: true } }),
    response: {
      clientDataJSON: bytes(4, 5),
      attestationObject: bytes(6, 7, 8, 9),
      getTransports: () => ["internal", "hybrid"],
    },
  };
}

function assertionCredential(withUserHandle: boolean): unknown {
  return {
    id: "cred-id",
    rawId: bytes(1, 2, 3),
    type: "public-key",
    authenticatorAttachment: null,
    getClientExtensionResults: () => ({}),
    response: {
      clientDataJSON: bytes(10),
      authenticatorData: bytes(11, 12),
      signature: bytes(13, 14, 15),
      userHandle: withUserHandle ? bytes(16) : null,
    },
  };
}

// ── base64url conversion ─────────────────────────────────────────────────────

describe("base64url ⇄ ArrayBuffer", () => {
  it("round-trips every byte value", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    const encoded = arrayBufferToBase64Url(all.buffer);
    expect(view(base64UrlToArrayBuffer(encoded))).toEqual(all);
  });

  it("emits the url alphabet and no padding", () => {
    // 0xFB 0xFF 0xFE → standard base64 "+//+", url-safe "-__-".
    expect(arrayBufferToBase64Url(bytes(0xfb, 0xff, 0xfe))).toBe("-__-");
    // 1- and 2-byte tails are where standard base64 pads with "=".
    expect(arrayBufferToBase64Url(bytes(1))).toBe("AQ");
    expect(arrayBufferToBase64Url(bytes(1, 2))).toBe("AQI");
    expect(arrayBufferToBase64Url(bytes(1, 2, 3))).toBe("AQID");
  });

  it("decodes every padding length — padded, unpadded, and standard-alphabet", () => {
    expect(view(base64UrlToArrayBuffer("AQ"))).toEqual(new Uint8Array([1]));
    expect(view(base64UrlToArrayBuffer("AQ=="))).toEqual(new Uint8Array([1]));
    expect(view(base64UrlToArrayBuffer("AQI"))).toEqual(new Uint8Array([1, 2]));
    expect(view(base64UrlToArrayBuffer("AQI="))).toEqual(new Uint8Array([1, 2]));
    expect(view(base64UrlToArrayBuffer("-__-"))).toEqual(
      new Uint8Array([0xfb, 0xff, 0xfe])
    );
    expect(view(base64UrlToArrayBuffer("+//+"))).toEqual(
      new Uint8Array([0xfb, 0xff, 0xfe])
    );
  });

  it("round-trips a payload larger than the fromCharCode argument limit", () => {
    const big = new Uint8Array(100_000);
    for (let i = 0; i < big.length; i += 1) big[i] = i % 256;
    expect(view(base64UrlToArrayBuffer(arrayBufferToBase64Url(big)))).toEqual(big);
  });

  it("accepts a view over a larger buffer without dragging in its neighbours", () => {
    const backing = new Uint8Array([9, 9, 1, 2, 3, 9]);
    expect(arrayBufferToBase64Url(backing.subarray(2, 5))).toBe("AQID");
  });

  it("empty round-trips to empty", () => {
    expect(arrayBufferToBase64Url(new Uint8Array(0))).toBe("");
    expect(view(base64UrlToArrayBuffer(""))).toEqual(new Uint8Array(0));
  });
});

// ── options decoding (server → browser) ──────────────────────────────────────

describe("server options → browser options", () => {
  it("decodes challenge, user.id and excludeCredentials[].id for create", () => {
    const options = toCreationOptions({
      rp: { id: "stapel.test", name: "Stapel" },
      user: { id: "AQID", name: "ada@stapel.test", displayName: "Ada" },
      challenge: "BAUG",
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [{ id: "BwgJ", type: "public-key", transports: ["usb"] }],
      timeout: 60_000,
      attestation: "none",
    });

    expect(view(options.challenge)).toEqual(new Uint8Array([4, 5, 6]));
    expect(view(options.user.id)).toEqual(new Uint8Array([1, 2, 3]));
    expect(view(options.excludeCredentials?.[0]?.id as ArrayBuffer)).toEqual(
      new Uint8Array([7, 8, 9])
    );
    // Everything else survives untouched — the browser owns that vocabulary.
    expect(options.rp).toEqual({ id: "stapel.test", name: "Stapel" });
    expect(options.user.name).toBe("ada@stapel.test");
    expect(options.timeout).toBe(60_000);
    expect(options.attestation).toBe("none");
  });

  it("decodes challenge and allowCredentials[].id for get", () => {
    const options = toRequestOptions({
      challenge: "AQID",
      rpId: "stapel.test",
      allowCredentials: [{ id: "BAUG", type: "public-key" }],
      userVerification: "preferred",
    });

    expect(view(options.challenge)).toEqual(new Uint8Array([1, 2, 3]));
    expect(view(options.allowCredentials?.[0]?.id as ArrayBuffer)).toEqual(
      new Uint8Array([4, 5, 6])
    );
    expect(options.rpId).toBe("stapel.test");
    expect(options.userVerification).toBe("preferred");
  });

  it("unwraps a `{ publicKey: … }` envelope", () => {
    const options = toRequestOptions({ publicKey: { challenge: "AQID" } });
    expect(view(options.challenge)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("an absent allowCredentials (usernameless) stays absent", () => {
    const options = toRequestOptions({ challenge: "AQID" });
    expect("allowCredentials" in options).toBe(false);
  });
});

// ── credential encoding (browser → server) ───────────────────────────────────

describe("browser credential → server JSON", () => {
  it("encodes an attestation the way _build_registration_credential reads it", () => {
    const json = encodeAttestation(
      attestationCredential() as PublicKeyCredential
    ) as Record<string, unknown>;

    expect(json["id"]).toBe("cred-id");
    expect(json["rawId"]).toBe("AQID");
    expect(json["type"]).toBe("public-key");
    expect(json["authenticatorAttachment"]).toBe("platform");
    expect(json["clientExtensionResults"]).toEqual({ credProps: { rk: true } });
    expect(json["response"]).toEqual({
      clientDataJSON: "BAU",
      attestationObject: "BgcICQ",
      transports: ["internal", "hybrid"],
    });
  });

  it("encodes an assertion the way _build_authentication_credential reads it", () => {
    const json = encodeAssertion(
      assertionCredential(true) as PublicKeyCredential
    ) as Record<string, unknown>;

    expect(json["rawId"]).toBe("AQID");
    expect(json["response"]).toEqual({
      clientDataJSON: "Cg",
      authenticatorData: "Cww",
      signature: "DQ4P",
      userHandle: "EA",
    });
    // A null attachment must not reach the server's enum.
    expect("authenticatorAttachment" in json).toBe(false);
  });

  it("omits userHandle when the authenticator returned none", () => {
    const json = encodeAssertion(
      assertionCredential(false) as PublicKeyCredential
    ) as Record<string, unknown>;
    expect("userHandle" in (json["response"] as Record<string, unknown>)).toBe(false);
  });
});

// ── the default binding drives navigator.credentials ─────────────────────────

describe("default binding", () => {
  it("create: passes decoded options to navigator.credentials.create, returns encoded JSON", async () => {
    const create = vi.fn(() => Promise.resolve(attestationCredential()));
    installCredentials({ create });

    const result = (await defaultWebauthnCreate({
      challenge: "AQID",
      user: { id: "BAUG", name: "ada", displayName: "Ada" },
      rp: { id: "stapel.test", name: "Stapel" },
    })) as Record<string, unknown>;

    expect(create).toHaveBeenCalledTimes(1);
    const passed = create.mock.calls[0]?.[0] as { publicKey: Record<string, unknown> };
    expect(view(passed.publicKey["challenge"])).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      view((passed.publicKey["user"] as Record<string, unknown>)["id"])
    ).toEqual(new Uint8Array([4, 5, 6]));
    expect(result["rawId"]).toBe("AQID");
  });

  it("get: passes decoded options to navigator.credentials.get, returns encoded JSON", async () => {
    const get = vi.fn(() => Promise.resolve(assertionCredential(true)));
    installCredentials({ get });

    const result = (await defaultWebauthnGet({
      challenge: "AQID",
      allowCredentials: [{ id: "BAUG", type: "public-key" }],
    })) as Record<string, unknown>;

    const passed = get.mock.calls[0]?.[0] as { publicKey: Record<string, unknown> };
    expect(view(passed.publicKey["challenge"])).toEqual(new Uint8Array([1, 2, 3]));
    const allow = passed.publicKey["allowCredentials"] as { id: unknown }[];
    expect(view(allow[0]?.id)).toEqual(new Uint8Array([4, 5, 6]));
    expect((result["response"] as Record<string, unknown>)["signature"]).toBe("DQ4P");
  });

  it("a user-cancelled prompt rejects (it does not resolve with junk)", async () => {
    installCredentials({
      get: vi.fn(() => Promise.reject(new DOMException("denied", "NotAllowedError"))),
    });
    await expect(defaultWebauthnGet({ challenge: "AQID" })).rejects.toThrow("denied");
  });

  it("a null credential is an error, not a submitted empty body", async () => {
    installCredentials({ get: vi.fn(() => Promise.resolve(null)) });
    await expect(defaultWebauthnGet({ challenge: "AQID" })).rejects.toThrow(
      "webauthn_no_credential"
    );
  });

  it("throws a named error when called with no browser API at all", async () => {
    expect(isWebauthnSupported()).toBe(false);
    await expect(defaultWebauthnCreate({ challenge: "AQID" })).rejects.toThrow(
      "webauthn_unsupported"
    );
  });
});

// ── resolution: override wins, no API stays thin ─────────────────────────────

describe("binding resolution", () => {
  it("picks the default when the API exists and nothing is injected", () => {
    installCredentials();
    expect(resolveWebauthnCreate()).toBe(defaultWebauthnCreate);
    expect(resolveWebauthnGet()).toBe(defaultWebauthnGet);
  });

  it("an injected binding wins over the default", () => {
    installCredentials();
    const injected = (): Promise<unknown> => Promise.resolve({});
    expect(resolveWebauthnCreate(injected)).toBe(injected);
    expect(resolveWebauthnGet(injected)).toBe(injected);
  });

  it("resolves to nothing where there is no browser API", () => {
    expect(resolveWebauthnCreate()).toBeUndefined();
    expect(resolveWebauthnGet()).toBeUndefined();
  });
});

// ── the flows actually use it ────────────────────────────────────────────────

describe("passkey flows on the default binding", () => {
  it("login completes with no host binding injected", async () => {
    installCredentials({ get: vi.fn(() => Promise.resolve(assertionCredential(true))) });
    const complete = vi.fn(() => Promise.resolve(authResponse()));
    const api = {
      passkeyAuthenticateBegin: vi.fn(() =>
        Promise.resolve({ session_key: "sk_1", options: { challenge: "AQID" } })
      ),
      passkeyAuthenticateComplete: complete,
    } as unknown as AuthApi;

    const flow = createPasskeyLoginFlow({ api });
    await flow.begin();

    expect(flow.machine.getState().step).toBe("authenticated");
    expect(complete).toHaveBeenCalledTimes(1);
    const [sessionKey, credential] = complete.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(sessionKey).toBe("sk_1");
    expect(credential["rawId"]).toBe("AQID");
  });

  it("registration completes with no host binding injected", async () => {
    installCredentials({
      create: vi.fn(() => Promise.resolve(attestationCredential())),
    });
    const complete = vi.fn(() =>
      Promise.resolve({ id: "pk_1", device_name: "mbp", created_at: "", last_used_at: null })
    );
    const api = {
      passkeyRegisterBegin: vi.fn(() =>
        Promise.resolve({ options: { challenge: "AQID" } })
      ),
      passkeyRegisterComplete: complete,
    } as unknown as AuthApi;

    const flow = createPasskeyRegistrationFlow({ api });
    await flow.begin("mbp");

    expect(flow.machine.getState().step).toBe("registered");
    const [credential] = complete.mock.calls[0] as unknown as [Record<string, unknown>];
    expect((credential["response"] as Record<string, unknown>)["attestationObject"]).toBe(
      "BgcICQ"
    );
  });

  it("a host override still wins over the default inside the flow", async () => {
    const nativeGet = vi.fn(() => Promise.resolve(assertionCredential(true)));
    installCredentials({ get: nativeGet });
    const complete = vi.fn(() => Promise.resolve(authResponse()));
    const api = {
      passkeyAuthenticateBegin: vi.fn(() =>
        Promise.resolve({ session_key: "sk_1", options: {} })
      ),
      passkeyAuthenticateComplete: complete,
    } as unknown as AuthApi;

    const flow = createPasskeyLoginFlow({
      api,
      webauthnGet: () => Promise.resolve({ id: "from-host-bridge" }),
    });
    await flow.begin();

    expect(nativeGet).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith("sk_1", { id: "from-host-bridge" });
  });

  it("no browser API: the flow parks on awaiting* for the host, no error", async () => {
    const api = {
      passkeyAuthenticateBegin: vi.fn(() =>
        Promise.resolve({ session_key: "sk_1", options: { challenge: "AQID" } })
      ),
      passkeyAuthenticateComplete: vi.fn(),
      passkeyRegisterBegin: vi.fn(() =>
        Promise.resolve({ options: { challenge: "AQID" } })
      ),
      passkeyRegisterComplete: vi.fn(),
    } as unknown as AuthApi;

    const login = createPasskeyLoginFlow({ api });
    await login.begin();
    expect(login.machine.getState().step).toBe("awaitingAssertion");

    const registration = createPasskeyRegistrationFlow({ api });
    await registration.begin();
    expect(registration.machine.getState().step).toBe("awaitingCredential");
  });
});
