/**
 * 4401 IS NOT TERMINAL — the property that made this pair write its own socket
 * client, verified against the one it now uses.
 *
 * 4401 is a statement about the CREDENTIAL, not about the socket: the access
 * token expired, or the handshake carried none. A credential can be renewed,
 * and only a refusal to a RENEWED credential is a verdict. The rule this
 * replaced — "4401 and 4403 mean never come back" — is what turned a
 * credential-channel mismatch into a product that refreshed every few seconds
 * for months.
 *
 * `@stapel/realtime` expresses it as `closeDisposition(4401) ===
 * "reauthenticate"` plus a session seam, and `<RealtimeProvider>` adopts core's
 * ACTIVE `SessionManager` for it — so the three outcomes below are core's own
 * `RefreshOutcome`, not a second copy of them living in chat:
 *
 *   renewed     → reconnect at once, no backoff. The person is looking at it.
 *   no verdict  → back off and try again. A 502 mid-redeploy says nothing
 *                 about the credential, and must never sign anyone out.
 *   refused     → a NAMED session refusal the person can act on.
 *
 * Everything here runs through the real handshake: no injected transport, and
 * no `Authorization` header, because a browser has none to give.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REFRESH_UNAVAILABLE, createSessionManager } from "@stapel/core";
import type { RefreshOutcome, SessionManager } from "@stapel/core";
import {
  chatConversationStream,
  chatInboxStream,
  useChatFreshness,
} from "../src/index.js";
import {
  ChatServer,
  TestHarness,
  installBrowserWebSocket,
  mockServer,
} from "./harness.js";
import type { BrowserWebSocketEnvironment } from "./harness.js";

const VIEWER = "u-buyer";
const INBOX = chatInboxStream(VIEWER);
const SOCKET_ORIGIN = "wss://chat.test";

let env: BrowserWebSocketEnvironment;
const retries: { fn: () => void; delay: number }[] = [];
let refreshCalls = 0;

beforeEach(() => {
  retries.length = 0;
  refreshCalls = 0;
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

/** A surface whose socket opens at once — an inbox has no cursor to wait for. */
function Inbox(): React.ReactElement {
  const freshness = useChatFreshness(INBOX, () => [], {
    fallbackRefetchInterval: 0,
  });
  return (
    <div>
      <span data-testid="transport">{freshness.transport}</span>
      <span data-testid="degraded">{freshness.degraded?.reason ?? "none"}</span>
    </div>
  );
}

function mount(outcome: () => Promise<RefreshOutcome>): SessionManager {
  // The ACTIVE manager — the one `<RealtimeProvider>` adopts, and the one
  // whose `refresh()` is single-flight for the whole app.
  const manager = createSessionManager({
    doRefresh: async () => {
      refreshCalls += 1;
      return outcome();
    },
  });
  manager.markAuthenticated();
  render(
    <TestHarness
      server={mockServer({})}
      realtime={{
        socketUrl: SOCKET_ORIGIN,
        schedule: (fn, delay) => {
          retries.push({ fn, delay });
          return () => {
            const index = retries.findIndex((entry) => entry.fn === fn);
            if (index >= 0) retries.splice(index, 1);
          };
        },
        random: () => 0.5,
      }}
    >
      <Inbox />
    </TestHarness>
  );
  return manager;
}

async function connected(): Promise<ChatServer> {
  await waitFor(() => expect(env.sockets.length).toBeGreaterThan(0));
  const server = new ChatServer(env.last(), { stream: INBOX.key, ephemeral: true });
  act(() => {
    server.accept();
  });
  return server;
}

