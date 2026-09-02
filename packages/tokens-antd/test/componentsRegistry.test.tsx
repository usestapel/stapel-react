// @vitest-environment jsdom
/**
 * The skin component registry (`SkinProvider` — design doc
 * `docs/skin-component-registry.md`): a host swaps a substrate primitive
 * ONCE and every default skin's substrate render picks it up.
 *
 * The claims under test, in the order they were promised:
 *
 *  1. no provider / an empty provider changes NOTHING (byte-stable —
 *     the deeper guarantee is `substrateBaseline.test.tsx`);
 *  2. an override registered once reaches every substrate render of that
 *     primitive — `GatedButton`, `ErrorAlert`'s retry, `SkinConfirm`'s two
 *     buttons, the picker footer — with the contract props forwarded;
 *  3. the dialog surface override receives the resolved surface and the
 *     stamped body, and the composites (`SkinConfirm`, `SkinPickerSheet`)
 *     inherit it because they render through `SkinDialog`;
 *  4. a nested provider re-overrides for its subtree only;
 *  5. a replacement that breaks its anatomy contract is a LOUD dev
 *     `console.error`, once per component per duty — never a silent
 *     degradation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { actionAvailable } from "@stapel/core";
import {
  CONFIRM_CANCEL_TESTID,
  CONFIRM_OK_TESTID,
  CountedInput,
  ErrorAlert,
  GatedButton,
  PICKER_DONE_TESTID,
  PICKER_SEARCH_TESTID,
  SkinButton,
  SkinConfirm,
  SkinDialog,
  SkinInput,
  SkinNumberField,
  SkinPickerSheet,
  SkinProvider,
  useSkinComponents,
} from "../src/skin.js";
import type { SkinButtonProps, SkinDialogSlotProps, SkinInputProps } from "../src/skin.js";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const noop = (): void => {};

/** A compliant replacement button: real `<button>`, contract props honoured. */
function HostButton(props: SkinButtonProps): ReactElement {
  const { children, onClick, disabled, loading, danger, block: _block, type, htmlType, ref, ...rest } = props;
  const dataProps = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("data-") || key.startsWith("aria-"))
  );
  return (
    <button
      type={htmlType ?? "button"}
      data-host-button={type ?? "default"}
      data-host-danger={danger === true ? "" : undefined}
      disabled={disabled === true || loading === true}
      onClick={onClick}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...dataProps}
    >
      {children}
    </button>
  );
}

/** A compliant replacement input: real `<input>`, controlled, suffix drawn. */
function HostInput(props: SkinInputProps): ReactElement {
  const { value, onChange, suffix, disabled, placeholder, ...rest } = props;
  const dataProps = Object.fromEntries(
    Object.entries(rest).filter(
      ([key]) => key.startsWith("data-") || key.startsWith("aria-") || key === "id" || key === "inputMode"
    )
  );
  return (
    <span data-host-input="">
      <input
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={onChange}
        disabled={disabled === true}
        placeholder={placeholder}
        {...dataProps}
      />
      {suffix !== undefined && <span data-host-suffix="">{suffix}</span>}
    </span>
  );
}

