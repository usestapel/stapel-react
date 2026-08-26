import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { workspacesI18nBundleEn } from "./keys.js";
import { workspacesErrorBundleRu } from "./generated/errors.ru.gen.js";

export { workspacesErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for workspaces-react — the pair's `ru` locale, shipped as
 * the `@stapel/workspaces-react/i18n/ru` subpath (i18n-shipping.md §2) so
 * the locale is opt-in: hosts that don't register it never carry these
 * strings (the main entry does not import this module — gated by size-limit
 * + the bundle-purity test).
 *
 * Composition mirrors {@link workspacesI18nBundleEn}: the GENERATED backend
 * error texts (from stapel-workspaces's `translations/errors.ru.json`
 * catalog, seeded from the curated stapel-translate corpus — `pnpm
 * gen:errors`) are spread first for coverage by construction; the
 * hand-written ru UI copy for the pair-owned `WORKSPACES_I18N_KEYS` follows.
 * Override any key by registering a host bundle AFTER this one
 * (merge-priority convention — see keys.ts).
 *
 * PLURALS. Russian takes four CLDR categories where English takes two, so a
 * `*.count` family ships `one`/`few`/`many`/`other` here and `one`/`other`
 * there. That asymmetry is the translation being right, not a key being
 * wrong — `useTPlural` picks the category from the reader's locale.
 */
export const workspacesI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...workspacesErrorBundleRu,

  // workspaces-react UI (hand-written ru mirror of the en copy in keys.ts)
  "workspaces.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "workspaces.retry": "Попробовать снова",
  "workspaces.dialog.close": "Закрыть",
  "workspaces.cancel": "Отмена",
  "workspaces.pager.prev": "Назад",
  "workspaces.pager.next": "Дальше",
  "workspaces.pager.position": "Страница {page}",
  "workspaces.list.loading": "Загрузка рабочих пространств…",
  "workspaces.list.empty": "Пока нет рабочих пространств.",
  "workspaces.list.load_failed":
    "Не удалось загрузить ваши рабочие пространства. Это сбой на нашей стороне, а не признак того, что их у вас нет.",
  "workspaces.list.create": "Создать рабочее пространство",
  "workspaces.list.creating": "Создание…",
  "workspaces.members.loading": "Загрузка участников…",
  "workspaces.members.empty": "Пока нет участников.",
  "workspaces.members.load_failed": "Не удалось загрузить список участников.",
  "workspaces.roles.load_failed":
    "Не удалось загрузить список ролей, поэтому изменить роль сейчас нельзя. Это не значит, что в рабочем пространстве нет ролей.",
  "workspaces.roles.empty":
    "На этой установке роли не заданы, выбирать не из чего.",
  "workspaces.members.invite": "Пригласить",
  "workspaces.members.inviting": "Приглашение…",
  "workspaces.members.update_role": "Изменить роль",
  "workspaces.members.remove": "Удалить",
  "workspaces.accept.accept": "Принять приглашение",
  "workspaces.accept.accepting": "Принятие…",
  "workspaces.accept.accepted": "Вы присоединились к рабочему пространству.",
  "workspaces.settings.title": "Рабочее пространство",
  "workspaces.settings.subtitle": "Название и общие настройки.",
  "workspaces.settings.field.name": "Название рабочего пространства",
  "workspaces.settings.field.slug": "URL-идентификатор",
  "workspaces.settings.field.type": "Тип",
  "workspaces.settings.type.personal": "Личное",
  "workspaces.settings.type.work": "Рабочее",
  "workspaces.settings.save": "Сохранить изменения",
  "workspaces.settings.blocked.cannot_manage":
    "Ваша роль не может менять настройки этого рабочего пространства.",
  "workspaces.settings.blocked.name_required": "Введите название рабочего пространства.",
  "workspaces.settings.blocked.unchanged": "Пока ничего не изменилось.",
  "workspaces.settings.saving": "Сохранение…",
  "workspaces.settings.danger_zone.title": "Опасная зона",
  "workspaces.settings.danger_zone.delete": "Удалить рабочее пространство",
  "workspaces.settings.danger_zone.delete_confirm": "Удалить это рабочее пространство? Действие необратимо.",
  "workspaces.settings.danger_zone.delete_confirm_body":
    "Все сразу потеряют доступ. Данные, которые хранят о нём другие сервисы, удаляются по их собственным правилам хранения.",
  "workspaces.settings.danger_zone.blocked": "Это рабочее пространство удалить нельзя.",
  "workspaces.settings.security.title": "Безопасность",
  "workspaces.settings.security.subtitle":
    "Правила, которым должны соответствовать все участники.",
  "workspaces.settings.security.require_mfa": "Требовать двухфакторную аутентификацию",
  "workspaces.settings.security.require_mfa_hint":
    "Участники без подтверждённого второго фактора не допускаются, пока не добавят его.",
  "workspaces.settings.security.policies_label":
    "Что потребовать при первом входе у аккаунтов, созданных этим пространством",
  "workspaces.settings.security.policies_hint":
    "Независимые требования, а не альтернативы — организация может потребовать оба.",
  "workspaces.settings.security.policy.password_change": "Сменить пароль",
  "workspaces.settings.security.policy.mfa_enroll": "Настроить двухфакторную аутентификацию",
  "workspaces.settings.security.save": "Сохранить настройки безопасности",
  "workspaces.settings.security.saving": "Сохранение…",
  "workspaces.settings.security.blocked.capability":
    "Ваша роль не может менять настройки безопасности.",
  "workspaces.settings.security.step_up_notice":
    "Перед сохранением мы попросим подтвердить вашу личность.",
  "workspaces.settings.security.mfa.status_title": "Как выполняется политика",
  "workspaces.settings.security.mfa.state_label": "Состояние",
  "workspaces.settings.security.mfa.state.pending": "Ждём первой проверки",
  "workspaces.settings.security.mfa.state.enforcing": "Проверяем участников",
  "workspaces.settings.security.mfa.state.enforced": "Действует",
  "workspaces.settings.security.mfa.state.failed": "Последняя проверка не удалась",
  "workspaces.settings.security.mfa.state.other": "Неизвестное состояние ({state})",
  "workspaces.settings.security.mfa.checked_count": "Проверено участников: {count}",
  "workspaces.settings.security.mfa.checked_count.one": "Проверен {count} участник",
  "workspaces.settings.security.mfa.checked_count.few": "Проверено {count} участника",
  "workspaces.settings.security.mfa.checked_count.many": "Проверено {count} участников",
  "workspaces.settings.security.mfa.checked_count.other": "Проверено участников: {count}",
  "workspaces.settings.security.mfa.noncompliant_count":
    "Отстранено без второго фактора: {count}",
  "workspaces.settings.security.mfa.noncompliant_count.one":
    "{count} участник отстранён — нет второго фактора",
  "workspaces.settings.security.mfa.noncompliant_count.few":
    "{count} участника отстранены — нет второго фактора",
  "workspaces.settings.security.mfa.noncompliant_count.many":
    "{count} участников отстранены — нет второго фактора",
  "workspaces.settings.security.mfa.noncompliant_count.other":
    "Отстранено без второго фактора: {count}",
  "workspaces.settings.security.mfa.unverified_count": "Ещё не проверено: {count}",
  "workspaces.settings.security.mfa.unverified_count.one": "{count} участник ещё не проверен",
  "workspaces.settings.security.mfa.unverified_count.few": "{count} участника ещё не проверены",
  "workspaces.settings.security.mfa.unverified_count.many": "{count} участников ещё не проверены",
  "workspaces.settings.security.mfa.unverified_count.other": "Ещё не проверено: {count}",
  "workspaces.settings.security.mfa.attempts_count": "Проверок выполнено: {count}",
  "workspaces.settings.security.mfa.attempts_count.one": "Выполнена {count} проверка",
  "workspaces.settings.security.mfa.attempts_count.few": "Выполнено {count} проверки",
  "workspaces.settings.security.mfa.attempts_count.many": "Выполнено {count} проверок",
  "workspaces.settings.security.mfa.attempts_count.other": "Проверок выполнено: {count}",
  "workspaces.settings.security.mfa.last_attempt": "Последняя проверка {date}",
  "workspaces.settings.security.mfa.completed_at": "Полное покрытие с {date}",
  "workspaces.settings.security.mfa.last_error": "Последняя ошибка: {error}",
  "workspaces.settings.security.mfa.unverified_hint":
    "Пока политика включена, непроверенных участников не пускают. Попросите их добавить второй фактор — число выше нужно довести до нуля.",
  "workspaces.settings.security.mfa.off":
    "Двухфакторная аутентификация в этом рабочем пространстве не требуется.",
  "workspaces.settings.security.mfa.no_status_yet":
    "Двухфакторная аутентификация здесь обязательна. Проверка ещё не проходила, поэтому никто не подтверждён.",
  "workspaces.members.title": "Участники",
  "workspaces.members.subtitle": "Управляйте доступом к рабочему пространству.",
  "workspaces.members.count": "Участников: {count}",
  "workspaces.members.count.one": "{count} участник",
  "workspaces.members.count.few": "{count} участника",
  "workspaces.members.count.many": "{count} участников",
  "workspaces.members.count.other": "Участников: {count}",
  "workspaces.members.joined": "Присоединился {date}",
  "workspaces.members.last_seen": "Был здесь {date}",
  "workspaces.members.last_seen_never": "Ещё не открывал это пространство",
  "workspaces.members.search_placeholder": "Поиск по имени или email",
  "workspaces.members.role_picker_label": "Роль участника {member}",
  "workspaces.members.blocked.read_only":
    "Вы видите, кто здесь, но не можете это менять.",
  "workspaces.members.mfa_label": "Второй фактор",
  "workspaces.members.mfa.compliant": "подтверждён",
  "workspaces.members.mfa.noncompliant": "отсутствует",
  "workspaces.members.mfa.unknown": "ещё не проверяли",
  "workspaces.members.suspended": "Отстранён",
  "workspaces.members.suspended.no_mfa":
    "Отстранён до подтверждения второго фактора.",
  "workspaces.members.provisioned": "Создан администратором",
  "workspaces.members.invite_dialog.title": "Пригласить участников",
  "workspaces.members.invite_dialog.emails_label": "Email-адреса",
  "workspaces.members.invite_dialog.emails_placeholder": "Введите email и нажмите Enter",
  "workspaces.members.invite_dialog.role_label": "Роль",
  "workspaces.members.invite_dialog.name_label": "Имя (необязательно)",
  "workspaces.members.invite_dialog.name_placeholder": "Показывается, пока человек не задаст своё",
  "workspaces.members.invite_dialog.submit": "Отправить приглашения",
  "workspaces.members.invite_dialog.blocked.no_emails":
    "Введите хотя бы один email-адрес.",
  "workspaces.members.invite_dialog.blocked.bad_email":
    "{email} — это не email-адрес.",
  "workspaces.members.remove_confirm": "Удалить этого участника?",
  "workspaces.members.remove_confirm_body":
    "{member} сразу потеряет доступ к рабочему пространству. Позже его можно пригласить снова.",
  "workspaces.members.remove.blocked.last_owner":
    "Это единственный владелец рабочего пространства. Сначала назначьте владельцем кого-то ещё.",
  "workspaces.members.remove.blocked.self":
    "Это вы. Попросите другого владельца или администратора удалить вас из пространства.",
  "workspaces.members.reset_password": "Сбросить пароль",
  "workspaces.members.reset_password.blocked.self":
    "Это вы. Свой пароль меняют в настройках аккаунта — здесь действие выполняется над чужим.",
  "workspaces.members.reset_password_dialog.title": "Сбросить пароль участника {member}?",
  "workspaces.members.reset_password_dialog.body":
    "Текущий пароль перестанет работать сразу, и участник узнает, что это сделали вы. Новый пароль в письме не отправляется.",
  "workspaces.members.reset_password_dialog.step_up":
    "Перед выполнением мы попросим подтвердить, что это вы.",
  "workspaces.members.reset_password_dialog.submit": "Сбросить пароль",
  "workspaces.members.reset_password_dialog.done": "У участника {member} новый пароль.",
  "workspaces.members.reset_password_dialog.generated": "Одноразовый пароль",
  "workspaces.members.reset_password_dialog.generated_hint":
    "Показывается один раз и больше никогда. Передайте его по каналу, которому доверяете; свой пароль участник задаст при первом входе.",
  "workspaces.members.reset_password_dialog.not_notified":
    "Сообщить было некуда — передайте пароль сами.",
  "workspaces.members.rename": "Переименовать",
  "workspaces.members.rename_dialog.title": "Исправить имя",
  "workspaces.members.rename_dialog.label": "Отображаемое имя",
  "workspaces.members.rename_dialog.placeholder": "Оставьте пустым, чтобы убрать имя",
  "workspaces.members.rename_dialog.hint":
    "Это имя человека во всём продукте, а не заметка внутри этого пространства.",
  "workspaces.members.rename_dialog.submit": "Сохранить имя",
  "workspaces.members.rename_dialog.blocked.unchanged": "Сначала измените имя.",
  "workspaces.members.role.owner": "Владелец",
  "workspaces.members.role.admin": "Администратор",
  "workspaces.members.role.member": "Участник",
  "workspaces.members.role.viewer": "Наблюдатель",

  // Role registry labels (builtin four; clients merge their own roles)
  "workspaces.role.owner": "Владелец",
  "workspaces.role.admin": "Администратор",
  "workspaces.role.member": "Участник",
  "workspaces.role.viewer": "Наблюдатель",
  "workspaces.role.rank_caption": "Ранг {rank}",

  // Workspaces page
  "workspaces.page.title": "Рабочие пространства",
  "workspaces.page.subtitle": "Все пространства, где вы состоите.",
  "workspaces.list.count": "Пространств: {count}",
  "workspaces.list.count.one": "{count} пространство",
  "workspaces.list.count.few": "{count} пространства",
  "workspaces.list.count.many": "{count} пространств",
  "workspaces.list.count.other": "Пространств: {count}",
  "workspaces.list.member_count": "Участников: {count}",
  "workspaces.list.member_count.one": "{count} участник",
  "workspaces.list.member_count.few": "{count} участника",
  "workspaces.list.member_count.many": "{count} участников",
  "workspaces.list.member_count.other": "Участников: {count}",
  "workspaces.list.owner_line": "Владелец: {owner}",
  "workspaces.list.your_role": "Ваша роль",
  "workspaces.list.open": "Открыть",
  "workspaces.list.preferred": "Основное",
  "workspaces.list.set_preferred": "Сделать основным",
  "workspaces.list.clear_preferred": "Убрать признак основного",
  "workspaces.list.empty_hint":
    "Создайте пространство, чтобы приглашать людей и держать работу вместе.",
  "workspaces.list.guest_notice":
    "Вы здесь как гость. Гость открывает то, что ему прислали, но не состоит в рабочем пространстве.",
  "workspaces.list.instance_closed":
    "Попросите приглашение у того, кто управляет этой установкой.",
  "workspaces.list.create_dialog.title": "Новое рабочее пространство",
  "workspaces.list.create_dialog.name_label": "Название",
  "workspaces.list.create_dialog.name_placeholder": "например, «Акме Инжиниринг»",
  "workspaces.list.create_dialog.submit": "Создать рабочее пространство",
  "workspaces.list.create_dialog.blocked.no_name": "Введите название.",
  "workspaces.list.blocked.create_policy":
    "На этой установке создавать пространства может только её владелец.",

  // Invitation administration
  "workspaces.invitations.title": "Приглашения",
  "workspaces.invitations.subtitle": "Кого пригласили и кто ещё не присоединился.",
  "workspaces.invitations.count": "Приглашений: {count}",
  "workspaces.invitations.count.one": "{count} приглашение",
  "workspaces.invitations.count.few": "{count} приглашения",
  "workspaces.invitations.count.many": "{count} приглашений",
  "workspaces.invitations.count.other": "Приглашений: {count}",
  "workspaces.invitations.empty": "Никто не ждёт приглашения.",
  "workspaces.invitations.expires_label": "Истекает",
  "workspaces.invitations.sent_label": "Отправлено",
  "workspaces.invitations.sent_never": "Письмо ещё не отправлялось",
  "workspaces.invitations.search_placeholder": "Поиск по email",
  "workspaces.invitations.filter_label": "Показать",
  "workspaces.invitations.filter.pending": "Ожидают",
  "workspaces.invitations.filter.never_accepted": "Так и не приняты",
  "workspaces.invitations.filter.all": "Все",
  "workspaces.invitations.status.pending": "Ожидает",
  "workspaces.invitations.status.accepted": "Принято",
  "workspaces.invitations.status.declined": "Отклонено",
  "workspaces.invitations.status.revoked": "Отозвано",
  "workspaces.invitations.status.expired": "Истекло",
  "workspaces.invitations.resend": "Отправить снова",
  "workspaces.invitations.resend_confirm": "Отправить приглашение ещё раз?",
  "workspaces.invitations.resend_confirm_body":
    "На адрес {email} уйдёт новая ссылка, а прежняя перестанет работать.",
  "workspaces.invitations.revoke": "Отозвать",
  "workspaces.invitations.revoke_confirm": "Отозвать это приглашение?",
  "workspaces.invitations.revoke_confirm_body":
    "Ссылка на {email} перестанет работать. Человеку об этом не сообщат; позже его можно пригласить снова.",
  "workspaces.invitations.rename": "Переименовать",
  "workspaces.invitations.rename_dialog.title": "Исправить имя приглашённого",
  "workspaces.invitations.blocked.terminal":
    "Это приглашение уже принято, отклонено, отозвано или истекло.",
  "workspaces.invitations.blocked.resend_terminal":
    "Отправить повторно можно только ожидающее или истёкшее приглашение.",
  "workspaces.invitations.blocked.row_closed":
    "Это приглашение закрыто — с ним больше ничего не сделать.",
  "workspaces.invitations.blocked.row_resend_only":
    "Срок приглашения истёк. Остаётся только отправить его заново.",

  // Membership history
  "workspaces.audit.title": "История участия",
  "workspaces.audit.subtitle": "Кто впустил человека, кто вывел и когда.",
  "workspaces.audit.empty": "Здесь пока ничего не происходило.",
  "workspaces.audit.filter_label": "Событие",
  "workspaces.audit.filter.all": "Все события",
  "workspaces.audit.actor_unknown": "Система",
  "workspaces.audit.by": "выполнил(а) {actor}",
  "workspaces.audit.role_line": "Роль: {role}",
  "workspaces.audit.action.invitation_created": "Приглашение отправлено",
  "workspaces.audit.action.invitation_accepted": "Приглашение принято",
  "workspaces.audit.action.invitation_revoked": "Приглашение отозвано",
  "workspaces.audit.action.invitation_declined": "Приглашение отклонено",
  "workspaces.audit.action.account_created_by_invitation":
    "Аккаунт создан по приглашению",
  "workspaces.audit.action.member_joined": "Присоединился к пространству",
  "workspaces.audit.action.member_provisioned": "Добавлен администратором",
  "workspaces.audit.action.member_removed": "Удалён из пространства",
  "workspaces.audit.action.member_role_changed": "Роль изменена",
  "workspaces.audit.action.member_suspended": "Доступ приостановлен",
  "workspaces.audit.action.member_unsuspended": "Доступ восстановлен",
  "workspaces.audit.action.deleted": "Рабочее пространство удалено",

  // Invite accept flow (org-program §B4)
  "workspaces.invite.loading": "Загрузка приглашения…",
  "workspaces.invite.acceptTitle": "Присоединиться к {workspace}",
  "workspaces.invite.roleLine": "Вас пригласили с ролью {role}.",
  "workspaces.invite.emailLine": "Приглашение для {email}",
  "workspaces.invite.joinCta": "Присоединиться",
  "workspaces.invite.declineCta": "Отклонить",
  "workspaces.invite.declineConfirm": "Отклонить это приглашение?",
  "workspaces.invite.declineConfirmBody":
    "Пространству сообщат об отказе, и ссылка перестанет работать. Если передумаете, попросите новое приглашение.",
  "workspaces.invite.accepted": "Вы присоединились к {workspace}.",
  "workspaces.invite.declined": "Приглашение отклонено.",
  "workspaces.invite.unavailable.expired": "Срок приглашения истёк. Попросите новое.",
  "workspaces.invite.unavailable.revoked": "Приглашение было отозвано.",
  "workspaces.invite.unavailable.accepted": "Приглашение уже использовано.",
  "workspaces.invite.unavailable.declined": "Приглашение было отклонено.",
  "workspaces.invite.unavailable.next_step":
    "Попросите администратора «{workspace}» прислать новое приглашение.",
  "workspaces.invite.exitCta": "К своим рабочим пространствам",
  "workspaces.invite.wrongAccount": "Приглашение для другого аккаунта",
  "workspaces.invite.wrongAccountHint":
    "Вы вошли как {email}, а приглашение отправлено на {invited}. Смените аккаунт, чтобы продолжить.",
  "workspaces.invite.switchAccountCta": "Сменить аккаунт",
  "workspaces.invite.loginTitle": "Войдите, чтобы принять приглашение",
  "workspaces.invite.newUserHint":
    "Мы создадим подтверждённый аккаунт для {email} — без пароля и подтверждения почты.",
  "workspaces.invite.createAccountCta": "Создать аккаунт и продолжить",
  "workspaces.invite.claiming": "Создаём ваш аккаунт…",
  "workspaces.invite.exchanging": "Выполняем вход…",
  "workspaces.invite.exchangeFailed": "Не удалось завершить вход.",
  "workspaces.invite.retryCta": "Попробовать ещё раз",
  "workspaces.invite.basicDataTitle": "Настройте профиль",
  "workspaces.invite.basicDataContinueCta": "Продолжить",
  "workspaces.invite.blocked.busy": "Заканчиваем начатый шаг…",

  // A workspace-scoped screen with no active workspace
  "workspaces.active.choose.title": "Выберите пространство",
  "workspaces.active.choose.hint":
    "Этот экран управляет одним пространством за раз. Выберите его на странице «Рабочие пространства» и вернитесь сюда.",
  "workspaces.active.none.title": "Вы пока не состоите ни в одном пространстве",
  "workspaces.active.none.hint":
    "Создайте пространство или попросите владельца пригласить вас — тогда здесь появится чем управлять.",

  // Nav manifest labels
  "workspaces.nav.workspaces": "Рабочие пространства",
  "workspaces.nav.settings": "Пространство",
  "workspaces.nav.members": "Участники",
  "workspaces.nav.invitations": "Приглашения",
  "workspaces.nav.audit": "История",
  "workspaces.nav.invite": "Приглашение",
};

/**
 * Register the pair's `ru` locale into a core i18n engine (call once at
 * startup, after {@link registerWorkspacesI18n}). Layers per the
 * merge-priority convention (i18n-shipping.md §3): the en floor is registered
 * UNDER the ru texts inside the `ru` locale, so a key the ru bundle ever
 * misses degrades to its English text — never to a raw key. A host bundle
 * registered after this call overrides both.
 */
export function registerWorkspacesI18nRu(engine: I18nEngine): void {
  engine.registerBundle("ru", workspacesI18nBundleEn);
  engine.registerBundle("ru", workspacesI18nBundleRu);
}
