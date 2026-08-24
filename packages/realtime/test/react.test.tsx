/**
 * The React surface. What matters here is not that a hook renders — it is that
 * `reconnecting` and `refused` reach the tree at all, because a socket that
 * degrades invisibly is the failure this package exists to end.
 */
import { act, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RealtimeProvider, useRealtimeState, useStream } from "../src/react/index.js";
import type { RealtimeFrame } from "../src/index.js";
import { FakeServer, STREAM, fakeTransport, kickFrame, manualClock } from "./fakeServer.js";

const transport = fakeTransport();
const clock = manualClock();

function Wrapper(props: { children: ReactNode }): ReactElement {
  return (
    <RealtimeProvider
      url="wss://api.example.test/ws/chat/7"
      webSocket={transport.factory}
      schedule={clock.schedule}
      random={() => 1}
      session={null}
    >
      {props.children}
    </RealtimeProvider>
  );
}

function Panel(props: { onFrame?: (frame: RealtimeFrame) => void }): ReactElement {
  const stream = useStream(STREAM, {
    ...(props.onFrame ? { onFrame: props.onFrame } : {}),
  });
  const connection = useRealtimeState();
  return (
    <div>
      <output data-testid="stream">{stream.status.state}</output>
      <output data-testid="cursor">{String(stream.status.cursor)}</output>
      <output data-testid="reason">{stream.status.reason ?? "-"}</output>
      <output data-testid="connection">{connection.state}</output>
      <output data-testid="refused">{String(connection.refused)}</output>
      <output data-testid="cursors">{JSON.stringify(connection.cursors)}</output>
    </div>
  );
}

afterEach(() => {
  transport.sockets.length = 0;
  clock.pending.length = 0;
});

describe("RealtimeProvider + useStream + useRealtimeState", () => {
  it("walks connecting → replaying → live and publishes the resume cursor", () => {
    const frames: RealtimeFrame[] = [];
    render(
      <Wrapper>
        <Panel onFrame={(frame) => frames.push(frame)} />
      </Wrapper>
    );
    expect(screen.getByTestId("stream").textContent).toBe("connecting");

    const socket = transport.last();
    const server = new FakeServer(socket);
    server.fill(2);
    act(() => {
      socket.accept();
      server.pump();
    });

    expect(screen.getByTestId("stream").textContent).toBe("live");
    expect(screen.getByTestId("connection").textContent).toBe("open");
    expect(screen.getByTestId("cursor").textContent).toBe("2");
    expect(JSON.parse(screen.getByTestId("cursors").textContent ?? "{}")).toEqual({
      [STREAM]: 2,
    });
    expect(frames.map((f) => f.type)).toEqual([
      "welcome",
      "replay",
      "replay",
      "replay_done",
    ]);
  });

  it("shows `reconnecting` instead of pretending nothing happened", () => {
    render(
      <Wrapper>
        <Panel />
      </Wrapper>
    );
    const socket = transport.last();
    act(() => {
      socket.accept();
      new FakeServer(socket).pump();
    });
    act(() => {
      socket.serverClose(1006);
    });
    expect(screen.getByTestId("stream").textContent).toBe("reconnecting");
    expect(screen.getByTestId("connection").textContent).toBe("reconnecting");
  });

  it("shows a refusal with the server's reason", () => {
    render(
      <Wrapper>
        <Panel />
      </Wrapper>
    );
    const socket = transport.last();
    act(() => {
      socket.accept();
      new FakeServer(socket).pump();
      socket.deliver(kickFrame(STREAM, "removed_from_conversation"));
      socket.serverClose(4410);
    });
    expect(screen.getByTestId("stream").textContent).toBe("refused");
    expect(screen.getByTestId("reason").textContent).toBe("removed_from_conversation");
    expect(screen.getByTestId("refused").textContent).toBe("true");
  });

  it("does not resubscribe when an inline callback changes identity", () => {
    // A resubscribe is a full replay. Doing one per keystroke is how a chat
    // that "works" costs the server the whole journal every few seconds.
    function Typing(): ReactElement {
      const [draft, setDraft] = useState("");
      useStream(STREAM, { onFrame: () => undefined });
      return (
        <button type="button" onClick={() => setDraft(`${draft}x`)}>
          {draft.length}
        </button>
      );
    }
    render(
      <Wrapper>
        <Typing />
      </Wrapper>
    );
    const before = transport.sockets.length;
    act(() => {
      screen.getByRole("button").click();
      screen.getByRole("button").click();
    });
    expect(transport.sockets).toHaveLength(before);
  });

  it("unsubscribes on unmount, which closes the last socket on that URL", () => {
    const view = render(
      <Wrapper>
        <Panel />
      </Wrapper>
    );
    const socket = transport.last();
    act(() => {
      socket.accept();
    });
    view.unmount();
    expect(socket.closedByClient).toBe(true);
  });

  it("says nothing is connected outside a provider", () => {
    function Bare(): ReactElement {
      const state = useRealtimeState();
      return <output data-testid="bare">{state.state}</output>;
    }
    render(<Bare />);
    expect(screen.getByTestId("bare").textContent).toBe("idle");
  });

  it("refuses to pretend a stream hook works without a provider", () => {
    function Bare(): ReactElement {
      useStream(STREAM);
      return <div />;
    }
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(/RealtimeProvider/);
    quiet.mockRestore();
  });
});
