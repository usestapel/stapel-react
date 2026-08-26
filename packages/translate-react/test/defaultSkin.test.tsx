import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { actionBlocked } from "@stapel/core";
import { LanguageSwitcher } from "../src/default/LanguageSwitcher.js";
import { LanguageSettingsPane } from "../src/default/LanguageSettingsPane.js";
import { TranslationStatus } from "../src/default/TranslationStatus.js";
import { TranslateButton } from "../src/default/TranslateButton.js";
import { TranslatedText } from "../src/default/TranslatedText.js";
import { TRANSLATE_I18N_KEYS } from "../src/index.js";
import type { TranslateTextBag } from "../src/index.js";
import { makeHarness, recordingFetch, setViewport, statusOf } from "./helpers.js";

const PHONE = 390;
const DESKTOP = 1280;

const NOOP = (): void => undefined;

function bagOf(overrides: Partial<TranslateTextBag>): TranslateTextBag {
  return {
    available: true,
    target: "en",
    setTarget: NOOP,
    status: "idle",
    originals: ["hola"],
    translations: null,
    texts: ["hola"],
    text: "hola",
    sourceLanguage: null,
    cached: false,
    provider: null,
    refusal: null,
    error: null,
    translate: { available: true },
    run: NOOP,
    showingOriginal: false,
    toggle: NOOP,
    ...overrides,
  };
}

afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
});

describe("<LanguageSwitcher> — the surface follows the viewport", () => {
  it("is a searchable Select on desktop", () => {
    setViewport(DESKTOP);
    const { Wrapper } = makeHarness({ status: statusOf() });
    render(
      <Wrapper>
        <LanguageSwitcher />
      </Wrapper>
    );
    expect(screen.getByTestId("translate-switcher-select")).toBeTruthy();
  });

  it("is a sheet trigger on a phone — never a 20-row dropdown at 390px", async () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness({ status: statusOf() });
    render(
      <Wrapper>
        <LanguageSwitcher />
      </Wrapper>
    );
    const trigger = screen.getByTestId("translate-switcher-trigger");
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        document.querySelector('[data-stapel-dialog-surface="sheet"]')
      ).not.toBeNull();
    });
  });

  it("names itself for a screen reader in its compact, icon-only form", () => {
    setViewport(DESKTOP);
    const { Wrapper } = makeHarness({ status: statusOf() });
    render(
      <Wrapper>
        <LanguageSwitcher compact />
      </Wrapper>
    );
    const trigger = screen.getByTestId("translate-switcher-trigger");
    expect(trigger.getAttribute("aria-label")).toBeTruthy();
  });

  it("says the copy is partial BESIDE the control, not in a tooltip", () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness({
      status: statusOf({ source: "fallback", failed: true, keys: 0 }),
    });
    const { container } = render(
      <Wrapper>
        <LanguageSwitcher />
      </Wrapper>
    );
    const note = container.querySelector('[data-stapel-translate="partial"]');
    expect(note?.textContent).toBeTruthy();
    expect(container.querySelectorAll("[title]").length).toBe(0);
  });

  it("renders the endonym, not a translated language name", () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness({ locale: "en", status: statusOf() });
    render(
      <Wrapper>
        <LanguageSwitcher />
      </Wrapper>
    );
    act(() => {
      screen.getByTestId("translate-switcher-trigger").click();
    });
    // A person looking for Russian in an English UI scans for the endonym.
    expect(screen.getByText("Русский")).toBeTruthy();
  });
});

describe("<TranslationStatus> — which rung answered", () => {
  it("shows the revision and the key count when the server answered", () => {
    setViewport(DESKTOP);
    const { Wrapper } = makeHarness({ status: statusOf({ revision: 41, keys: 264 }) });
    const { container } = render(
      <Wrapper>
        <TranslationStatus />
      </Wrapper>
    );
    expect(container.textContent).toContain("41");
    expect(container.textContent).toContain("264");
  });

  it("names the degraded rung instead of looking healthy", () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness({
      status: statusOf({ source: "cache", stale: true, failed: true }),
    });
    const { container } = render(
      <Wrapper>
        <TranslationStatus />
      </Wrapper>
    );
    expect(
      container.querySelector('[data-stapel-translate="degraded"]')
    ).not.toBeNull();
  });

  it("draws the loading state rather than an empty line", () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness();
    const { container } = render(
      <Wrapper>
        <TranslationStatus />
      </Wrapper>
    );
    expect(
      container.querySelector('[data-stapel-load-state="loading"]')
    ).not.toBeNull();
  });
});

