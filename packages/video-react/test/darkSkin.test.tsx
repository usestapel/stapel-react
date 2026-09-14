/**
 * THE CALL SURFACE IS DERIVED FROM THE THEME, NOT PAINTED.
 *
 * Owner report 2026-09-14: "in video-call mode in the dark theme everything is
 * very bad". Measured on the stand: `<CallRoute>`'s full-screen frame and the
 * ring's phone arm filled themselves with `token.colorBgContainer` read ABOVE
 * their own `<SkinTheme>`, which in a host that themes through `data-theme`
 * alone is antd's ambient default — white — under the dark theme's light
 * text: 1.09:1 on every line of the in-call screen.
 *
 * Two gates, so the defect cannot come back by either door:
 *
 *  1. The SOURCE of the default skin carries no colour literal at all — no
 *     hex, no `rgb()`, no named colour. A colour that is not a token is a
 *     colour one theme will get wrong.
 *  2. RENDERED under `data-theme="dark"`, every fill the skin writes inline
 *     is one of the dark theme's own surface roles, every skin root says it
 *     resolved dark, and nothing is light. The same render under light
 *     resolves the light roles — the values move with the mode because they
 *     come from it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toAntdTheme } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { CallsProvider } from "../src/index.js";
import { CallPanel } from "../src/default/CallPanel.js";
import { CallRoute } from "../src/default/CallRoute.js";
import { IncomingCallOverlay } from "../src/default/IncomingCallOverlay.js";
import type { CallResponse } from "../src/api/types.js";
import { TestProviders, mockServer } from "./harness.js";

const ALICE = "u-alice";
const BOB = "u-bob";

function call(overrides: Partial<CallResponse> = {}): CallResponse {
  return {
    id: "call-1",
    thread_key: "conv-1",
    caller_id: ALICE,
    callee_id: BOB,
    room_name: "call-call-1",
    media: "video",
    state: "ringing",
    end_reason: "",
    started_at: new Date(Date.now() - 1000).toISOString(),
    answered_at: null,
    ended_at: null,
    duration_seconds: 0,
    expires_at: new Date(Date.now() + 44_000).toISOString(),
    ...overrides,
  } as CallResponse;
}

/* ── 1. the source ──────────────────────────────────────────────────────── */

const SKIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "default");

/** A colour written down rather than read from a token. */
const COLOUR_LITERAL =
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|gr[ae]y|silver|gainsboro|whitesmoke|snow|ivory)\b/i;

