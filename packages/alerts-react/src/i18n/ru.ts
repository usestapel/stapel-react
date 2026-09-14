import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { alertsErrorBundleRu } from "./generated/errors.ru.gen.js";
import { alertsI18nBundleEn } from "./keys.js";

export { alertsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for alerts-react — shipped as the
 * `@stapel/alerts-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * ONE SOURCE for every backend code. `alertsErrorBundleRu` is generated from
 * the module's OWN `translations/errors.ru.json` merged over stapel-core's
 * catalogue — the same merge the backend loader performs at runtime, so what a
 * client bundles is what a server would have rendered. stapel-alerts 0.2.0
 * added that catalogue for the six codes it owns; before it, this pair would
 * have had to author those six strings here and a Russian host would have read
 * six English sentences on day one. That is the whole reason the pin is 0.2.0
 * and not the 0.1.0 this pair was written against (contract-pins.json).
 *
 * What is authored below is only this pair's own UI copy.
 */
export const alertsI18nBundleRu: I18nDictionary = {
  // Every backend code, in ru — the module's own catalogue merged over core's.
  ...alertsErrorBundleRu,

  // alerts-react UI
  "alerts.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "alerts.nav.feed": "Ошибки",
  "alerts.nav.issue": "Проблема",
  "alerts.value.none": "—",
  "alerts.dialog.dismiss": "Закрыть",
  "alerts.dialog.cancel": "Отмена",

  "alerts.feed.title": "Ошибки",
  "alerts.feed.intro":
    "Все баги, которые записал этот парк сервисов, по строке на каждый — сверху те, что проявлялись недавно.",
  "alerts.feed.loading": "Читаем трекер…",
  "alerts.feed.failed": "Не удалось прочитать трекер.",
  "alerts.feed.empty": "Ничего не падало",
  "alerts.feed.emptyHint":
    "Ни один сервис не сообщил об ошибке. Так выглядит тихий парк: трекер доступен, и показывать ему нечего.",
  "alerts.feed.emptyFiltered": "Под эти фильтры ничего не подходит",
  "alerts.feed.emptyFilteredHint":
    "За их пределами что-то может продолжать падать — снимите фильтры, чтобы увидеть всю доску.",
  "alerts.feed.staffOnly": "Трекер доступен только сотрудникам",
  "alerts.feed.staffOnlyHint":
    "Вы вошли, но эта учётная запись не сотрудник. Здесь пусто не потому, что нечего показать, а потому, что это не ваши данные.",
  "alerts.feed.signedOut": "Войдите, чтобы открыть трекер",
  "alerts.feed.signedOutHint":
    "Сессия больше не действительна. Войдите заново — доска вернётся.",
  "alerts.feed.refresh": "Проверить сейчас",
  "alerts.feed.checking": "Проверяем…",
  "alerts.feed.upToDate": "Всё актуально",
  "alerts.feed.range": "{from}–{to} из {total}",
  "alerts.feed.previous": "Назад",
  "alerts.feed.next": "Дальше",
  "alerts.feed.groupSummary": "проблем: {issues} · случаев: {count}",

  "alerts.col.issue": "Проблема",
  "alerts.col.level": "Уровень",
  "alerts.col.count": "Случаев",
  "alerts.col.firstSeen": "Впервые",
  "alerts.col.lastSeen": "Последний раз",
  "alerts.col.status": "Статус",
  "alerts.row.open": "Открыть",
  "alerts.row.sinceFix": "после починки: {count}",
  "alerts.row.seenRange": "впервые {first} · последний раз {last}",

  "alerts.level.debug": "Отладка",
  "alerts.level.info": "Информация",
  "alerts.level.warning": "Предупреждение",
  "alerts.level.error": "Ошибка",
  "alerts.level.fatal": "Критическая",
  "alerts.level.unknown": "Неизвестно ({level})",

  "alerts.kind.exception": "Исключение",
  "alerts.kind.log": "Запись в логе",
  "alerts.kind.dlq": "Потерянная работа",
  "alerts.kind.monitoring": "Слепая зона мониторинга",
  "alerts.kind.manual": "Сообщили вручную",
  "alerts.kind.unknown": "Неизвестно ({kind})",

  "alerts.status.new": "Новая",
  "alerts.status.fixed": "Починена",
  "alerts.status.regressed": "Вернулась",
  "alerts.status.muted": "Приглушена",
  "alerts.status.unknown": "Неизвестно ({status})",

  "alerts.filter.status": "Статус",
  "alerts.filter.level": "Уровень",
  "alerts.filter.service": "Сервис",
  "alerts.filter.since": "Активна с",
  "alerts.filter.openOnly": "Только открытые",
  "alerts.filter.openOnlyHint": "Новые и вернувшиеся",
  "alerts.filter.anyStatus": "Любой статус",
  "alerts.filter.anyLevel": "Любой уровень",
  "alerts.filter.anyService": "Любой сервис",
  "alerts.filter.sinceAny": "За всё время",
  "alerts.filter.sinceDay": "За сутки",
  "alerts.filter.sinceWeek": "За неделю",
  "alerts.filter.sinceMonth": "За месяц",
  "alerts.filter.clear": "Сбросить фильтры",

  "alerts.detail.title": "Проблема",
  "alerts.detail.loading": "Читаем проблему…",
  "alerts.detail.failed": "Не удалось прочитать эту проблему.",
  "alerts.detail.notFound": "Такой проблемы нет",
  "alerts.detail.notFoundHint":
    "Её здесь и не записывали — или уборка удалила её после закрытия. Открытую проблему уборка не трогает, сколько бы ей ни было лет.",
  "alerts.detail.service": "Сервис",
  "alerts.detail.environment": "Окружение",
  "alerts.detail.kind": "Источник",
  "alerts.detail.fingerprint": "Отпечаток",
  "alerts.detail.count": "Случаев",
  "alerts.detail.sinceFix": "После починки",
  "alerts.detail.firstSeen": "Впервые",
  "alerts.detail.lastSeen": "Последний раз",
  "alerts.detail.fixedIn": "Починена в",
  "alerts.detail.fixedSha": "Коммит",
  "alerts.detail.fixedAt": "Закрыта",
  "alerts.detail.mutedUntil": "Приглушена до",
  "alerts.detail.mutedForever": "Приглушена без срока",
  "alerts.detail.note": "Заметка",
  "alerts.detail.regressed": "Проблема вернулась после закрытия",
  "alerts.detail.regressedHint":
    "Это выставило само хранилище, когда пришло новое событие по проблеме, закрытой в {version}. Ни подтвердить, ни скрыть это вручную нельзя.",
  "alerts.detail.sentry": "Событие в Sentry",
  "alerts.detail.markFixed": "Отметить починенной",
  "alerts.detail.mute": "Приглушить",
  "alerts.detail.reopen": "Открыть заново",
  "alerts.detail.reopenConfirm":
    "Вернуть проблему на доску как новую. Релиз, который заявлял починку, останется записанным.",
  "alerts.detail.events": "Случаи",
  "alerts.detail.eventsHint":
    "Последние {shown} из {count}. Остальные убраны по сроку хранения: счётчик — это факт, а здесь выборка.",
  "alerts.detail.eventsEmpty": "Ни одного случая не сохранилось",
  "alerts.detail.eventsEmptyHint":
    "Уборка удалила события этой проблемы. Сама строка осталась: удалить её значило бы превратить «не починено» в «не случалось».",
  "alerts.detail.trace": "Трассировка",
  "alerts.detail.noTrace": "В этом случае трассировки не было.",
  "alerts.detail.context": "Контекст",
  "alerts.detail.noContext": "Контекст не записан.",
  "alerts.detail.requestPath": "Запрос",
  "alerts.detail.traceId": "Идентификатор трассы",
  "alerts.detail.release": "Релиз",
  "alerts.detail.occurrences": "Свёрнуто случаев",
  "alerts.detail.receivedAt": "Получено",
  "alerts.detail.redacted":
    "Хранилище вычищает чувствительные поля из контекста до записи.",

  "alerts.fix.title": "Отметить починенной",
  "alerts.fix.body":
    "Укажите релиз, который заявляет починку. Если это повторится, хранилище откроет проблему само — и именно эта запись скажет, какой выкат должен был это прекратить.",
  "alerts.fix.version": "Версия",
  "alerts.fix.versionHint": "Тег релиза, например 0.42.1",
  "alerts.fix.sha": "Коммит",
  "alerts.fix.shaHint": "Коммит, который несёт починку",
  "alerts.fix.blank":
    "Без обоих полей проблема всё равно закроется — просто не на что будет сослаться, когда она вернётся.",
  "alerts.fix.submit": "Отметить починенной",

  "alerts.mute.title": "Приглушить проблему",
  "alerts.mute.body":
    "Приглушение выключает уведомления. Запись оно не выключает: случаи продолжают приходить, счётчик продолжает расти.",
  "alerts.mute.until": "До",
  "alerts.mute.day": "До завтра",
  "alerts.mute.week": "На неделю",
  "alerts.mute.month": "На месяц",
  "alerts.mute.forever": "Без срока",
  "alerts.mute.foreverHint":
    "Само по себе это никогда не вернётся на доску. Лучше поставить дату.",
  "alerts.mute.note": "Почему",
  "alerts.mute.noteHint":
    "Приглушённая строка без причины — ловушка для того, кто откроет её следующим.",
  "alerts.mute.submit": "Приглушить",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerAlertsI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, alertsI18nBundleEn);
  engine.registerBundle(locale, alertsI18nBundleRu);
}
