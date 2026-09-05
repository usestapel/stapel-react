/**
 * `<CallPanel>` — the controls, the clock and the two states a call has.
 *
 * The room is a plain object here, not a fake SDK: the panel touches exactly
 * four methods, they are declared structurally for that reason, and a test
 * that stood up a mock LiveKit would be testing the mock.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CallPanel } from "../src/default/CallPanel.js";
import type { CallMediaRoom } from "../src/default/CallPanel.js";
import type { CallResponse } from "../src/api/types.js";
import { TestProviders, mockServer } from "./harness.js";

const ANSWERED_AT = "2026-09-06T10:00:00+00:00";

function accepted(overrides: Partial<CallResponse> = {}): CallResponse {
  return {
    id: "call-1",
    thread_key: "conv-1",
    caller_id: "u-alice",
    callee_id: "u-bob",
    room_name: "call-call-1",
    media: "video",
    state: "accepted",
    end_reason: "",
    started_at: "2026-09-06T09:59:55+00:00",
    answered_at: ANSWERED_AT,
    ended_at: null,
    duration_seconds: 0,
    expires_at: null,
    ...overrides,
  } as CallResponse;
}

function room(overrides: Partial<CallMediaRoom> = {}): CallMediaRoom {
  return {
    localParticipant: {
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
    },
    switchActiveDevice: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function draw(props: Partial<Parameters<typeof CallPanel>[0]> = {}): void {
  const server = mockServer({});
  render(
    <TestProviders server={server}>
      <CallPanel
        room={props.room ?? room()}
        call={props.call ?? accepted()}
        onHangup={props.onHangup ?? (() => undefined)}
        {...props}
      />
    </TestProviders>
  );
}

describe("the timer is the server's", () => {
  it("counts from answered_at, not from when this browser mounted", () => {
    // Both people's screens say the same thing, and a reconnect does not
    // restart the clock. A locally-started timer disagrees with the
    // call line the thread will show.
    draw({ now: () => Date.parse(ANSWERED_AT) + 192_000 });
    expect(screen.getByTestId("video-call-clock").textContent).toBe("3:12");
  });

  it("shows no clock before the call is answered", () => {
    draw({ call: accepted({ state: "ringing", answered_at: null }) });
    expect(screen.queryByTestId("video-call-clock")).toBeNull();
  });
});

describe("the controls", () => {
  it("mutes and unmutes through the room", async () => {
    const media = room();
    draw({ room: media });
    fireEvent.click(screen.getByTestId("video-call-mic"));
    await waitFor(() => {
      expect(media.localParticipant?.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });
    expect(screen.getByTestId("video-call-mic").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("does not fire twice on a double tap", async () => {
    // Both handlers would read the SAME stale value, and the second would set
    // the device back to where it started while the UI said otherwise.
    let resolve: (() => void) | undefined;
    const media = room({
      localParticipant: {
        setMicrophoneEnabled: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolve = r;
            })
        ),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      },
    });
    draw({ room: media });
    const button = screen.getByTestId("video-call-mic");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(media.localParticipant?.setMicrophoneEnabled).toHaveBeenCalledTimes(1);
    resolve?.();
  });

  it("explains a permission denial differently from a device failure", async () => {
    // One is fixed in the browser's site settings, the other by closing
    // whatever holds the device. Read off the DOMException's name, because the
    // message text is not stable across engines.
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const media = room({
      localParticipant: {
        // Turning a device OFF cannot be refused by a permission — only
        // acquiring one can — so the fake refuses exactly the direction the
        // platform refuses.
        setMicrophoneEnabled: vi.fn((on: boolean) =>
          on ? Promise.reject(denied) : Promise.resolve(undefined)
        ),
        setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      },
    });
    draw({ room: media, call: accepted() });
    fireEvent.click(screen.getByTestId("video-call-mic"));
    await waitFor(() => {
      expect(screen.getByTestId("video-call-mic").getAttribute("aria-pressed")).toBe(
        "true"
      );
    });
    fireEvent.click(screen.getByTestId("video-call-mic"));
    await waitFor(() => {
      expect(screen.getByTestId("video-call-device-notice")).toBeTruthy();
    });
    expect(screen.getByTestId("video-call-device-notice").textContent).toMatch(
      /settings/iu
    );
  });

  it("offers the camera flip only when there is another camera", () => {
    draw({ cameras: [{ deviceId: "a", label: "Front" }] });
    expect(screen.queryByTestId("video-call-flip")).toBeNull();
  });

  it("switches the device rather than swapping a facingMode constraint", async () => {
    const media = room();
    draw({
      room: media,
      cameras: [
        { deviceId: "front", label: "Front" },
        { deviceId: "back", label: "Back" },
      ],
    });
    fireEvent.click(screen.getByTestId("video-call-flip"));
    await waitFor(() => {
      expect(media.switchActiveDevice).toHaveBeenCalledWith("videoinput", "back");
    });
  });

  it("hangs up through the callback, not through the room", () => {
    // A call has to end on the SERVER — the other person's screen closes, the
    // meter stops, the thread gets its line. A panel that only disconnected
    // would leave a call the meter keeps counting.
    const media = room({ disconnect: vi.fn() });
    const onHangup = vi.fn();
    draw({ room: media, onHangup });
    fireEvent.click(screen.getByTestId("video-call-hangup"));
    expect(onHangup).toHaveBeenCalledTimes(1);
    expect(media.disconnect).not.toHaveBeenCalled();
  });
});

describe("audio-only is a state, not a broken video", () => {
  it("draws the peer instead of an empty rectangle", () => {
    draw({ call: accepted({ media: "audio" }), peerName: "Анна" });
    expect(screen.getByTestId("video-call-audio-only")).toBeTruthy();
    expect(screen.queryByTestId("video-call-pip")).toBeNull();
  });

  it("offers no camera control at all in an audio call", () => {
    draw({ call: accepted({ media: "audio" }) });
    expect(screen.queryByTestId("video-call-camera")).toBeNull();
    expect(screen.getByTestId("video-call-mic")).toBeTruthy();
  });

  /**
   * …AND THE OTHER PERSON IS STILL AUDIBLE.
   *
   * This arm used to draw the card INSTEAD of calling `renderRemote`, so the
   * host's media node was never mounted and the remote AUDIO track had no
   * element to attach to: a silent call, on the one kind of call that is
   * nothing but audio. The card is what a person sees; the sink is what they
   * hear.
   */
  it("still mounts the host's remote media, behind the card", () => {
    const seen: boolean[] = [];
    draw({
      call: accepted({ media: "audio" }),
      renderRemote: (context) => {
        seen.push(context.audioOnly);
        return <audio data-testid="host-remote" />;
      },
    });
    expect(screen.getByTestId("video-call-audio-only")).toBeTruthy();
    const sink = screen.getByTestId("video-call-audio-sink");
    expect(sink.contains(screen.getByTestId("host-remote"))).toBe(true);
    // Present in the layout, not `display: none`: a media element in a hidden
    // subtree is exactly what a browser may stop feeding.
    expect(sink.style.display).not.toBe("none");
    expect(sink.style.position).toBe("absolute");
    // The slot is TOLD which arm asked, so a host can hand back a sink rather
    // than a tile without reading the call row a second time.
    expect(seen).toContain(true);
    expect(seen).not.toContain(false);
  });

  it("draws the video arm through the same slot, said to be video", () => {
    const seen: boolean[] = [];
    draw({
      renderRemote: (context) => {
        seen.push(context.audioOnly);
        return <div data-testid="host-remote" />;
      },
    });
    expect(screen.getByTestId("host-remote")).toBeTruthy();
    expect(screen.queryByTestId("video-call-audio-sink")).toBeNull();
    expect(seen).toContain(false);
  });
});

describe("the connection state is visible", () => {
  it("says nothing while connected", () => {
    draw();
    expect(screen.queryByTestId("video-call-connection")).toBeNull();
  });

  it("offers a reconnect that re-mints the grant", () => {
    // Not a reload: the token is presented again on every full reconnect and
    // nothing re-mints it, so a Reconnect that replayed the old one fails
    // exactly when the call has been up long enough to matter.
    const onReconnect = vi.fn();
    draw({ connection: "reconnecting", onReconnect });
    expect(screen.getByTestId("video-call-connection")).toBeTruthy();
    fireEvent.click(screen.getByTestId("video-call-reconnect"));
    expect(onReconnect).toHaveBeenCalled();
  });
});
