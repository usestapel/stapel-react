import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { videoErrorBundleRu } from "./generated/errors.ru.gen.js";

export { videoErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for video-react — shipped as the
 * `@stapel/video-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit and the
 * bundle-purity test).
 *
 * TWO SOURCES, ON PURPOSE. The generated `videoErrorBundleRu` covers the 42
 * cross-cutting keys stapel-core owns and localizes. The 9 keys stapel-video
 * owns are NOT in it, and cannot be: the module ships no `translations/`
 * directory at all, so the generator emits a `Partial` bundle and says so in
 * its own header (`ERRORS_LOCALE_EXEMPT_OWNERS`, the stapel-forms /
 * stapel-reviews precedent). They are authored below, beside the UI copy. When
 * upstream ships `translations/errors.ru.json`, these nine lines are deleted
 * and the generated bundle covers them — the keys and the texts do not move.
 *
 * Counted copy carries Russian's four CLDR categories where English has two;
 * that asymmetry is the translation being right, and the locale-parity gate
 * compares plural FAMILIES rather than category leaves for exactly that.
 */
export const videoI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts for every key core owns.
  ...videoErrorBundleRu,

  // Backend error codes stapel-video owns — authored here (see above).
  "error.400.video_invalid_access_level":
    "Уровень доступа должен быть одним из: public, scope_trusted, restricted",
  "error.400.video_invalid_usage_period":
    "Месяц указывается как ГГГГ-ММ, число месяцев — от 1 до 36, часовой пояс — из базы IANA",
  "error.400.video_invalid_webhook":
    "Вебхук провайдера не прошёл проверку подписи",
  "error.403.video_join_denied": "Ведущий не пустил вас в эту комнату",
  "error.403.video_not_room_host": "Это может сделать только ведущий комнаты",
  "error.403.video_not_room_participant":
    "Это видно только участникам этой комнаты",
  "error.404.video_participant_not_found":
    "Этот участник больше не ждёт разрешения войти",
  "error.404.video_room_not_found": "Комнаты с таким кодом нет",
  // The uniform 404 — see the en bundle's note. Says nothing about WHICH of
  // the three situations it is, and never reads as "there were no calls".
  "error.404.video_scope_not_found":
    "Статистика звонков для этого пространства недоступна",

  // UI copy.
  "video.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "video.usage.heading": "Время в звонках",
  "video.usage.month_label": "Месяц",
  "video.usage.refresh": "Обновить",
  "video.usage.loading": "Загружаем время в звонках…",
  "video.usage.unavailable":
    "Статистика звонков для этого пространства недоступна",
  "video.usage.empty": "В этом месяце никто не был в звонках",
  "video.usage.no_scope": "Пространство не выбрано — показывать нечего",
  "video.usage.invalid_period":
    "Такой период запросить нельзя: число месяцев должно быть от 1 до 36",

  "video.usage.column.person": "Участник",
  "video.usage.column.talk_time": "Время в звонках",
  "video.usage.column.calls": "Звонки",
  "video.usage.column.connections": "Подключения",

  "video.usage.total.label": "Итого",
  "video.usage.total.people.one": "{count} участник",
  "video.usage.total.people.few": "{count} участника",
  "video.usage.total.people.many": "{count} участников",
  "video.usage.total.people.other": "{count} участника",
  "video.usage.total.attendances.one": "{count} участие",
  "video.usage.total.attendances.few": "{count} участия",
  "video.usage.total.attendances.many": "{count} участий",
  "video.usage.total.attendances.other": "{count} участия",
  "video.usage.total.attendances_hint":
    "Сумма звонков по каждому участнику: трое в одном звонке дают три",

  "video.rooms.heading": "Встречи",
  "video.rooms.intro":
    "Начните встречу и поделитесь кодом или присоединитесь к чужой.",
  "video.rooms.no_directory":
    "Списка комнат нет: в комнату входят по коду, и приложение ничего не знает о комнатах, которые оно не открывало.",
  "video.rooms.start": "Начать встречу",
  "video.rooms.start_hint":
    "Вы станете ведущим и будете решать, кого пускать, если включён лобби-зал.",
  "video.rooms.start.blocked.pending": "Создаём встречу…",
  "video.rooms.join_heading": "Присоединиться к встрече",
  "video.rooms.code_label": "Код встречи",
  "video.rooms.code_placeholder": "abc-defg-hij",
  "video.rooms.join": "Войти",
  "video.rooms.join.blocked.empty": "Сначала введите присланный вам код.",
  "video.rooms.join.blocked.pending": "Запрашиваем вход…",
  "video.rooms.leave": "Выйти из встречи",

  "video.room.heading": "Эта встреча",
  "video.room.code_label": "Код",
  "video.room.share_hint": "По этому коду любой может попроситься во встречу.",
  "video.room.access_label": "Кто может войти",
  "video.room.access.public": "Любой, у кого есть код",
  "video.room.access.scope_trusted": "Участники этого пространства",
  "video.room.access.restricted": "Только те, кого пустит ведущий",
  "video.room.access.unknown": "По настройкам ведущего",
  "video.room.lobby_on": "Лобби включено — ведущий впускает по одному",
  "video.room.lobby_off": "Лобби выключено — входят сразу",
  "video.room.host_badge": "Вы ведущий",

  "video.join.admitted": "Вы во встрече",
  "video.join.waiting": "Ждём, пока ведущий вас впустит",
  "video.join.waiting_hint":
    "Не закрывайте страницу — вас впустят без повторной просьбы.",
  "video.join.denied": "Ведущий вас не впустил",
  "video.join.denied_hint":
    "Для этой комнаты ответ окончательный. Попросите у ведущего новое приглашение.",

  "video.lobby.heading": "Ждут разрешения войти",
  "video.lobby.empty": "Никто не ждёт",
  "video.lobby.empty_hint":
    "Здесь появятся те, кто попросится во встречу при включённом лобби.",
  "video.lobby.waiting_count.one": "{count} человек ждёт",
  "video.lobby.waiting_count.few": "{count} человека ждут",
  "video.lobby.waiting_count.many": "{count} человек ждут",
  "video.lobby.waiting_count.other": "{count} человека ждут",
  "video.lobby.admit": "Впустить",
  "video.lobby.deny": "Отказать",
  "video.lobby.deny_title": "Отказать этому человеку?",
  "video.lobby.deny_body":
    "По этому коду он больше не попросится, и ему сообщат, что его не впустили.",
  "video.lobby.blocked.not_host":
    "Отвечать в лобби может только ведущий комнаты.",
  "video.lobby.blocked.pending": "Отправляем ответ…",
  "video.lobby.refresh": "Проверить снова",

  "video.lobby.live": "В реальном времени",
  "video.lobby.connecting": "Подключаемся…",
  "video.lobby.reconnecting": "Переподключаемся…",
  "video.lobby.offline": "Не в реальном времени",
  "video.lobby.offline_hint": "Список обновится по кнопке «Проверить снова».",
  "video.lobby.refused.session":
    "Сессия истекла, поэтому обновления остановились. Войдите заново.",
  "video.lobby.refused.origin":
    "В этой установке обновления с этого адреса запрещены. Их должен разрешить администратор.",
  "video.lobby.refused.forbidden":
    "Обновления в реальном времени в этой комнате вам недоступны",
  "video.lobby.refused.unknown": "Обновления в реальном времени остановились",
  "video.lobby.reconnect": "Переподключиться",

  "video.participants.heading": "Во встрече",
  "video.participants.empty": "Пока никто не вошёл",
  "video.participants.more": "В комнате больше людей, чем показано здесь",
  "video.participant.status.waiting": "Ждёт",
  "video.participant.status.admitted": "В звонке",
  "video.participant.status.denied": "Отказано",
  "video.participant.status.left": "Вышел",
  "video.participant.status.unknown": "Неизвестно",
  "video.participant.role.host": "Ведущий",
  "video.participant.role.guest": "Участник",

  "video.stage.heading": "Звонок",
  "video.stage.connecting": "Подключаемся к звонку…",
  "video.stage.connected": "Вы подключены",
  "video.stage.failed": "Не удалось подключиться к звонку",
  "video.stage.no_peer": "Видео недоступно на этом устройстве",
  "video.stage.no_peer_hint":
    "Вы в комнате, и вас в ней видно, но картинка и звук здесь не запускаются. Откройте комнату в другом браузере или попросите включить видео тех, кто ведёт это приложение.",
  "video.stage.no_token": "Для этого звонка нет токена",
  "video.stage.no_token_hint": "Токен выдают только после того, как вас впустят.",
  "video.stage.no_server": "Адрес медиасервера не настроен",
  "video.stage.leave": "Выйти из звонка",
  "video.stage.retry": "Попробовать подключиться снова",
  // ── 1:1 calls ─────────────────────────────────────────────────────────────
  "video.call.incoming.title": "Входящий звонок",
  "video.call.incoming.video": "звонит вам",
  "video.call.incoming.audio": "звонит вам — только звук",
  "video.call.outgoing": "Вызов…",
  "video.call.accept": "Ответить",
  "video.call.decline": "Отклонить",
  "video.call.cancel": "Отменить",
  "video.call.peer_unknown": "Собеседник",

  "video.call.state.ringing": "Звонит",
  "video.call.state.accepted": "Идёт разговор",
  "video.call.state.declined": "Отклонён",
  "video.call.state.missed": "Пропущенный",
  "video.call.state.ended": "Звонок",
  "video.call.state.failed": "Не удалось соединить",
  "video.call.state.unknown": "Звонок",

  "video.call.hang_up": "Завершить",
  "video.call.mute": "Выключить микрофон",
  "video.call.unmute": "Включить микрофон",
  "video.call.camera_on": "Включить камеру",
  "video.call.camera_off": "Выключить камеру",
  "video.call.flip_camera": "Другая камера",
  "video.call.audio_only": "Аудиозвонок",
  "video.call.waiting_for_video": "Ждём видео собеседника…",
  "video.call.reconnecting": "Восстанавливаем связь…",
  "video.call.connection_lost": "Связь прервалась",
  "video.call.reconnect": "Переподключиться",
  "video.call.media_session_artist": "Звонок",

  "video.call.mic_blocked":
    "Сайту закрыт доступ к микрофону. Разрешите его в настройках браузера для этого сайта.",
  "video.call.mic_failed": "Не удалось включить микрофон",
  "video.call.camera_blocked":
    "Сайту закрыт доступ к камере. Разрешите его в настройках браузера для этого сайта.",
  "video.call.camera_failed": "Не удалось включить камеру",
  "video.call.camera_switch_failed": "Эта камера недоступна",
  "video.call.blocked.pending": "Секунду…",

  // The six codes the call surface added. The 404 is UNIFORM over "no such
  // call", "not your call" and "already over": a call id names two people and
  // the conversation they are having, so a 403 would confirm a guessed id. The
  // sentence has to be true of all three, which is why it does not say the
  // call has ended.
  "error.404.video_call_not_found": "Этот звонок недоступен",
  "error.400.video_call_invalid_callee": "Этому человеку нельзя позвонить",
  "error.403.video_call_not_allowed": "Вы не можете позвонить этому человеку",
  "error.409.video_call_busy": "Вы уже в звонке",
  "error.409.video_call_state": "Звонок изменил состояние — обновите",
  "error.503.video_call_provider_unavailable":
    "Звонки сейчас недоступны. Попробуйте через минуту.",
};

/** Register the Russian bundle into a core i18n engine. */
export function registerVideoI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, videoI18nBundleRu);
}
