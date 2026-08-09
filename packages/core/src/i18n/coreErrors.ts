/**
 * The FLOOR of the one error dialect: display copy for the codes CORE itself
 * mints, in every locale core ships.
 *
 * Every pair generates a catalogue from its backend's `errors.py` registry
 * (`profiles-react/src/i18n/generated/errors.json` and friends), so a
 * structured envelope — `{localizable_error: "error.400.display_name_emoji"}`
 * — always has a translated string waiting for it. Nothing generated the
 * catalogue for the codes with no backend registry behind them, because no
 * backend registry mints them: `parseErrorEnvelope` invents
 * `stapel.http.<status>` when a failed response carries no envelope, and
 * `toStapelApiError` invents {@link TRANSPORT_ERROR_CODE} when the request
 * never reached a backend at all.
 *
 * That gap is what a live sandbox 500 walked straight through (owner report
 * 2026-08-09). A Django 500 with `DEBUG=False` returns an HTML page, not an
 * envelope, so the wire carried no `localizable_error` to map — the honest
 * answer is not "map the code", it is "there is no code, say something true
 * anyway". `formatFlowError`'s three-step chain ended at step 3 and would
 * have rendered the raw key `stapel.http.500`; the skin that never entered
 * the chain rendered `StapelApiError.message`, which for a bodiless failure
 * is `parseErrorEnvelope`'s own `"Request failed with status 500"` — the HTTP
 * client's internal diagnostic, shown to a human, in English, on a Russian
 * UI.
 *
 * So these strings are deliberately NOT specific. A 5xx tells the frontend
 * that the server broke and nothing else; inventing "could not save your
 * profile" would be a fabrication dressed as a diagnosis. They say what is
 * known (our side / your side / the network) and leave the rest to the logs.
 *
 * NO SENTENCE CARRIES THE STATUS. It used to — every 5xx sentence ended in a
 * bare `" (500)"` — and the owner rejected it on sight (2026-08-09): products
 * write a human sentence, they do not read a protocol number out to a person.
 * The status is still the only correlation handle that exists, so it did not
 * get deleted; it moved OUT of the sentence and into
 * {@link DETAIL_ERROR_KEY}, a separate, secondary, plainly-technical line a
 * skin renders in muted small type beside the copy (`describeFlowError`).
 * A caller that renders only the message still gets complete human copy —
 * the detail is additive, never load-bearing.
 *
 * NOTE — the status is a WEAK correlation handle: it identifies the class of
 * failure, not the request. A real one (a request id echoed in a response
 * header, quotable into a support ticket and greppable in the backend logs)
 * needs the backend to emit one first; no Stapel backend does today
 * (grep-confirmed across the python fleet, 2026-08-09). When one lands, it
 * belongs on `StapelApiError` beside `status`, and it extends the DETAIL
 * template (`"HTTP {status} · {request_id}"`) — not the sentence.
 *
 * Registered by {@link createI18n} itself, under every locale, BEFORE any
 * caller-supplied bundle — the floor, so a host or a pair overrides any of it
 * by registering the same key later (the fleet-wide merge-priority
 * convention), and no host has to wire anything to stop seeing raw keys.
 */
import type { I18nDictionary } from "../i18n.js";

/**
 * The TECHNICAL DETAIL template: what a support agent quotes, rendered beside
 * the human sentence rather than inside it. Interpolated with the same params
 * a message template gets, so it sees `{status}` (and `{request_id}`, once a
 * backend emits one).
 *
 * It lives in the bundle rather than hardcoded in `describeFlowError` because
 * every other user-visible string in this fleet is overridable by a host that
 * registers the same key later; a hardcoded one would be the single string a
 * host could not touch (a host that stamps a build id into it, say).
 */
export const DETAIL_ERROR_KEY = "stapel.error.detail";

/** Hardcoded stand-in for {@link DETAIL_ERROR_KEY} when a caller passes a
 * bundle core never floored (a hand-built bundle in a unit test). */
export const DETAIL_ERROR_FALLBACK = "HTTP {status}";

/**
 * Statuses worth their own sentence. Everything else in a class falls back to
 * the class-wide `stapel.http.5xx`/`stapel.http.4xx` entry — resolved by
 * {@link coreErrorKeyCandidates}, not by listing 60 keys nobody translates.
 */
