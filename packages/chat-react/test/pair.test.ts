import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSessionManager } from "@stapel/core";
import {
  CHAT_FLOWS,
  chatQueryKeys,
  chatI18nBundleEn,
  createChatRuntime,
  flowEndpoints,
  navEntries,
  nextReadMarker,
  registerChatI18n,
} from "../src/index.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces under the module root", () => {
    expect(chatQueryKeys.all[0]).toBe("chat");
    expect(chatQueryKeys.thread("c-1")).toEqual(["chat", "thread", "c-1"]);
    expect(chatQueryKeys.readMarker("c-1")).toEqual(["chat", "read-marker", "c-1"]);
  });
});

describe("the read marker only moves forward", () => {
  it("sends a higher seq", () => {
    expect(nextReadMarker(3, 7)).toBe(7);
    expect(nextReadMarker(undefined, 1)).toBe(1);
  });

  it("sends nothing for a seq already reported", () => {
    expect(nextReadMarker(7, 7)).toBeNull();
    expect(nextReadMarker(7, 3)).toBeNull();
  });

  it("sends nothing for seq 0 — there is no such message", () => {
    expect(nextReadMarker(undefined, 0)).toBeNull();
    expect(nextReadMarker(undefined, Number.NaN)).toBeNull();
  });
});

describe("i18n registration", () => {
  it("pins the module-scoped unknown fallback", () => {
    expect(chatI18nBundleEn["chat.error.unknown"]).toBeTruthy();
  });

  it("registers the bundle into a core i18n engine", () => {
    const seen: Record<string, unknown> = {};
    registerChatI18n({
      registerBundle: (_locale: string, dict: Record<string, unknown>) => {
        Object.assign(seen, dict);
      },
    } as never);
    expect(seen["chat.error.unknown"]).toBeTruthy();
  });
});

describe("zero-flow registry shim", () => {
  it("stapel-chat annotates no flows, and the surface says so at that shape", () => {
    expect(CHAT_FLOWS).toEqual({});
    expect(flowEndpoints("never" as never)).toEqual([]);
  });
});

describe("self-description (frontend-core §2.4 — drift-gated manifest)", () => {
  it("manifest.json describes this package + its backend contract", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
    expect(manifest.package).toBe("@stapel/chat-react");
    expect(manifest.backend.module).toBe("stapel-chat");
    expect(manifest.backend.contract).toBeTruthy();
    expect(Array.isArray(manifest.layers)).toBe(true);
  });
});

describe("the nav manifest", () => {
  it("declares one MEMBER screen with a unique id and an i18n label", () => {
    // Chat is authenticated end to end: every endpoint is IsAuthenticated and
    // the socket closes 4401 without a session. A public container that
    // forgot the audience filter must not be able to mount this.
    expect(navEntries).toHaveLength(1);
    const ids = new Set(navEntries.map((entry) => entry.id));
    expect(ids.size).toBe(navEntries.length);
    for (const entry of navEntries) {
      expect(entry.surface).toBe("member");
      expect(entry.requiresAuth).toBe(true);
      expect(entry.labelKey in chatI18nBundleEn).toBe(true);
      expect(entry.component.subpath).toBe("default");
    }
  });

  it("the emitted nav-manifest.json matches the source entries", () => {
    const emitted = JSON.parse(readFileSync("nav-manifest.json", "utf8"));
    expect(emitted.package).toBe("@stapel/chat-react");
    expect(emitted.entries.map((e: { id: string }) => e.id)).toEqual(
      navEntries.map((entry) => entry.id)
    );
  });

  it("its component is really exported from the /default subpath", async () => {
    // The nav contract addresses a NAMED export off a subpath, and the
    // scaffold's codegen imports it by that name — a typo here is only ever
    // discovered when a container is built, unless it is tested here.
    const skin = (await import("../src/default/index.js")) as Record<string, unknown>;
    for (const entry of navEntries) {
      expect(typeof skin[entry.component.export]).toBe("function");
    }
  });
});

describe("logout hook (frontend-core-architecture-v2 §43.7 — pair contract)", () => {
  it("registers a logout hook (no-op by default) on the active SessionManager", async () => {
    const manager = createSessionManager({ doRefresh: async () => null });
    const spy = vi.spyOn(manager, "registerLogoutHook");
    createChatRuntime({
      baseUrl: "/chat/api/v1",
      realtime: { socketUrl: null },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(manager.logout()).resolves.toBeUndefined();
  });
});
