/**
 * The UI floor: copy for the handful of controls the SHARED skin substrate
 * (`@stapel/tokens-antd/skin` — `ErrorAlert`, `SkinConfirm`, `EmptyState`,
 * `LoadBoundary`, `SlotPlaceholder`) renders on its own behalf — "Try again",
 * "Cancel", "Nothing here yet" — in every locale core ships.
 *
 * Why core and not the skin package: the token bridge owns no i18n engine and
 * must not invent user-facing English (see `SkinDialog.dismissLabel`, which
 * for that reason is a required caller-supplied string). Fifteen pairs each
 * shipped their own `uiRetry` key for the same button because nothing lower
 * in the graph had one. This bundle is that lower place. It is a FLOOR in
 * the fleet's usual sense — seeded by {@link createI18n} under every locale
 * before any caller bundle, so a pair or host overrides any key by
 * registering the same key later, and a skin gets a real sentence with zero
 * wiring.
 *
 * Keys are referenced through {@link STAPEL_UI_KEYS}, never spelled inline:
 * the object is what a skin imports, and what a host reads to override.
 */
import type { I18nDictionary } from "../i18n.js";

/** The keys, by role. Values are the catalogue keys under `stapel.ui.*`. */
export const STAPEL_UI_KEYS = {
  /** Re-run a failed read. */
  retry: "stapel.ui.retry",
  /** Close an alert, a sheet, a dialog — the accessible name of the affordance. */
  dismiss: "stapel.ui.dismiss",
  /** The affirmative button of a confirmation. */
  confirm: "stapel.ui.confirm",
  /** The way out of a confirmation. */
  cancel: "stapel.ui.cancel",
  /** Accessible name of a loading region. */
  loading: "stapel.ui.loading",
  /** Default title of an empty state, for the caller that has no better one. */
  emptyTitle: "stapel.ui.empty.title",
  /** Dev-only placeholder for a render slot the host left unfilled. */
  slotUnfilled: "stapel.ui.slot.unfilled",
  /** The overflow control of a row's actions on a phone ("More"). */
  more: "stapel.ui.more",
  /** Accessible name / title of an actions sheet ("Actions"). */
  actions: "stapel.ui.actions",
} as const;

const CORE_UI_BUNDLES: Readonly<Record<string, I18nDictionary>> = {
  en: {
    [STAPEL_UI_KEYS.retry]: "Try again",
    [STAPEL_UI_KEYS.dismiss]: "Dismiss",
    [STAPEL_UI_KEYS.confirm]: "Confirm",
    [STAPEL_UI_KEYS.cancel]: "Cancel",
    [STAPEL_UI_KEYS.loading]: "Loading",
    [STAPEL_UI_KEYS.emptyTitle]: "Nothing here yet",
    [STAPEL_UI_KEYS.slotUnfilled]: "Slot “{name}” is not filled",
    [STAPEL_UI_KEYS.more]: "More",
    [STAPEL_UI_KEYS.actions]: "Actions",
  },
  ru: {
    [STAPEL_UI_KEYS.retry]: "Повторить",
    [STAPEL_UI_KEYS.dismiss]: "Закрыть",
    [STAPEL_UI_KEYS.confirm]: "Подтвердить",
    [STAPEL_UI_KEYS.cancel]: "Отмена",
    [STAPEL_UI_KEYS.loading]: "Загрузка",
    [STAPEL_UI_KEYS.emptyTitle]: "Пока здесь ничего нет",
    [STAPEL_UI_KEYS.slotUnfilled]: "Слот «{name}» не заполнен",
    [STAPEL_UI_KEYS.more]: "Ещё",
    [STAPEL_UI_KEYS.actions]: "Действия",
  },
  es: {
    [STAPEL_UI_KEYS.retry]: "Reintentar",
    [STAPEL_UI_KEYS.dismiss]: "Cerrar",
    [STAPEL_UI_KEYS.confirm]: "Confirmar",
    [STAPEL_UI_KEYS.cancel]: "Cancelar",
    [STAPEL_UI_KEYS.loading]: "Cargando",
    [STAPEL_UI_KEYS.emptyTitle]: "Aún no hay nada aquí",
    [STAPEL_UI_KEYS.slotUnfilled]: "El espacio «{name}» no está relleno",
    [STAPEL_UI_KEYS.more]: "Más",
    [STAPEL_UI_KEYS.actions]: "Acciones",
  },
};

/** Locales core ships its UI floor in. */
export const CORE_UI_LOCALES: readonly string[] = Object.keys(CORE_UI_BUNDLES);

/**
 * Core's UI floor for a locale — exact locale, then its base language
 * (`es-MX` → `es`), then `en`. Never empty, so an unknown locale renders
 * English on the retry button rather than a raw key.
 */
export function coreUiBundle(locale: string): I18nDictionary {
  const exact = CORE_UI_BUNDLES[locale];
  if (exact) return { ...exact };
  const base = CORE_UI_BUNDLES[locale.split("-")[0] ?? ""];
  if (base) return { ...base };
  return { ...(CORE_UI_BUNDLES["en"] ?? {}) };
}
