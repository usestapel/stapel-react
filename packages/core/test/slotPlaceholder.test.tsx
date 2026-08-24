import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "../src/i18n.js";
import { SlotPlaceholder, isDevBuild } from "../src/slotPlaceholder.js";

function Host(props: { locale?: string; children: ReactNode }): ReactElement {
  return <I18nProvider i18n={createI18n({ locale: props.locale ?? "en" })}>{props.children}</I18nProvider>;
}

describe("SlotPlaceholder", () => {
  it("runs under a development build here, so `auto` shows the placeholder", () => {
    expect(isDevBuild()).toBe(true);
    render(
      <Host>
        <SlotPlaceholder name="renderCategoryPicker" />
      </Host>
    );
    const box = screen.getByRole("note");
    expect(box.textContent).toContain("renderCategoryPicker");
    expect(box.getAttribute("data-stapel-slot")).toBe("renderCategoryPicker");
  });

  it("renders nothing when pinned hidden — the production behaviour", () => {
    const { container } = render(
      <Host>
        <SlotPlaceholder name="renderCurrencyField" visibility="hidden" />
      </Host>
    );
    expect(container.innerHTML).toBe("");
  });

  it("speaks the host's locale through the core floor", () => {
    render(
      <Host locale="ru">
        <SlotPlaceholder name="headerExtra" visibility="visible" />
      </Host>
    );
    expect(screen.getByRole("note").textContent).toContain("headerExtra");
    expect(screen.getByRole("note").textContent).not.toContain("Slot");
  });
});