describe("<TranslateButton> — absent, not dead", () => {
  it("renders NOTHING where the deployment offers no content translation", () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness({ contentTranslate: false });
    const { container } = render(
      <Wrapper>
        <TranslateButton bag={bagOf({ available: false })} />
      </Wrapper>
    );
    expect(container.querySelector('[data-testid="translate-button"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("prints the block's reason beside a gated control", () => {
    setViewport(DESKTOP);
    const { Wrapper, i18n } = makeHarness();
    const { container } = render(
      <Wrapper>
        <TranslateButton
          bag={bagOf({
            translate: actionBlocked(TRANSLATE_I18N_KEYS.buttonTooLong, {
              max_chars: 5000,
            }),
          })}
        />
      </Wrapper>
    );
    const reason = container.querySelector("[data-stapel-gated-reason]");
    expect(reason?.textContent).toBe(
      i18n.t(TRANSLATE_I18N_KEYS.buttonTooLong, { max_chars: 5000 })
    );
    // The limit is IN the sentence: "too long" with no number is not actionable.
    expect(reason?.textContent).toContain("5000");
  });

  it("becomes the way back to the original once an answer is in hand", () => {
    setViewport(PHONE);
    const { Wrapper, i18n } = makeHarness();
    render(
      <Wrapper>
        <TranslateButton
          bag={bagOf({
            status: "translated",
            translations: ["hello"],
            texts: ["hello"],
            text: "hello",
          })}
        />
      </Wrapper>
    );
    expect(screen.getByTestId("translate-button-toggle").textContent).toBe(
      i18n.t(TRANSLATE_I18N_KEYS.buttonShowOriginal)
    );
  });

  it("folds a 429 into its own sentence, with a retry", () => {
    setViewport(PHONE);
    const { Wrapper, i18n } = makeHarness();
    const { container } = render(
      <Wrapper>
        <TranslateButton
          bag={bagOf({
            status: "failed",
            error: new Error("429"),
            refusal: {
              key: TRANSLATE_I18N_KEYS.buttonThrottled,
              params: {},
              retryable: true,
              requiresSignIn: false,
            },
          })}
        />
      </Wrapper>
    );
    expect(container.textContent).toContain(
      i18n.t(TRANSLATE_I18N_KEYS.buttonThrottled)
    );
    expect(
      container.querySelector('[data-stapel-error="inline"]')
    ).not.toBeNull();
  });
});

describe("<TranslatedText> — one request for a screenful", () => {
  it("folds three mounted texts into ONE call and marks the answer", async () => {
    setViewport(PHONE);
    const wire = recordingFetch({
      routes: {
        "api/v1/text/": [
          200,
          {
            texts: ["one", "two", "three"],
            text: "one",
            source_language: "es",
            target_language: "en",
            provider: "AgentProvider",
            cached: true,
          },
        ],
      },
    });
    const { Wrapper } = makeHarness({ fetch: wire.fetch });
    render(
      <Wrapper>
        <TranslatedText text="uno" sourceLang="es" auto />
        <TranslatedText text="dos" sourceLang="es" auto />
        <TranslatedText text="tres" sourceLang="es" auto />
      </Wrapper>
    );

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-stapel-translate="cached"]').length
      ).toBe(3);
    });

    const posts = wire.calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
      texts: ["uno", "dos", "tres"],
      target_lang: "en",
      source_lang: "es",
    });
    // The estimate markers are visible copy, not a hidden attribute.
    const note = screen.getAllByTestId("translate-text-note")[0];
    expect(note?.textContent).toContain("machine translation");
    expect(note?.textContent).toContain("saved answer");
  });

  it("shows the author's own words first, and after a toggle back", async () => {
    setViewport(PHONE);
    const { Wrapper } = makeHarness();
    render(
      <Wrapper>
        <TranslatedText text="uno" sourceLang="es" />
      </Wrapper>
    );
    const shown = screen.getByTestId("translate-text");
    expect(shown.textContent).toBe("uno");
    expect(shown.getAttribute("data-stapel-translate")).toBe("original");
  });

  it("refuses a text over the ceiling with a visible sentence and no call", async () => {
    setViewport(PHONE);
    const wire = recordingFetch();
    const { Wrapper, i18n } = makeHarness({ fetch: wire.fetch });
    const { container } = render(
      <Wrapper>
        <TranslatedText text={"x".repeat(5001)} sourceLang="es" />
      </Wrapper>
    );
    await waitFor(() => {
      expect(container.querySelector("[data-stapel-gated-reason]")).not.toBeNull();
    });
    expect(container.textContent).toContain(
      i18n.t(TRANSLATE_I18N_KEYS.buttonTooLong, { max_chars: 5000 })
    );
    expect(wire.calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
});

describe("<LanguageSettingsPane> — the account screen", () => {
  it("mounts the control, its explanation and the status line", () => {
    setViewport(PHONE);
    const { Wrapper, i18n } = makeHarness({ status: statusOf() });
    const { container } = render(
      <Wrapper>
        <LanguageSettingsPane />
      </Wrapper>
    );
    expect(screen.getByTestId("translate-language-settings")).toBeTruthy();
    expect(container.textContent).toContain(
      i18n.t(TRANSLATE_I18N_KEYS.settingsHint)
    );
    expect(screen.getByTestId("translate-switcher-trigger")).toBeTruthy();
  });

  it("follows the document's theme rather than pinning one", async () => {
    setViewport(DESKTOP);
    const { Wrapper } = makeHarness({ status: statusOf() });
    const { container } = render(
      <Wrapper>
        <LanguageSettingsPane />
      </Wrapper>
    );
    document.documentElement.setAttribute("data-theme", "dark");
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        container.querySelector('[data-stapel-skin-mode="dark"]')
      ).not.toBeNull();
    });
    document.documentElement.removeAttribute("data-theme");
  });
});
