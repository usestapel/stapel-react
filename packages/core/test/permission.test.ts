/**
 * What has to hold about `usePermission`, and why each of these is a test
 * rather than a comment:
 *
 * - the five states really are five, and `unknown` (Safari's answer for a
 *   media permission) is never rendered as a refusal;
 * - a refusal is a VALUE — `request()` resolves, it does not reject, because
 *   every caller of it is inside a click handler;
 * - the caller's own `requester` is what gets called, so the browser is
 *   prompted once and not twice;
 * - a media prompt does not leave the device open afterwards.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePermission, permissionSupported, PERMISSION_KINDS } from "../src/permission.js";

interface FakeQueryResult {
  state: PermissionState;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}

function stubPermissionsApi(
  answers: Partial<Record<string, PermissionState | "throw">>
): { fire: (name: string) => void } {
  const listeners = new Map<string, () => void>();
  const query = vi.fn(async ({ name }: { name: string }) => {
    const answer = answers[name];
    if (answer === undefined || answer === "throw") {
      throw new TypeError(`unsupported permission name: ${name}`);
    }
    const result: FakeQueryResult = {
      state: answer,
      addEventListener: (_type, listener) => listeners.set(name, listener),
      removeEventListener: () => listeners.delete(name),
    };
    return result as unknown as PermissionStatus;
  });
  vi.stubGlobal("navigator", {
    ...navigator,
    permissions: { query },
  });
  return {
    fire: (name) => {
      listeners.get(name)?.();
    },
  };
}

function stubGeolocation(impl: Partial<Geolocation>): void {
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: { getCurrentPosition: vi.fn(), ...impl },
    permissions: (navigator as Navigator & { permissions?: Permissions }).permissions,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("permissionSupported", () => {
  it("is false for every kind when the browser ships none of the APIs", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("Notification", undefined);
    for (const kind of PERMISSION_KINDS) {
      expect(permissionSupported(kind)).toBe(false);
    }
  });

  it("is true for a kind whose API exists", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn() } });
    expect(permissionSupported("geolocation")).toBe(true);
    expect(permissionSupported("camera")).toBe(false);
  });
});

describe("usePermission — reading the state without prompting", () => {
  it("reports `prompt` for a capability nobody has been asked about", async () => {
    stubGeolocation({});
    stubPermissionsApi({ geolocation: "prompt" });
    stubGeolocation({});
    const { result } = renderHook(() => usePermission("geolocation"));
    await waitFor(() => {
      expect(result.current.status).toBe("prompt");
    });
    expect(result.current.supported).toBe(true);
  });

  it("reports `denied` — the state a UI must stop offering a button for", async () => {
    stubPermissionsApi({ geolocation: "denied" });
    stubGeolocation({});
    const { result } = renderHook(() => usePermission("geolocation"));
    await waitFor(() => {
      expect(result.current.status).toBe("denied");
    });
  });

  it("reports `unknown`, not `denied`, when the Permissions API refuses the name", async () => {
    // Safari, for `camera`. "Ask and find out" — never a refusal.
    stubPermissionsApi({ camera: "throw" });
    vi.stubGlobal("navigator", {
      permissions: (navigator as Navigator & { permissions?: Permissions }).permissions,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    const { result } = renderHook(() => usePermission("camera"));
    await waitFor(() => {
      expect(result.current.status).toBe("unknown");
    });
    expect(result.current.supported).toBe(true);
  });

  it("reports `unsupported` where the capability does not exist", async () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => usePermission("camera"));
    await waitFor(() => {
      expect(result.current.status).toBe("unsupported");
    });
    expect(result.current.supported).toBe(false);
  });

  it("reports `unsupported` when the DEPLOYMENT turned the offer off", async () => {
    stubGeolocation({});
    const { result } = renderHook(() =>
      usePermission("geolocation", { offered: false })
    );
    await waitFor(() => {
      expect(result.current.status).toBe("unsupported");
    });
  });

  it("reads notifications off Notification.permission, not the Permissions API", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(),
    });
    const { result } = renderHook(() => usePermission("notifications"));
    await waitFor(() => {
      expect(result.current.status).toBe("granted");
    });
  });

  it("follows a change made in browser settings, with no reload", async () => {
    const api = stubPermissionsApi({ geolocation: "prompt" });
    stubGeolocation({});
    const { result } = renderHook(() => usePermission("geolocation"));
    await waitFor(() => {
      expect(result.current.status).toBe("prompt");
    });
    // The person opens site settings and blocks it.
    stubPermissionsApi({ geolocation: "denied" });
    act(() => {
      api.fire("geolocation");
    });
    await waitFor(() => {
      expect(result.current.status).toBe("denied");
    });
  });
});

describe("usePermission — asking", () => {
  it("calls the CALLER's requester, so the browser prompts once", async () => {
    const requester = vi.fn(async () => "a position");
    stubPermissionsApi({ geolocation: "prompt" });
    stubGeolocation({});
    const { result } = renderHook(() => usePermission("geolocation", { requester }));
    await waitFor(() => {
      expect(result.current.status).toBe("prompt");
    });
    let answer: string | undefined;
    await act(async () => {
      answer = await result.current.request();
    });
    expect(requester).toHaveBeenCalledTimes(1);
    expect(answer).toBe("granted");
    expect(result.current.status).toBe("granted");
  });

  it("resolves with `denied` rather than rejecting, for a refusal", async () => {
    const requester = vi.fn(async () => {
      throw Object.assign(new Error("no"), { code: 1 });
    });
    stubPermissionsApi({ geolocation: "prompt" });
    stubGeolocation({});
    const { result } = renderHook(() => usePermission("geolocation", { requester }));
    await waitFor(() => {
      expect(result.current.status).toBe("prompt");
    });
    let answer: string | undefined;
    await act(async () => {
      answer = await result.current.request();
    });
    expect(answer).toBe("denied");
    expect(result.current.status).toBe("denied");
  });

  it("reads NotAllowedError as denied and NotFoundError as unsupported", async () => {
    for (const [name, expected] of [
      ["NotAllowedError", "denied"],
      ["NotFoundError", "unsupported"],
    ] as const) {
      const requester = vi.fn(async () => {
        throw Object.assign(new Error(name), { name });
      });
      stubPermissionsApi({ camera: "throw" });
      vi.stubGlobal("navigator", {
        permissions: (navigator as Navigator & { permissions?: Permissions }).permissions,
        mediaDevices: { getUserMedia: vi.fn() },
      });
      const { result } = renderHook(() => usePermission("camera", { requester }));
      let answer: string | undefined;
      await act(async () => {
        answer = await result.current.request();
      });
      expect(answer).toBe(expected);
    }
  });

  it("does not leave the camera open after the prompt was the whole point", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { result } = renderHook(() => usePermission("camera"));
    await act(async () => {
      await result.current.request();
    });
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("asks for audio, not video, for the microphone", async () => {
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [] }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { result } = renderHook(() => usePermission("microphone"));
    await act(async () => {
      await result.current.request();
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it("turns Notification.requestPermission's answer into the status", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(async () => "denied"),
    });
    const { result } = renderHook(() => usePermission("notifications"));
    let answer: string | undefined;
    await act(async () => {
      answer = await result.current.request();
    });
    expect(answer).toBe("denied");
  });

  it("answers `unsupported` without touching anything when it cannot ask", async () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => usePermission("camera"));
    let answer: string | undefined;
    await act(async () => {
      answer = await result.current.request();
    });
    expect(answer).toBe("unsupported");
  });
});
