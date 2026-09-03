// @vitest-environment jsdom
/**
 * `GatedControl` / `GatedButton` — a blocked control's reason is visible text
 * beside it, linked by `aria-describedby`; never a tooltip, never a `title`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "antd";
import { actionAvailable, actionBlocked, actionBlockedByFailure, parseErrorEnvelope } from "@stapel/core";
import { GatedButton, GatedControl, PaneGate } from "../src/skin.js";
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

  it("when blocked: aria-disabled, the reason is visible text, and aria-describedby points at it", () => {
    render(
      <Host i18n={hostWithReason("en", "This listing is under review.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} testId="archive">
          Archive
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Archive" });
    // NOT html-disabled: a disabled element fires no events, so it can never
    // disclose the sentence below or reach the door behind it.
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
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
    expect((control as HTMLButtonElement).disabled).toBe(false);
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(
      screen.getByText("Choose a workspace first.").getAttribute("id")
    );
    expect(screen.getByTestId("notify").style.flexDirection).toBe("row");
  });
});

/**
 * The mechanism defect (walker defects D45/D72, "the gesture shows nothing"): the
 * binding used to hand the control html `disabled`, so every gated control in
 * the fleet was INERT — no click, no focus, no way to reach the reason or the
 * door behind it. A blocked control is now `aria-disabled` and alive; the
 * action is suppressed by `GatedControl` itself, not by the browser.
 */
describe("a blocked control is alive, not inert", () => {
  it("is not html-disabled, is aria-disabled, and is focusable", () => {
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} testId="fav">
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("receives the click and does NOT perform the action", () => {
    const onClick = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} onClick={onClick} testId="fav">
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("tells the caller the blocked control was activated, so a door can open", () => {
    const onBlockedActivate = vi.fn();
    const onClick = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton
          gate={actionBlocked(REASON_KEY)}
          onClick={onClick}
          onBlockedActivate={onBlockedActivate}
          testId="fav"
        >
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    expect(onBlockedActivate).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("the reason is reachable by keyboard: focus, then Enter, and the action still does not run", () => {
    const onClick = vi.fn();
    const onBlockedActivate = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton
          gate={actionBlocked(REASON_KEY)}
          onClick={onClick}
          onBlockedActivate={onBlockedActivate}
          testId="fav"
        >
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    expect(document.activeElement).toBe(button);
    // The sentence is wired to the focused control, so a screen reader reads
    // it with the control's name — no pointer anywhere in this test.
    const reason = screen.getByText("Sign in to do this.");
    expect(button.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onBlockedActivate).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps antd's disabled look while staying interactive", () => {
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)}>Save</GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("ant-btn-disabled");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("a value-changing control cannot be changed while blocked", () => {
    const onChange = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "Choose a workspace first.")}>
        <GatedControl gate={actionBlocked(REASON_KEY)} testId="notify">
          {(bind) => <Switch aria-label="Notify" onChange={onChange} {...bind} />}
        </GatedControl>
      </Host>
    );
    const control = screen.getByRole("switch", { name: "Notify" });
    expect((control as HTMLButtonElement).disabled).toBe(false);
    expect(control.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an available control is untouched: no aria-disabled, no suppression", () => {
    const onClick = vi.fn();
    render(
      <Host>
        <GatedButton gate={actionAvailable()} onClick={onClick}>
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-disabled")).toBeNull();
    expect(button.className).not.toContain("ant-btn-disabled");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("`whenBlocked=\"inert\"` still produces a truly inert control", () => {
    const onClick = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} whenBlocked="inert" onClick={onClick}>
          Save
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("a pooled reason discloses itself on the gesture", () => {
  it("inside a PaneGate the sentence is printed once, and the gesture brings a copy to the control", () => {
    render(
      <Host i18n={hostWithReason("en", "Sign in to do this.")}>
        <PaneGate gate={actionAvailable()} testId="pane">
          <GatedButton gate={actionBlocked(REASON_KEY)} testId="a">
            Save
          </GatedButton>
          <GatedButton gate={actionBlocked(REASON_KEY)} testId="b">
            Share
          </GatedButton>
        </PaneGate>
      </Host>
    );
    // One standing copy for two controls — the volume fix stays.
    expect(screen.getAllByText("Sign in to do this.")).toHaveLength(1);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-describedby")).toBe(
      screen.getByText("Sign in to do this.").getAttribute("id")
    );
    // The gesture discloses the sentence AT the control it belongs to.
    fireEvent.click(button);
    expect(screen.getAllByText("Sign in to do this.").length).toBeGreaterThan(1);
    expect(screen.getByTestId("a-gate").querySelector("[role=status]")).not.toBeNull();
    // ...and only at that control.
    expect(screen.getByTestId("b-gate").querySelector("[role=status]")).toBeNull();
  });
});

describe("`whenBlocked=\"annotate\"` — a verdict on the VALUE, not on the person", () => {
  it("leaves the control fully usable and only adds the sentence", () => {
    const onClick = vi.fn();
    render(
      <Host i18n={hostWithReason("en", "The end is before the start.")}>
        <GatedButton gate={actionBlocked(REASON_KEY)} whenBlocked="annotate" onClick={onClick}>
          Apply
        </GatedButton>
      </Host>
    );
    const button = screen.getByRole("button", { name: "Apply" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBeNull();
    const reason = screen.getByText("The end is before the start.");
    expect(button.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
