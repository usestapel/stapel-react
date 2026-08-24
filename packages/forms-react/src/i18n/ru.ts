import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { formsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { formsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for forms-react — the pair's `ru` locale, shipped as the
 * `@stapel/forms-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the bundle-purity
 * test).
 *
 * Composition mirrors `formsI18nBundleEn`: the GENERATED backend error texts
 * (from stapel-forms's `translations/errors.ru.json`, merged under
 * stapel-core's cross-cutting catalogue — `pnpm gen:errors`) are spread first
 * for coverage by construction; the 12 `stapel_attributes`-owned keys the generated
 * bundle cannot carry follow (attributes ships English only — no
 * `translations/` directory — so `gen:errors` runs with
 * `ERRORS_LOCALE_EXEMPT_OWNERS=stapel_attributes` and emits a `Partial`
 * bundle; upstream localization is stapel-forms MODULE.md §12.6); then the ru UI copy.
 *
 * PROVENANCE, stated rather than implied: stapel-forms' ru/es catalogues ship
 * `origin=seed:authored` and are UNREVIEWED (backend delta note 10) — authored
 * rather than machine-translated, but approved by nobody. The pair-authored
 * strings below are the same grade. Neither is a claim of review.
 */
const ATTRIBUTES_ERRORS_RU: Readonly<Record<string, string>> = {
  "error.400.feature_below_minimum": "Значение меньше минимального для «{feature}»",
  "error.400.feature_above_maximum": "Значение больше максимального для «{feature}»",
  "error.400.feature_not_in_options":
    "Значение отсутствует среди допустимых вариантов для «{feature}»",
  "error.400.feature_invalid_type": "Неверный тип значения для «{feature}»",
  "error.400.feature_invalid_format": "Неверный формат значения для «{feature}»",
  "error.400.feature_mandatory_missing": "Поле «{feature}» обязательно для заполнения",
  "error.400.feature_unknown_type": "Неизвестный тип поля «{feature}»",
  "error.400.feature_not_allowed": "Поле «{feature}» здесь недопустимо",
  "error.400.feature_unknown": "Неизвестное поле «{feature}»",
  "error.400.feature_invalid_config": "Неверная конфигурация поля «{feature}»",
  "error.400.description_too_short": "Описание должно содержать не менее {min_length} символов",
  "error.400.description_too_long": "Описание должно содержать не более {max_length} символов",
};

export const formsI18nBundleRu: I18nDictionary = {
  ...formsErrorBundleRu,
  ...ATTRIBUTES_ERRORS_RU,

  "forms.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "forms.error.no_workspace":
    "Этому экрану нужно рабочее пространство. Передайте `workspaceId` или объявите его в рантайме: `createFormsRuntime({ workspaceId })`.",

  "forms.nav.list": "Формы",
  "forms.nav.builder": "Конструктор формы",
  "forms.nav.responses": "Ответы",

  "forms.fill.loading": "Загрузка формы…",
  "forms.fill.retry": "Повторить",
  "forms.fill.load_failed":
    "Не удалось загрузить форму. Проблема на нашей стороне, а не в вашей ссылке.",
  "forms.fill.not_found": "Ссылка на форму недействительна.",
  "forms.fill.closed": "Форма закрыта и больше не принимает ответы.",
  "forms.fill.superseded":
    "Форма изменилась, пока вы её заполняли. Проверьте ответы и отправьте ещё раз.",
  "forms.fill.unsupported_field":
    "Поле типа «{kind}» не может быть показано в этой версии приложения.",
  "forms.fill.required": "Обязательно",
  "forms.fill.submit": "Отправить",
  "forms.fill.submitting": "Отправка…",
  "forms.fill.thanks": "Спасибо — ваш ответ записан.",
  "forms.fill.optional_hint": "Необязательно",
  "forms.fill.bool_yes": "Да",
  "forms.fill.bool_no": "Нет",
  "forms.fill.select_placeholder": "Выберите…",
  "forms.fill.unlimited": "Без ограничения",

  "forms.submit.blocked.done": "Вы уже отправили эту форму.",
  "forms.submit.blocked.in_flight": "Отправляем ваш ответ…",
  "forms.submit.blocked.unsupported_kind":
    "В форме есть поле типа, который приложение не умеет показывать ({kinds}), поэтому отправить её безопасно нельзя.",

  "forms.builder.title": "Конструктор формы",
  "forms.builder.add_field": "Добавить поле",
  "forms.builder.remove_field": "Удалить поле",
  "forms.builder.move_up": "Выше",
  "forms.builder.move_down": "Ниже",
  "forms.builder.field_slug": "Ключ",
  "forms.builder.field_label": "Название",
  "forms.builder.field_required": "Обязательное",
  "forms.builder.field_kind": "Тип",
  "forms.builder.save": "Сохранить черновик",
  "forms.builder.publish": "Опубликовать",
  "forms.builder.blocked.saving": "Сохраняем черновик…",
  "forms.builder.blocked.publishing": "Публикуем…",
  "forms.builder.blocked.no_changes": "С последнего сохранения ничего не изменилось.",
  "forms.builder.blocked.empty_schema":
    "Добавьте хотя бы одно поле перед публикацией.",
  "forms.builder.blocked.unsaved_draft":
    "Сначала сохраните черновик — иначе будет опубликована предыдущая сохранённая версия.",
  "forms.builder.builder_less":
    "У этого типа поля здесь нет редактируемых настроек. Его конфигурация задаётся через API черновика.",
  "forms.builder.kind_unregistered":
    "Эта установка не знает такой тип поля — его нельзя ни настроить, ни отобразить здесь. Поле сохранено, чтобы оно не исчезло из схемы незаметно.",
  "forms.builder.kinds_failed":
    "Не удалось загрузить список типов полей, поэтому сейчас нельзя добавить поле.",
  "forms.builder.no_kinds":
    "В этой установке нет доступных настраиваемых типов полей.",
  "forms.builder.unsupported_config":
    "Некоторые настройки этого поля ({keys}) пока нельзя изменить здесь.",
  "forms.builder.empty": "В этой форме пока нет полей.",
  "forms.builder.meta_title": "Название формы",
  "forms.builder.meta_description": "Описание",
  "forms.builder.meta_submit_label": "Текст кнопки отправки",
  "forms.builder.meta_confirmation": "Сообщение после отправки",
  "forms.builder.state_open": "Открыта",
  "forms.builder.state_closed": "Закрыта",
  "forms.builder.state_draft": "Черновик",
  "forms.builder.rotate_link": "Обновить публичную ссылку",
  "forms.builder.public_link": "Публичная ссылка",
  "forms.builder.blocked.first_field": "Это уже первое поле.",
  "forms.builder.blocked.last_field": "Это уже последнее поле.",

  "forms.settings.title": "Настройки формы",
  "forms.settings.open": "Настройки",
  "forms.settings.close": "Закрыть",
  "forms.settings.form_title": "Название формы",
  "forms.settings.notify_emails": "Уведомлять эти адреса",
  "forms.settings.notify_emails_hint":
    "Каждый новый ответ уходит письмом на эти адреса. Если не указан ни один, ответы сохраняются, но никто о них не узнаёт.",
  "forms.settings.notify_telegram": "Уведомлять эти чаты в Telegram",
  "forms.settings.notify_telegram_hint":
    "Идентификаторы чатов, а не имена пользователей: у группового чата id начинается с минуса.",
  "forms.settings.add_destination": "Введите адрес и нажмите Enter",
  "forms.settings.retention": "Удалять ответы через",
  "forms.settings.retention_hint":
    "Дней. Переопределение может только СОКРАТИТЬ срок хранения этой установки; оставьте пустым, чтобы использовать срок установки.",
  "forms.settings.retention_default": "Срок установки",
  "forms.settings.no_destination":
    "Ни один получатель не указан: новый ответ будет сохранён, но никто не получит уведомления.",
  "forms.settings.suspect_emails":
    "Это не похоже на адреса электронной почты, письма могут не дойти: {list}",
  "forms.settings.save": "Сохранить настройки",
  "forms.settings.saved": "Настройки сохранены.",
  "forms.settings.load_failed": "Не удалось загрузить настройки этой формы.",
  "forms.settings.blocked.loading": "Загружаем настройки формы…",
  "forms.settings.blocked.saving": "Сохраняем…",
  "forms.settings.blocked.no_changes": "С последнего сохранения ничего не изменилось.",
  "forms.settings.blocked.retention": "Ответы нужно хранить хотя бы один день.",
  "forms.settings.blocked.no_title": "Сначала дайте форме название.",

  "forms.responses.title": "Ответы",
  "forms.responses.empty": "Ответов пока нет.",
  "forms.responses.load_failed": "Не удалось загрузить ответы.",
  "forms.responses.submitted_at": "Отправлен",
  "forms.responses.respondent": "Респондент",
  "forms.responses.anonymous": "Аноним",
  "forms.responses.version": "Версия",
  "forms.responses.all_versions": "Все версии",
  "forms.responses.next": "Дальше",
  "forms.responses.prev": "Назад",
  "forms.responses.blocked.at_end": "Это последняя страница.",
  "forms.responses.blocked.at_start": "Это первая страница.",
  "forms.responses.delete": "Удалить",
  "forms.responses.delete_confirm": "Удалить этот ответ безвозвратно?",
  "forms.responses.resend": "Отправить повторно",
  "forms.responses.resend_sent": "Отправлено получателям: {count}.",
  "forms.responses.resend_override": "Отправить на другие адреса",
  "forms.responses.resend_override_hint":
    "Они заменяют настроенных получателей формы для этой отправки.",
  "forms.responses.export": "Экспорт в CSV",
  "forms.responses.exporting": "Экспорт… (страниц: {pages})",
  "forms.responses.erased": "Стёрт",
  "forms.responses.blocked.erased":
    "Этот ответ стёрт — его больше нельзя переслать или удалить.",
  "forms.responses.detail": "Ответ целиком",
  "forms.responses.close": "Закрыть",
  "forms.responses.refresh": "Проверить новые ответы",
  "forms.responses.polling_note":
    "Список не обновляется сам — проверьте ещё раз, чтобы увидеть ответы, пришедшие после загрузки.",

  "forms.list.title": "Формы",
  "forms.list.empty": "В этом рабочем пространстве пока нет форм.",
  "forms.list.load_failed": "Не удалось загрузить формы.",
  "forms.list.create": "Новая форма",
  "forms.list.new_title": "Форма без названия",
  "forms.list.submission_count": "Ответов: {count}",
  "forms.list.empty_hint":
    "Форма собирает ответы по публичной ссылке, которую можно разместить на любой странице.",
  "forms.list.open": "Открыть",
  "forms.list.delete": "Удалить",
  "forms.list.delete_confirm": "Удалить «{title}»?",
  "forms.list.delete_body":
    "Форма и её ответы (всего {count}) перестанут быть доступны. Публичная ссылка перестанет работать сразу.",
  "forms.list.delete_body_open":
    "Эта форма ОТКРЫТА. Удаление закроет её: публичная ссылка перестанет работать сразу, а ответы (всего {count}) станут недоступны.",
  "forms.list.state_filter": "Фильтр по состоянию",
};

/** Register the ru bundle. Call AFTER `registerFormsI18n` so it layers over
 * the en floor (merge priority = registration order). */
export function registerFormsI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", formsI18nBundleRu);
}
