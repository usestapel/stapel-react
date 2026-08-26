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
  "auth.otp.mock_delivery":
    "Тестовый режим: код не отправлялся. Используйте код, заданный в настройках стенда.",
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
  "auth.passkey.unsupported":
    "Этот браузер не умеет passkey. Попробуйте другой браузер или устройство либо выберите другой способ.",
  "auth.passkey.declined":
    "Passkey не использован. Либо запрос был отклонён, либо на этом устройстве ещё нет passkey для нас — войдите другим способом и добавьте его в настройках безопасности.",
  "auth.passkey.timeout":
    "Запрос passkey истёк, не дождавшись ответа. Попробуйте ещё раз.",
  "auth.passkey.insecure":
    "Для passkey нужно защищённое соединение с сайтом. Откройте страницу по https и попробуйте снова.",
  "auth.passkey.already_on_device":
    "На этом устройстве уже есть passkey от вашей учётной записи. Войдите по нему, а не добавляйте ещё один.",
  "auth.passkey.failed":
    "Устройство не смогло выполнить проверку passkey. Попробуйте ещё раз или выберите другой способ.",
  "auth.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  // Default-skin UI (§54 AuthPanel)
  "auth.ui.login_title": "Вход",
  "auth.ui.or": "или",
  "auth.ui.more_methods": "Другие способы входа",
  "auth.ui.continue_as_guest": "Продолжить как гость",
  "auth.ui.continue_as_guest_pending": "Входим…",
  "auth.ui.continue_as_guest_hint": "Войти можно позже — данные сохранятся.",
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
  "auth.ui.retry": "Повторить",
  "auth.ui.close": "Закрыть",
  "auth.ui.passkey_failed_title": "Не удалось войти по passkey",
  "auth.ui.passkey_pick_another": "Выбрать другой способ",

  // Registration surface
  "auth.ui.register_title": "Создать аккаунт",
  "auth.ui.register_confirm_label": "Подтвердите пароль",
  "auth.ui.register_mismatch": "Пароли не совпадают.",
  "auth.ui.register_submit": "Создать аккаунт",

  // Method-capability labels
  "auth.sec.method_cap.login": "Для входа",
  "auth.sec.method_cap.register": "Для регистрации",
  "auth.sec.method_cap.both": "Вход и регистрация",
  "auth.sec.method_cap.portable_anon":
    "Вход в гостевой аккаунт с другого устройства",

  // Security-profile components (owner directive, item 5)
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

  "auth.sec.totp.replace": "Заменить",
  "auth.sec.totp.replace_title": "Замена приложения-аутентификатора",
  "auth.sec.totp.replace_hint":
    "Подтвердите текущий код аутентификатора или резервный код, затем настройте новое устройство.",
  "auth.sec.totp.replace_continue_cta": "Продолжить",
  "auth.sec.totp.lost_cta": "Потеряли аутентификатор?",
  "auth.sec.totp.delayed_hint":
    "Мы отключим двухфакторную аутентификацию через 14 дней и уведомим ваш подтверждённый email или телефон. Вы можете отменить запрос в любой момент до этого срока.",
  "auth.sec.totp.delayed_cta": "Запросить отключение",
  "auth.sec.totp.pending_message":
    "Приложение-аутентификатор будет отключено {date} (через {days} дн.).",
  "auth.sec.totp.pending_note":
    "Мы уведомили ваш подтверждённый email или телефон об этом запросе.",
  "auth.sec.totp.no_contact_title": "Нет контакта для восстановления",
  "auth.sec.totp.no_contact_hint":
    "Нельзя запланировать это действие без подтверждённого email или телефона на аккаунте. Обратитесь в поддержку.",

  "auth.sec.passkeys.title": "Passkey",
  "auth.sec.passkeys.add": "Добавить passkey",
  "auth.sec.passkeys.remove": "Удалить",
  "auth.sec.passkeys.empty": "Passkey пока не добавлены.",
  "auth.sec.passkeys.awaiting_ceremony":
    "Следуйте подсказке браузера или устройства, чтобы завершить добавление passkey.",
  "auth.sec.passkeys.remove_confirm_title": "Удалить этот passkey?",
  "auth.sec.passkeys.added_success": "Passkey добавлен.",
  "auth.sec.passkeys.done": "Готово",
  "auth.sec.passkeys.added_on": "Добавлен {date}",
  "auth.sec.passkeys.last_used": "Последний вход {date}",
  "auth.sec.passkeys.never_used": "Ещё не использовался",
  "auth.sec.passkeys.add_another": "Добавить ещё один",
  "auth.sec.passkeys.kind_device": "Встроен в устройство",
  "auth.sec.passkeys.kind_security_key": "Аппаратный ключ",
  "auth.sec.passkeys.kind_phone": "Телефон или планшет рядом",
  "auth.sec.passkeys.kind_unknown": "Passkey",
  "auth.sec.passkeys.add_unsupported":
    "Этот браузер не умеет создавать passkey. Откройте страницу в другом браузере, чтобы добавить его.",

  "auth.sec.password.title": "Смена пароля",
  "auth.sec.password.old_label": "Текущий пароль",
  "auth.sec.password.new_label": "Новый пароль",
  "auth.sec.password.confirm_label": "Подтвердите новый пароль",
  "auth.sec.password.mismatch": "Пароли не совпадают.",
  "auth.sec.password.change_cta": "Сменить пароль",
  "auth.sec.password.via_otp_hint": "Мы отправим код на {target}",
  "auth.sec.password.success": "Пароль изменён.",
  "auth.sec.password.no_methods":
    "Для этого аккаунта здесь нет способов сменить пароль.",

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

  "auth.sec.change.current_value": "Текущий {channel}: {value}",
  "auth.sec.change.cta": "Изменить {channel}",
  "auth.sec.change.instant_hint":
    "Мы отправим код на ваш текущий {channel}, чтобы подтвердить, что это вы, а затем код на новый.",
  "auth.sec.change.no_access_cta": "Нет доступа к старому {channel}?",
  "auth.sec.change.old_code_hint": "Введите код, отправленный на {target}",
  "auth.sec.change.new_value_label": "Новый {channel}",
  "auth.sec.change.request_new_cta": "Отправить код на новый {channel}",
  "auth.sec.change.new_code_hint": "Введите код, отправленный на {target}",
  "auth.sec.change.confirm_cta": "Подтвердить",
  "auth.sec.change.success": "Ваш {channel} изменён.",
  "auth.sec.change.retry": "Попробовать снова",
  "auth.sec.change.delayed_form_hint":
    "Мы уведомим ваш СТАРЫЙ {channel} и подождём 14 дней перед применением изменения — код со старого {channel} не требуется. Введите новый {channel} ниже.",
  "auth.sec.change.delayed_submit_cta": "Начать смену (14 дней)",
  "auth.sec.change.delayed_started": "Смена запрошена. См. ожидающее изменение ниже.",
  "auth.sec.change.pending_message": "Смена на {value} вступит в силу {date} (через {days} дн.).",
  "auth.sec.change.pending_note": "Ваш старый {channel} уведомлён об этом изменении.",
  "auth.sec.change.pending_cancel": "Отменить",
  "auth.sec.change.cancel_confirm_title": "Отменить это ожидающее изменение?",

  "auth.sec.audit.title": "Журнал безопасности",
  "auth.sec.audit.empty": "Активности пока нет.",
  "auth.sec.audit.ip": "IP {ip}",
  "auth.sec.audit.load_more": "Показать ещё",

  "auth.sec.page.title": "Безопасность",
  "auth.sec.page.subtitle":
    "Управляйте способами входа, подключёнными устройствами и активностью аккаунта.",
  "auth.sec.group.contact": "Контактные данные",
  "auth.sec.group.password": "Пароль",
  "auth.sec.group.two_factor": "Двухфакторная аутентификация",
  "auth.sec.group.devices": "Устройства и сессии",
  "auth.sec.group.connected": "Подключённые аккаунты",
  "auth.sec.group.audit": "Журнал безопасности",

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

  // QR login_request confirmation
  "auth.qr.confirm.title": "Войти на другом устройстве?",
  "auth.qr.confirm.subtitle":
    "Вы отсканировали код входа. Подтверждение выполнит вход на том устройстве под вашим аккаунтом. Если это сканировали не вы — отклоните.",
  "auth.qr.confirm.approve": "Да, войти там",
  "auth.qr.confirm.decline": "Нет, это не я",
  "auth.qr.confirm.approved":
    "То устройство вошло в систему. Это можно отложить.",
  "auth.qr.confirm.declined": "Вход отклонён. Ничего не передано.",
  "auth.qr.confirm.no_key":
    "В этой ссылке нет кода входа. Отсканируйте QR-код ещё раз.",
  "auth.qr.error.session_not_adopted":
    "На другом устройстве вход подтвердили, но это устройство не смогло принять сессию. Попробуйте код ещё раз.",

  // First-login enforcement (org-program §C2)
  "auth.forcedChange.title": "Задайте собственный пароль",
  "auth.forcedChange.hint":
    "Организация выдала вам временный пароль. Придумайте свой, чтобы продолжить — дальше вы будете входить с ним.",
  "auth.forcedChange.new_label": "Новый пароль",
  "auth.forcedChange.confirm_label": "Повторите новый пароль",
  "auth.forcedChange.mismatch": "Пароли не совпадают",
  "auth.forcedChange.submit": "Задать пароль и продолжить",
  "auth.forcedChange.success": "Пароль задан — вы вошли в систему.",

  "auth.mfaEnroll.title": "Настройте двухфакторную аутентификацию",
  "auth.mfaEnroll.hint":
    "Организация требует второй фактор. Добавьте его сейчас, чтобы завершить вход.",
  "auth.mfaEnroll.preparing": "Подготовка к настройке…",
  "auth.mfaEnroll.method_totp": "Приложение-аутентификатор",
  "auth.mfaEnroll.method_passkey": "Passkey",
  "auth.mfaEnroll.backup_codes_ack": "Я сохранил резервные коды — завершить",
  "auth.mfaEnroll.success": "Второй фактор включён — вы вошли в систему.",
  "auth.mfaEnroll.restart_hint": "Срок этого шага истёк. Войдите ещё раз, чтобы повторить.",
  "auth.mfaEnroll.error.no_tokens":
    "Настройка завершена, но сессию оформить не удалось. Войдите ещё раз.",

  // Nav-manifest labels
  "auth.nav.login": "Вход",
  "auth.nav.security": "Безопасность",
  "auth.nav.qr_confirm": "Подтверждение входа",
  "auth.ui.switch_to_register": "Впервые здесь? Создайте аккаунт",
  "auth.ui.switch_to_login": "Уже есть аккаунт? Войти",
  "auth.sec.password.no_methods_hint":
    "Добавьте подтверждённую почту или телефон — тогда появится способ сменить пароль.",
  "auth.sec.passkeys.empty_hint":
    "Passkey подтверждает вход лицом, отпечатком или PIN-кодом устройства — пароль не нужно ни помнить, ни бояться утечки.",
  "auth.sec.passkeys.rename": "Переименовать",
  "auth.sec.passkeys.rename_label": "Переименовать «{name}»",
  "auth.sec.passkeys.rename_field": "Как назвать этот passkey?",
  "auth.sec.passkeys.rename_save": "Сохранить название",
  "auth.sec.passkeys.remove_label": "Удалить «{name}»",
  "auth.sec.sessions.empty_hint":
    "Сеансы появятся здесь, когда вы войдёте в других браузерах и на других устройствах.",
  "auth.sec.passkeys.gone":
    "Этого passkey больше нет в аккаунте. Список обновлён.",
  "auth.sec.oauth.unlink_label": "Отключить «{name}»",
  "auth.sec.oauth.empty_hint":
    "Подключите аккаунт, чтобы в следующий раз входить одним касанием.",
  "auth.sec.audit.empty_hint":
    "Здесь появятся входы, смены пароля и действия с устройствами.",
  "auth.sec.audit.suspicious_label": "Неопознанное действие",

  // Backend error codes — the ru MIRROR of the polished en copy in keys.ts.
  // The generated ru bundle above already covers every registry code, but a
  // key the en bundle re-words has to be re-worded here too: otherwise the
  // Russian dialog quietly shows the registry's plainer sentence while the
  // English one shows the polished one, and the two locales drift apart on
  // exactly the strings a person reads when something has gone wrong.
  "error.401.invalid_credentials": "Неверная почта или пароль.",
  "error.401.account_disabled": "Этот аккаунт отключён.",
  "error.401.refresh_revoked": "Сеанс завершён. Войдите ещё раз.",
  "error.400.code_expired": "Срок действия кода истёк. Запросите новый.",
  "error.400.invalid_code": "Неверный код.",
  "error.400.invalid_code_attempts":
    "Неверный код. Осталось попыток: {attempts_remaining}.",
  "error.422.blocked":
    "Слишком много попыток. Повторите через {retry_after_minutes} мин.",
  "error.429.rate_limit": "Подождите, прежде чем запрашивать код ещё раз.",
  "error.400.no_verified_contact": "Для этого способа нет подтверждённого контакта.",
  "error.400.wrong_password": "Текущий пароль указан неверно.",
  "error.400.no_password": "У этого аккаунта не задан пароль.",
  "error.404.user_for_reset": "Аккаунт с такой почтой или телефоном не найден.",
  "error.403.mock_otp_admin":
    "В этом окружении администраторы не могут входить по коду.",
  "error.400.code_required": "Нужен код.",
  "error.400.totp_not_pending": "Сначала начните настройку второго фактора.",
  "error.423.account_locked":
    "Аккаунт заблокирован. Повторите через {retry_after_minutes} мин.",
  "error.429.magic_link_rate":
    "Слишком много запросов ссылки для входа. Повторите позже.",
  "error.400.passkey_invalid": "Не удалось проверить passkey.",
  "error.400.passkey_challenge_expired":
    "Срок запроса passkey истёк. Попробуйте ещё раз.",
  "error.409.passkey_already_registered": "Этот passkey уже зарегистрирован.",
  "error.400.last_auth_method": "Нельзя удалить последний способ входа.",
  "error.400.invalid_redirect_url": "Недопустимый адрес перехода.",
  "error.400.magic_link_invalid": "Ссылка для входа недействительна или устарела.",
  "error.400.captcha_required": "Пройдите проверку captcha.",
  "error.400.captcha_invalid": "Проверка captcha не пройдена.",
  "error.403.verification_required": "Нужно дополнительное подтверждение.",
  "error.404.verification_challenge_not_found":
    "Срок подтверждения истёк. Повторите действие.",
  "error.400.verification_invalid_factor": "Этот способ подтверждения недоступен.",
  "error.400.verification_failed": "Подтверждение не прошло. Попробуйте ещё раз.",
  "error.423.verification_locked": "Слишком много попыток. Повторите действие позже.",
  "error.404.sso_org_not_found": "Организация не найдена.",
  "error.400.sso_not_configured": "Для этой организации SSO не настроен.",
  "error.403.sso_required": "Этот аккаунт должен входить через SSO.",

  // Step-up verification preferences
  "auth.sec.group.verification": "Дополнительное подтверждение",
  "auth.sec.verify.title": "Когда спрашивать дополнительное подтверждение",
  "auth.sec.verify.subtitle":
    "Некоторые действия могут ещё раз попросить подтвердить, что это вы, даже когда вы уже вошли. Выберите, какие именно.",
  "auth.sec.verify.scope.settings": "Изменение настроек безопасности",
  "auth.sec.verify.scope.settings_hint":
    "Пароли, passkey, второй фактор и сама эта страница.",
  "auth.sec.verify.scope.other": "{scope}",
  "auth.sec.verify.toggle_label": "Дополнительное подтверждение для: {scope}",
  "auth.sec.verify.on": "Спрашивать",
  "auth.sec.verify.off": "Не спрашивать",
  "auth.sec.verify.disable_note":
    "Чтобы отключить это, сначала нужно подтвердить, что это вы.",
  "auth.sec.verify.empty": "Здесь нечего выбирать",
  "auth.sec.verify.empty_hint":
    "Приложение не объявило действий, о которых вы могли бы решать. Всё работает по встроенным правилам.",
  "auth.sec.verify.default": "По умолчанию, как настроено в приложении",

  // ── Operator console ─────────────────────────────────────────────────────
  "auth.admin.sso.title": "Корпоративный SSO",
  "auth.admin.sso.subtitle":
    "Организации, сотрудники которых входят через собственного поставщика учётных записей.",
  "auth.admin.sso.empty": "Организаций пока нет",
  "auth.admin.sso.empty_hint":
    "Добавьте организацию, чтобы направить её почтовый домен к её поставщику учётных записей.",
  "auth.admin.sso.add": "Добавить организацию",
  "auth.admin.sso.name_label": "Название организации",
  "auth.admin.sso.slug_label": "Короткий идентификатор",
  "auth.admin.sso.slug_hint": "Появляется в адресе входа. Буквы, цифры и дефисы.",
  "auth.admin.sso.domain_label": "Почтовый домен",
  "auth.admin.sso.domain_hint": "Все адреса на этом домене направляются сюда.",
  "auth.admin.sso.enforced_label": "Требовать SSO для этого домена",
  "auth.admin.sso.enforced_on": "SSO обязателен",
  "auth.admin.sso.enforced_off": "SSO по желанию",
  "auth.admin.sso.created_on": "Добавлена {date}",
  "auth.admin.sso.save": "Сохранить",
  "auth.admin.sso.cancel": "Отмена",
  "auth.admin.sso.edit": "Изменить",
  "auth.admin.sso.edit_label": "Изменить «{name}»",
  "auth.admin.sso.delete": "Удалить",
  "auth.admin.sso.delete_label": "Удалить «{name}»",
  "auth.admin.sso.delete_confirm_title": "Удалить «{name}»?",
  "auth.admin.sso.delete_confirm_body":
    "Все на этом домене потеряют маршрут SSO и будут входить другим способом.",
  "auth.admin.sso.config_title": "Поставщик учётных записей",
  "auth.admin.sso.configure": "Поставщик учётных записей",
  "auth.admin.sso.protocol_label": "Протокол",
  "auth.admin.sso.protocol_saml": "SAML 2.0",
  "auth.admin.sso.protocol_oidc": "OpenID Connect",
  "auth.admin.sso.active_label": "Подключение активно",
  "auth.admin.sso.saml_entity_id": "Entity ID (издатель)",
  "auth.admin.sso.saml_sso_url": "Адрес входа",
  "auth.admin.sso.saml_slo_url": "Адрес выхода",
  "auth.admin.sso.saml_cert": "Сертификат подписи",
  "auth.admin.sso.saml_name_id": "Формат Name ID",
  "auth.admin.sso.attr_email": "Атрибут почты",
  "auth.admin.sso.attr_first_name": "Атрибут имени",
  "auth.admin.sso.attr_last_name": "Атрибут фамилии",
  "auth.admin.sso.oidc_client_id": "Client ID",
  "auth.admin.sso.oidc_client_secret": "Client secret",
  "auth.admin.sso.oidc_discovery": "Адрес discovery",
  "auth.admin.sso.oidc_scopes": "Области доступа",
  "auth.admin.sso.config_new":
    "Сохранение заменяет всё подключение к поставщику учётных записей. Текущие значения показать нельзя — в API нет чтения для них.",
  "auth.admin.keys.title": "Служебные ключи",
  "auth.admin.keys.subtitle":
    "Учётные данные для машин: скриптов, интеграций и других сервисов, которые вызывают этот API.",
  "auth.admin.keys.empty": "Служебных ключей пока нет",
  "auth.admin.keys.empty_hint":
    "Выпустите ключ, чтобы скрипт мог вызывать API без пользовательского сеанса.",
  "auth.admin.keys.issue": "Выпустить ключ",
  "auth.admin.keys.name_label": "Название",
  "auth.admin.keys.description_label": "Для чего он нужен?",
  "auth.admin.keys.endpoints_label": "Разрешённые эндпоинты",
  "auth.admin.keys.endpoints_hint":
    "По одному пути в строке. Оставьте пустым, чтобы разрешить все эндпоинты, до которых достают права ключа.",
  "auth.admin.keys.endpoints_all": "Все эндпоинты",
  "auth.admin.keys.endpoints_count": "{count} эндпоинтов",
  "auth.admin.keys.created_on": "Выпущен {date}",
  "auth.admin.keys.last_used": "Использован {date}",
  "auth.admin.keys.never_used": "Ни разу не использован",
  "auth.admin.keys.active": "Активен",
  "auth.admin.keys.inactive": "Отключён",
  "auth.admin.keys.disable": "Отключить",
  "auth.admin.keys.enable": "Включить",
  "auth.admin.keys.delete": "Удалить",
  "auth.admin.keys.delete_label": "Удалить «{name}»",
  "auth.admin.keys.delete_confirm_title": "Удалить «{name}»?",
  "auth.admin.keys.delete_confirm_body":
    "Всё, что ещё пользуется этим ключом, перестанет работать сразу же. Если хотите сперва проверить — отключите ключ.",
  "auth.admin.keys.secret_title": "Скопируйте ключ сейчас",
  "auth.admin.keys.secret_hint":
    "Он показывается только один раз. Сохраните его там, откуда его прочитает вызывающая сторона.",
  "auth.admin.keys.secret_copy": "Скопировать",
  "auth.admin.keys.secret_copied": "Скопировано",
  "auth.admin.keys.secret_done": "Я сохранил ключ",
  "auth.admin.keys.cancel": "Отмена",
  "auth.admin.roles.title": "Служебные роли",
  "auth.admin.roles.subtitle": "У кого расширенный доступ и кто его выдал.",
  "auth.admin.roles.empty": "Служебных ролей ни у кого нет",
  "auth.admin.roles.empty_hint":
    "Назначьте роль, чтобы коллега получил доступ к операторским экранам.",
  "auth.admin.roles.assign": "Назначить роль",
  "auth.admin.roles.user_label": "Идентификатор пользователя",
  "auth.admin.roles.user_hint": "UUID аккаунта, скопированный из его профиля.",
  "auth.admin.roles.role_label": "Роль",
  "auth.admin.roles.role_hint": "Название роли в том виде, как оно задано в этой установке.",
  "auth.admin.roles.filter_label": "Показать только один аккаунт",
  "auth.admin.roles.filter_clear": "Показать всех",
  "auth.admin.roles.assigned_by": "Назначил {who}",
  "auth.admin.roles.assigned_by_system": "Назначено системой",
  "auth.admin.roles.assigned_on": "{date}",
  "auth.admin.roles.user_row": "Аккаунт {id}",
  "auth.admin.roles.remove": "Снять",
  "auth.admin.roles.remove_label": "Снять роль {role} с аккаунта {id}",
  "auth.admin.roles.remove_confirm_title": "Снять роль {role}?",
  "auth.admin.roles.remove_confirm_body":
    "Аккаунт потеряет операторские экраны, которые открывает эта роль, при следующем запросе.",
  "auth.admin.roles.cancel": "Отмена",
  "auth.admin.users.title": "Создать аккаунт",
  "auth.admin.users.subtitle":
    "Завести аккаунт напрямую — без регистрации и без ввода кода.",
  "auth.admin.users.email_label": "Почта",
  "auth.admin.users.phone_label": "Телефон",
  "auth.admin.users.username_label": "Имя пользователя",
  "auth.admin.users.display_name_label": "Отображаемое имя",
  "auth.admin.users.password_label": "Временный пароль",
  "auth.admin.users.password_hint":
    "Оставьте пустым, чтобы создать аккаунт без пароля — вход будет по коду.",
  "auth.admin.users.send_welcome": "Отправить приветственное сообщение",
  "auth.admin.users.send_welcome_hint":
    "Письмо или SMS о том, что аккаунт создан.",
  "auth.admin.users.mark_verified": "Считать контакты подтверждёнными",
  "auth.admin.users.mark_verified_hint":
    "Отключите, чтобы человек сам подтвердил адрес.",
  "auth.admin.users.submit": "Создать аккаунт",
  "auth.admin.users.needs_contact": "Укажите хотя бы почту или телефон.",
  "auth.admin.users.created": "Аккаунт создан.",
  "auth.admin.users.created_id": "Идентификатор пользователя {id}",
  "auth.admin.users.another": "Создать ещё один",
  "auth.admin.audit.title": "Журнал событий",
  "auth.admin.audit.subtitle": "Действия безопасности всех аккаунтов, новые сверху.",
  "auth.admin.audit.empty": "Ничего не найдено",
  "auth.admin.audit.empty_hint": "Расширьте период или сбросьте фильтры.",
  "auth.admin.audit.filter_event": "Тип события",
  "auth.admin.audit.filter_user": "Идентификатор пользователя",
  "auth.admin.audit.filter_from": "С",
  "auth.admin.audit.filter_to": "По",
  "auth.admin.audit.apply": "Применить",
  "auth.admin.audit.clear": "Сбросить фильтры",
  "auth.admin.audit.actor": "Аккаунт {id}",
  "auth.admin.audit.count": "{count} событий",
  "auth.nav.admin_sso": "Корпоративный SSO",
  "auth.nav.admin_service_keys": "Служебные ключи",
  "auth.nav.admin_staff_roles": "Служебные роли",
  "auth.nav.admin_users": "Создание аккаунта",
  "auth.nav.admin_audit": "Журнал событий",
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