describe("the default skin's source carries no colour literal", () => {
  for (const file of readdirSync(SKIN_DIR).filter((f) => /\.tsx?$/.test(f))) {
    it(file, () => {
      // Code only: a comment may NAME a white sheet; the code may not paint one.
      const source = readFileSync(join(SKIN_DIR, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
      const offending = source
        .split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => COLOUR_LITERAL.test(line));
      expect(offending, offending.map((o) => `${file}:${o.index + 1}: ${o.line.trim()}`).join("\n")).toEqual(
        []
      );
    });
  }
});

/* ── 2. the render ──────────────────────────────────────────────────────── */

/** `#rrggbb` → the `rgb(r, g, b)` jsdom serialises an inline style to. */
function rgb(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (m === null) return hex;
  return `rgb(${parseInt(m[1] ?? "0", 16)}, ${parseInt(m[2] ?? "0", 16)}, ${parseInt(m[3] ?? "0", 16)})`;
}

function luminance(color: string): number {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (m === null) return 0;
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(Number(m[1])) + 0.7152 * f(Number(m[2])) + 0.0722 * f(Number(m[3]));
}

/** The fills the skin's own elements write inline, under every skin root. */
function inlineFills(): { id: string; background: string }[] {
  const found: { id: string; background: string }[] = [];
  for (const root of document.querySelectorAll<HTMLElement>("[data-stapel-skin-root]")) {
    for (const el of [root, ...root.querySelectorAll<HTMLElement>("[style]")]) {
      const background = el.style.backgroundColor;
      if (background === "" || background === "transparent") continue;
      if (el.closest("[data-stapel-skin-root]") === null) continue;
      found.push({ id: el.dataset["testid"] ?? el.tagName.toLowerCase(), background });
    }
  }
  return found;
}

function setMode(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

function room(): NonNullable<Parameters<typeof CallPanel>[0]["room"]> {
  return {
    localParticipant: {
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
    },
    switchActiveDevice: vi.fn().mockResolvedValue(undefined),
  };
}

/** Everything the call surface draws, in one document: the in-call panel with
 * its corner picture, the ring, and the route's full-screen frame reached the
 * way it is in life — the callee accepts, the grant comes back. */
async function drawEverything(): Promise<void> {
  let accepted = false;
  const server = mockServer({
    "GET /calls/active": () => ({
      body: {
        call: accepted
          ? call({ state: "accepted", answered_at: new Date().toISOString() })
          : call(),
      },
    }),
    "POST /accept": () => {
      accepted = true;
      return {
        body: {
          call: call({ state: "accepted", answered_at: new Date().toISOString() }),
          token: "tok",
          url: "wss://sfu.test",
        },
      };
    },
  });
  class Room {
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn();
    localParticipant = room().localParticipant;
  }
  render(
    <TestProviders server={server}>
      <CallPanel
        room={room()}
        call={call({ state: "accepted", answered_at: new Date().toISOString() })}
        onHangup={() => undefined}
      />
      <CallsProvider userId={BOB} notifyWhenHidden={false}>
        <IncomingCallOverlay variant="fullscreen" />
        <CallRoute loadPeer={async () => ({ Room })} />
      </CallsProvider>
    </TestProviders>
  );
  // The corner picture is drawn once the camera is published.
  await waitFor(() => expect(screen.getByTestId("video-call-pip")).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId("video-ring-overlay")).toBeTruthy());
  // The ring's avatar and fullscreen fill are photographed BEFORE the accept.
  const ringFills = inlineFills().filter((f) => f.id === "video-ring-overlay" || f.id === "video-ring-avatar");
  expect(ringFills.map((f) => f.id).sort()).toEqual(["video-ring-avatar", "video-ring-overlay"]);
  await act(async () => {
    fireEvent.click(screen.getByTestId("video-ring-accept"));
  });
  await waitFor(() => expect(screen.getByTestId("video-call-route")).toBeTruthy());
}

describe("rendered under data-theme, every fill is the mode's own role", () => {
  for (const mode of ["dark", "light"] as const) {
    it(`${mode}: the route frame, the frame, the corner picture and the ring resolve ${mode} roles`, async () => {
      setMode(mode);
      await drawEverything();

      // Every skin root the surface mounted resolved the document's mode.
      const roots = [...document.querySelectorAll<HTMLElement>("[data-stapel-skin-root]")];
      expect(roots.length).toBeGreaterThan(0);
      expect(roots.map((r) => r.dataset["stapelSkinMode"])).toEqual(roots.map(() => mode));

      const tokens = toAntdTheme(mode);
      const surfaces = new Set(
        [tokens.colorBgLayout, tokens.colorBgContainer, tokens.colorBgElevated]
          .filter((v): v is string => typeof v === "string")
          .map(rgb)
      );
      const fills = inlineFills();
      const ids = new Set(fills.map((f) => f.id));
      for (const must of ["video-call-route", "video-call-frame", "video-call-pip"]) {
        expect(ids.has(must), `${must} paints a fill`).toBe(true);
      }
      for (const fill of fills) {
        expect(surfaces.has(fill.background), `${fill.id} fill ${fill.background} is a ${mode} surface role`).toBe(
          true
        );
      }
      // The defect, stated as a number: no light fill under the dark theme.
      if (mode === "dark") {
        for (const fill of fills) {
          expect(luminance(fill.background), `${fill.id} is dark`).toBeLessThan(0.2);
        }
      }
    });
  }

  it("the two modes paint different fills, so the colour is derived rather than fixed", async () => {
    setMode("dark");
    await drawEverything();
    const dark = inlineFills().find((f) => f.id === "video-call-route")?.background;
    expect(dark).toBeDefined();
    expect(dark).toBe(rgb(String(toAntdTheme("dark").colorBgContainer)));
    expect(dark).not.toBe(rgb(String(toAntdTheme("light").colorBgContainer)));
  });
});
