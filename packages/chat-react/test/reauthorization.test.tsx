/**
 * THE MID-SOCKET RE-CHECK (stapel-realtime 0.2.3, stapel-chat 0.11.0).
 *
 * The consumer re-asks `authorize()` every `AUTHORIZE_CACHE_S` on an open
 * socket. Losing access answers `error{code=unauthorized}` and closes 4403;
 * an authorizer that raised closes 1011. The terminal set is
 * {4403, 4404, 4410}; 4401 is a session refresh, never terminal. These two
 * closes must stay apart: a 4403 retried is a loop against a verdict, and a
 * 1011 treated as a verdict strands a member behind a transient fault.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TERMINAL_CLOSE_CODES } from "@stapel/realtime";
import { ConversationThread, chatConversationStream } from "../src/index.js";
import type { ChatRealtimeOptions } from "../src/index.js";
import { ChatServer, TestHarness, installBrowserWebSocket, mockServer } from "./harness.js";
import type { BrowserWebSocketEnvironment } from "./harness.js";
import { CONVERSATION_ID, messagePage } from "./fixtures.js";

const STREAM = chatConversationStream(CONVERSATION_ID).key;

let env: BrowserWebSocketEnvironment;
const retries: { fn: () => void; delay: number }[] = [];

beforeEach(() => {
  retries.length = 0;
  env = installBrowserWebSocket();
});

afterEach(() => {
  env.restore();
});

function mount(): void {
  const server = mockServer({
    "GET /messages": () => ({ body: messagePage([3, 2, 1]) }),
  });
  const realtime: ChatRealtimeOptions = {
    socketUrl: "wss://chat.test",
    schedule: (fn, delay) => {
      retries.push({ fn, delay });
      return () => {
        const index = retries.findIndex((entry) => entry.fn === fn);
        if (index >= 0) retries.splice(index, 1);
      };
    },
    random: () => 0.5,
  };
  render(
    <TestHarness server={server} realtime={realtime}>
      <ConversationThread conversationId={CONVERSATION_ID} autoMarkRead={false}>
        {({ transport, degraded }) => (
          <div>
            <span data-testid="transport">{transport}</span>
            <span data-testid="degraded">{degraded?.reason ?? "none"}</span>
          </div>
        )}
      </ConversationThread>
    </TestHarness>
  );
}

async function live(): Promise<ChatServer> {
  await waitFor(() => expect(env.sockets.length).toBeGreaterThan(0));
  const consumer = new ChatServer(env.last(), { stream: STREAM });
  act(() => {
    consumer.accept();
  });
  await waitFor(() => expect(screen.getByTestId("transport").textContent).toBe("socket"));
  return consumer;
}

describe("the periodic re-authorization", () => {
  it("the client's terminal set is the server's: 4403, 4404, 4410 and not 4401", () => {
    expect([...TERMINAL_CLOSE_CODES].sort()).toEqual([4403, 4404, 4410]);
  });

  it("lost access on a long-open socket is a verdict: named, and never retried", async () => {
    mount();
    const consumer = await live();
    retries.length = 0;

    act(() => {
      consumer.loseAccess();
    });

    await waitFor(() => expect(screen.getByTestId("degraded").textContent).toBe("forbidden"));
    // No reconnect is scheduled and no second socket opens.
    expect(retries).toHaveLength(0);
    expect(env.sockets).toHaveLength(1);
  });

  it("an authorizer that raised (1011) is a fault: the client reconnects and is asked again", async () => {
    mount();
    const consumer = await live();
    retries.length = 0;

    act(() => {
      consumer.authorizerFailed();
    });

    await waitFor(() => expect(retries.length).toBeGreaterThan(0));
    expect(screen.getByTestId("degraded").textContent).not.toBe("forbidden");
    act(() => {
      retries.shift()?.fn();
    });
    expect(env.sockets).toHaveLength(2);
  });
});
