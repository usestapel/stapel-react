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
 * for coverage by construction; the `error.400.feature_*` family the generated
 * snapshot does not carry follows (see `keys.ts` for why the pair hand-carries
 * it); then the ru UI copy.
 *
 * PROVENANCE, stated rather than implied: stapel-forms' ru/es catalogues ship
 * `origin=seed:authored` and are UNREVIEWED (backend delta note 10) — authored
 * rather than machine-translated, but approved by nobody. The pair-authored
 * strings below are the same grade. Neither is a claim of review.
 */
const FEATURE_ERRORS_RU: Readonly<Record<string, string>> = {
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
};

export const formsI18nBundleRu: I18nDictionary = {
  ...formsErrorBundleRu,
  ...FEATURE_ERRORS_RU,

  "forms.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

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
  "forms.responses.detail": "Ответ целиком",
  "forms.responses.close": "Закрыть",

  "forms.list.title": "Формы",
  "forms.list.empty": "В этом рабочем пространстве пока нет форм.",
  "forms.list.load_failed": "Не удалось загрузить формы.",
  "forms.list.create": "Новая форма",
  "forms.list.new_title": "Форма без названия",
  "forms.list.submission_count": "Ответов: {count}",
};

/** Register the ru bundle. Call AFTER `registerFormsI18n` so it layers over
 * the en floor (merge priority = registration order). */
export function registerFormsI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", formsI18nBundleRu);
}
