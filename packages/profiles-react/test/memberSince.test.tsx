/**
 * TENURE IS A MONTH AND A YEAR, AT THE READER'S LOCALE.
 *
 * stapel-profiles 0.19.2 answers `created_at` on the public read so a seller
 * page can say how long somebody has been here without a second lookup. What
 * this suite pins is everything a consumer would otherwise get wrong doing it
 * themselves: the raw ISO instant never reaches the glass (visual class
 * VC-A8), the day is deliberately dropped, the sentence is a key in all three
 * locales, and an absent or unreadable time renders NOTHING rather than a
 * sentence about the backend.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { MemberSince } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import { registerProfilesI18nRu } from "../src/i18n/ru.js";
import { registerProfilesI18nEs } from "../src/i18n/es.js";

const MARCH_2024 = "2024-03-15T12:00:00Z";

function mount(node: ReactElement, locale = "en"): ReturnType<typeof render> {
  const i18n = createI18n({ locale });
  registerProfilesI18n(i18n);
  if (locale === "ru") registerProfilesI18nRu(i18n);
  if (locale === "es") registerProfilesI18nEs(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe("<MemberSince>", () => {
  it("states the month and the year, and NOT the day", () => {
    mount(<MemberSince created_at={MARCH_2024} />);
    const text = screen.getByTestId("member-since").textContent ?? "";
    expect(text).toContain("March 2024");
    // The precision the component throws away on purpose: "since 15 March
    // 2024, 09:41" reads as surveillance of a stranger.
    expect(text).not.toContain("15");
    expect(text).not.toContain(":");
  });

  it("never lets the raw ISO instant onto the glass", () => {
    mount(<MemberSince created_at={MARCH_2024} />);
    expect(screen.getByTestId("member-since").textContent).not.toContain(
      MARCH_2024
    );
  });

  it("renders nothing at all when there is no tenure to state", () => {
    for (const value of [null, undefined, "", "not-a-date"]) {
      const { container, unmount } = mount(<MemberSince created_at={value} />);
      expect(container.textContent, String(value)).toBe("");
      unmount();
    }
  });

  it("speaks each locale's own sentence, and each locale's own month", () => {
    const { unmount } = mount(<MemberSince created_at={MARCH_2024} />, "ru");
    // Russian states the fact rather than saying "since": `Intl` writes the
    // month in the nominative case and a Russian "since <month>" governs the
    // genitive, so the PHRASING moves rather than the formatter.
    const ru = screen.getByTestId("member-since").textContent ?? "";
    expect(ru).toContain("март");
    expect(ru).toContain(":");
    unmount();

    mount(<MemberSince created_at={MARCH_2024} />, "es");
    const es = screen.getByTestId("member-since").textContent ?? "";
    expect(es).toContain("marzo");
    expect(es.startsWith("Miembro desde")).toBe(true);
  });

  it("publishes the instant it formatted, so a walker can check the reduction", () => {
    mount(<MemberSince created_at={MARCH_2024} testId="tenure" />);
    expect(
      screen.getByTestId("tenure").getAttribute("data-stapel-member-since")
    ).toBe(MARCH_2024);
  });
});