/** Let the refresh promise and the reconnect it schedules settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("outcome 1 — renewed: reconnect at once, with no backoff", () => {
  it("spends exactly one refresh and opens a new socket immediately", async () => {
    mount(async () => "authenticated");
    await connected();
    expect(env.sockets).toHaveLength(1);

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();

    expect(refreshCalls).toBe(1);
    // A second socket, and NOT through the retry timer: a renewed credential
    // is not a fault to back off from.
    expect(env.sockets).toHaveLength(2);
    expect(retries.filter((entry) => entry.delay > 0 && entry.delay < 35_000)).toEqual([]);
    // Nothing is asking the person to sign in — the socket is coming back.
    expect(screen.getByTestId("degraded").textContent).not.toBe("sign_in_required");
  });

  it("re-arms on welcome, so a token that expires an hour later renews again", async () => {
    mount(async () => "authenticated");
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    // The reconnect is welcomed — which is what restores the one-shot budget.
    const second = new ChatServer(env.last(), { stream: INBOX.key, ephemeral: true });
    act(() => {
      second.accept();
    });

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    expect(refreshCalls).toBe(2);
    expect(env.sockets).toHaveLength(3);
  });

  it("a second 4401 WITHOUT an intervening welcome is the verdict, not a renewal loop", async () => {
    mount(async () => "authenticated");
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();
    // The fresh credential was refused too. Asking an auth service again,
    // faster, is worse than a stopped socket.
    act(() => {
      env.last().serverClose(4401);
    });
    await settle();

    expect(refreshCalls).toBe(1);
    expect(env.sockets).toHaveLength(2);
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("sign_in_required")
    );
  });
});

describe("outcome 2 — no verdict: a fault, never a logout", () => {
  it("backs off, keeps the session, and does not ask anyone to sign in", async () => {
    const manager = mount(async () => REFRESH_UNAVAILABLE);
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();

    expect(refreshCalls).toBe(1);
    // A retry is scheduled rather than performed: no verdict was obtained, so
    // this is exactly a dropped connection.
    expect(retries.some((entry) => entry.delay > 0)).toBe(true);
    expect(env.sockets).toHaveLength(1);
    // core learned this the day a 502 mid-redeploy signed everyone out.
    expect(manager.getStatus()).toBe("authenticated");
    expect(screen.getByTestId("degraded").textContent).not.toBe("sign_in_required");
  });
});

describe("outcome 3 — refused: a NAMED session refusal", () => {
  it("stops, says sign_in_required, and does not hammer the host", async () => {
    const manager = mount(async () => null);
    await connected();

    act(() => {
      env.last().serverClose(4401);
    });
    await settle();

    expect(refreshCalls).toBe(1);
    expect(env.sockets).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId("degraded").textContent).toBe("sign_in_required")
    );
    // The server ANSWERED that the credential is dead, so core tore the
    // session down — the socket's refusal and the app's are the same fact.
    expect(manager.getStatus()).toBe("unauthenticated");
  });
});

describe("the refresh is core's single-flight one", () => {
  it("two sockets that both see 4401 produce ONE refresh", async () => {
    const manager = createSessionManager({
      doRefresh: async () => {
        refreshCalls += 1;
        return "authenticated";
      },
    });
    manager.markAuthenticated();
    render(
      <TestHarness
        server={mockServer({})}
        realtime={{
          socketUrl: SOCKET_ORIGIN,
          schedule: (fn) => () => {
            void fn;
          },
        }}
      >
        <Inbox />
        <Inbox2 />
      </TestHarness>
    );
    await waitFor(() => expect(env.sockets.length).toBe(2));
    act(() => {
      env.sockets[0]?.serverClose(4401);
      env.sockets[1]?.serverClose(4401);
    });
    await settle();
    // N sockets that all see 4401 in the same second must produce ONE call —
    // the same coalescing the HTTP client's 401s already go through.
    expect(refreshCalls).toBe(1);
  });
});

/**
 * A second surface on a stream that resolves to a DIFFERENT URL, so two
 * sockets really are open. (Two inbox streams would not: the substrate keys a
 * connection by URL, and `ws/chat/inbox` is one mount — which is itself the
 * multiplexing the fleet gets for free now.)
 */
function Inbox2(): React.ReactElement {
  const freshness = useChatFreshness(
    chatConversationStream("11111111-2222-3333-4444-555555555555"),
    () => [],
    { fallbackRefetchInterval: 0 }
  );
  return <span data-testid="transport-2">{freshness.transport}</span>;
}
