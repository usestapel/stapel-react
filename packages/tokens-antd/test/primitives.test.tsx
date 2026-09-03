// @vitest-environment jsdom
/**
 * The layout primitives the third visual pass asked the substrate for:
 * `Pane`/`Page` (the measure), `StatusTag` (one treatment per family),
 * `RowActions` (wrap between buttons, overflow to a sheet), `PaneGate` (one
 * refusal per pane, pooled reasons), `ListRow`/`CardHeader` (min-width: 0,
 * slots for badge and actions), `DataTable` (table or cards by element width).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { breakpoints } from "@stapel/tokens";
import { actionAvailable, actionBlocked } from "@stapel/core";
import {
  CardHeader,
  DataTable,
  GatedButton,
  ListRow,
  PANE_MEASURES,
  Page,
  Pane,
  PaneGate,
  RowActions,
  StatusTag,
} from "../src/skin.js";
import type { RowAction } from "../src/skin.js";
import { Host, installMatchMedia, makeI18n, resetViewportListeners, setViewport } from "./env.js";

beforeEach(() => {
  installMatchMedia();
  setViewport(1280);
});

afterEach(() => {
  cleanup();
  resetViewportListeners();
  vi.restoreAllMocks();
});

const REASON = "reviews.moderate.blocked.not_moderator";
const OTHER = "reviews.reply.blocked.not_owner";

function host(): ReturnType<typeof makeI18n> {
  const i18n = makeI18n("en");
  i18n.registerBundle("en", {
    [REASON]: "You are not a moderator of this item.",
    [OTHER]: "Only the seller can reply.",
  });
  return i18n;
}

describe("Pane / Page — the measure and the padding scale (C-NOMAXW)", () => {
  it("caps a pane at its named measure, derived from the token breakpoints", () => {
    render(
      <>
        <Pane testId="reading">
          <span />
        </Pane>
        <Pane measure="narrow" testId="narrow">
          <span />
        </Pane>
        <Pane measure="wide" testId="wide">
          <span />
        </Pane>
        <Pane measure="full" testId="full">
          <span />
        </Pane>
      </>
    );
    expect(screen.getByTestId("reading").style.maxWidth).toBe(`${String(PANE_MEASURES.reading)}px`);
    expect(screen.getByTestId("narrow").style.maxWidth).toBe(`${String(PANE_MEASURES.narrow)}px`);
    expect(screen.getByTestId("wide").style.maxWidth).toBe(`${String(breakpoints.desktop)}px`);
    expect(screen.getByTestId("full").style.maxWidth).toBe("");
    expect(PANE_MEASURES.narrow).toBeLessThan(PANE_MEASURES.reading);
    expect(PANE_MEASURES.reading).toBeLessThan(PANE_MEASURES.wide);
    const pane = screen.getByTestId("reading");
    expect(pane.getAttribute("data-stapel-pane")).toBe("reading");
    expect(["0", "0px"]).toContain(pane.style.minWidth);
    expect(pane.style.marginInline).toBe("auto");
  });

  it("pads tighter on a phone than on a desktop, from the token layer", () => {
    render(
      <Pane testId="desk">
        <span />
      </Pane>
    );
    const desk = parseInt(screen.getByTestId("desk").style.paddingInline, 10);
    cleanup();
    setViewport(390);
    render(
      <Pane testId="phone">
        <span />
      </Pane>
    );
    const phone = parseInt(screen.getByTestId("phone").style.paddingInline, 10);
    expect(phone).toBeGreaterThan(0);
    expect(phone).toBeLessThan(desk);
  });

  it("a Page is a self-themed base surface with one heading and its actions", () => {
    render(
      <Page title="Passkeys" intro="Sign in without a password." actions={<button>Add</button>} data-testid="page">
        <p>body</p>
      </Page>
    );
    const page = screen.getByTestId("page");
    expect(page.getAttribute("data-stapel-skin-surface")).toBe("base");
    const main = page.querySelector("main[data-stapel-pane='wide']");
    expect(main).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Passkeys");
    expect(screen.getByText("Sign in without a password.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });
});

describe("StatusTag — one treatment per family (C-STATUSMIX)", () => {
  it("files the word under its family and lets antd's status colour paint it", () => {
    render(
      <>
        <StatusTag status="success" testId="ok">
          Published
        </StatusTag>
        <StatusTag status="error" testId="bad">
          Taken down
        </StatusTag>
        <StatusTag status="neutral" testId="meh">
          Draft
        </StatusTag>
      </>
    );
    expect(screen.getByTestId("ok").getAttribute("data-stapel-status")).toBe("success");
    expect(screen.getByTestId("ok").className).toContain("ant-tag-success");
    expect(screen.getByTestId("bad").className).toContain("ant-tag-error");
    expect(screen.getByTestId("meh").getAttribute("data-stapel-status")).toBe("neutral");
    // Not a touch target: no `role="button"`, so the phone floor leaves it a chip.
    expect(screen.getByTestId("ok").getAttribute("role")).toBeNull();
  });
});

describe("CardHeader / ListRow — text that wraps, slots that reserve space (N4/N5/N6)", () => {
  it("gives the title a min-width of 0 and word-wrapping, never an ellipsis by default", () => {
    render(<CardHeader title="Two-factor authentication" badge={<StatusTag status="success">On</StatusTag>} actions={<button>Replace</button>} testId="h" />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(["0", "0px"]).toContain(heading.style.minWidth);
    expect(heading.style.overflowWrap).toBe("break-word");
    expect(heading.style.whiteSpace).toBe("normal");
    expect(heading.style.textOverflow).toBe("");
    const header = screen.getByTestId("h");
    expect(header.style.flexWrap).toBe("wrap");
    expect(header.querySelector("[data-stapel-card-header-badge]")?.textContent).toBe("On");
    const actions = header.querySelector("[data-stapel-card-header-actions]") as HTMLElement;
    expect(actions.style.flex).toBe("0 0 auto");
    expect(within(actions).getByRole("button", { name: "Replace" })).toBeTruthy();
  });

  it("truncates only when told to", () => {
    render(<CardHeader title="Active sessions" truncate />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.style.textOverflow).toBe("ellipsis");
    expect(heading.style.whiteSpace).toBe("nowrap");
  });

  it("puts a row's actions beside the text on a desktop and under it on a phone, at 44px", () => {
    render(<ListRow title="Google" meta="Connected" actions={<button>Disconnect</button>} testId="row" />);
    let row = screen.getByTestId("row");
    expect(row.querySelector("[data-stapel-list-row-text] [data-stapel-list-row-actions]")).toBeNull();
    expect(row.querySelector("[data-stapel-list-row-actions]")).not.toBeNull();
    expect(row.style.minHeight).toBe("");
    cleanup();
    setViewport(390);
    render(<ListRow title="Google" meta="Connected" actions={<button>Disconnect</button>} testId="row" />);
    row = screen.getByTestId("row");
    expect(row.querySelector("[data-stapel-list-row-text] [data-stapel-list-row-actions]")).not.toBeNull();
    expect(row.style.minHeight).toBe("44px");
    const text = row.querySelector("[data-stapel-list-row-text]") as HTMLElement;
    expect(["0", "0px"]).toContain(text.style.minWidth);
  });

  it("reserves a cell for the badge on the title line instead of floating it", () => {
    render(<ListRow title="Signed in" meta="Aug 22, 2026 — IP 45.9.148.77" badge={<StatusTag status="warning">Unrecognized</StatusTag>} testId="row" />);
    const badge = screen.getByTestId("row").querySelector("[data-stapel-list-row-badge]") as HTMLElement;
    expect(["none", "0 0 auto"]).toContain(badge.style.flex);
    expect(badge.style.position).toBe("");
  });
});

describe("RowActions — wrap between buttons, overflow into a sheet on a phone", () => {
  const actions = (spies: Record<string, () => void>): readonly RowAction[] => [
    { key: "rename", label: "Rename", onClick: spies["rename"] },
    { key: "signout", label: "Sign out everywhere", onClick: spies["signout"], primary: true },
    { key: "remove", label: "Remove", onClick: spies["remove"], danger: true },
  ];

  it("shows every action inline on a desktop, each label on one line", () => {
    render(
      <Host>
        <RowActions actions={actions({})} testId="ra" />
      </Host>
    );
    const box = screen.getByTestId("ra");
    expect(box.getAttribute("data-stapel-row-actions")).toBe("inline");
    expect(box.style.flexWrap).toBe("wrap");
    for (const name of ["Rename", "Sign out everywhere", "Remove"]) {
      const button = screen.getByRole("button", { name });
      expect(button.style.whiteSpace).toBe("nowrap");
    }
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("keeps the primary action inline on a phone and folds the rest into a sheet", () => {
    setViewport(390);
    const remove = vi.fn();
    render(
      <Host>
        <RowActions actions={actions({ remove })} testId="ra" />
      </Host>
    );
    const box = screen.getByTestId("ra");
    expect(box.getAttribute("data-stapel-row-actions")).toBe("overflow");
    expect(within(box).getByRole("button", { name: "Sign out everywhere" })).toBeTruthy();
    expect(within(box).queryByRole("button", { name: "Remove" })).toBeNull();
    const more = screen.getByRole("button", { name: "More" });
    expect(more.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(more);
    const sheet = screen.getByTestId("ra-sheet");
    expect(sheet.getAttribute("data-stapel-dialog-surface")).toBe("sheet");
    expect(within(sheet).getByRole("button", { name: "Rename" })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove" }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders a gated action through GatedButton, reason beside it", () => {
    render(
      <Host i18n={host()}>
        <RowActions
          actions={[{ key: "hide", label: "Hide", gate: actionBlocked(REASON), onClick: () => undefined }]}
        />
      </Host>
    );
    const button = screen.getByRole("button", { name: "Hide" }) as HTMLButtonElement;
    // Semantically off, interactively alive — an html-disabled row action
    // could not disclose the sentence beside it, nor open a door.
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("You are not a moderator of this item.")).toBeTruthy();
  });
});

describe("PaneGate — one refusal per pane, pooled reasons (NC-GATEDNOISE / VC-B1)", () => {
  it("blocked: renders the reason once, an action, a preview, and none of the children — and no retry", () => {
    render(
      <Host i18n={host()}>
        <PaneGate gate={actionBlocked(REASON)} title="Moderation" action={<a href="/sign-in">Sign in</a>} preview={<p>the reviews</p>} testId="gate">
          <button>Hide</button>
          <button>Publish</button>
        </PaneGate>
      </Host>
    );
    const gate = screen.getByTestId("gate");
    expect(gate.getAttribute("data-stapel-pane-gate")).toBe("blocked");
    expect(screen.getByRole("status").textContent).toContain("You are not a moderator of this item.");
    expect(screen.getAllByText("You are not a moderator of this item.")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(gate.querySelector("[data-stapel-pane-gate-preview]")?.textContent).toBe("the reviews");
  });

  it("available: renders the children and pools identical per-control reasons into one sentence", () => {
    render(
      <Host i18n={host()}>
        <PaneGate gate={actionAvailable()} testId="gate">
          {["a", "b", "c"].map((id) => (
            <GatedButton key={id} gate={actionBlocked(REASON)} testId={`hide-${id}`}>
              Hide
            </GatedButton>
          ))}
          <GatedButton gate={actionBlocked(OTHER)} testId="reply">
            Reply
          </GatedButton>
          <GatedButton gate={actionAvailable()} testId="ok">
            Open
          </GatedButton>
        </PaneGate>
      </Host>
    );
    expect(screen.getByTestId("gate").getAttribute("data-stapel-pane-gate")).toBe("available");
    expect(screen.getAllByText("You are not a moderator of this item.")).toHaveLength(1);
    expect(screen.getAllByText("Only the seller can reply.")).toHaveLength(1);
    const pooled = screen.getByTestId("gate").querySelector("[data-stapel-gate-reasons]") as HTMLElement;
    expect(pooled.querySelectorAll("[data-stapel-gated-reason]")).toHaveLength(2);
    const sentence = screen.getByText("You are not a moderator of this item.");
    for (const id of ["a", "b", "c"]) {
      const button = screen.getByTestId(`hide-${id}`);
      expect((button as HTMLButtonElement).disabled).toBe(false);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-describedby")).toBe(sentence.getAttribute("id"));
    }
    expect(screen.getByTestId("ok").getAttribute("aria-describedby")).toBeNull();
  });

  it("drops a pooled sentence when its last control leaves", () => {
    function Rows(props: { readonly n: number }): React.ReactElement {
      return (
        <PaneGate gate={actionAvailable()}>
          {Array.from({ length: props.n }, (_, i) => (
            <GatedButton key={String(i)} gate={actionBlocked(REASON)}>
              Hide
            </GatedButton>
          ))}
        </PaneGate>
      );
    }
    const { rerender } = render(
      <Host i18n={host()}>
        <Rows n={2} />
      </Host>
    );
    expect(screen.getAllByText("You are not a moderator of this item.")).toHaveLength(1);
    rerender(
      <Host i18n={host()}>
        <Rows n={0} />
      </Host>
    );
    expect(screen.queryByText("You are not a moderator of this item.")).toBeNull();
  });
});

describe("DataTable — a table where the box is wide, cards where it is not (VC-B3)", () => {
  interface Row {
    readonly id: string;
    readonly name: string;
    readonly state: string;
    readonly used: string;
  }
  const rows: readonly Row[] = [
    { id: "1", name: "Deploy key", state: "Active", used: "2 days ago" },
    { id: "2", name: "CI key with a rather long descriptive name", state: "Revoked", used: "never" },
  ];
  const columns = [
    { key: "name", title: "Name", render: (r: Row) => r.name, cardRole: "title" as const },
    { key: "state", title: "State", render: (r: Row) => <StatusTag status="info">{r.state}</StatusTag>, cardRole: "badge" as const },
    { key: "used", title: "Last used", render: (r: Row) => r.used },
  ];
  const table = (layout?: "auto" | "table" | "cards"): React.ReactElement => (
    <Host>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        ariaLabel="Service keys"
        testId="dt"
        {...(layout !== undefined ? { layout } : {})}
        rowActions={(r) => [{ key: "revoke", label: `Revoke ${r.id}`, danger: true, onClick: () => undefined }]}
      />
    </Host>
  );

  it("renders a real table in a wide box", () => {
    render(table());
    const box = screen.getByTestId("dt");
    expect(box.getAttribute("data-stapel-datatable")).toBe("table");
    expect(box.querySelector("table")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Last used" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke 2" })).toBeTruthy();
  });

  it("renders cards in a phone-wide document: title, badge, label/value fields, actions", () => {
    setViewport(390);
    render(table());
    const box = screen.getByTestId("dt");
    expect(box.getAttribute("data-stapel-datatable")).toBe("cards");
    expect(box.querySelector("table")).toBeNull();
    const cards = box.querySelectorAll("[data-stapel-datatable-card]");
    expect(cards).toHaveLength(2);
    const second = cards[1] as HTMLElement;
    expect(within(second).getByRole("heading").textContent).toBe("CI key with a rather long descriptive name");
    expect(second.querySelector("[data-stapel-status='info']")?.textContent).toBe("Revoked");
    expect(second.querySelector("dt")?.textContent).toBe("Last used");
    expect(second.querySelector("dd")?.textContent).toBe("never");
    expect(within(second).getByRole("button", { name: "Revoke 2" })).toBeTruthy();
  });

  it("decides by the ELEMENT's width: a narrow box on a wide viewport gets cards", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 390,
      height: 100,
      top: 0,
      left: 0,
      right: 390,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(table());
    expect(screen.getByTestId("dt").getAttribute("data-stapel-datatable")).toBe("cards");
  });

  it("honours a forced layout and renders the designed empty state for zero rows", () => {
    render(table("cards"));
    expect(screen.getByTestId("dt").getAttribute("data-stapel-datatable")).toBe("cards");
    cleanup();
    render(
      <Host>
        <DataTable rows={[]} columns={columns} rowKey={(r) => r.id} testId="dt" />
      </Host>
    );
    expect(screen.getByTestId("dt-empty").getAttribute("data-stapel-empty")).toBe("");
  });
});
