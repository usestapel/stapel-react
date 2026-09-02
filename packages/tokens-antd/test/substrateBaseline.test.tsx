// @vitest-environment jsdom
/**
 * Byte-stability baseline for the component-registry work (skin registry
 * design doc, `docs/skin-component-registry.md`).
 *
 * These snapshots were recorded BEFORE the substrate's internal `Button` /
 * `Input` / dialog-surface renders were routed through the component
 * registry, and the suite's whole claim is that with NO `SkinProvider` in
 * the tree the substrate's markup is exactly what it was: the registry's
 * default arm must be invisible. A diff here is not "update the snapshot" —
 * it is the regression the registry promised not to make.
 *
 * IDs from `useId` are position-derived and legitimately move when an
 * internal component boundary is added, so they are normalised out — they
 * are React bookkeeping, not markup a host can see.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  CountedInput,
  EmptyState,
  ErrorAlert,
  GatedButton,
  RowActions,
  SkinConfirm,
  SkinDialog,
  SkinNumberField,
  SkinPickerSheet,
} from "../src/skin.js";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { Host, installMatchMedia, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
  document.body.innerHTML = "";
});

/** The DOM the user agent sees, minus React's positional `useId` values. */
function bodyMarkup(): string {
  return document.body.innerHTML
    .replace(/«[^»]*»/g, "«id»")
    .replace(/:r[0-9a-z]+:/g, ":id:");
}

const noop = (): void => {};

describe("substrate markup without a provider (byte-stability baseline)", () => {
  it("ErrorAlert block with retry", () => {
    render(
      <Host>
        <ErrorAlert message="It broke" detail="HTTP 500" onRetry={noop} testId="err" />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("ErrorAlert inline with retry and dismiss", () => {
    render(
      <Host>
        <ErrorAlert variant="inline" message="It broke" onRetry={noop} onDismiss={noop} testId="err" />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("EmptyState with action", () => {
    render(
      <Host>
        <EmptyState title="No drafts" hint="Create one" action={<span>door</span>} testId="empty" />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("GatedButton available and blocked", () => {
    render(
      <Host>
        <GatedButton gate={actionAvailable()} onClick={noop} testId="go">
          Go
        </GatedButton>
        <GatedButton gate={actionBlocked("stapel.ui.retry")} onClick={noop} testId="held">
          Held
        </GatedButton>
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinConfirm open, modal surface, danger", () => {
    render(
      <Host>
        <SkinConfirm
          open
          danger
          onConfirm={noop}
          onCancel={noop}
          title="Delete forever?"
          body="The listing goes away."
          confirmLabel="Delete forever"
          surface="modal"
          data-testid="confirm"
        />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinConfirm open, sheet surface", () => {
    setViewport(390);
    render(
      <Host>
        <SkinConfirm open onConfirm={noop} onCancel={noop} title="Sure?" surface="sheet" data-testid="confirm" />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinDialog open, modal surface", () => {
    render(
      <Host>
        <SkinDialog open onClose={noop} title="A dialog" dismissLabel="Dismiss" surface="modal" data-testid="dlg">
          <p>body</p>
        </SkinDialog>
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinDialog open, sheet surface, with footer", () => {
    setViewport(390);
    render(
      <Host>
        <SkinDialog
          open
          onClose={noop}
          title="A sheet"
          dismissLabel="Dismiss"
          surface="sheet"
          footer={<span>footer</span>}
          data-testid="dlg"
        >
          <p>body</p>
        </SkinDialog>
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinPickerSheet multi with search, groups and footer", () => {
    render(
      <Host>
        <SkinPickerSheet
          mode="multi"
          open
          onClose={noop}
          onChange={noop}
          title="Body type"
          doneLabel="Done"
          searchPlaceholder="Search"
          values={["sedan"]}
          groups={[
            {
              key: "all",
              label: "All",
              options: [
                { value: "sedan", label: "Sedan" },
                { value: "wagon", label: "Wagon", description: "The long one" },
              ],
            },
          ]}
          surface="modal"
          testId="picker"
        />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("SkinNumberField with unit, hint and error", () => {
    render(
      <Host>
        <SkinNumberField
          value={12}
          onValueChange={noop}
          unit="km"
          hintPlaceholder="0–100"
          helpText="Whole kilometres"
          errorText="Too far"
          ariaLabel="Distance"
          integer
          testId="num"
        />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("CountedInput single line and multiline", () => {
    render(
      <Host>
        <CountedInput value="abc" onChange={noop} maxLength={10} ariaLabel="Code" mono testId="code" />
        <CountedInput
          value="long text"
          onChange={noop}
          maxLength={100}
          ariaLabel="Description"
          multiline
          rows={2}
          testId="desc"
        />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });

  it("RowActions inline with a gated action", () => {
    render(
      <Host>
        <RowActions
          testId="row"
          actions={[
            { key: "rename", label: "Rename", onClick: noop },
            { key: "remove", label: "Remove", onClick: noop, danger: true, gate: actionBlocked("stapel.ui.retry") },
          ]}
        />
      </Host>
    );
    expect(bodyMarkup()).toMatchSnapshot();
  });
});
