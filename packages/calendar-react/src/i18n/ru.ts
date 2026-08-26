import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { calendarErrorBundleRu } from "./generated/errors.ru.gen.js";

export { calendarErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for calendar-react — shipped as the
 * `@stapel/calendar-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: hosts that do not register it never carry these strings (the main
 * entry does not import this module — size-limit and the bundle-purity test
 * are the teeth).
 *
 * TWO SOURCES, ON PURPOSE. The generated `calendarErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 7 keys
 * stapel-calendar owns are NOT in it and cannot be: the module ships no
 * `translations/` directory at all, so the generator emits a `Partial` bundle
 * and says so in its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the
 * stapel-video / stapel-reviews precedent). They are authored below, beside
 * the UI copy. When upstream ships `translations/errors.ru.json` those seven
 * lines are deleted and the generated bundle covers them — the keys and the
 * texts do not move.
 *
 * Plural families carry the four categories Russian defines (`one`, `few`,
 * `many`, `other`); English defines two. That asymmetry is the translation
 * being right, not a key being wrong — `stapel/i18n-locale-parity` knows the
 * CLDR categories and compares families, not forms.
 */
export const calendarI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...calendarErrorBundleRu,

  // Backend error codes stapel-calendar owns — authored here (see above).
  "error.400.calendar_invalid_range":
    "Так не получится — конец раньше начала.",
  "error.400.calendar_invalid_recurrence": "Правило повтора задано неверно",
  "error.400.calendar_invalid_rsvp":
    "Ответ может быть только одним из: принято, возможно, отказ",
  "error.400.calendar_invalid_slot_minutes":
    "Длительность слота — целое число минут, не меньше 1.",
  "error.403.calendar_not_event_owner":
    "Менять встречу может только тот, кто её создал.",
  "error.404.calendar_event_not_found": "Встреча не найдена",
  "error.404.calendar_not_invited": "Вас не приглашали на эту встречу.",
  // Core-owned, but re-said as a sentence: this refusal means "we could not
  // ask whether you may", not "you may not", and it became reachable when the
  // event endpoints moved onto the workspace mandate.
  "error.503.mandate_unavailable":
    "Не удалось проверить доступ к рабочему пространству. Попробуйте через минуту.",

  // UI copy.
  "calendar.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "calendar.blocked.not_owner":
    "Менять встречу может только тот, кто её создал.",
  "calendar.blocked.owner_unknown":
    "Мы не можем определить, ваша ли это встреча, поэтому редактирование выключено.",
  "calendar.blocked.not_invited":
    "Вас нет в списке приглашённых — отвечать не на что.",
  "calendar.blocked.event_cancelled": "Встреча отменена.",
  "calendar.blocked.no_changes": "Пока ничего не изменилось.",
  "calendar.blocked.virtual_occurrence":
    "Это время берётся из повторяющейся серии — откройте серию, чтобы изменить его.",
  "calendar.blocked.no_mandate":
    "Этот календарь принадлежит рабочему пространству, в котором вас нет.",

  "calendar.validation.end_before_start": "Время окончания раньше начала.",
  "calendar.validation.range_incomplete": "Укажите начало и окончание.",
  "calendar.validation.slot_minutes":
    "Длительность слота — целое число минут, не меньше 1.",
  "calendar.validation.title_required": "Дайте встрече название.",

  "calendar.view.heading": "Календарь",
  "calendar.view.loading": "Загружаем календарь…",
  "calendar.view.empty": "На этот период ничего не запланировано.",
  "calendar.view.empty_hint": "Всё, что вы создадите, появится здесь.",
  "calendar.view.error": "Не удалось загрузить календарь.",
  "calendar.view.retry": "Попробовать ещё раз",
  "calendar.view.today": "Сегодня",
  "calendar.view.previous": "Назад",
  "calendar.view.next": "Вперёд",
  "calendar.view.mode.month": "Месяц",
  "calendar.view.mode.week": "Неделя",
  "calendar.view.mode.day": "День",
  "calendar.view.new_event": "Новая встреча",
  "calendar.view.cancelled": "Отменена",
  "calendar.view.repeats": "Часть серии",
  "calendar.view.marker": "Метка",
  "calendar.view.open_event": "Открыть встречу",
  "calendar.view.more_count.one": "ещё {count}",
  "calendar.view.more_count.few": "ещё {count}",
  "calendar.view.more_count.many": "ещё {count}",
  "calendar.view.more_count.other": "ещё {count}",
  "calendar.view.untitled": "Встреча без названия",
  "calendar.view.agenda_layout": "Список",

  "calendar.agenda.heading": "Расписание",
  "calendar.agenda.empty": "Ничего не запланировано.",
  "calendar.agenda.empty_hint": "Ближайшие встречи появятся здесь.",
  "calendar.agenda.day_empty": "В этот день ничего нет",

  "calendar.detail.heading": "Встреча",
  "calendar.detail.no_description": "Без описания",
  "calendar.detail.organizer": "Организатор",
  "calendar.detail.when": "Когда",
  "calendar.detail.participants": "Приглашённые",
  "calendar.detail.no_participants": "Пока никого не пригласили.",
  "calendar.detail.rsvp_summary":
    "принято: {accepted} · возможно: {tentative} · отказ: {declined} · без ответа: {invited}",
  "calendar.detail.add_to_calendar": "Добавить в календарь",
  "calendar.detail.edit": "Изменить",
  "calendar.detail.close": "Закрыть",
  "calendar.detail.cancelled_banner":
    "Встреча отменена. Она остаётся в календаре, чтобы все видели, что её отменили.",
  "calendar.detail.series_note": "Одно из повторений серии.",

  "calendar.rsvp.heading": "Вы придёте?",
  "calendar.rsvp.accept": "Приду",
  "calendar.rsvp.tentative": "Возможно",
  "calendar.rsvp.decline": "Не приду",
  "calendar.rsvp.responding": "Сохраняем ваш ответ…",
  "calendar.rsvp.your_answer": "Ваш ответ: {answer}",
  "calendar.rsvp.no_answer": "Вы ещё не ответили.",
  "calendar.rsvp.state.invited": "Ответа пока нет",
  "calendar.rsvp.state.accepted": "Придёт",
  "calendar.rsvp.state.tentative": "Возможно",
  "calendar.rsvp.state.declined": "Не придёт",

  "calendar.composer.create": "Создать встречу",
  "calendar.composer.creating": "Создаём…",
  "calendar.composer.created": "Встреча создана.",
  "calendar.editor.create_heading": "Новая встреча",
  "calendar.editor.edit_heading": "Изменить встречу",
  "calendar.editor.title": "Название",
  "calendar.editor.title_placeholder": "О чём встреча?",
  "calendar.editor.description": "Описание",
  "calendar.editor.start": "Начало",
  "calendar.editor.end": "Окончание",
  "calendar.editor.save": "Сохранить",
  "calendar.editor.saving": "Сохраняем…",
  "calendar.editor.saved": "Сохранено.",
  "calendar.editor.discard": "Отменить правки",
  "calendar.editor.marker_hint":
    "Начало и окончание совпадают — это сохранится как метка и не займёт времени.",
  "calendar.editor.cancel_event": "Отменить встречу",
  "calendar.editor.cancel_question": "Отменить эту встречу?",
  "calendar.editor.cancel_body":
    "Она останется у всех в календаре с пометкой «отменена» и перестанет занимать время. Это не то же самое, что удаление.",
  "calendar.editor.cancel_confirm": "Отменить встречу",

  "calendar.recurrence.label": "Повтор",
  "calendar.recurrence.interval": "Каждые",
  "calendar.recurrence.weekdays": "По дням",
  "calendar.recurrence.ends": "Заканчивается",
  "calendar.recurrence.end.never": "Никогда",
  "calendar.recurrence.end.until": "В указанную дату",
  "calendar.recurrence.end.count": "После нескольких повторов",
  "calendar.recurrence.until_label": "Последняя дата",
  "calendar.recurrence.count_label": "Сколько раз",
  "calendar.recurrence.exclusive_hint":
    "Серия заканчивается либо датой, либо числом повторов — никогда и тем, и другим.",
  "calendar.recurrence.preset.none": "Не повторяется",
  "calendar.recurrence.preset.daily": "Каждый день",
  "calendar.recurrence.preset.weekdays": "По будням",
  "calendar.recurrence.preset.weekly": "Каждую неделю",
  "calendar.recurrence.preset.biweekly": "Раз в две недели",
  "calendar.recurrence.preset.monthly": "Каждый месяц",
  "calendar.recurrence.preset.custom": "Своё правило…",

  "calendar.participants.heading": "Приглашённые",
  "calendar.participants.add": "Пригласить",
  "calendar.participants.add_placeholder": "Идентификатор пользователя",
  "calendar.participants.remove": "Убрать",
  "calendar.participants.result_heading":
    "После сохранения приглашены будут ровно эти люди",
  "calendar.participants.replace_warning":
    "Сохранение заменяет весь список приглашённых на тот, что выше: кого нет в списке — тот теряет приглашение.",
  "calendar.participants.nobody": "Приглашённых не останется.",
  "calendar.participants.save": "Сохранить список",
  "calendar.participants.saving": "Сохраняем…",
  "calendar.participants.saved": "Список сохранён.",
  "calendar.participants.reset": "Вернуть как было",
  "calendar.participants.added_count.one": "{count} получит приглашение",
  "calendar.participants.added_count.few": "{count} получат приглашение",
  "calendar.participants.added_count.many": "{count} получат приглашение",
  "calendar.participants.added_count.other": "{count} получат приглашение",
  "calendar.participants.removed_count.one": "{count} потеряет приглашение",
  "calendar.participants.removed_count.few": "{count} потеряют приглашение",
  "calendar.participants.removed_count.many": "{count} потеряют приглашение",
  "calendar.participants.removed_count.other": "{count} потеряют приглашение",

  "calendar.delete.action": "Удалить встречу",
  "calendar.delete.question": "Удалить эту встречу?",
  "calendar.delete.body":
    "Она исчезнет из календаря у всех. Если нужно отменить, но оставить на виду — отмените её, а не удаляйте.",
  "calendar.delete.occurrence_body":
    "Это одно из повторений серии. Удаление убирает это время насовсем — при следующем построении серии оно не вернётся.",
  "calendar.delete.confirm": "Удалить",
  "calendar.delete.deleting": "Удаляем…",

  "calendar.availability.heading": "Свободное время",
  "calendar.availability.slot_length": "Длительность слота (минуты)",
  "calendar.availability.slots": "Свободные слоты",
  "calendar.availability.pick": "Забронировать слот",
  "calendar.availability.busy": "Занято",
  "calendar.availability.no_busy": "На этот период ничего не занято.",
  "calendar.availability.no_windows": "На этот период нет времени для записи.",
  "calendar.availability.no_windows_hint":
    "Свободные слоты берутся из окон доступности. Их не задали, поэтому записываться пока не на что — это не значит, что время занято.",
  "calendar.availability.truncated": "Этот ответ неполный.",
  "calendar.availability.truncated_hint":
    "Повторяющаяся серия оказалась слишком длинной, чтобы развернуть её целиком, поэтому дальнее время здесь может быть уже занято, хотя выглядит свободным. Сузьте период, чтобы получить полный ответ.",
  "calendar.availability.refresh": "Обновить",
  "calendar.availability.loading": "Смотрим ваше свободное время…",
};

/** Register the Russian bundle (call after {@link registerCalendarI18n}). */
export function registerCalendarI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", calendarI18nBundleRu);
}
