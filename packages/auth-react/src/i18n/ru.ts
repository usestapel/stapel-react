import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { authI18nBundleEn } from "./keys.js";
import { authErrorBundleRu } from "./generated/errors.ru.gen.js";

export { authErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for auth-react — the pair's `ru` locale, shipped as the
 * `@stapel/auth-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the bundle-purity
 * test).
 *
 * Composition mirrors {@link authI18nBundleEn}: the GENERATED backend error
 * texts (from stapel-auth's `translations/errors.ru.json` catalog, seeded from
 * the curated stapel-translate corpus — `pnpm gen:errors`) are spread first for
 * coverage by construction; the hand-written ru UI copy for the pair-owned
 * {@link AUTH_I18N_KEYS} follows. Override any key by registering a host bundle
 * AFTER this one (merge-priority convention — see keys.ts).
 */
export const authI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...authErrorBundleRu,

  // auth-react UI (hand-written ru mirror of the en copy in keys.ts)
  "auth.otp.enter_code": "Введите код из сообщения",
  "auth.otp.resend": "Отправить код ещё раз",
  "auth.otp.sent_to": "Код отправлен на {target}",
  "auth.password.label": "Пароль",
  "auth.totp.enter_code": "Введите 6-значный код",
  "auth.totp.use_backup": "Использовать резервный код",
  "auth.verification.choose_factor": "Подтвердите, что это вы",
  "auth.verification.success": "Подтверждено",
  "auth.session.this_device": "Это устройство",
  "auth.session.suspicious": "Неопознанный вход",
  "auth.passkey.no_credentials":
    "Не удалось войти по passkey на этом устройстве. Добавьте его в настройках безопасности, войдя другим способом, или выберите другой способ входа ниже.",
  "auth.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerAuthI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the ru
 * texts inside the `ru` locale, so a key the ru bundle ever misses degrades to
 * its English text — never to a raw key. A host bundle registered after this
 * call overrides both.
 */
export function registerAuthI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", authI18nBundleEn);
  engine.registerBundle("ru", authI18nBundleRu);
}
