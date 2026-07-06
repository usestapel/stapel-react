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
 * hand-written ru UI copy for the pair-owned {@link WORKSPACES_I18N_KEYS}
 * follows. Override any key by registering a host bundle AFTER this one
 * (merge-priority convention — see keys.ts).
 */
export const workspacesI18nBundleRu: I18nDictionary = {
  // Backend error codes — generated ru texts (coverage by construction).
  ...workspacesErrorBundleRu,

  // workspaces-react UI (hand-written ru mirror of the en copy in keys.ts)
  "workspaces.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "workspaces.list.loading": "Загрузка рабочих пространств…",
  "workspaces.list.empty": "Пока нет рабочих пространств.",
  "workspaces.list.create": "Создать рабочее пространство",
  "workspaces.list.creating": "Создание…",
  "workspaces.members.loading": "Загрузка участников…",
  "workspaces.members.invite": "Пригласить",
  "workspaces.members.inviting": "Приглашение…",
  "workspaces.members.update_role": "Изменить роль",
  "workspaces.members.remove": "Удалить",
  "workspaces.accept.accept": "Принять приглашение",
  "workspaces.accept.accepting": "Принятие…",
  "workspaces.accept.accepted": "Вы присоединились к рабочему пространству.",
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
