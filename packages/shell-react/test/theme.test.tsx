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
  THEME_ATTRIBUTE,
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

/** The control plus the wiring a real header would give it. */
function Host({ initial }: { initial: ThemePreference }) {
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
    render(<ThemeModeControl value="system" onChange={() => {}} />);

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
    render(<ThemeModeControl value={value} onChange={() => {}} />);

    expect(radio(name).getAttribute("aria-checked")).toBe("true");
    expect(markedState()).toBe(value);
  });

  it("reports the choice, and stays quiet when the marked one is clicked", () => {
    const onChange = vi.fn();
    render(<ThemeModeControl value="light" onChange={onChange} />);

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

  it("follows an OS change while mounted, without moving the mark", () => {
    const os = installMatchMedia(false);
    render(<Host initial="system" />);
    expect(documentThemeMode()).toBe("light");
    expect(radio(/\(Light\)$/).getAttribute("aria-checked")).toBe("true");

    act(() => os.set(true));

    expect(documentThemeMode()).toBe("dark");
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