const CORE_ERROR_BUNDLES: Readonly<Record<string, I18nDictionary>> = {
  en: {
    "stapel.error.unknown": "Something went wrong. Please try again.",
    "stapel.transport.failed":
      "Could not reach the server. Check your connection and try again.",
    [DETAIL_ERROR_KEY]: "HTTP {status}",
    "stapel.http.4xx": "That request could not be completed.",
    "stapel.http.400": "That request could not be completed.",
    "stapel.http.401": "Your session has expired. Please sign in again.",
    "stapel.http.403": "You do not have access to this.",
    "stapel.http.404": "This is no longer available.",
    "stapel.http.408": "The server took too long to respond. Please try again.",
    "stapel.http.409": "This changed while you were working. Please reload and try again.",
    "stapel.http.413": "That is too large to upload.",
    "stapel.http.429": "Too many requests. Please wait a moment and try again.",
    "stapel.http.5xx": "Something went wrong on our side. Please try again in a moment.",
    "stapel.http.500": "Something went wrong on our side. Please try again in a moment.",
    "stapel.http.502": "Something went wrong on our side. Please try again in a moment.",
    "stapel.http.503": "The service is temporarily unavailable. Please try again shortly.",
    "stapel.http.504": "The server took too long to respond. Please try again.",
  },
  ru: {
    "stapel.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
    "stapel.transport.failed":
      "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.",
    [DETAIL_ERROR_KEY]: "HTTP {status}",
    "stapel.http.4xx": "Не удалось выполнить запрос.",
    "stapel.http.400": "Не удалось выполнить запрос.",
    "stapel.http.401": "Сессия истекла. Войдите снова.",
    "stapel.http.403": "У вас нет доступа к этому.",
    "stapel.http.404": "Это больше недоступно.",
    "stapel.http.408": "Сервер слишком долго не отвечал. Попробуйте ещё раз.",
    "stapel.http.409": "Данные изменились, пока вы работали. Обновите страницу и повторите.",
    "stapel.http.413": "Слишком большой размер для загрузки.",
    "stapel.http.429": "Слишком много запросов. Подождите немного и попробуйте снова.",
    "stapel.http.5xx": "На нашей стороне произошла ошибка. Попробуйте ещё раз через минуту.",
    "stapel.http.500": "На нашей стороне произошла ошибка. Попробуйте ещё раз через минуту.",
    "stapel.http.502": "На нашей стороне произошла ошибка. Попробуйте ещё раз через минуту.",
    "stapel.http.503": "Сервис временно недоступен. Попробуйте чуть позже.",
    "stapel.http.504": "Сервер слишком долго не отвечал. Попробуйте ещё раз.",
  },
};

/** Locales core ships its own error floor in. */
export const CORE_ERROR_LOCALES: readonly string[] = Object.keys(CORE_ERROR_BUNDLES);

/**
 * Core's error floor for a locale — the exact locale first, then its base
 * language (`ru-RU` → `ru`), then `en`. Never empty: an unknown locale gets
 * English rather than raw keys, which is the same degradation every pair's
 * `register*I18nRu` already applies by layering the en floor underneath.
 */
export function coreErrorBundle(locale: string): I18nDictionary {
  const exact = CORE_ERROR_BUNDLES[locale];
  if (exact) return { ...exact };
  const base = CORE_ERROR_BUNDLES[locale.split("-")[0] ?? ""];
  if (base) return { ...base };
  return { ...(CORE_ERROR_BUNDLES["en"] ?? {}) };
}

/**
 * The keys to try, most specific first, for one error code — the reason a
 * bodiless 507 is not a raw key. `error.404.foo` (a real backend code) is
 * only ever itself; `stapel.http.507` also gets to fall back to the
 * class-wide `stapel.http.5xx`.
 *
 * Kept here rather than inside `formatFlowError` so the widening rule and the
 * bundle that satisfies it stay in one file — add `stapel.http.3xx` and the
 * lookup already knows about it.
 */
export function coreErrorKeyCandidates(code: string): readonly string[] {
  const match = /^stapel\.http\.(\d)\d{2}$/.exec(code);
  if (match === null) return [code];
  return [code, `stapel.http.${match[1] ?? ""}xx`];
}

/**
 * Does this code's copy need a technical detail beside it?
 *
 * Only for the codes core SYNTHESIZES (`stapel.*`), whose copy is
 * deliberately generic — "something went wrong on our side" identifies
 * nothing, so the status is the only thing a person could quote. A real
 * backend code (`error.400.display_name_emoji`) already renders a sentence
 * about the specific thing that happened; stamping `HTTP 400` under every
 * validation message would be noise a product does not ship.
 */
export function codeCarriesTechnicalDetail(code: string): boolean {
  return code.startsWith("stapel.");
}
