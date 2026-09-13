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
  // The en floor under whatever locale is asked for, exactly as the pair's own
  // `registerProfilesI18nRu`/`Es` do — a locale with no bundle of its own then
  // renders the English SENTENCE around its own formatted date, which is what
  // a host running `ja` with no `ja` bundle actually sees.
  registerProfilesI18n(i18n, locale);
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
    // Russian says "since" like every other locale, and the month is in the
    // GENITIVE the preposition governs: `marta`, never the nominative `mart`.
    //
    // `\u202f` is a NARROW NO-BREAK SPACE, and it is ICU's, not ours: it is
    // the literal the ru pattern puts between the year and the abbreviation
    // for "year" that follows it, so the two cannot be split across a line.
    // It survives here precisely because the
    // line is a rebuild of the locale's own parts — a pair that joined a month
    // and a year itself would have written an ordinary space and allowed the
    // break.
    expect(screen.getByTestId("member-since").textContent).toBe(
      "На сайте с марта 2024\u202fг."
    );
    unmount();

    const en = mount(<MemberSince created_at={MARCH_2024} />, "en");
    expect(screen.getByTestId("member-since").textContent).toBe(
      "Member since March 2024"
    );
    en.unmount();

    mount(<MemberSince created_at={MARCH_2024} />, "es");
    const es = screen.getByTestId("member-since").textContent ?? "";
    expect(es).toContain("marzo");
    expect(es.startsWith("Miembro desde")).toBe(true);
  });

  /**
   * The declension is a rebuild of the locale's OWN month-year phrase with one
   * part swapped, never a `{month} {year}` of our own. That distinction is the
   * whole safety of it: Spanish joins the two with `de` and Japanese writes
   * neither word, and a pair that assembled the pieces itself would quietly
   * flatten both. Only the WORD moves; the pattern around it is `Intl`'s.
   */
  it("keeps each locale's own month-year pattern, not a shape of our own", () => {
    const { unmount } = mount(<MemberSince created_at={MARCH_2024} />, "es");
    // `de` survives — the parts were rebuilt, not concatenated.
    expect(screen.getByTestId("member-since").textContent).toBe(
      "Miembro desde marzo de 2024"
    );
    unmount();

    // Japanese writes the month as a NUMBER inside `2024年3月`. There is no
    // case to decline and nothing to take apart; the line is the pattern.
    mount(<MemberSince created_at={MARCH_2024} />, "ja");
    expect(screen.getByTestId("member-since").textContent).toContain("2024年3月");
  });

  /**
   * The fallback arm. A locale tag the runtime refuses (`en_US` — an
   * underscore is a `RangeError` to `Intl`, and tags reach a host from config,
   * a URL segment and stored preferences alike) leaves the declension with
   * nothing to read.
   *
   * What must NOT happen is the half sentence — the preposition with the
   * date missing behind it — which is what a decline path that returns its
   * failure as an empty string produces. The line falls back to exactly what
   * it rendered before this existed: the nominative phrase, whole.
   */
  it("falls back to the whole nominative line when the tag is unreadable", () => {
    const i18n = createI18n({ locale: "en_US" });
    registerProfilesI18n(i18n, "en_US");
    render(
      <I18nProvider i18n={i18n}>
        <MemberSince created_at={MARCH_2024} />
      </I18nProvider>
    );
    const text = screen.getByTestId("member-since").textContent ?? "";
    expect(text).toBe("Member since March 2024");
    // Belt and braces: no half sentence, whatever the runtime's own default
    // locale writes the month as.
    expect(text.endsWith("2024")).toBe(true);
  });

  it("publishes the instant it formatted, so a walker can check the reduction", () => {
    mount(<MemberSince created_at={MARCH_2024} testId="tenure" />);
    expect(
      screen.getByTestId("tenure").getAttribute("data-stapel-member-since")
    ).toBe(MARCH_2024);
  });
});
