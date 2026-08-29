/**
 * The UI floor: copy for the handful of controls the SHARED skin substrate
 * (`@stapel/tokens-antd/skin` — `ErrorAlert`, `SkinConfirm`, `EmptyState`,
 * `LoadBoundary`, `SlotPlaceholder`, `PermissionSheet`) renders on its own
 * behalf — "Try again", "Cancel", "Nothing here yet" — in every locale core
 * ships.
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

  // ── The permission pre-prompt (`PermissionSheet`) ────────────────────────
  // A browser prompt is one line the product cannot write, fired once, with
  // no second chance: "Allow example.com to use your location?" and two
  // buttons. Everything that makes it answerable — why we are asking, what
  // happens if you say no, where the switch is once you have — has to be
  // said BEFORE it, by us. That is the copy below, and it ships translated
  // so a pair gets an answerable question with zero wiring rather than an
  // English one or a raw key. Override any line by registering the same key.
  /** The affirmative of a permission pre-prompt. */
  permissionAllow: "stapel.permission.allow",
  /** The way out of one — deliberately not "Deny": the browser was never asked. */
  permissionNotNow: "stapel.permission.not_now",
  /** Shown where a capability does not exist in this browser at all. */
  permissionUnsupported: "stapel.permission.unsupported",
  /** Why we want the position, before the browser asks. */
  permissionGeolocationTitle: "stapel.permission.geolocation.title",
  permissionGeolocationBody: "stapel.permission.geolocation.body",
  /** What to do once it has been refused — the browser will not ask again. */
  permissionGeolocationDenied: "stapel.permission.geolocation.denied",
  permissionCameraTitle: "stapel.permission.camera.title",
  permissionCameraBody: "stapel.permission.camera.body",
  permissionCameraDenied: "stapel.permission.camera.denied",
  permissionMicrophoneTitle: "stapel.permission.microphone.title",
  permissionMicrophoneBody: "stapel.permission.microphone.body",
  permissionMicrophoneDenied: "stapel.permission.microphone.denied",
  permissionNotificationsTitle: "stapel.permission.notifications.title",
  permissionNotificationsBody: "stapel.permission.notifications.body",
  permissionNotificationsDenied: "stapel.permission.notifications.denied",
} as const;

/**
 * The three floor keys a permission kind has, by kind — so a skin looks the
 * copy up by the same name the hook is tracking instead of switching on it.
 */
export const PERMISSION_COPY_KEYS: Readonly<
  Record<string, { readonly title: string; readonly body: string; readonly denied: string }>
