// @vitest-environment jsdom
/**
 * `GatedControl` / `GatedButton` — a blocked control's reason is visible text
 * beside it, linked by `aria-describedby`; never a tooltip, never a `title`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "antd";
import { actionAvailable, actionBlocked, actionBlockedByFailure, parseErrorEnvelope } from "@stapel/core";
import { GatedButton, GatedControl } from "../src/skin.js";
import { Host, installMatchMedia, makeI18n, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

const REASON_KEY = "listings.archive.blocked.under_review";

function hostWithReason(locale: string, sentence: string): ReturnType<typeof makeI18n> {
  const i18n = makeI18n(locale);
  i18n.registerBundle(locale, { [REASON_KEY]: sentence });
  return i18n;
}

describe("GatedButton", () => {
  it("is an ordinary button with no reason when the action is available", () => {
    const onClick = vi.fn();
    render(
      <Host>
        <GatedButton gate={actionAvailable()} onClick={onClick} testId="archive">
          Archive
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Archive" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByTestId("archive-gate").getAttribute("data-stapel-gated")).toBe("available");
    expect(document.querySelector("[data-stapel-gated-reason]")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("when blocked: disabled, the reason is visible text, and aria-describedby points at it", () => {
    render(
      <Host i18n={hostWithReason("en", "This listing is under review.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} testId="archive">
          Archive
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Archive" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const reason = screen.getByText("This listing is under review.");
    expect(reason.getAttribute("id")).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    expect(button.getAttribute("title")).toBeNull();
    expect(screen.getByTestId("archive-gate").getAttribute("data-stapel-gated")).toBe("blocked");
  });

  it("speaks the host's locale for the reason", () => {
    render(
      <Host i18n={hostWithReason("ru", "Объявление на проверке.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)}>Archive</GatedButton>
      </Host>
    );
    expect(screen.getByText("Объявление на проверке.")).toBeTruthy();
  });

  it("a load failure shows the floor's sentence plus the technical detail", () => {
    render(
      <Host>
        <GatedButton gate={actionBlockedByFailure(parseErrorEnvelope(404, ""))}>Upload</GatedButton>
      </Host>
    );
    expect(screen.getByText(/could not load/i)).toBeTruthy();
    expect(screen.getByText("HTTP 404")).toBeTruthy();
    // Never the 404 sentence — that would claim the dependency does not exist.
    expect(screen.queryByText(/no longer available/i)).toBeNull();
  });

  it("passes every other Button prop through, but never `disabled` or `title`", () => {
    render(
      <Host>
        <GatedButton gate={actionAvailable()} danger size="small" aria-label="Delete" testId="del">
          <span aria-hidden="true">x</span>
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("ant-btn-dangerous");
    expect(button.className).toContain("ant-btn-sm");
    expect(button.getAttribute("data-testid")).toBe("del");
  });
});

describe("GatedControl", () => {
  it("binds any control through the render prop", () => {
    render(
      <Host i18n={hostWithReason("en", "Choose a workspace first.")}>
        <GatedControl gate={actionBlocked(REASON_KEY)} layout="inline" testId="notify">
          {(bind) => <Switch aria-label="Notify" {...bind} />}
        </GatedControl>
      </Host>
    );
    const control = screen.getByRole("switch", { name: "Notify" });
    expect((control as HTMLButtonElement).disabled).toBe(true);
    expect(control.getAttribute("aria-describedby")).toBe(
      screen.getByText("Choose a workspace first.").getAttribute("id")
    );
    expect(screen.getByTestId("notify").style.flexDirection).toBe("row");
  });
});
