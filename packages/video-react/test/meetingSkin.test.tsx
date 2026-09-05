import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionBlocked, loadReady } from "@stapel/core";
import { CallStage } from "../src/default/CallStage.js";
import { JoinGate } from "../src/default/JoinGate.js";
import { LobbyPanel } from "../src/default/LobbyPanel.js";
import { ParticipantsList } from "../src/default/ParticipantsList.js";
import { staticLobbyBag, staticMeetingBag } from "../src/index.js";
import type { ParticipantResponse, RoomResponse } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";

const ROOM: RoomResponse = {
  id: "r-1",
  join_code: "abc-defg-hij",
  scope_key: "acme-7f0c",
  access_level: "scope_trusted",
  admit_required: true,
  created_by_id: "u-9a1f",
  provider_room_ref: "lk_1",
};

const WAITING: ParticipantResponse = {
  id: "p-2",
  user_id: "u-4c02",
  status: "waiting",
  role: "guest",
  joined_at: "2026-08-24T09:14:41Z",
};

const HOST: ParticipantResponse = {
  id: "p-1",
  user_id: "u-9a1f",
  status: "admitted",
  role: "host",
  joined_at: "2026-08-24T09:12:04Z",
};

function mount(node: React.ReactElement): ReturnType<typeof render> {
  return render(<TestProviders server={mockServer({})}>{node}</TestProviders>);
}

