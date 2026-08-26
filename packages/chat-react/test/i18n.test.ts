/**
 * Three locales, and the keys that only exist because this pair wrote them.
 *
 * stapel-chat ships English only — no `translations/` directory at all — so
 * the generated ru/es bundles are PARTIAL by construction and the module's own
 * error keys are absent from them. The pair fills that gap in its locale
 * modules, and this file is what stops the gap from silently reappearing: a
 * `StapelApiError.code` from this module must render as a sentence in every
 * locale the pair ships, never as a raw key.
 *
 * THE COUNT IS THE CONTRACT'S, NOT THIS FILE'S. It was twelve against
 * stapel-chat 0.2.2. Regenerating against 0.6.0 brought eleven more — the
 * moderation verbs (edit/delete and their refusals), attachments and activity
 * states, subjects, and the two the block check added: `error.403.
 * chat_send_refused` and `error.503.chat_blocks_unavailable`. The number is
 * asserted rather than derived precisely so that the NEXT contract bump lands
 * here, in a test that names what is missing, instead of on a Russian host
 * reading English.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  CHAT_ERROR_CODES,
  CHAT_I18N_KEYS,
  chatI18nBundleEn,
  registerChatI18n,
} from "../src/index.js";
import { chatI18nBundleRu, registerChatI18nRu } from "../src/i18n/ru.js";
import { chatI18nBundleEs, registerChatI18nEs } from "../src/i18n/es.js";
import { chatErrorBundleRu } from "../src/i18n/generated/errors.ru.gen.js";
import { chatErrorBundleEs } from "../src/i18n/generated/errors.es.gen.js";

/** The keys stapel_chat owns — the ones no locale catalogue upstream carries. */
const CHAT_OWNED = CHAT_ERROR_CODES.filter((code) => code.includes("chat_"));

const UI_KEYS = Object.values(CHAT_I18N_KEYS).filter(
  (key) => !key.startsWith("error.")
);

describe("the keys upstream does not localize", () => {
  it("there are 23 of them, and the generated bundles do not carry them", () => {
    expect(CHAT_OWNED).toHaveLength(23);
    for (const code of CHAT_OWNED) {
      expect(chatErrorBundleRu, code).not.toHaveProperty(code);
      expect(chatErrorBundleEs, code).not.toHaveProperty(code);
    }
  });

  it("the pair's ru bundle carries every one of them", () => {
    const missing = CHAT_OWNED.filter((code) => !(code in chatI18nBundleRu));
    expect(missing).toEqual([]);
  });

  it("the pair's es bundle carries every one of them", () => {
    const missing = CHAT_OWNED.filter((code) => !(code in chatI18nBundleEs));
    expect(missing).toEqual([]);
  });
});

describe("every backend code resolves in every locale", () => {
  it("en — the floor covers the whole registry", () => {
    const missing = CHAT_ERROR_CODES.filter((code) => !(code in chatI18nBundleEn));
    expect(missing).toEqual([]);
  });

  it("ru — generated core keys plus the pair's own, through the engine", () => {
    const engine = createI18n({ locale: "ru" });
    registerChatI18n(engine);
    registerChatI18nRu(engine);
    for (const code of CHAT_ERROR_CODES) {
      // Never the key itself: that is what "a raw key reached the user" looks
      // like, and it is the failure this whole contour exists to prevent.
      expect(engine.t(code), code).not.toBe(code);
    }
  });

  it("es — same, through the engine", () => {
    const engine = createI18n({ locale: "es" });
    registerChatI18n(engine);
    registerChatI18nEs(engine);
    for (const code of CHAT_ERROR_CODES) {
      expect(engine.t(code), code).not.toBe(code);
    }
  });
});

describe("the pair's own UI copy", () => {
  it("every declared key has English", () => {
    const missing = UI_KEYS.filter((key) => !(key in chatI18nBundleEn));
    expect(missing).toEqual([]);
  });

  it("ru and es translate all of it — this pair does not ship a half-Russian chat", () => {
    // notifications-react deliberately leaves its es UI copy to the en floor;
    // a marketplace's buyer-to-seller chat is the surface where that shows
    // most, so both locales are complete here and the test says so.
    expect(UI_KEYS.filter((key) => !(key in chatI18nBundleRu))).toEqual([]);
    expect(UI_KEYS.filter((key) => !(key in chatI18nBundleEs))).toEqual([]);
  });

  it("interpolation slots survive translation", () => {
    for (const bundle of [chatI18nBundleEn, chatI18nBundleRu, chatI18nBundleEs]) {
      expect(String(bundle["chat.list.unread"])).toContain("{count}");
      expect(String(bundle["chat.composer.blocked.too_long"])).toContain("{max}");
    }
  });

  it("a locale registers the en floor UNDERNEATH itself, so a gap degrades to English", () => {
    const engine = createI18n({ locale: "ru" });
    registerChatI18nRu(engine);
    // A key the ru bundle does not own at all still resolves.
    expect(engine.t("chat.nav.conversations")).toBeTruthy();
    expect(engine.t("chat.nav.conversations")).not.toBe("chat.nav.conversations");
  });
});

describe("the locales stay out of the main entry", () => {
  it("nothing in src/ reaches for the ru or es bundle except the locale modules themselves", async () => {
    // The size-limit budget catches the same leak in bytes; this catches it in
    // the module graph, which is the form a reviewer can read. A host that
    // ships one language must carry one language.
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(name)) continue;
        if (full.endsWith("i18n/ru.ts") || full.endsWith("i18n/es.ts")) continue;
        const source = readFileSync(full, "utf8");
        if (/from "\.{1,2}\/(i18n\/)?(ru|es)\.js"/.test(source)) offenders.push(full);
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
