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

  // Default-skin UI (§54 AuthPanel)
  "auth.ui.login_title": "Вход",
  "auth.ui.or": "или",
  "auth.ui.more_methods": "Другие способы входа",
  "auth.ui.continue_as_guest": "Продолжить как гость",
  "auth.ui.continue_as_guest_pending": "Входим…",
  "auth.ui.resend_in": "Повторить через {s} с",
  "auth.ui.email_label": "Эл. почта",
  "auth.ui.email_placeholder": "you@example.com",
  "auth.ui.phone_label": "Телефон",
  "auth.ui.phone_placeholder": "+7 900 000 0000",
  "auth.ui.send_code": "Отправить код",
  "auth.ui.continue": "Продолжить",
  "auth.ui.submit": "Войти",
  "auth.ui.password_placeholder": "Ваш пароль",
  "auth.ui.qr_hint": "Отсканируйте этот код телефоном, чтобы войти.",
  "auth.ui.passkey_cta": "Войти по passkey",
  "auth.ui.magic_link_cta": "Прислать ссылку для входа",
  "auth.ui.magic_link_sent_title": "Проверьте почту",
  "auth.ui.magic_link_sent_body": "Мы отправили ссылку для входа. Откройте её на этом устройстве.",
  "auth.ui.sso_domain_label": "Рабочий домен",
  "auth.ui.sso_domain_placeholder": "acme.com",
  "auth.ui.sso_continue": "Продолжить через SSO",
  "auth.ui.channel_email": "Эл. почта",
  "auth.ui.channel_phone": "Телефон",
  "auth.ui.channel_password": "Пароль",
  "auth.ui.channel_passkey": "Passkey",
  "auth.ui.channel_oauth": "Соцсети",
  "auth.ui.channel_sso": "SSO",
  "auth.ui.channel_qr": "QR-код",
  "auth.ui.channel_magic_link": "Ссылка на почту",

  // Компоненты профиля безопасности (директива владельца, пункт 5)
  "auth.sec.sessions.title": "Активные сеансы",
  "auth.sec.sessions.subtitle":
    "Где вы сейчас вошли в систему. Выход из сеанса отзывает устройство немедленно.",
  "auth.sec.sessions.sign_out": "Выйти",
  "auth.sec.sessions.sign_out_all": "Выйти на всех других устройствах",
  "auth.sec.sessions.confirm_me": "Это я",
  "auth.sec.sessions.sign_out_confirm_title": "Выйти на этом устройстве?",
  "auth.sec.sessions.sign_out_all_confirm_title":
    "Выйти на всех других устройствах?",
  "auth.sec.sessions.empty": "Нет активных сеансов.",
  "auth.sec.sessions.last_used": "Последняя активность {when}",

  "auth.sec.totp.title": "Двухфакторная аутентификация",
  "auth.sec.totp.enabled": "Включена",
  "auth.sec.totp.disabled": "Не настроена",
  "auth.sec.totp.backup_remaining": "Осталось резервных кодов: {n}",
  "auth.sec.totp.set_up": "Настроить",
  "auth.sec.totp.disable": "Отключить",
  "auth.sec.totp.setup_title": "Настройка двухфакторной аутентификации",
  "auth.sec.totp.scan_hint":
    "Отсканируйте в приложении-аутентификаторе или введите код вручную.",
  "auth.sec.totp.secret_label": "Код для ручного ввода",
  "auth.sec.totp.confirm_label": "Введите 6-значный код",
  "auth.sec.totp.confirm_cta": "Подтвердить",
  "auth.sec.totp.backup_codes_title": "Сохраните резервные коды",
  "auth.sec.totp.backup_codes_hint":
    "Каждый код работает один раз, если вы потеряете доступ к аутентификатору. Они показываются только сейчас.",
  "auth.sec.totp.backup_codes_ack": "Я сохранил(а) эти коды",
  "auth.sec.totp.disable_title": "Отключение двухфакторной аутентификации",
  "auth.sec.totp.disable_code_label": "Код аутентификатора",
  "auth.sec.totp.disable_backup_label": "Резервный код",
  "auth.sec.totp.use_backup_toggle": "Использовать резервный код",

  "auth.sec.passkeys.title": "Passkey",
  "auth.sec.passkeys.add": "Добавить passkey",
  "auth.sec.passkeys.remove": "Удалить",
  "auth.sec.passkeys.empty": "Passkey пока не добавлены.",
  "auth.sec.passkeys.add_title": "Добавить passkey",
  "auth.sec.passkeys.name_label": "Название passkey",
  "auth.sec.passkeys.name_placeholder": "например, Мой ноутбук",
  "auth.sec.passkeys.begin_cta": "Продолжить",
  "auth.sec.passkeys.awaiting_ceremony":
    "Следуйте подсказке браузера или устройства, чтобы завершить добавление passkey.",
  "auth.sec.passkeys.remove_confirm_title": "Удалить этот passkey?",
  "auth.sec.passkeys.added_success": "Passkey добавлен.",

  "auth.sec.password.title": "Смена пароля",
  "auth.sec.password.old_label": "Текущий пароль",
  "auth.sec.password.new_label": "Новый пароль",
  "auth.sec.password.confirm_label": "Подтвердите новый пароль",
  "auth.sec.password.mismatch": "Пароли не совпадают.",
  "auth.sec.password.change_cta": "Сменить пароль",
  "auth.sec.password.via_otp_hint": "Мы отправим код на {target}",
  "auth.sec.password.success": "Пароль изменён.",

  "auth.sec.oauth.title": "Привязанные аккаунты",
  "auth.sec.oauth.linked": "Привязан",
  "auth.sec.oauth.link": "Привязать",
  "auth.sec.oauth.unlink": "Отвязать",
  "auth.sec.oauth.unlink_confirm_title": "Отвязать этот аккаунт?",
  "auth.sec.oauth.empty": "Провайдеры не настроены.",
  "auth.sec.oauth.unlink_unavailable":
    "Отвязка сейчас недоступна.",
  "auth.sec.oauth.link_unavailable":
    "Привязка нового аккаунта сейчас недоступна.",

  "auth.sec.qr.title": "Войти на другом устройстве",
  "auth.sec.qr.subtitle":
    "Отсканируйте этот код камерой устройства, на котором вы не вошли — оно войдёт под этим же аккаунтом.",
  "auth.sec.qr.show_cta": "Показать QR-код",
  "auth.sec.qr.cancel": "Отмена",
  "auth.sec.qr.expires_in": "Истекает через {time}",
  "auth.sec.qr.expiring": "Истекает…",
  "auth.sec.qr.fulfilled": "То устройство теперь вошло в систему.",
  "auth.sec.qr.rejected": "Вход был отклонён на другом устройстве.",
  "auth.sec.qr.retry": "Попробовать снова",
  "auth.sec.qr.regenerating": "Этот код истёк — получаем новый…",
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
