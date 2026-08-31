// @vitest-environment jsdom
/**
 * What the permission surface has to hold:
 *
 *  - the pre-prompt explains BEFORE the browser is touched — no capability
 *    call happens until the person presses Allow;
 *  - a refusal does not close onto a dead end: the same sheet swaps to the
 *    guidance and renders the fallback;
 *  - a blocked capability has NO Allow button, because pressing it provably
 *    cannot work;
 *  - the surface is a sheet on a phone and a modal above it (inherited from
 *    SkinDialog, asserted here so a regression in the inheritance is caught
 *    in the package that owns the rule);
 *  - the copy is real translated prose from core's floor, never a raw key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { PermissionBag, PermissionStatus } from "@stapel/core";
import { Host, installMatchMedia, resetViewportListeners } from "./env.js";
import {
  PermissionGate,
  PermissionSheet,
  PERMISSION_ALLOW_TESTID,
  PERMISSION_DISMISS_TESTID,
  permissionIsBlocked,
} from "../src/skin.js";

function bagOf(
  status: PermissionStatus,
  request: () => Promise<PermissionStatus> = async () => status
): PermissionBag {
  return {
    kind: "geolocation",
    status,
    supported: status !== "unsupported",
    asking: false,
    request,
    refresh: () => undefined,
  };
}

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

function withLocale(locale: string, node: ReactElement): ReactElement {
  return <Host locale={locale}>{node}</Host>;
}

describe("permissionIsBlocked", () => {
  it("is true only where pressing a button cannot help", () => {
    expect(permissionIsBlocked("denied")).toBe(true);
    expect(permissionIsBlocked("unsupported")).toBe(true);
    expect(permissionIsBlocked("prompt")).toBe(false);
    expect(permissionIsBlocked("unknown")).toBe(false);
    expect(permissionIsBlocked("granted")).toBe(false);
  });
});

describe("PermissionSheet", () => {
  it("explains first and touches no browser API until Allow is pressed", async () => {
    const request = vi.fn(async (): Promise<PermissionStatus> => "granted");
    const onClose = vi.fn();
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt", request)}
          onClose={onClose}
          data-testid="perm"
        />
      )
    );
    expect(await screen.findByText(/Use your location\?/)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByTestId(PERMISSION_ALLOW_TESTID).click();
    });
    expect(request).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("stays open on the guidance arm when the answer is no", async () => {
    const onClose = vi.fn();
    const onResolved = vi.fn();
    const { rerender } = render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt", async () => "denied")}
          onClose={onClose}
          onResolved={onResolved}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    await act(async () => {
      screen.getByTestId(PERMISSION_ALLOW_TESTID).click();
    });
    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith("denied");
    });
    // The whole point: it did NOT close onto nothing.
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("denied")}
          onClose={onClose}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    expect(screen.getByTestId("perm").querySelector("[data-stapel-permission]")).toBeTruthy();
    expect(
      screen.getByTestId("perm").querySelector('[data-stapel-permission="denied"]')
    ).toBeTruthy();
    expect(screen.getByTestId("fallback")).toBeTruthy();
    expect(screen.getByText(/will not ask again/)).toBeTruthy();
  });

  it("puts the fallback door on screen BEFORE the refusal, not only after it", async () => {
    // Blocker C1: the door was gated on `blocked`, so the one arm that carries
    // a "Not now" button — the arm the sheet OPENS on — had nothing behind it.
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt")}
          onClose={vi.fn()}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    expect(
      screen.getByTestId("perm").querySelector('[data-stapel-permission="prompt"]')
    ).toBeTruthy();
    expect(screen.getByTestId("fallback")).toBeTruthy();
    // …and the ask is still on offer: the door is a second way out, not a
    // replacement for the question.
    expect(screen.getByTestId(PERMISSION_ALLOW_TESTID)).toBeTruthy();
  });

  it("carries the door through `unknown` too — the arm Safari answers with", () => {
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("unknown")}
          onClose={vi.fn()}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    expect(screen.getByTestId("fallback")).toBeTruthy();
  });

  it("shows no fallback once the capability is granted", () => {
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("granted")}
          onClose={vi.fn()}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    expect(screen.queryByTestId("fallback")).toBeNull();
  });

  it("closes on an unanswered prompt, so the caller can take the way around", async () => {
    // `usePermission` resolves an unanswered browser prompt as `prompt` (its
    // module doc, 5). That is not blocked, so the sheet hands control back
    // rather than sitting on a spinner forever.
    const onClose = vi.fn();
    const onResolved = vi.fn();
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt", async () => "prompt")}
          onClose={onClose}
          onResolved={onResolved}
          fallback={<span data-testid="fallback">choose a place</span>}
          data-testid="perm"
        />
      )
    );
    await act(async () => {
      screen.getByTestId(PERMISSION_ALLOW_TESTID).click();
    });
    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith("prompt");
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("offers no Allow button once the browser has stopped asking", () => {
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("denied")}
          onClose={() => undefined}
        />
      )
    );
    expect(screen.queryByTestId(PERMISSION_ALLOW_TESTID)).toBeNull();
    expect(screen.getByTestId(PERMISSION_DISMISS_TESTID)).toBeTruthy();
  });

  it("says the browser cannot do it at all, rather than blaming the person", () => {
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("unsupported")}
          onClose={() => undefined}
        />
      )
    );
    expect(screen.getByText(/This browser cannot do that\./)).toBeTruthy();
    expect(screen.queryByTestId(PERMISSION_ALLOW_TESTID)).toBeNull();
  });

  it("is a sheet on a phone and a modal above it", () => {
    const { unmount } = render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="sheet"
          permission={bagOf("prompt")}
          onClose={() => undefined}
          data-testid="perm"
        />
      )
    );
    expect(screen.getByTestId("perm").getAttribute("data-stapel-dialog-surface")).toBe(
      "sheet"
    );
    unmount();
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt")}
          onClose={() => undefined}
          data-testid="perm"
        />
      )
    );
    expect(screen.getByTestId("perm").getAttribute("data-stapel-dialog-surface")).toBe(
      "modal"
    );
  });

  it("takes its copy from core's floor, translated, and lets a caller win", async () => {
    const { unmount } = render(
      withLocale(
        "ru",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt")}
          onClose={() => undefined}
        />
      )
    );
    expect(await screen.findByText("Разрешить")).toBeTruthy();
    unmount();

    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt")}
          onClose={() => undefined}
          title="Find nearby listings?"
          body="We use it once, to centre the map."
          allowLabel="Use my position"
        />
      )
    );
    expect(screen.getByText("Find nearby listings?")).toBeTruthy();
    expect(screen.getByText("We use it once, to centre the map.")).toBeTruthy();
    expect(screen.getByTestId(PERMISSION_ALLOW_TESTID).textContent).toContain(
      "Use my position"
    );
  });

  it("names the way out 'Not now' before the ask, and 'Dismiss' after a refusal", () => {
    const { unmount } = render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("prompt")}
          onClose={() => undefined}
        />
      )
    );
    expect(screen.getByTestId(PERMISSION_DISMISS_TESTID).textContent).toContain("Not now");
    unmount();
    render(
      withLocale(
        "en",
        <PermissionSheet
          open
          surface="modal"
          permission={bagOf("denied")}
          onClose={() => undefined}
        />
      )
    );
    expect(screen.getByTestId(PERMISSION_DISMISS_TESTID).textContent).toContain("Dismiss");
  });
});

describe("PermissionGate", () => {
  it("shows the capability's content only once it is granted", () => {
    render(
      withLocale(
        "en",
        <PermissionGate
          permission={bagOf("granted")}
          testId="gate"
          fallback={<span data-testid="fallback">type an address</span>}
        >
          <span data-testid="granted-content">the map</span>
        </PermissionGate>
      )
    );
    expect(screen.getByTestId("granted-content")).toBeTruthy();
    expect(screen.queryByTestId("fallback")).toBeNull();
    expect(screen.getByTestId("gate").getAttribute("data-stapel-permission-gate")).toBe(
      "granted"
    );
  });

  it("renders the fallback, and no dead trigger, once it is refused", () => {
    render(
      withLocale(
        "en",
        <PermissionGate
          permission={bagOf("denied")}
          testId="gate"
          fallback={<span data-testid="fallback">type an address</span>}
        >
          <span data-testid="granted-content">the map</span>
        </PermissionGate>
      )
    );
    expect(screen.getByTestId("fallback")).toBeTruthy();
    expect(screen.queryByTestId("granted-content")).toBeNull();
    expect(screen.queryByTestId("gate-ask")).toBeNull();
  });

  it("asks nobody until the trigger is pressed", async () => {
    const request = vi.fn(async (): Promise<PermissionStatus> => "granted");
    render(
      withLocale(
        "en",
        <PermissionGate permission={bagOf("prompt", request)} testId="gate" surface="modal">
          <span data-testid="granted-content">the map</span>
        </PermissionGate>
      )
    );
    expect(screen.queryByTestId(PERMISSION_ALLOW_TESTID)).toBeNull();
    await act(async () => {
      screen.getByTestId("gate-ask").click();
    });
    expect(screen.getByTestId(PERMISSION_ALLOW_TESTID)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it("opens the pre-prompt on mount only when told to, and never for a blocked kind", async () => {
    const { unmount } = render(
      withLocale(
        "en",
        <PermissionGate
          permission={bagOf("prompt")}
          askOnMount
          testId="gate"
          surface="modal"
        >
          <span>the map</span>
        </PermissionGate>
      )
    );
    expect(await screen.findByTestId(PERMISSION_ALLOW_TESTID)).toBeTruthy();
    unmount();

    render(
      withLocale(
        "en",
        <PermissionGate
          permission={bagOf("denied")}
          askOnMount
          testId="gate"
          surface="modal"
          fallback={<span data-testid="fallback">type an address</span>}
        >
          <span>the map</span>
        </PermissionGate>
      )
    );
    expect(screen.queryByTestId(PERMISSION_ALLOW_TESTID)).toBeNull();
    expect(screen.getByTestId("fallback")).toBeTruthy();
  });
});
