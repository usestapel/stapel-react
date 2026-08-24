/**
 * THE HANDSHAKE, THROUGH THE PATH A BROWSER ACTUALLY TAKES.
 *
 * Every other socket test in this package injects a `ChatWebSocketFactory`,
 * which means every other socket test skips `browserWebSocketFactory` — the
 * only code that ever calls `new WebSocket(...)`, and therefore the only code
 * that can put a credential on a handshake. This file does not inject one. It
 * stands a `WebSocket` double at the environment edge and asserts on what the
 * client CONSTRUCTED, because that is the whole question: a browser cannot
 * set a header on a WebSocket, so either the credential is in the URL or in
 * the subprotocol list, or it does not exist.
 *
 * The bug this file would have caught: `new WebSocket(url)` against a
 * deployment whose Channels middleware read only the Authorization header,
 * the subprotocol and `?token=`. Every handshake closed 4401, the client
 * called 4401 permanent, and a chat "with websockets" refreshed on a timer
 * for months.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createChatSocket } from "../src/index.js";
import type {
  ChatCredentialRenewalOutcome,
  ChatServerFrame,
  ChatSocketCredential,
  ChatSocketStatus,
} from "../src/index.js";
import { installBrowserWebSocket } from "./browserSocket.js";
import type { BrowserWebSocketEnvironment } from "./browserSocket.js";
import { messageFrame } from "./fixtures.js";

const SOCKET_URL = "wss://chat.test/ws/chat/c-1";

let env: BrowserWebSocketEnvironment;

beforeEach(() => {
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

interface Driven {
  readonly frames: ChatServerFrame[];
  readonly statuses: ChatSocketStatus[];
  readonly socket: ReturnType<typeof createChatSocket>;
  readonly retries: { fn: () => void; delay: number }[];
  /** Renewals the client asked for. */
  readonly renewals: number[];
}

/**
 * The client with NO transport injected — `browserWebSocketFactory` runs for
 * real. The only things handed in are a clock and a jitter source, neither of
 * which is the subject here.
 */
function drive(
  options: {
    credential?: () => ChatSocketCredential | null;
    renew?: () => ChatCredentialRenewalOutcome | Promise<ChatCredentialRenewalOutcome>;
    maxAttempts?: number;
    maxCredentialRenewals?: number;
  } = {}
): Driven {
  const frames: ChatServerFrame[] = [];
  const statuses: ChatSocketStatus[] = [];
  const retries: { fn: () => void; delay: number }[] = [];
  const renewals: number[] = [];
  const renew = options.renew;
  const socket = createChatSocket({
    url: SOCKET_URL,
    lastSeq: () => 0,
    onFrame: (frame) => frames.push(frame),
    onStatus: (status) => statuses.push(status),
    ...(options.credential ? { credential: options.credential } : {}),
    ...(renew
      ? {
          renewCredential: () => {
            renewals.push(renewals.length + 1);
            return renew();
          },
        }
      : {}),
    schedule: (fn, delay) => {
      retries.push({ fn, delay });
      return () => {
        const index = retries.findIndex((entry) => entry.fn === fn);
        if (index >= 0) retries.splice(index, 1);
      };
    },
    random: () => 0.5,
    reconnect: {
      baseDelayMs: 100,
      maxDelayMs: 1000,
      ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
      ...(options.maxCredentialRenewals !== undefined
        ? { maxCredentialRenewals: options.maxCredentialRenewals }
        : {}),
    },
  });
  return { frames, statuses, socket, retries, renewals };
}

describe("what the client puts on the wire", () => {
  it("with no credential source it opens the COOKIE channel — one argument, no subprotocols", () => {
    drive();
    expect(env.sockets).toHaveLength(1);
    expect(env.last().url).toBe(SOCKET_URL);
    // `new WebSocket(url)`, not `new WebSocket(url, [])`: the browser attaches
    // its httpOnly JWT cookie itself. That is a real channel (core reads it
    // fourth, behind an origin allowlist) — it is simply not one this code
    // constructs.
    expect(env.last().protocols).toBeUndefined();
  });

  it("a subprotocol credential is the SECOND constructor argument", () => {
    drive({ credential: () => ({ channel: "subprotocol", token: "jwt.aaa.bbb" }) });
    // `["bearer", token]` — the pair shape core's extractor accepts, chosen
    // over `"bearer.<token>"` because a JWT's own dots survive it untouched.
    expect(env.last().protocols).toEqual(["bearer", "jwt.aaa.bbb"]);
    // …and the URL is left alone: a token in a query string lands in every
    // proxy access log.
    expect(env.last().url).toBe(SOCKET_URL);
  });

  it("a query credential is percent-encoded into the URL", () => {
    drive({ credential: () => ({ channel: "query", token: "a b+c/d" }) });
    expect(env.last().url).toBe(`${SOCKET_URL}?token=a%20b%2Bc%2Fd`);
    expect(env.last().protocols).toBeUndefined();
  });

  it("a null credential still opens the socket — a cookie is a credential the JS cannot see", () => {
    drive({ credential: () => null });
    expect(env.sockets).toHaveLength(1);
    expect(env.last().protocols).toBeUndefined();
  });

  it("hello and the frames go through the real browser factory", () => {
    const d = drive({ credential: () => ({ channel: "subprotocol", token: "t" }) });
    env.last().open();
    expect(env.last().sent).toEqual([{ type: "hello", last_seq: 0 }]);
    env.last().emit(messageFrame(1));
    expect(d.frames).toHaveLength(1);
    expect(d.socket.status().state).toBe("open");
  });
});

