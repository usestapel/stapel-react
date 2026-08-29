import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Russian bundle for `@stapel/shell-react` — shipped as the
 * `@stapel/shell-react/i18n/ru` subpath so the locale is opt-in: a host that
 * never registers it carries none of these strings (the package root does not
 * import this module).
 *
 * Eight strings, and every one of them is chrome a person meets before they
 * meet the product: the nav sheet's open and close controls, the admin
 * section and why it is there, the storefront's sign-in call, and the theme
 * control's three states. Shipping them in English on a Russian host was not
 * a missing translation — it was the frame around a translated app reading in
 * another language.
 */
export const shellI18nBundleRu: I18nDictionary = {
  "shell.nav.open_menu": "Открыть меню",
  "shell.nav.close_menu": "Закрыть меню",
  "shell.nav.admin": "Администрирование",
  "shell.nav.admin_staff_only": "Для сотрудников, которые управляют продуктом",
  "shell.dock.label": "Основные разделы",
  "shell.dock.unread": "непрочитано: {count}",
  "shell.public.sign_in": "Войти",
  "shell.legal.privacy": "Конфиденциальность",
  "shell.legal.terms": "Условия",
  "shell.legal.support": "Поддержка",
  "shell.theme.group": "Оформление",
  "shell.theme.light": "Светлая",
  "shell.theme.dark": "Тёмная",
  "shell.theme.system": "Как в системе",
};

/** Register the Russian chrome copy into a core i18n engine. */
export function registerShellI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, shellI18nBundleRu);
}
