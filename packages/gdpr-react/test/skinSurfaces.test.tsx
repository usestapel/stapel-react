/**
 * What the 0.2.0 wave added to the skin, and the matrix nobody was running.
 *
 * Three things are proved here that no test in this package proved before:
 *
 *  1. **Every wired surface renders in all four frames** — phone and desk,
 *     light and dark. The account group's whole visual defect class was that
 *     the skins existed and nothing ever mounted them; a matrix that mounts
 *     each one in both widths and both modes is the machine form of "the
 *     product has a face".
 *  2. **The per-row erasure detail is a real consumer of `useErasure`** — the
 *     hook shipped in 0.1.0 with no caller anywhere, which is a read a person
 *     was entitled to and could not reach.
 *  3. **The public intake page exists as a component a route can mount**, with
 *     the captcha as a declared slot rather than a silent absence.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  AccountClosurePanel,
  DataExportPanel,
  DsarForm,
  PendingDeletions,
  PrivacyPane,
  PrivacyRequestPane,
} from "../src/default/index.js";
import { DsarQueue, OwnersHealth, PrivacyAdminPane } from "../src/default/admin/index.js";
import {
  EXPORT_NOT_FOUND,
  NO_ACTIVE_CLOSURE,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  DSAR_ACKNOWLEDGED,
  ERASURE_ERASING,
  IN_GRACE,
  OWNER_ALIVE,
} from "./fixtures.js";

/** Every read any of these surfaces issues, answered with a real body. */
function everyRead(): MockServer {
  return mockServer({
    "/user/account/close/status": { body: IN_GRACE },
    "/user/data-export/status": EXPORT_NOT_FOUND,
    "/erasures/17": { body: ERASURE_ERASING },
    "/me/erasures": { body: [ERASURE_ERASING] },
    "/owners/health": { body: [OWNER_ALIVE] },
    "/dsar": { body: [DSAR_ACKNOWLEDGED] },
  });
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

const JSDOM_DEFAULT_WIDTH = 1024;
afterEach(() => {
  setViewportWidth(JSDOM_DEFAULT_WIDTH);
  document.documentElement.removeAttribute("data-theme");
});

const SURFACES: readonly (readonly [string, () => ReactElement])[] = [
  ["PrivacyPane", () => <PrivacyPane />],
  ["PrivacyRequestPane", () => <PrivacyRequestPane />],
  ["PrivacyAdminPane", () => <PrivacyAdminPane />],
  ["AccountClosurePanel", () => <AccountClosurePanel />],
  ["PendingDeletions", () => <PendingDeletions />],
  ["DataExportPanel", () => <DataExportPanel />],
  ["DsarForm", () => <DsarForm variant="app" />],
  ["DsarQueue", () => <DsarQueue />],
  ["OwnersHealth", () => <OwnersHealth />],
];

const FRAMES: readonly (readonly [string, number, "light" | "dark"])[] = [
  ["phone-light", 390, "light"],
  ["phone-dark", 390, "dark"],
  ["desktop-light", 1280, "light"],
  ["desktop-dark", 1280, "dark"],
];

describe("every wired surface renders in all four frames", () => {
  for (const [name, ui] of SURFACES) {
    for (const [frame, width, mode] of FRAMES) {
      it(`${name} — ${frame}`, async () => {
        setViewportWidth(width);
        document.documentElement.setAttribute("data-theme", mode);
        const { container } = render(
          <TestProviders server={everyRead()}>{ui()}</TestProviders>
        );
        // The mode is read from the DOCUMENT through the shared substrate, so
        // this asserts the skin is subscribed to the host's theme rather than
        // having sampled a default at import time.
        const root = container.querySelector("[data-stapel-skin-mode]");
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe(mode);
        await waitFor(() =>
          expect(container.querySelector("[data-stapel-load-state='loading']")).toBeNull()
        );
        expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
      });
    }
  }
});

describe("a runtime theme flip repaints a mounted skin", () => {
  it("follows `data-theme` without a remount", async () => {
    const { container } = render(
      <TestProviders server={everyRead()}>
        <AccountClosurePanel />
      </TestProviders>
    );
    const root = (): Element | null =>
      container.querySelector("[data-stapel-skin-mode]");
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("light");
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    // The defect this replaces: `resolveThemeMode()` SAMPLED the document once
    // per render, so a shell's dark toggle left every mounted skin on the old
    // side until something unrelated re-rendered it.
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("dark");
  });
});

describe("<PendingDeletions> — opening a row reads that one erasure", () => {
  it("shows the per-owner receipts and the processor window behind the second date", async () => {
    const server = everyRead();
    render(
      <TestProviders server={server}>
        <PendingDeletions />
      </TestProviders>
    );
    await screen.findByTestId("gdpr-deletions-rows");
    // Nothing is read for a row nobody opened: the detail is one request per
    // OPENED row, not one per listed row.
    expect(server.calls.some((call) => call.url.includes("/erasures/17"))).toBe(false);

    const expander = document.querySelector<HTMLElement>(
      "button.ant-table-row-expand-icon"
    );
    expect(expander).not.toBeNull();
    fireEvent.click(expander as HTMLElement);

    const detail = await screen.findByTestId("gdpr-deletions-detail");
    await waitFor(() =>
      expect(server.calls.some((call) => call.url.includes("/erasures/17"))).toBe(true)
    );
    // The receipt that exists, the owner still silent, and the processor whose
    // contractual window is why `fully_erased_by` is a month past `due_at`.
    expect(detail.textContent).toContain("recordings");
    expect(detail.textContent).toContain("media");
    expect(detail.textContent).toContain("openai");
  });
});

describe("<AccountClosurePanel> — a cancel that worked says so", () => {
  it("leaves a receipt on the idle screen it returns to", async () => {
    let cancelled = false;
    const server = mockServer({
      "POST /user/account/cancel-close": () => {
        cancelled = true;
        return { body: { ...IN_GRACE, status: "cancelled", can_cancel: false } };
      },
      "/user/account/close/status": () =>
        cancelled ? NO_ACTIVE_CLOSURE : { body: IN_GRACE },
    });
    render(
      <TestProviders server={server}>
        <AccountClosurePanel />
      </TestProviders>
    );
    fireEvent.click(await screen.findByTestId("gdpr-closure-cancel"));
    // Idle and "your deletion was called off" are the same screen otherwise —
    // a control that worked would be indistinguishable from one that did
    // nothing at all.
    const receipt = await screen.findByTestId("gdpr-closure-cancelled");
    expect(receipt.textContent).toContain("active again");
    expect(screen.getByTestId("gdpr-closure-none")).toBeTruthy();
  });
});

describe("<PrivacyRequestPane> — the page a stranger can reach", () => {
  it("asks for an email, because the session cannot supply one", async () => {
    render(
      <TestProviders server={everyRead()}>
        <PrivacyRequestPane />
      </TestProviders>
    );
    await screen.findByTestId("gdpr-privacy-request");
    expect(screen.getByTestId("gdpr-dsar-email")).toBeTruthy();
  });

  it("ships no dev scaffolding in the empty captcha slot", async () => {
    const { container } = render(
      <TestProviders server={everyRead()}>
        <PrivacyRequestPane />
      </TestProviders>
    );
    await screen.findByTestId("gdpr-privacy-request");
    // This is the one page in the pair a STRANGER reaches — no session, no
    // chrome, arrived from a link in a privacy policy. A dev placeholder is a
    // note to the developer, and vitest runs as a dev build, which is exactly
    // where the old `SlotPlaceholder` rendered: a dashed box captioned "your
    // captcha widget renders here", on the public face of the product.
    //
    // A deployment that forgot to wire its widget still finds out at once,
    // because the first submission answers `error.400.captcha_required` and
    // the form renders that refusal by name.
    expect(container.querySelector("[data-stapel-slot='captcha']")).toBeNull();
    expect(container.textContent).not.toContain("renders here");
    // The form itself is still there — an empty slot removes scaffolding, not
    // the intake a regulator expects to exist.
    expect(screen.getByTestId("gdpr-dsar-email")).toBeTruthy();
  });

  it("renders the host's widget when one is supplied, and no placeholder", async () => {
    const { container } = render(
      <TestProviders server={everyRead()}>
        <PrivacyRequestPane captcha={<div data-testid="host-captcha" />} />
      </TestProviders>
    );
    await screen.findByTestId("gdpr-privacy-request");
    expect(screen.getByTestId("host-captcha")).toBeTruthy();
    expect(container.querySelector("[data-stapel-slot='captcha']")).toBeNull();
  });
});
