/**
 * The three-state theme control, and the states that are easy to get wrong.
 *
 * The subject is NOT "does a class get toggled". It is the distinction the
 * control exists to preserve: `system` is a rule that RESOLVES to a colour,
 * and it must stay tellable apart from being pinned to that same colour —
 * on screen, in the accessible name, and while the OS changes underneath a
 * mounted control.
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { resolveThemeMode } from "@stapel/tokens-antd";

import {
  applyThemePreference,
  documentThemeMode,
  resolveThemePreference,
  watchSystemTheme,
  themeControlFocusCss,
  THEME_ATTRIBUTE,
  THEME_CONTROL_FOCUS_CLASS,
  THEME_PREFERENCE_STORAGE_KEY,
  ThemeModeControl,
  useThemePreference,
  type ThemePreference,
} from "../src/theme/index.js";

/** A `matchMedia` whose answer the test controls and whose listeners the
 * test can fire — jsdom ships neither. */
function installMatchMedia(prefersDark: boolean): { set: (next: boolean) => void } {
  let dark = prefersDark;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query.includes("dark") ? dark : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      dark = next;
      for (const fn of [...listeners]) fn();
    },
  };
}

const root = (): HTMLElement => document.documentElement;

/** The one button currently marked, by the state it stands for. */
function markedState(): string | null {
  const marked = screen
    .getAllByRole("radio")
    .filter((b) => b.getAttribute("aria-checked") === "true");
  expect(marked).toHaveLength(1);
  return marked[0]?.getAttribute("data-state") ?? null;
}

function radio(name: RegExp | string): HTMLElement {
  return screen.getByRole("radio", { name });
}

/** The SETTINGS control plus the wiring a real appearance screen would give
 * it. Explicit about the variant because the default is no longer this one:
 * every assertion below about a radio group is an assertion about
 * `variant="settings"`, and a test that inherited the default would move to
 * a different control the day the default moved. */
function Host({ initial }: { initial: ThemePreference }) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  useThemePreference(preference, { persist: false });
  return (
    <ThemeModeControl variant="settings" value={preference} onChange={setPreference} />
  );
}

/** The COMPACT control with the same wiring — one button, cycling. */
function CompactHost({ initial }: { initial: ThemePreference }) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  useThemePreference(preference, { persist: false });
  return <ThemeModeControl value={preference} onChange={setPreference} />;
}

beforeEach(() => {
  installMatchMedia(false);
  root().removeAttribute(THEME_ATTRIBUTE);
  root().className = "";
  root().style.colorScheme = "";
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a preference resolves; it is not itself a colour", () => {
  it("pins light and dark whatever the OS says", () => {
    installMatchMedia(true);
    expect(resolveThemePreference("light")).toBe("light");
    expect(resolveThemePreference("dark")).toBe("dark");
  });

  it("resolves system to whichever side the OS is on", () => {
    const os = installMatchMedia(false);
    expect(resolveThemePreference("system")).toBe("light");
    os.set(true);
    expect(resolveThemePreference("system")).toBe("dark");
  });
});

