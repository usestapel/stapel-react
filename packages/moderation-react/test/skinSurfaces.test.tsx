/**
 * The matrix §54 asks for and nothing in this package ran before: every wired
 * surface mounted at phone AND desktop width, in light AND dark, against real
 * response bodies.
 *
 * The account group's whole visual defect class was that skins existed and
 * nothing ever mounted them. Two things are proved here that a story cannot:
 * the mode comes from the DOCUMENT (so the skin is subscribed to the host's
 * theme rather than having sampled a default at import time), and the dialog
 * surfaces obey the shared sheet rule at 390px without asserting it in prose.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  AppealPanel,
  PolicyDisclosurePane,
  ReportButton,
  ReportSheet,
} from "../src/default/index.js";
import {
  AppealsQueue,
  CaseDetail,
  ModerationQueue,
} from "../src/default/admin/index.js";
import {
  JSDOM_DEFAULT_WIDTH,
  TestProviders,
  mockServer,
  setViewportWidth,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  APPEAL_OPEN,
  CASE_CLAIMED,
  CASE_DETAIL,
  CASE_QUEUED,
  POLICY,
  STATS,
} from "../demo/_fixtures.js";

/** Every read any of these surfaces issues, answered with a real body. Order
 * matters: `/cases/{id}` contains `/cases`, `/appeals/queue` contains
 * `/appeals/`. */
function everyRead(): MockServer {
  return mockServer({
    "/policy": { body: POLICY },
    "/stats": { body: STATS },
    "/appeals/queue": { body: [APPEAL_OPEN] },
    "/cases/": { body: CASE_DETAIL },
    "/cases": { body: [CASE_QUEUED, CASE_CLAIMED] },
    "/appeals/": { body: [APPEAL_OPEN] },
  });
}

const SURFACES: readonly (readonly [string, () => ReactElement])[] = [
  ["ReportButton", () => <ReportButton targetType="listing" targetKey="8842" />],
  [
    "ReportSheet",
    () => (
      <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
    ),
  ],
  ["AppealPanel", () => <AppealPanel caseId={CASE_QUEUED.id} />],
  ["PolicyDisclosurePane", () => <PolicyDisclosurePane />],
  ["ModerationQueue", () => <ModerationQueue />],
  [
    "CaseDetail",
    () => <CaseDetail open caseId={CASE_DETAIL.id} onClose={() => {}} />,
  ],
  ["AppealsQueue", () => <AppealsQueue />],
];

const FRAMES: readonly (readonly [string, number, "light" | "dark"])[] = [
  ["phone-light", 390, "light"],
  ["phone-dark", 390, "dark"],
  ["desktop-light", 1280, "light"],
  ["desktop-dark", 1280, "dark"],
];

afterEach(() => {
  setViewportWidth(JSDOM_DEFAULT_WIDTH);
  document.documentElement.removeAttribute("data-theme");
});

describe("every wired surface renders in all four frames", () => {
  for (const [name, ui] of SURFACES) {
    for (const [frame, width, mode] of FRAMES) {
      it(`${name} — ${frame}`, async () => {
        setViewportWidth(width);
        document.documentElement.setAttribute("data-theme", mode);
        const { container } = render(
          <TestProviders server={everyRead()}>{ui()}</TestProviders>
        );
        const root = container.querySelector("[data-stapel-skin-mode]");
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe(mode);
        await waitFor(() =>
          expect(
            document.body.querySelector("[data-stapel-load-state='loading']")
          ).toBeNull()
        );
        // A dialog's body is a portal, so the text is looked for on the
        // document rather than in the mount container.
        expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
      });
    }
  }
});

describe("the dialog surfaces inherit the shared sheet rule", () => {
  it("the report sheet is a bottom sheet at 390 and a modal at 1280", async () => {
    setViewportWidth(390);
    const phone = render(
      <TestProviders server={everyRead()}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        document.body.querySelector("[data-stapel-dialog-surface]")
      ).not.toBeNull()
    );
    expect(
      document.body
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
    phone.unmount();

    setViewportWidth(1280);
    render(
      <TestProviders server={everyRead()}>
        <ReportSheet open onClose={() => {}} targetType="listing" targetKey="8842" />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        document.body.querySelector("[data-stapel-dialog-surface]")
      ).not.toBeNull()
    );
    expect(
      document.body
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
  });

  it("the case card is a sheet on a phone too", async () => {
    setViewportWidth(390);
    render(
      <TestProviders server={everyRead()}>
        <CaseDetail open caseId={CASE_DETAIL.id} onClose={() => {}} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        document.body.querySelector("[data-stapel-dialog-surface='sheet']")
      ).not.toBeNull()
    );
  });
});

describe("a runtime theme flip repaints a mounted skin", () => {
  it("follows `data-theme` without a remount", async () => {
    const { container } = render(
      <TestProviders server={everyRead()}>
        <PolicyDisclosurePane />
      </TestProviders>
    );
    const root = (): Element | null =>
      container.querySelector("[data-stapel-skin-mode]");
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("light");
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("dark");
  });
});