describe("<LobbyPanel> — the lobby says what the channel is doing", () => {
  it("without a socket it renders the OFFLINE arm and a visible way to re-read", () => {
    // The §83.1 defect in one assertion: a lobby with no live channel must
    // say so and offer the manual read, never fall into a hidden timer.
    mount(
      <LobbyPanel joinCode="abc-defg-hij" isHost lobby={staticLobbyBag([WAITING])} />
    );
    expect(screen.getByTestId("video-lobby-liveness-offline")).toBeTruthy();
    expect(screen.getByTestId("video-lobby-not-live")).toBeTruthy();
  });

  it("a host answers the queue; the verdicts carry the person's id", () => {
    const admit = vi.fn();
    mount(
      <LobbyPanel
        joinCode="abc-defg-hij"
        isHost
        lobby={staticLobbyBag([WAITING], { admit })}
      />
    );
    fireEvent.click(screen.getByTestId("video-lobby-admit-p-2"));
    expect(admit).toHaveBeenCalledWith("p-2");
  });

  it("turning someone away ASKS first — the verdict is sticky", () => {
    const deny = vi.fn();
    mount(
      <LobbyPanel
        joinCode="abc-defg-hij"
        isHost
        lobby={staticLobbyBag([WAITING], { deny })}
      />
    );
    fireEvent.click(screen.getByTestId("video-lobby-deny-p-2"));
    expect(deny).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    expect(deny).toHaveBeenCalledWith("p-2");
  });

  it("a viewer who is not the host gets the REASON beside the control, not a lit primary", () => {
    mount(
      <LobbyPanel
        joinCode="abc-defg-hij"
        isHost={false}
        lobby={staticLobbyBag([WAITING], {
          verdictGate: actionBlocked("video.lobby.blocked.not_host"),
        })}
      />
    );
    const gate = screen.getByTestId("video-lobby-admit-p-2-gate");
    expect(gate.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(gate.textContent).toContain("Only the room's host");
  });

  it("nobody waiting is a designed empty state, not a zero", () => {
    mount(
      <LobbyPanel joinCode="abc-defg-hij" isHost lobby={staticLobbyBag([HOST])} />
    );
    expect(screen.getByTestId("video-lobby-empty")).toBeTruthy();
  });

  it("the guest arm carries the wait and the channel, and no verdicts", () => {
    mount(
      <LobbyPanel
        joinCode="abc-defg-hij"
        variant="guest"
        lobby={staticLobbyBag([WAITING])}
      />
    );
    expect(screen.getByTestId("video-lobby-waiting-hint")).toBeTruthy();
    expect(screen.queryByTestId("video-lobby-admit-p-2")).toBeNull();
  });
});

describe("<ParticipantsList> — a state is a tag, never a raw enum", () => {
  it("renders the mapped copy for every row and admits the page is partial", () => {
    mount(<ParticipantsList participants={loadReady([HOST, WAITING])} hasMore />);
    const rows = screen.getByTestId("video-participants-rows");
    expect(rows.textContent).toContain("In the call");
    expect(rows.textContent).toContain("Waiting");
    expect(rows.textContent).not.toContain("admitted");
    expect(screen.getByTestId("video-participants-more")).toBeTruthy();
  });
});

describe("<JoinGate> — the field, the reason, and the sticky refusal", () => {
  it("an empty code blocks the button WITH the reason on the page", () => {
    mount(<JoinGate meeting={staticMeetingBag(undefined)} />);
    const gate = screen.getByTestId("video-join-submit-gate");
    expect(gate.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(gate.textContent).toContain("Enter the code");
  });

  it("a denial renders the host's answer and offers no retry", () => {
    mount(
      <JoinGate
        meeting={staticMeetingBag({
          kind: "denied",
          room: ROOM,
          participant: WAITING,
        })}
      />
    );
    expect(screen.getByTestId("video-join-denied").textContent).toContain(
      "did not let you in"
    );
    expect(screen.queryByTestId("video-join-failed")).toBeNull();
  });
});

describe("<CallStage> — the optional peer's absence is a screen", () => {
  it("draws a designed refusal, never the integrator's install instructions", async () => {
    mount(
      <CallStage
        token="tok"
        serverUrl="wss://sfu.test"
        loadPeer={() => Promise.resolve({})}
      />
    );
    await waitFor(() => expect(screen.getByTestId("video-stage-no-peer")).toBeTruthy());
    const shown = screen.getByTestId("video-stage-no-peer").textContent ?? "";
    // The person in the room is told what is true for them and what to do
    // about it. Which npm package is missing is a fact about the deployment,
    // and it used to be printed at them (visual pass M-7).
    expect(shown).toContain("Video is not available on this device");
    expect(shown).not.toContain("livekit-client");
    expect(shown).not.toContain("callStage");
  });

  it("a module-not-found throw is the same screen, not a crash", async () => {
    mount(
      <CallStage
        token="tok"
        serverUrl="wss://sfu.test"
        loadPeer={() =>
          Promise.reject(new Error("Failed to resolve module specifier 'livekit-client'"))
        }
      />
    );
    await waitFor(() => expect(screen.getByTestId("video-stage-no-peer")).toBeTruthy());
  });

  it("connects when the peer is there, and the media slot names itself", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();
    class Room {
      connect = connect;
      disconnect = disconnect;
    }
    await act(async () => {
      mount(
        <CallStage
          token="tok"
          serverUrl="wss://sfu.test"
          loadPeer={() => Promise.resolve({ Room })}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId("video-stage-connected")).toBeTruthy()
    );
    expect(connect).toHaveBeenCalledWith("wss://sfu.test", "tok");
    // vitest runs as a dev build, so the unfilled slot is a named dashed box
    // rather than a silent null.
    expect(document.querySelector('[data-stapel-slot="renderMedia"]')).toBeTruthy();
  });

  it("no token is a sentence, not a failure", () => {
    mount(<CallStage serverUrl="wss://sfu.test" />);
    expect(screen.getByTestId("video-stage-no-token")).toBeTruthy();
  });

  /**
   * THE ONE ASSERTION THE ARMS ABOVE CANNOT MAKE.
   *
   * Every test here injects `loadPeer`, which is what makes the arms testable
   * — and it is also why nobody noticed that the built-in loader could never
   * load anything. The specifier used to be a `string`-typed constant, so no
   * bundler could see it and the browser was left resolving a BARE specifier
   * at runtime: hosts that HAD `livekit-client` installed got "video is not
   * available" on every call. The fix is a written-out `import()`, and the
   * only way to check it stays written out is to read the source: a mocked
   * loader proves nothing about the module the bundler compiles.
   */
  it("keeps the peer import a LITERAL, so a bundler can emit its chunk", () => {
    // Read from the package root — vitest runs with the package as cwd, the
    // same way `pair.test.ts` reads the manifest.
    const source = readFileSync("src/default/CallStage.tsx", "utf8");
    expect(source).toContain('import("livekit-client")');
    // …and never goes back to the indirection that broke it. Comments are
    // stripped first: this file EXPLAINS the defect, and the explanation
    // names the shape it warns against.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/import\(\s*[A-Za-z_$][\w$]*\s*\)/);
  });
});