describe("applying a preference stamps one document, both signals", () => {
  it("writes the attribute, the class and color-scheme together", () => {
    applyThemePreference("dark", { persist: false });

    expect(root().getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.colorScheme).toBe("dark");

    applyThemePreference("light", { persist: false });

    expect(root().getAttribute(THEME_ATTRIBUTE)).toBe("light");
    expect(root().classList.contains("dark")).toBe(false);
    expect(root().style.colorScheme).toBe("light");
  });

  it("agrees with the reader every default skin uses", () => {
    // `@stapel/tokens-antd`'s `resolveThemeMode()` decides which side of
    // every colour role a stapel skin renders. If this writer and that
    // reader ever key off different signals, a host is half themed and
    // nothing catches it — so the agreement is asserted, not commented.
    applyThemePreference("dark", { persist: false });
    expect(resolveThemeMode()).toBe("dark");
    expect(documentThemeMode()).toBe("dark");

    applyThemePreference("light", { persist: false });
    expect(resolveThemeMode()).toBe("light");
    expect(documentThemeMode()).toBe("light");
  });

  it("lets a host that wants no class opt out of it", () => {
    applyThemePreference("dark", { persist: false, darkClasses: [] });

    expect(root().getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(root().className).toBe("");
  });

  it("caches under the key a boot script can read before any bundle", async () => {
    applyThemePreference("dark");
    await vi.waitFor(() =>
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toContain("dark"),
    );
  });
});

describe("only system follows the OS", () => {
  it("re-stamps the document when the OS flips under system", () => {
    const os = installMatchMedia(false);
    const stop = watchSystemTheme("system", { persist: false });
    applyThemePreference("system", { persist: false });
    expect(documentThemeMode()).toBe("light");

    os.set(true);
    expect(documentThemeMode()).toBe("dark");
    stop();
  });

  it("leaves a pinned choice alone when the OS flips", () => {
    const os = installMatchMedia(false);
    const stop = watchSystemTheme("light", { persist: false });
    applyThemePreference("light", { persist: false });

    os.set(true);
    expect(documentThemeMode()).toBe("light");
    stop();
  });
});

describe("the control shows three states and marks the chosen one", () => {
  it("offers exactly light, dark and system", () => {
    render(<ThemeModeControl variant="settings" value="system" onChange={() => {}} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radiogroup").getAttribute("aria-label")).toBe(
      "Appearance",
    );
  });

  it.each([
    ["light" as const, /^Light$/],
    ["dark" as const, /^Dark$/],
    ["system" as const, /^Match system/],
  ])("marks %s and nothing else", (value, name) => {
    render(<ThemeModeControl variant="settings" value={value} onChange={() => {}} />);

    expect(radio(name).getAttribute("aria-checked")).toBe("true");
    expect(markedState()).toBe(value);
  });

  it("reports the choice, and stays quiet when the marked one is clicked", () => {
    const onChange = vi.fn();
    render(<ThemeModeControl variant="settings" value="light" onChange={onChange} />);

    fireEvent.click(radio(/^Dark$/));
    expect(onChange).toHaveBeenCalledWith("dark");

    onChange.mockClear();
    fireEvent.click(radio(/^Light$/));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("system stays tellable apart from the colour it resolves to", () => {
  it("marks the half-disc, not the moon, when system resolves to dark", () => {
    installMatchMedia(true);
    render(<Host initial="system" />);

    // The document IS dark…
    expect(documentThemeMode()).toBe("dark");
    // …and the mark is still on system, so a person can see that their
    // choice will move again when the OS does.
    expect(markedState()).toBe("system");
    expect(radio(/^Dark$/).getAttribute("aria-checked")).toBe("false");
  });

  it("names the resolved mode for a reader who cannot see the mark", () => {
    installMatchMedia(true);
    render(<Host initial="system" />);

    expect(radio("Match system (Dark)")).toBeDefined();
  });

  it("pinned dark and system-resolved-to-dark differ in what is marked", () => {
    installMatchMedia(true);
    const pinned = render(<Host initial="dark" />);
    expect(documentThemeMode()).toBe("dark");
    expect(markedState()).toBe("dark");
    pinned.unmount();

    render(<Host initial="system" />);

    expect(documentThemeMode()).toBe("dark"); // the same colour on screen…
    expect(markedState()).toBe("system"); // …a different state marked
  });

  it("follows an OS change while mounted, without moving the mark", async () => {
    const os = installMatchMedia(false);
    render(<Host initial="system" />);
    expect(documentThemeMode()).toBe("light");
    expect(radio(/\(Light\)$/).getAttribute("aria-checked")).toBe("true");

    // The DOCUMENT moves synchronously — no frame ever shows the old side.
    act(() => os.set(true));
    expect(documentThemeMode()).toBe("dark");

    // The CONTROL follows on the same microtask checkpoint: its reader is
    // now the fleet's single one (`@stapel/tokens-antd/skin`'s
    // `useThemeMode`), a MutationObserver on `data-theme`, which browsers
    // deliver before the next paint. Awaiting a microtask here is what a
    // synchronous `act` does not do; it is not a frame of staleness.
    await act(async () => {
      await Promise.resolve();
    });

    // The name follows the resolution…
    expect(radio(/\(Dark\)$/).getAttribute("aria-checked")).toBe("true");
    // …and the mark has not wandered off system.
    expect(markedState()).toBe("system");
  });

  it("stops following once a concrete side is chosen", () => {
    const os = installMatchMedia(false);
    render(<Host initial="system" />);

    fireEvent.click(radio(/^Light$/));
    act(() => os.set(true));

    expect(documentThemeMode()).toBe("light");
    expect(markedState()).toBe("light");
  });
});

/**
 * `role="radiogroup"` is a promise about the KEYBOARD, not only about the
 * names a screen reader reads out. A radio group is ONE tab stop and the
 * arrow keys move the choice inside it (WAI-ARIA APG). Three separately
 * tabbable buttons that ignore the arrows announce themselves as a radio
 * group and then behave like nothing of the sort — which leaves the person
 * who trusted the announcement worse off than plain buttons would have.
 */
describe("the control is the radio group it says it is", () => {
  it("is one tab stop: only the marked button is in the tab order", () => {
    render(<Host initial="dark" />);
    expect(radio(/^Dark$/).getAttribute("tabindex")).toBe("0");
    expect(radio(/^Light$/).getAttribute("tabindex")).toBe("-1");
    expect(radio(/^Match system/).getAttribute("tabindex")).toBe("-1");
  });

  it("moves the choice with ArrowRight and ArrowDown, and wraps at the end", () => {
    render(<Host initial="light" />);
    const group = screen.getByRole("radiogroup");

    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(markedState()).toBe("dark");

    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(markedState()).toBe("system");

    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(markedState()).toBe("light");
  });

  it("moves the other way with ArrowLeft and ArrowUp, wrapping at the start", () => {
    render(<Host initial="light" />);
    const group = screen.getByRole("radiogroup");

    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(markedState()).toBe("system");

    fireEvent.keyDown(group, { key: "ArrowUp" });
    expect(markedState()).toBe("dark");
  });

  it("jumps to the ends with Home and End", () => {
    render(<Host initial="dark" />);
    const group = screen.getByRole("radiogroup");

    fireEvent.keyDown(group, { key: "End" });
    expect(markedState()).toBe("system");

    fireEvent.keyDown(group, { key: "Home" });
    expect(markedState()).toBe("light");
  });

  it("moves the FOCUS with the choice, so the next arrow key comes from the same place", () => {
    render(<Host initial="light" />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(radio(/^Dark$/));
    expect(radio(/^Dark$/).getAttribute("tabindex")).toBe("0");
  });

  it("leaves other keys to the host — a group does not swallow Tab or Enter", () => {
    const seen: string[] = [];
    render(
      <div onKeyDown={(e) => seen.push(e.key)}>
        <Host initial="light" />
      </div>
    );
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Tab" });
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Enter" });
    expect(seen).toEqual(["Tab", "Enter"]);
    expect(markedState()).toBe("light");
  });

  it("carries no tooltip: the accessible name is the whole explanation", () => {
    render(<Host initial="system" />);
    for (const button of screen.getAllByRole("radio")) {
      expect(button.getAttribute("title")).toBeNull();
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
  });
});

/**
 * The compact variant — the DEFAULT since 0.14.0.
 *
 * The subject is what one icon button has to carry that three labelled
 * segments carried for free: which state the page is in, and what the next
 * press does. Both of those live in the accessible name here, so the name is
 * not a nicety in this variant — it is the control's entire readout.
 */
describe("the compact variant is the default, and it is one button", () => {
  it("renders a single button and no radio group at all", () => {
    render(<CompactHost initial="light" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("is what a host that names no variant gets", () => {
    render(<ThemeModeControl value="dark" onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("compact");
  });

  it("shows the state the page is IN, not the one a press would reach", () => {
    render(<CompactHost initial="dark" />);
    expect(screen.getByRole("button").getAttribute("data-state")).toBe("dark");
  });

  it("cycles light -> dark -> system -> light on click", () => {
    render(<CompactHost initial="light" />);
    const seen = ["light"];
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole("button"));
      seen.push(screen.getByRole("button").getAttribute("data-state") ?? "?");
    }
    expect(seen).toEqual(["light", "dark", "system", "light"]);
  });

  it("reports every step to the host, including the wrap back to light", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ThemeModeControl value="system" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("light");
    rerender(<ThemeModeControl value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith("dark");
  });

  it("names the current state AND the next one — the readout the labels used to be", () => {
    render(<CompactHost initial="light" />);
    const name = () => screen.getByRole("button").getAttribute("aria-label") ?? "";
    expect(name()).toBe("Appearance: Light. Switch to Dark");
    fireEvent.click(screen.getByRole("button"));
    expect(name()).toBe("Appearance: Dark. Switch to Match system");
  });

  it("leaves no {placeholder} unfilled in the name", () => {
    render(<CompactHost initial="system" />);
    expect(screen.getByRole("button").getAttribute("aria-label")).not.toMatch(/[{}]/);
  });

  it("takes the host's sentence and its word order, not just its nouns", () => {
    render(
      <ThemeModeControl
        value="light"
        onChange={() => {}}
        labels={{
          group: "Оформление",
          light: "Светлая",
          dark: "Тёмная",
          system: "Как в системе",
          cycle: "Оформление: {current}. Следующее: {next}",
        }}
      />
    );
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Оформление: Светлая. Следующее: Тёмная"
    );
  });

  it("falls back to the English sentence for labels written before `cycle` existed", () => {
    render(
      <ThemeModeControl
        value="light"
        onChange={() => {}}
        labels={{ group: "Appearance", light: "Light", dark: "Dark", system: "Match system" }}
      />
    );
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Appearance: Light. Switch to Dark"
    );
  });

  it("says what system RESOLVES to, so the one non-colour state stays readable", () => {
    installMatchMedia(true);
    applyThemePreference("system");
    render(<ThemeModeControl value="system" onChange={() => {}} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe(
      "Appearance: Match system (Dark). Switch to Light"
    );
    expect(button.getAttribute("data-resolved")).toBe("dark");
  });

  it("distinguishes pinned dark from system-resolved-to-dark in the name", () => {
    installMatchMedia(true);
    applyThemePreference("system");
    const { rerender } = render(<ThemeModeControl value="dark" onChange={() => {}} />);
    const pinned = screen.getByRole("button").getAttribute("aria-label");
    rerender(<ThemeModeControl value="system" onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).not.toBe(pinned);
  });

  it("is a button, not a switch: role=switch promises two states and this has three", () => {
    render(<CompactHost initial="light" />);
    expect(screen.getByRole("button").getAttribute("role")).toBeNull();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("carries no tooltip unless the host asks for one", () => {
    const { rerender } = render(<ThemeModeControl value="light" onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("title")).toBeNull();
    rerender(<ThemeModeControl value="light" onChange={() => {}} tooltip />);
    expect(screen.getByRole("button").getAttribute("title")).toBe(
      screen.getByRole("button").getAttribute("aria-label")
    );
  });

  it("keeps a 36px hit area — a header icon button, not a 24px glyph", () => {
    render(<CompactHost initial="light" />);
    const style = screen.getByRole("button").style;
    expect(style.inlineSize).toBe("2.25rem");
    expect(style.blockSize).toBe("2.25rem");
  });

  it("colours itself through tokens, so it is right in both themes with no CSS file", () => {
    render(<CompactHost initial="light" />);
    const style = screen.getByRole("button").getAttribute("style") ?? "";
    expect(style).toContain("--stapel-text");
    expect(style).toContain("--stapel-border");
    expect(style).toContain("--stapel-surface-sunken");
  });
});

describe("the settings variant is the control that shipped, unchanged", () => {
  it("still marks its group, so a host that opts in gets the same DOM contract", () => {
    render(<Host initial="dark" />);
    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("data-variant")).toBe("settings");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(markedState()).toBe("dark");
  });

  it("keeps its 44px segments and its visible labels", () => {
    render(<Host initial="light" />);
    for (const button of screen.getAllByRole("radio")) {
      expect(button.style.minHeight).toBe("2.75rem");
      expect(button.textContent?.trim()).toBeTruthy();
    }
  });
});

describe("the keyboard focus ring is the shell's token, in both variants", () => {
  it("emits a :focus-visible rule keyed to --stapel-focus-ring, never a plain :focus", () => {
    const css = themeControlFocusCss();
    expect(css).toContain(`.${THEME_CONTROL_FOCUS_CLASS}:focus-visible`);
    expect(css).toContain("var(--stapel-focus-ring");
    expect(css).toContain("outline-offset:2px");
    // Never a mouse-click ring: the rule must gate on :focus-visible, not
    // on a bare :focus that fires for every pointer click too.
    expect(css).not.toMatch(/:focus\s*\{/);
  });

  it("the compact button carries the ring class, host className kept alongside it", () => {
    render(<CompactHost initial="light" />);
    expect(screen.getByRole("button").className).toContain(THEME_CONTROL_FOCUS_CLASS);
  });

  it("a host className rides alongside the ring class rather than replacing it", () => {
    render(<ThemeModeControl value="light" onChange={() => {}} className="host-class" />);
    const classes = screen.getByRole("button").className.split(/\s+/);
    expect(classes).toContain(THEME_CONTROL_FOCUS_CLASS);
    expect(classes).toContain("host-class");
  });

  it("every settings segment carries the same ring class as the compact button", () => {
    render(<Host initial="light" />);
    for (const button of screen.getAllByRole("radio")) {
      expect(button.className).toContain(THEME_CONTROL_FOCUS_CLASS);
    }
  });

  it("hoists the ring sheet once via the dedup href, whichever variant mounts", () => {
    render(<CompactHost initial="light" />);
    const sheet = document.head.querySelector('style[data-href="stapel-shell-theme-focus"]');
    expect(sheet?.textContent).toContain(THEME_CONTROL_FOCUS_CLASS);
  });
});
