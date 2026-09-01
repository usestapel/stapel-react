import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Spanish bundle for `@stapel/shell-react` — shipped as the
 * `@stapel/shell-react/i18n/es` subpath so the locale is opt-in: a host that
 * never registers it carries none of these strings (the package root does not
 * import this module).
 *
 * See `ru.ts` for why the shell's own eight strings matter more than their
 * number suggests: they are the frame every other translated screen sits in.
 */
export const shellI18nBundleEs: I18nDictionary = {
  "shell.nav.open_menu": "Abrir el menú",
  "shell.nav.close_menu": "Cerrar el menú",
  "shell.nav.admin": "Administración",
  "shell.nav.admin_staff_only": "Para el personal que opera este producto",
  "shell.dock.label": "Secciones principales",
  "shell.dock.unread": "sin leer: {count}",
  "shell.public.sign_in": "Iniciar sesión",
  "shell.public.home": "Inicio",
  "shell.legal.privacy": "Privacidad",
  "shell.legal.terms": "Condiciones",
  "shell.legal.support": "Soporte",
  "shell.theme.group": "Apariencia",
  "shell.theme.light": "Claro",
  "shell.theme.dark": "Oscuro",
  "shell.theme.system": "Igual que el sistema",
};

/** Register the Spanish chrome copy into a core i18n engine. */
export function registerShellI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, shellI18nBundleEs);
}