describe("the credential is read at every connect, never captured once", () => {
  it("a reconnect carries the token the host holds NOW", () => {
    let token = "first";
    const d = drive({ credential: () => ({ channel: "subprotocol", token }) });
    env.last().open();
    expect(env.last().protocols).toEqual(["bearer", "first"]);

    // The socket drops; meanwhile the host rotated its access token.
    env.last().serverClose(1006);
    token = "second";
    d.retries[0]?.fn();
    expect(env.sockets).toHaveLength(2);
    expect(env.last().protocols).toEqual(["bearer", "second"]);
  });
});

describe("4401 is a statement about the CREDENTIAL, not about the socket", () => {
  it("without a renewal seam it stops AND SAYS unauthenticated — never a silent fall-through", () => {
    const d = drive();
    env.last().serverClose(4401);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unauthenticated",
      reason: "credential_rejected",
    });
    // No blind retry either: hammering a host that already declined is the
    // other half of the same mistake.
    expect(d.retries).toHaveLength(0);
    expect(env.sockets).toHaveLength(1);
  });

  it("renews, then reconnects WITH THE RENEWED CREDENTIAL", async () => {
    let token = "expired";
    const d = drive({
      credential: () => ({ channel: "subprotocol", token }),
      renew: () => {
        token = "fresh";
        return "renewed";
      },
    });
    expect(env.last().protocols).toEqual(["bearer", "expired"]);

    env.last().serverClose(4401);
    // The renewal is async; the status says what is happening meanwhile.
    expect(d.socket.status()).toMatchObject({
      state: "connecting",
      reason: "credential_rejected",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(d.renewals).toHaveLength(1);
    expect(env.sockets).toHaveLength(2);
    expect(env.last().protocols).toEqual(["bearer", "fresh"]);
  });

  it("a renewal the server REFUSES is the verdict: stop, and surface it", async () => {
    const d = drive({ renew: () => "refused" });
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unauthenticated",
    });
    expect(env.sockets).toHaveLength(1);
  });

  it("a renewal that reaches NO VERDICT is a fault, not a logout", async () => {
    // core learned this the day a 502 mid-redeploy signed everyone out: an
    // unreachable auth service says nothing about the credential.
    const d = drive({ renew: () => "unavailable" });
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.socket.status()).toMatchObject({
      state: "degraded",
      refusal: undefined,
      reason: "credential_rejected",
    });
    expect(d.retries).toHaveLength(1);
  });

  it("a THROWING renewal is treated as no verdict either", async () => {
    const d = drive({
      renew: () => {
        throw new Error("network down");
      },
    });
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.socket.status().state).toBe("degraded");
  });

  it("renews at most once per socket — a second 4401 on a fresh credential is an answer", async () => {
    const d = drive({ renew: () => "renewed" });
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(env.sockets).toHaveLength(2);

    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.renewals).toHaveLength(1);
    expect(env.sockets).toHaveLength(2);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unauthenticated",
    });
  });

  it("a successful handshake restores the renewal budget", async () => {
    const d = drive({ renew: () => "renewed" });
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    env.last().open();

    // Hours later the access token expires on a live socket (4401 again).
    env.last().serverClose(4401);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.renewals).toHaveLength(2);
    expect(env.sockets).toHaveLength(3);
  });
});

describe("the other close codes, through the same path", () => {
  it("4403 stops — a right is not renewable", () => {
    const d = drive({ renew: () => "renewed" });
    env.last().serverClose(4403);
    expect(d.renewals).toHaveLength(0);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "forbidden",
    });
  });

  it("4408 (heartbeat) reconnects — it is a fault, not an answer", () => {
    const d = drive();
    env.last().open();
    env.last().serverClose(4408);
    expect(d.socket.status()).toMatchObject({
      state: "degraded",
      reason: "heartbeat",
    });
    expect(d.retries).toHaveLength(1);
  });

  it("the retry budget ends in a NAMED closed state, not in silence", () => {
    const d = drive({ maxAttempts: 2 });
    env.last().open();
    env.last().serverClose(1006);
    d.retries[0]?.fn();
    env.last().serverClose(1006);
    expect(d.socket.status()).toMatchObject({
      state: "closed",
      refusal: "unreachable",
      reason: "transport",
    });
  });
});