> = {
  geolocation: {
    title: STAPEL_UI_KEYS.permissionGeolocationTitle,
    body: STAPEL_UI_KEYS.permissionGeolocationBody,
    denied: STAPEL_UI_KEYS.permissionGeolocationDenied,
  },
  camera: {
    title: STAPEL_UI_KEYS.permissionCameraTitle,
    body: STAPEL_UI_KEYS.permissionCameraBody,
    denied: STAPEL_UI_KEYS.permissionCameraDenied,
  },
  microphone: {
    title: STAPEL_UI_KEYS.permissionMicrophoneTitle,
    body: STAPEL_UI_KEYS.permissionMicrophoneBody,
    denied: STAPEL_UI_KEYS.permissionMicrophoneDenied,
  },
  notifications: {
    title: STAPEL_UI_KEYS.permissionNotificationsTitle,
    body: STAPEL_UI_KEYS.permissionNotificationsBody,
    denied: STAPEL_UI_KEYS.permissionNotificationsDenied,
  },
};

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
    [STAPEL_UI_KEYS.permissionAllow]: "Allow",
    [STAPEL_UI_KEYS.permissionNotNow]: "Not now",
    [STAPEL_UI_KEYS.permissionUnsupported]: "This browser cannot do that.",
    [STAPEL_UI_KEYS.permissionGeolocationTitle]: "Use your location?",
    [STAPEL_UI_KEYS.permissionGeolocationBody]:
      "So the map opens where you are. Your browser asks next, and you can say no.",
    [STAPEL_UI_KEYS.permissionGeolocationDenied]:
      "Location is blocked for this site, and the browser will not ask again. Turn it back on in the site settings beside the address bar — or just choose the place yourself.",
    [STAPEL_UI_KEYS.permissionCameraTitle]: "Use your camera?",
    [STAPEL_UI_KEYS.permissionCameraBody]:
      "So you can take the photo here instead of hunting for one in your files.",
    [STAPEL_UI_KEYS.permissionCameraDenied]:
      "The camera is blocked for this site, and the browser will not ask again. Turn it back on in the site settings beside the address bar, or upload a file instead.",
    [STAPEL_UI_KEYS.permissionMicrophoneTitle]: "Use your microphone?",
    [STAPEL_UI_KEYS.permissionMicrophoneBody]:
      "So you can speak instead of typing. Nothing is recorded until you start.",
    [STAPEL_UI_KEYS.permissionMicrophoneDenied]:
      "The microphone is blocked for this site, and the browser will not ask again. Turn it back on in the site settings beside the address bar.",
    [STAPEL_UI_KEYS.permissionNotificationsTitle]: "Send you notifications?",
    [STAPEL_UI_KEYS.permissionNotificationsBody]:
      "So you hear about a reply while this tab is closed. Only what you are waiting for — never marketing.",
    [STAPEL_UI_KEYS.permissionNotificationsDenied]:
      "Notifications are blocked for this site, and the browser will not ask again. Turn them back on in the site settings beside the address bar; until then everything still arrives inside the app.",
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
    [STAPEL_UI_KEYS.permissionAllow]: "Разрешить",
    [STAPEL_UI_KEYS.permissionNotNow]: "Не сейчас",
    [STAPEL_UI_KEYS.permissionUnsupported]: "Этот браузер так не умеет.",
    [STAPEL_UI_KEYS.permissionGeolocationTitle]: "Определить, где вы?",
    [STAPEL_UI_KEYS.permissionGeolocationBody]:
      "Чтобы карта открылась там, где вы есть. Дальше спросит браузер — отказаться можно.",
    [STAPEL_UI_KEYS.permissionGeolocationDenied]:
      "Доступ к геопозиции для этого сайта закрыт, и браузер больше не спросит. Включить обратно можно в настройках сайта рядом с адресной строкой — или просто выберите место сами.",
    [STAPEL_UI_KEYS.permissionCameraTitle]: "Включить камеру?",
    [STAPEL_UI_KEYS.permissionCameraBody]:
      "Чтобы снять фото прямо здесь, а не искать его в файлах.",
    [STAPEL_UI_KEYS.permissionCameraDenied]:
      "Камера для этого сайта закрыта, и браузер больше не спросит. Включите её в настройках сайта рядом с адресной строкой или загрузите файл.",
    [STAPEL_UI_KEYS.permissionMicrophoneTitle]: "Включить микрофон?",
    [STAPEL_UI_KEYS.permissionMicrophoneBody]:
      "Чтобы говорить, а не печатать. Запись начнётся, только когда вы её начнёте.",
    [STAPEL_UI_KEYS.permissionMicrophoneDenied]:
      "Микрофон для этого сайта закрыт, и браузер больше не спросит. Включите его в настройках сайта рядом с адресной строкой.",
    [STAPEL_UI_KEYS.permissionNotificationsTitle]: "Присылать уведомления?",
    [STAPEL_UI_KEYS.permissionNotificationsBody]:
      "Чтобы узнать об ответе, даже когда вкладка закрыта. Только то, чего вы ждёте, — и никакой рекламы.",
    [STAPEL_UI_KEYS.permissionNotificationsDenied]:
      "Уведомления для этого сайта отключены, и браузер больше не спросит. Включите их в настройках сайта рядом с адресной строкой; до тех пор всё приходит внутри приложения.",
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
    [STAPEL_UI_KEYS.permissionAllow]: "Permitir",
    [STAPEL_UI_KEYS.permissionNotNow]: "Ahora no",
    [STAPEL_UI_KEYS.permissionUnsupported]: "Este navegador no puede hacerlo.",
    [STAPEL_UI_KEYS.permissionGeolocationTitle]: "¿Usar tu ubicación?",
    [STAPEL_UI_KEYS.permissionGeolocationBody]:
      "Para que el mapa se abra donde estás. Lo siguiente lo pregunta el navegador, y puedes decir que no.",
    [STAPEL_UI_KEYS.permissionGeolocationDenied]:
      "La ubicación está bloqueada para este sitio y el navegador no volverá a preguntar. Puedes reactivarla en los ajustes del sitio, junto a la barra de direcciones, o elegir el lugar tú mismo.",
    [STAPEL_UI_KEYS.permissionCameraTitle]: "¿Usar la cámara?",
    [STAPEL_UI_KEYS.permissionCameraBody]:
      "Para hacer la foto aquí mismo en vez de buscarla entre tus archivos.",
    [STAPEL_UI_KEYS.permissionCameraDenied]:
      "La cámara está bloqueada para este sitio y el navegador no volverá a preguntar. Reactívala en los ajustes del sitio, junto a la barra de direcciones, o sube un archivo.",
    [STAPEL_UI_KEYS.permissionMicrophoneTitle]: "¿Usar el micrófono?",
    [STAPEL_UI_KEYS.permissionMicrophoneBody]:
      "Para hablar en lugar de escribir. No se graba nada hasta que empieces.",
    [STAPEL_UI_KEYS.permissionMicrophoneDenied]:
      "El micrófono está bloqueado para este sitio y el navegador no volverá a preguntar. Reactívalo en los ajustes del sitio, junto a la barra de direcciones.",
    [STAPEL_UI_KEYS.permissionNotificationsTitle]: "¿Enviarte notificaciones?",
    [STAPEL_UI_KEYS.permissionNotificationsBody]:
      "Para enterarte de una respuesta aunque esta pestaña esté cerrada. Solo lo que estás esperando; nunca publicidad.",
    [STAPEL_UI_KEYS.permissionNotificationsDenied]:
      "Las notificaciones están bloqueadas para este sitio y el navegador no volverá a preguntar. Actívalas en los ajustes del sitio, junto a la barra de direcciones; hasta entonces todo llega dentro de la aplicación.",
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