/** A compliant replacement dialog surface: role, name, children, footer. */
function HostDialog(props: SkinDialogSlotProps): ReactElement | null {
  if (!props.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-host-dialog={props.surface}
      {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
    >
      {props.title !== undefined && <header>{props.title}</header>}
      {props.dismissible && (
        <button type="button" aria-label={props.dismissLabel} onClick={props.onClose}>
          ×
        </button>
      )}
      {props.children}
      {props.footer !== undefined && <footer>{props.footer}</footer>}
    </div>
  );
}

describe("SkinProvider — default arm", () => {
  it("an empty provider renders exactly what no provider renders", () => {
    const probe = (
      <Host>
        <GatedButton gate={actionAvailable()} onClick={noop} testId="go">
          Go
        </GatedButton>
        <ErrorAlert message="It broke" onRetry={noop} testId="err" />
        <SkinNumberField value={5} onValueChange={noop} unit="km" ariaLabel="D" testId="num" />
      </Host>
    );
    const bare = render(probe);
    const bareHtml = bare.container.innerHTML;
    bare.unmount();
    const provided = render(<SkinProvider components={{}}>{probe}</SkinProvider>);
    expect(provided.container.innerHTML).toBe(bareHtml);
  });

  it("useSkinComponents reports no overrides outside a provider", () => {
    let seen: unknown = null;
    function Probe(): null {
      seen = useSkinComponents();
      return null;
    }
    render(<Probe />);
    expect(seen).toEqual({});
  });
});

describe("SkinProvider — Button slot", () => {
  it("one registration reaches SkinButton, GatedButton, ErrorAlert's retry and SkinConfirm's arms", () => {
    const onConfirm = vi.fn();
    render(
      <SkinProvider components={{ Button: HostButton }}>
        <Host>
          <SkinButton onClick={noop} data-testid="plain">
            Plain
          </SkinButton>
          <GatedButton gate={actionAvailable()} onClick={noop} testId="gated">
            Gated
          </GatedButton>
          <ErrorAlert message="It broke" onRetry={noop} testId="err" />
          <SkinConfirm
            open
            onConfirm={onConfirm}
            onCancel={noop}
            title="Sure?"
            surface="modal"
            data-testid="confirm"
          />
        </Host>
      </SkinProvider>
    );
    // Every substrate button is the host's anatomy now.
    expect(document.querySelectorAll("[data-host-button]").length).toBeGreaterThanOrEqual(5);
    // The contract props still flow: test ids, labels, clicks.
    expect(screen.getByTestId("plain").hasAttribute("data-host-button")).toBe(true);
    expect(screen.getByTestId("gated").textContent).toBe("Gated");
    const ok = screen.getByTestId(CONFIRM_OK_TESTID);
    expect(ok.getAttribute("data-host-button")).toBe("primary");
    fireEvent.click(ok);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("SkinConfirm's initial-focus ref lands on a compliant replacement", async () => {
    render(
      <SkinProvider components={{ Button: HostButton }}>
        <Host>
          <SkinConfirm open danger onConfirm={noop} onCancel={noop} title="Delete?" surface="modal" />
        </Host>
      </SkinProvider>
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId(CONFIRM_CANCEL_TESTID));
    });
  });

  it("a nested provider re-overrides for its subtree only", () => {
    function InnerButton(props: SkinButtonProps): ReactElement {
      return (
        <button type="button" data-inner-button="" onClick={props.onClick} {...{ "data-testid": props["data-testid"] }}>
          {props.children}
        </button>
      );
    }
    render(
      <SkinProvider components={{ Button: HostButton }}>
        <Host>
          <SkinButton data-testid="outer">Outer</SkinButton>
          <SkinProvider components={{ Button: InnerButton }}>
            <SkinButton data-testid="inner">Inner</SkinButton>
          </SkinProvider>
        </Host>
      </SkinProvider>
    );
    expect(screen.getByTestId("outer").hasAttribute("data-host-button")).toBe(true);
    expect(screen.getByTestId("inner").hasAttribute("data-inner-button")).toBe(true);
  });
});

describe("SkinProvider — Input slot", () => {
  it("one registration reaches SkinNumberField, CountedInput and the picker's search box", () => {
    render(
      <SkinProvider components={{ Input: HostInput }}>
        <Host>
          <SkinNumberField value={7} onValueChange={noop} unit="km" ariaLabel="Distance" testId="num" />
          <CountedInput value="abc" onChange={noop} maxLength={10} ariaLabel="Code" testId="code" />
          <SkinPickerSheet
            mode="single"
            open
            onClose={noop}
            onChange={noop}
            title="Pick"
            options={[{ value: "a", label: "A" }]}
            surface="modal"
            testId="picker"
          />
        </Host>
      </SkinProvider>
    );
    expect(document.querySelectorAll("[data-host-input]").length).toBe(3);
    // The unit still rides as a suffix, and the keypad hint still flows.
    expect(document.querySelector("[data-host-suffix]")?.textContent).toBe("km");
    const search = screen.getByTestId(PICKER_SEARCH_TESTID);
    expect(search.closest("[data-host-input]")).not.toBeNull();
  });

  it("a controlled replacement still edits: typing reaches onValueChange", () => {
    const onValueChange = vi.fn();
    render(
      <SkinProvider components={{ Input: HostInput }}>
        <Host>
          <SkinNumberField value={undefined} onValueChange={onValueChange} ariaLabel="Distance" testId="num" />
        </Host>
      </SkinProvider>
    );
    const input = document.querySelector("[data-host-input] input");
    expect(input).not.toBeNull();
    fireEvent.change(input as Element, { target: { value: "42" } });
    expect(onValueChange).toHaveBeenCalledWith(42);
  });

  it("CountedInput's multiline arm stays antd (TextArea is a future slot)", () => {
    render(
      <SkinProvider components={{ Input: HostInput }}>
        <Host>
          <CountedInput value="x" onChange={noop} maxLength={10} ariaLabel="Long" multiline testId="long" />
        </Host>
      </SkinProvider>
    );
    expect(document.querySelector("textarea")).not.toBeNull();
    expect(document.querySelector("[data-host-input]")).toBeNull();
  });
});

describe("SkinProvider — Dialog slot", () => {
  it("SkinDialog renders the override with the resolved surface and the stamped body", () => {
    render(
      <SkinProvider components={{ Dialog: HostDialog }}>
        <Host>
          <SkinDialog open onClose={noop} title="Custom" dismissLabel="Dismiss" surface="sheet" data-testid="dlg">
            <p>body</p>
          </SkinDialog>
        </Host>
      </SkinProvider>
    );
    const surface = document.querySelector("[data-host-dialog]");
    expect(surface?.getAttribute("data-host-dialog")).toBe("sheet");
    // The substrate's stamp is still inside — a pair's own tests keep passing.
    const stamp = screen.getByTestId("dlg");
    expect(stamp.getAttribute("data-stapel-dialog-surface")).toBe("sheet");
    expect(surface?.contains(stamp)).toBe(true);
    // No antd modal/drawer got rendered alongside.
    expect(document.querySelector(".ant-modal, .ant-drawer")).toBeNull();
  });

  it("SkinConfirm and SkinPickerSheet inherit the dialog override through SkinDialog", () => {
    render(
      <SkinProvider components={{ Dialog: HostDialog, Button: HostButton }}>
        <Host>
          <SkinConfirm open onConfirm={noop} onCancel={noop} title="Sure?" surface="modal" data-testid="confirm" />
          <SkinPickerSheet
            mode="multi"
            open
            onClose={noop}
            onChange={noop}
            doneLabel="Done"
            title="Pick"
            values={[]}
            options={[{ value: "a", label: "A" }]}
            surface="modal"
            testId="picker"
          />
        </Host>
      </SkinProvider>
    );
    expect(document.querySelectorAll("[data-host-dialog]").length).toBe(2);
    // The composite's own furniture is inside the override, still findable.
    expect(screen.getByTestId(CONFIRM_OK_TESTID).closest("[data-host-dialog]")).not.toBeNull();
    expect(screen.getByTestId(PICKER_DONE_TESTID).closest("[data-host-dialog]")).not.toBeNull();
  });

  it("the override's onClose is the substrate's onClose", () => {
    const onCancel = vi.fn();
    render(
      <SkinProvider components={{ Dialog: HostDialog }}>
        <Host>
          <SkinConfirm open onConfirm={noop} onCancel={onCancel} title="Sure?" surface="modal" />
        </Host>
      </SkinProvider>
    );
    fireEvent.click(screen.getByLabelText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("SkinProvider — contract violations are loud in dev", () => {
  it("a Button replacement with no focusable button is a console.error, once per duty", () => {
    const error = vi.spyOn(console, "error").mockImplementation(noop);
    function DivButton(props: SkinButtonProps): ReactElement {
      return <div onClick={props.onClick as never}>{props.children}</div>;
    }
    const { rerender } = render(
      <SkinProvider components={{ Button: DivButton }}>
        <SkinButton data-testid="bad">Bad</SkinButton>
      </SkinProvider>
    );
    const violations = (): string[] =>
      error.mock.calls
        .map((call) => String(call[0]))
        .filter((line) => line.includes("[stapel skin]"));
    expect(violations().length).toBeGreaterThan(0);
    expect(violations().join("\n")).toContain("DivButton");
    const seen = violations().length;
    // The same violation again is not a second line.
    rerender(
      <SkinProvider components={{ Button: DivButton }}>
        <SkinButton data-testid="bad">Bad again</SkinButton>
      </SkinProvider>
    );
    expect(violations().length).toBe(seen);
  });

  it("an Input replacement that drops the test id is called out", () => {
    const error = vi.spyOn(console, "error").mockImplementation(noop);
    function NoTestIdInput(props: SkinInputProps): ReactElement {
      return <input value={typeof props.value === "string" ? props.value : ""} onChange={props.onChange} />;
    }
    render(
      <SkinProvider components={{ Input: NoTestIdInput }}>
        <SkinInput data-testid="find-me" value="x" onChange={noop} />
      </SkinProvider>
    );
    const lines = error.mock.calls.map((call) => String(call[0])).join("\n");
    expect(lines).toContain("[stapel skin]");
    expect(lines).toContain("data-testid");
  });

  it("a compliant replacement produces no violation lines", () => {
    const error = vi.spyOn(console, "error").mockImplementation(noop);
    render(
      <SkinProvider components={{ Button: HostButton, Input: HostInput }}>
        <Host>
          <SkinButton data-testid="ok">Fine</SkinButton>
          <SkinInput data-testid="ok-input" value="x" onChange={noop} />
        </Host>
      </SkinProvider>
    );
    const lines = error.mock.calls.map((call) => String(call[0])).filter((l) => l.includes("[stapel skin]"));
    expect(lines).toEqual([]);
  });
});
