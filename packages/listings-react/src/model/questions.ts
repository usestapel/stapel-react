/**
 * WHICH FOUR QUESTIONS A LISTING OFFERS, and why the pair has to be told what
 * kind of listing it is.
 *
 * ── the defect ────────────────────────────────────────────────────────────
 *
 * `<ListingDetailPane>` shipped one set of chips for every listing on every
 * surface: "is it still available", "is the price negotiable", "can I come and
 * see it", "do you deliver". Those are a GOODS classified's four. The founder
 * opened a job vacancy on the live site and was offered to ask a hiring
 * manager whether their vacancy was still for sale, with no greeting in front
 * of it — four chips, four wrong sentences, on every vacancy and every service
 * the board carries.
 *
 * ── why a TOPIC the host states, and not a lookup this module does ────────
 *
 * The right set follows the listing's ROOT category, and this pair cannot read
 * one. The detail wire carries `category_id` and nothing else — a string id,
 * nullable, with no slug, no ancestry and no name (`api/generated/schema.ts`,
 * `ListingDetail`). Walking that id up to "transport" or "jobs" is a
 * CATALOGUE read, and the catalogue belongs to `@stapel/categories-react`,
 * which an L2 pair does not import. A storefront, on the other hand, already
 * knows: it routed the visitor to this page through the category tree.
 *
 * So the fact travels as a prop (`<ListingDetailPane questionTopic>`), the
 * pair owns the SENTENCES, and neither side guesses. The default is
 * {@link DEFAULT_QUESTION_TOPIC} — every host that says nothing keeps exactly
 * the four it had, so nothing regresses on the way to stating the topic.
 *
 * ── the greeting ─────────────────────────────────────────────────────────
 *
 * Every chip opens with one, written into the copy rather than composed in
 * front of it: a greeting is punctuation and register as much as words — the
 * Spanish one is bracketed by inverted marks and the Russian one is a formal
 * plural — and a pair that concatenated a prefix would be deciding another
 * language's punctuation in TypeScript. The chip becomes the first line of a
 * message to a stranger, which is the whole argument for it.
 */
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

/**
 * The kinds of thing a classified's root categories describe, as far as the
 * question a buyer opens with is concerned.
 *
 * FIVE names and three sets, deliberately. `"transport"` and `"realty"` take
 * the goods set today because a car and a flat are bought with exactly those
 * four questions — still available, negotiable, can I see it, is there
 * delivery — and inventing a separate wording for them would be this pair
 * writing copy nobody asked for. They are named anyway so a host states the
 * truth about its own tree and the day one of them earns its own set, no
 * deployment has to change a call site.
 */
export type ListingQuestionTopic =
  | "transport"
  | "realty"
  | "jobs"
  | "services"
  | "goods";

/** What a listing is about when nobody said — the set every host had before
 * the topic existed. */
export const DEFAULT_QUESTION_TOPIC: ListingQuestionTopic = "goods";

const GOODS: readonly string[] = [
  LISTINGS_I18N_KEYS.detailQuestionAvailable,
  LISTINGS_I18N_KEYS.detailQuestionPrice,
  LISTINGS_I18N_KEYS.detailQuestionViewing,
  LISTINGS_I18N_KEYS.detailQuestionDelivery,
];

const JOBS: readonly string[] = [
  LISTINGS_I18N_KEYS.detailQuestionJobOpen,
  LISTINGS_I18N_KEYS.detailQuestionJobSchedule,
  LISTINGS_I18N_KEYS.detailQuestionJobApply,
];

const SERVICES: readonly string[] = [
  LISTINGS_I18N_KEYS.detailQuestionServiceAvailable,
  LISTINGS_I18N_KEYS.detailQuestionServicePrice,
  LISTINGS_I18N_KEYS.detailQuestionServiceSlot,
];

/**
 * The i18n keys of the chips a topic offers, in the order they are drawn.
 *
 * KEYS and not sentences: the caller has the translator
 * (`useT()`), and a module that resolved the copy itself would need one per
 * render and could not be read by a test that cares about WHICH questions
 * rather than about how they are spelled in one locale.
 */
export function quickQuestionKeys(
  topic: ListingQuestionTopic = DEFAULT_QUESTION_TOPIC
): readonly string[] {
  if (topic === "jobs") return JOBS;
  if (topic === "services") return SERVICES;
  return GOODS;
}
