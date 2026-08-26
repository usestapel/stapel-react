import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { tasksI18nBundleEn } from "./keys.js";
import { tasksErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for tasks-react — shipped as the
 * `@stapel/tasks-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * The backend error catalogue for this locale is GENERATED from
 * stapel-tasks's own `translations/errors.ru.json` (backend 0.3.0 ships one)
 * and spread in FIRST, exactly as `keys.ts` spreads the en one, so every
 * backend code keeps coverage by construction and the pair only hand-writes
 * its own UI copy.
 */
export const tasksI18nBundleRu: I18nDictionary = {
  ...tasksErrorBundleRu,

  "tasks.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",

  "tasks.nav.boards": "Доски",
  "tasks.nav.board": "Доска",

  "tasks.boards.title": "Доски",
  "tasks.boards.empty": "Досок пока нет",
  "tasks.boards.emptyHint": "Доска — это колонки, по которым движутся карточки.",
  "tasks.boards.create": "Новая доска",
  "tasks.boards.open": "Открыть доску",
  "tasks.boards.archive": "В архив",
  "tasks.boards.archiveQuestion": "Отправить доску в архив?",
  "tasks.boards.archiveBody":
    "Доска и её карточки сохранятся, но исчезнут из этого списка.",
  "tasks.boards.columnCount": "Колонок: {count}",
  "tasks.boards.created": "Создана {date}",
  "tasks.boards.loading": "Загружаем доски…",
  "tasks.boards.failed": "Не удалось загрузить доски.",

  "tasks.board.create.title": "Новая доска",
  "tasks.board.create.name": "Название",
  "tasks.board.create.namePlaceholder": "Релиз 2.0",
  "tasks.board.create.preset": "Форма",
  "tasks.board.create.presetCustom": "Свои колонки",
  "tasks.board.create.columns": "Колонки",
  "tasks.board.create.addColumn": "Добавить колонку",
  "tasks.board.create.columnKey": "Ключ",
  "tasks.board.create.columnName": "Название колонки",
  "tasks.board.create.category": "Категория",
  "tasks.board.create.wipLimit": "Лимит WIP",
  "tasks.board.create.submit": "Создать доску",
  "tasks.board.create.removeColumn": "Удалить колонку {name}",

  "tasks.column.todo": "К выполнению",
  "tasks.column.in_progress": "В работе",
  "tasks.column.done": "Готово",

  "tasks.category.backlog": "Бэклог",
  "tasks.category.active": "В работе",
  "tasks.category.review": "На проверке",
  "tasks.category.waiting": "Ожидание",
  "tasks.category.done": "Готово",

  "tasks.board.truncated":
    "Показываем последние карточки: {count}. Отфильтруйте, чтобы увидеть остальные.",
  "tasks.board.emptyColumn": "Пусто",
  "tasks.board.empty": "На этой доске ещё нет колонок.",
  "tasks.board.noBoard": "Доска не выбрана",
  "tasks.board.noBoardHint": "Откройте доску из списка досок.",
  "tasks.board.addCard": "Добавить карточку",
  "tasks.board.addCardPlaceholder": "Название карточки",
  "tasks.board.addCardSubmit": "Добавить",
  "tasks.board.wip": "{count}/{limit}",
  "tasks.board.wipExceeded": "Превышен лимит WIP: {limit}",
  "tasks.board.phone.columnSwitcher": "Колонка",
  "tasks.board.manageColumns": "Настроить колонки",

  "tasks.board.filters.title": "Фильтры",
  "tasks.board.filters.assignee": "Исполнитель",
  "tasks.board.filters.category": "Категория",
  "tasks.board.filters.text": "Поиск по названиям",
  "tasks.board.filters.clear": "Сбросить фильтры",
  "tasks.board.filters.any": "Любой",

  "tasks.card.dragHandle": "Перетащить {title}",
  "tasks.card.due": "Срок {date}",
  "tasks.card.overdue": "Просрочено с {date}",
  "tasks.card.checklist": "{done} из {total} шагов",
  "tasks.card.blocked": "Блокируют карточек: {count}",
  "tasks.card.open": "Открыть {title}",

  "tasks.move.applied": "Перенесено в «{column}».",
  "tasks.move.deferred": "Перенесено, ожидает подтверждения.",
  "tasks.move.denied": "Правила доски не разрешают такой перенос.",
  "tasks.move.failed": "Не удалось сохранить перенос. Карточка вернулась на место.",
  "tasks.move.pendingBadge": "Ждёт подтверждения",

  "tasks.task.title": "Название",
  "tasks.task.sheetTitle": "Карточка",
  "tasks.task.description": "Описание",
  "tasks.task.descriptionPlaceholder": "Что нужно сделать?",
  "tasks.task.column": "Колонка",
  "tasks.task.priority": "Приоритет",
  "tasks.task.priorityNone": "Без приоритета",
  "tasks.task.due": "Срок",
  "tasks.task.assignees": "Исполнители",
  "tasks.task.assigneesReadOnly":
    "В этом приложении не подключён выбор людей, поэтому исполнителей здесь можно только прочитать.",
  "tasks.task.assigneesEmpty": "Пока никого",
  "tasks.task.features": "Дополнительные поля",
  "tasks.task.checklist": "Чек-лист",
  "tasks.task.comments": "Комментарии",
  "tasks.task.created": "Создана {date}",
  "tasks.task.completed": "Завершена {date}",
  "tasks.task.archived": "Карточка в архиве, её можно только читать.",
  "tasks.task.archive": "В архив",
  "tasks.task.archiveQuestion": "Отправить карточку в архив?",
  "tasks.task.save": "Сохранить",
  "tasks.task.saving": "Сохраняем…",
  "tasks.task.loading": "Загружаем карточку…",

  "tasks.priority.low": "Низкий",
  "tasks.priority.normal": "Обычный",
  "tasks.priority.high": "Высокий",
  "tasks.priority.urgent": "Срочный",

  "tasks.checklist.add": "Добавить шаг",
  "tasks.checklist.placeholder": "Следующий шаг",
  "tasks.checklist.empty": "Шагов пока нет",
  "tasks.checklist.markDone": "Отметить «{text}» выполненным",
  "tasks.checklist.markPending": "Снять отметку с «{text}»",
  "tasks.checklist.markFailed": "Отметить «{text}» проваленным",
  "tasks.checklist.stateFailed": "Провален",
  "tasks.checklist.more": "Другие действия для «{text}»",

  "tasks.comment.placeholder": "Написать комментарий",
  "tasks.comment.send": "Отправить",
  "tasks.comment.empty": "Комментариев пока нет",
  "tasks.comment.hint": "Enter отправляет, Shift+Enter переносит строку.",

  "tasks.columns.title": "Колонки",
  "tasks.columns.reorderHint": "Перетащите колонку, чтобы изменить её место на доске.",
  "tasks.columns.noRename":
    "Здесь колонки можно переставлять и добавлять. Переименование и удаление недоступны.",
  "tasks.columns.dragHandle": "Переставить {name}",
  "tasks.columns.saveOrder": "Сохранить порядок",
  "tasks.columns.existsHint": "Выберите ключ, которого на доске ещё нет.",

  "tasks.gate.titleRequired": "Сначала дайте карточке название.",
  "tasks.gate.columnsRequired": "У доски должна быть хотя бы одна колонка.",
  "tasks.gate.nameRequired": "Сначала дайте доске название.",
  "tasks.gate.archived": "Карточка в архиве.",
  "tasks.gate.noPicker": "Выбрать людей здесь нельзя.",
  "tasks.gate.commentEmpty": "Сначала напишите текст.",
  "tasks.gate.noColumn": "На доске нет колонок, куда добавить карточку.",
  "tasks.gate.noColumnChange":
    "Откройте карточку с её доски, чтобы перенести её в другую колонку.",
  "tasks.gate.noNavigation": "Открыть доску здесь нельзя.",

  "tasks.scope.unresolved":
    "Не удалось определить, какому воркспейсу принадлежит доска. Выберите воркспейс и повторите.",

  "tasks.dialog.dismiss": "Закрыть",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerTasksI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, tasksI18nBundleEn);
  engine.registerBundle(locale, tasksI18nBundleRu);
}
