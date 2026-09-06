/**
 * A NAME'S SLOT IS THE SAME SLOT BEFORE THE NAME ARRIVES (D453).
 *
 * Measured on a live seller page: a 24px line of loading text was swapped for
 * an 86px `h4` when the profile read landed, 537ms after first paint, and the
 * 46px difference pushed the rating line and the whole results grid down the
 * page. CLS 0.0281 at 1440 and 0.0396 at 1280 — the only one of four surfaces
 * above 0.01, and one shift, not many.
 *
 * jsdom lays nothing out, so what this suite pins is the two things a DOM can
 * decide and which together are the fix: both states are the SAME heading
 * element at the same level, and both declare the same reserved height from
 * the same class contract. A layout that starts from one element with one
 * declared minimum cannot swap one box for a taller one.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  PROFILE_NAME_CLASS,
  PROFILE_NAME_LINE_VAR,
  PROFILE_NAME_PLACEHOLDER_CLASS,
  ProfileNameHeading,
  profileNameCss,
} from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

/** What the heading declares about its own height, as the DOM holds it. */
function slot(el: HTMLElement): {
  tag: string;
  className: string;
  line: string;
} {
  return {
    tag: el.tagName,
    className: el.className,
    line: el.style.getPropertyValue(PROFILE_NAME_LINE_VAR),
  };
}

describe("the loading and loaded states are one slot", () => {
  it("draws the SAME heading element, class and reserved line in both", () => {
    const loading = mount(<ProfileNameHeading loading testId="a" />);
    const before = slot(screen.getByTestId("a"));
    loading.unmount();

    mount(<ProfileNameHeading name="Ada Lovelace" testId="b" />);
    const after = slot(screen.getByTestId("b"));

    // Same element (so antd's heading margins are identical), same class (so
    // the floor applies to both), same reserved line (so the floor is the
    // same number).
    expect(before.tag).toBe("H4");
    expect(after.tag).toBe(before.tag);
    expect(before.className).toContain(PROFILE_NAME_CLASS);
    expect(after.className).toBe(before.className);
    expect(before.line).toMatch(/^\d+px$/);
    expect(after.line).toBe(before.line);
  });

  it("reserves the height through the class contract, not a magic number", () => {
    const css = profileNameCss();
    // The floor is one line of THIS heading, published per instance so one
    // hoisted sheet serves every level.
    expect(css).toContain(
      `.${PROFILE_NAME_CLASS}{min-block-size:var(${PROFILE_NAME_LINE_VAR})}`
    );
    expect(css).toContain(`.${PROFILE_NAME_PLACEHOLDER_CLASS}{`);
    mount(<ProfileNameHeading loading testId="c" />);
    // Antd's heading-4 line box, from the theme's own tokens: a number this
    // package never types, and one that moves when the type scale moves.
    const line = screen.getByTestId("c").style.getPropertyValue(
      PROFILE_NAME_LINE_VAR
    );
    expect(Number.parseInt(line, 10)).toBeGreaterThan(20);
  });

  it("follows the level the host asked for, in both states", () => {
    const four = mount(<ProfileNameHeading loading testId="d4" />);
    const lineFour = slot(screen.getByTestId("d4")).line;
    four.unmount();

    const loading = mount(<ProfileNameHeading loading level={2} testId="d" />);
    const before = slot(screen.getByTestId("d"));
    loading.unmount();
    mount(<ProfileNameHeading name="Ada" level={2} testId="e" />);
    const after = slot(screen.getByTestId("e"));

    expect(before.tag).toBe("H2");
    expect(after.tag).toBe("H2");
    // Still one slot across the swap…
    expect(after.line).toBe(before.line);
    // …and a bigger heading reserves a taller line: the reservation is the
    // level's own, never a constant.
    expect(Number.parseInt(before.line, 10)).toBeGreaterThan(
      Number.parseInt(lineFour, 10)
    );
  });
});

describe("what it says while it waits, and when it has nothing to say", () => {
  it("announces the wait instead of announcing an empty heading", () => {
    mount(<ProfileNameHeading loading testId="g" />);
    const heading = screen.getByTestId("g");
    expect(heading.getAttribute("aria-busy")).toBe("true");
    expect(heading.getAttribute("data-state")).toBe("loading");
    // The bar is decoration and says so; the heading carries the sentence.
    expect(heading.getAttribute("aria-label")).toBe("Loading profile…");
    const bar = screen.getByTestId("g-placeholder");
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.className).toBe(PROFILE_NAME_PLACEHOLDER_CLASS);
  });

  it("prints the name, with no aria-label competing with it, once it lands", () => {
    mount(<ProfileNameHeading name="  Ada Lovelace  " testId="h" />);
    const heading = screen.getByTestId("h");
    expect(heading.textContent).toBe("Ada Lovelace");
    expect(heading.getAttribute("aria-label")).toBeNull();
    expect(heading.getAttribute("aria-busy")).toBeNull();
    expect(heading.getAttribute("data-state")).toBe("ready");
    expect(screen.queryByTestId("h-placeholder")).toBeNull();
  });

  it("says the pair's word for a nameless profile, never blank space", () => {
    // stapel-profiles 0.15.0 provisions a row at registration, so an empty
    // `display_name` is a routine answer and not a failure.
    mount(<ProfileNameHeading name="" testId="i" />);
    expect(screen.getByTestId("i").textContent).toBe("Unnamed");
    expect(screen.getByTestId("i").getAttribute("data-state")).toBe("ready");
  });
});
