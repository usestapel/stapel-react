// @vitest-environment jsdom
/**
 * `SkinConfirm` — a confirmation is a dialog, so on a phone it is a sheet and
 * on a desktop a small modal; both arms are plain props; the copy is the
 * floor's unless the caller names the action. (The surface-rule inheritance
 * and the destructive-mask rule are pinned in skin.test.tsx beside the
 * dialog itself.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { CONFIRM_CANCEL_TESTID, CONFIRM_OK_TESTID, SkinConfirm } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
});

const QUESTION = "Remove this member?";

describe("SkinConfirm", () => {
  it("is a bottom sheet on a phone, with stacked full-width buttons", () => {
    setViewport(390);
    render(
      <Host>
        <SkinConfirm open onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} data-testid="rm" />
      </Host>
    );
    expect(screen.getByTestId("rm").dataset["stapelDialogSurface"]).toBe("sheet");
    expect(screen.getByTestId(CONFIRM_OK_TESTID).className).toContain("ant-btn-block");
    expect(screen.getByTestId("stapel-sheet-handle")).toBeTruthy();
  });

  it("is a modal at the tablet breakpoint and above, buttons in a row", () => {
    setViewport(breakpoints.tablet);
    render(
      <Host>
        <SkinConfirm open onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} data-testid="rm" />
      </Host>
    );
    expect(screen.getByTestId("rm").dataset["stapelDialogSurface"]).toBe("modal");
    expect(screen.getByTestId(CONFIRM_OK_TESTID).className).not.toContain("ant-btn-block");
  });

  it("switches surface while open when the viewport crosses the breakpoint", () => {
    setViewport(1280);
    render(
      <Host>
        <SkinConfirm open onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} data-testid="rm" />
      </Host>
    );
    expect(screen.getByTestId("rm").dataset["stapelDialogSurface"]).toBe("modal");
    setViewport(390);
    expect(screen.getByTestId("rm").dataset["stapelDialogSurface"]).toBe("sheet");
  });

  it("labels its buttons from the floor in the host's locale and wires both arms", () => {
    setViewport(1280);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <Host locale="ru">
        <SkinConfirm open onConfirm={onConfirm} onCancel={onCancel} title={QUESTION} />
      </Host>
    );
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The footer's cancel and the modal's close control share the copy.
    const cancels = screen.getAllByRole("button", { name: "Отмена" });
    expect(cancels).toHaveLength(2);
    fireEvent.click(screen.getByTestId(CONFIRM_CANCEL_TESTID));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("speaks English from the floor with no provider at all", () => {
    setViewport(1280);
    render(<SkinConfirm open onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} />);
    expect(screen.getByTestId(CONFIRM_OK_TESTID).textContent).toBe("Confirm");
    expect(screen.getByTestId(CONFIRM_CANCEL_TESTID).textContent).toBe("Cancel");
  });

  it("a destructive confirmation names itself, is red, and focuses CANCEL first", async () => {
    setViewport(1280);
    render(
      <Host>
        <SkinConfirm
          open
          danger
          confirmLabel="Remove"
          onConfirm={() => undefined}
          onCancel={() => undefined}
          title={QUESTION}
          body="They lose access immediately."
        />
      </Host>
    );
    const confirm = screen.getByTestId(CONFIRM_OK_TESTID);
    expect(confirm.textContent).toBe("Remove");
    expect(confirm.className).toContain("ant-btn-dangerous");
    expect(
      screen.getByText("They lose access immediately.").closest("[data-stapel-confirm]")?.getAttribute("data-stapel-confirm")
    ).toBe("danger");
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId(CONFIRM_CANCEL_TESTID));
    });
  });

  it("an ordinary confirmation focuses the affirmative first", async () => {
    setViewport(1280);
    render(
      <Host>
        <SkinConfirm open onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} />
      </Host>
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId(CONFIRM_OK_TESTID));
    });
  });

  it("while confirming, the confirm spins and the way out is held until it settles", () => {
    setViewport(390);
    render(
      <Host>
        <SkinConfirm open confirming onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} />
      </Host>
    );
    expect(screen.getByTestId(CONFIRM_OK_TESTID).className).toContain("ant-btn-loading");
    expect((screen.getByTestId(CONFIRM_CANCEL_TESTID) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("stapel-sheet-handle")).toBeNull();
  });

  it("renders nothing visible when closed", () => {
    setViewport(1280);
    render(
      <Host>
        <SkinConfirm open={false} onConfirm={() => undefined} onCancel={() => undefined} title={QUESTION} />
      </Host>
    );
    expect(screen.queryByText(QUESTION)).toBeNull();
  });
});
