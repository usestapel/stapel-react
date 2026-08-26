/**
 * The shell's own chrome copy, in every locale it ships.
 *
 * These eight strings are the frame every translated screen sits inside: the
 * nav sheet's open and close controls, the admin section and why it is
 * closed, the storefront's sign-in call, and the theme control's three
 * states. Shipping
 * them in English on a ru/es host was not a missing translation — it was an
 * English frame around a translated product, and it was invisible to every
 * test that runs in one locale, which is all of them.
 *
 * The `stapel/i18n-locale-parity` lint checks the key sets from the outside.
 * This checks what a lint cannot: that the bundle a host actually REGISTERS
 * resolves, that nothing is a copy-paste of the English, and that the keys
 * the code names are the keys the bundles define.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { SHELL_I18N_KEYS, registerShellI18n, shellI18nBundleEn } from "../src/i18n/keys.js";
import { registerShellI18nRu, shellI18nBundleRu } from "../src/i18n/ru.js";
import { registerShellI18nEs, shellI18nBundleEs } from "../src/i18n/es.js";

const LOCALES = {
  ru: shellI18nBundleRu,
  es: shellI18nBundleEs,
} as const;

const englishKeys = Object.keys(shellI18nBundleEn).sort();

describe("shell chrome i18n — en/ru/es parity", () => {
  it("every key the code names is defined in English", () => {
    for (const key of Object.values(SHELL_I18N_KEYS)) {
      expect(shellI18nBundleEn[key], key).toBeTypeOf("string");
    }
  });

  it("every English key the code names is reachable through SHELL_I18N_KEYS", () => {
    expect(englishKeys).toEqual([...Object.values(SHELL_I18N_KEYS)].sort());
  });

  it.each(Object.keys(LOCALES))("%s defines exactly the English key set", (locale) => {
    const bundle = LOCALES[locale as keyof typeof LOCALES];
    expect(Object.keys(bundle).sort()).toEqual(englishKeys);
  });

  it.each(Object.keys(LOCALES))("%s translates every string, none left in English", (locale) => {
    const bundle = LOCALES[locale as keyof typeof LOCALES];
    const untranslated = englishKeys.filter((key) => bundle[key] === shellI18nBundleEn[key]);
    expect(untranslated).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s has no empty copy", (locale) => {
    const bundle = LOCALES[locale as keyof typeof LOCALES];
    for (const [key, value] of Object.entries(bundle)) {
      expect(typeof value === "string" && value.trim().length > 0, key).toBe(true);
    }
  });
});

describe("shell chrome i18n — registering a locale is what a host does", () => {
  it("resolves the ru copy after registerShellI18nRu, not the key and not the English", () => {
    const i18n = createI18n({ locale: "ru" });
    registerShellI18n(i18n); // the en floor, as a host registers it at startup
    registerShellI18nRu(i18n);
    const menu = i18n.t(SHELL_I18N_KEYS.navOpenMenu);
    expect(menu).not.toBe(SHELL_I18N_KEYS.navOpenMenu);
    expect(menu).not.toBe(shellI18nBundleEn[SHELL_I18N_KEYS.navOpenMenu]);
    expect(menu).toBe(shellI18nBundleRu[SHELL_I18N_KEYS.navOpenMenu]);
  });

  it("resolves the es copy after registerShellI18nEs", () => {
    const i18n = createI18n({ locale: "es" });
    registerShellI18n(i18n);
    registerShellI18nEs(i18n);
    expect(i18n.t(SHELL_I18N_KEYS.navAdmin)).toBe(
      shellI18nBundleEs[SHELL_I18N_KEYS.navAdmin]
    );
  });

  it("takes the English floor into whatever locale a host runs, which is how a locale core has no bundle for still reads", () => {
    // core's engine resolves against the ACTIVE locale and falls back to the
    // key, not to English — so `registerShellI18n(engine, locale)` is the
    // floor, and it is the second argument that makes it one. A host on `de`
    // registers the en bundle under `de` and gets English words instead of
    // `shell.public.sign_in` on its buttons.
    const i18n = createI18n({ locale: "de" });
    registerShellI18n(i18n, "de");
    expect(i18n.t(SHELL_I18N_KEYS.publicSignIn)).toBe(
      shellI18nBundleEn[SHELL_I18N_KEYS.publicSignIn]
    );
  });
});
