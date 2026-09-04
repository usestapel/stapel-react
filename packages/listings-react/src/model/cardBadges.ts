/**
 * The CARD BADGE CONTRACT — what a badge on a result card is allowed to say.
 *
 * ── What was on screen ────────────────────────────────────────────────────
 *
 * A live card's badge line read "Brick · 3 · 9". Three true facts about a
 * flat, and two of them unreadable: 3 what, 9 what. The projection carried
 * the VALUES and the display half printed them, because that is all a stored
 * `features_badges` row could offer — a number with no unit and no question
 * beside it.
 *
 * stapel-listings 0.21.3 adds the missing half to each element:
 *
 *   `value`         the raw answer
 *   `label`         its resolved copy, where the answer is an option
 *   `unit`          what the number is measured in
 *   `name`          the question — the feature's own display name
 *   `presentation`  which of those to print, decided by the SERVER
 *
 * `presentation` is the load-bearing key, and it is the server's decision
 * rather than a rule guessed here, because the right badge for a value
 * depends on the CATEGORY: "3 rooms" wants its name, "Brick" is a
 * boolean whose name IS the badge, "20 000 km" wants its unit and no name at
 * all, and no client-side heuristic gets all three right for every catalogue
 * in the fleet.
 *
 * ── The four presentations ───────────────────────────────────────────────
 *
 *   `value`       the value alone      — "Brick" (an option label)
 *   `value_unit`  value and unit       — "20 000 km"
 *   `name_value`  name and value       — "Floor 3": a SPACE and never a colon,
 *                                        because a card is a caption and not a
 *                                        form. The unit is kept when the
 *                                        element carries one — a named row
 *                                        that dropped it reads "Mileage 20 000"
 *   `name`        the name alone       — a TRUE boolean, whose whole content
 *                                        is that the flat is brick. A FALSE
 *                                        one renders nothing: "not brick" is
 *                                        not a selling point, and a card is a
 *                                        summary rather than a form.
 *
 * ── Why a local type extension and not a regenerated schema ───────────────
 *
 * The generated `FeatureDao` union is already unusable on this side (the
 * discriminator defect, `api/types.ts`), `features_badges` is a `JSONField`
 * on the serializer, and this pair reads the row through
 * {@link ListingFeatureDao} — a hand-written mirror of the runtime shape —
 * for exactly that reason. The contract is an additive extension of the same
 * mirror, so a regeneration cannot take it away and an older backend that
 * sends none of the five keys is simply a row where
 * {@link hasCardBadgeContract} is false.
 *
 * ── The fallback is the whole compatibility story ─────────────────────────
 *
 * A row with no `presentation` is a row from a server that predates the
 * contract, and it is rendered exactly as it is rendered today — through
 * `@stapel/attributes-react`'s `<FeatureBadges>`, off the stored DAO's own
 * config. Nothing about this module is required for a card to draw.
 */
import type { ListingCardBadgeElement, ListingFeatureDao } from "../api/types.js";

/**
 * Which parts of a badge element the server asked to be printed.
 *
 * Read off the GENERATED element rather than spelled again here: the four
 * readings are the server's enum, and a fifth added upstream must turn this
 * build red instead of falling through {@link badgePresentation}'s default in
 * silence.
 */
export type CardBadgePresentation = ListingCardBadgeElement["presentation"];

/**
 * The keys stapel-listings 0.21.3 adds to a `features_badges` /
 * `features_title` element.
 *
 * The NAMES and their types come from the generated element; the optionality
 * is this pair's own, and is the whole compatibility story — the contract
 * makes them required, and a server that predates it sends none of them. Same
 * argument as {@link ListingEngagementFields}, one file over: a generated type
 * is a promise about the contract, not about the bytes a deployment sends.
 */
export type CardBadgeContract = {
  /** The raw answer. Absent on a redacted row, which is why the renderers
   * below all tolerate it, and `unknown` because the DAO union types it per
   * feature type and a badge prints whatever it was given. */
  readonly value?: unknown;
} & {
  readonly [K in "label" | "unit" | "name"]?: ListingCardBadgeElement[K] | null;
} & {
  /** Widened back to `string` on purpose: {@link badgePresentation} exists to
   * REFUSE a reading it does not know, and a field typed as the four would
   * make that refusal unreachable — and untestable — while a server is still
   * free to send a fifth. */
  readonly presentation?: string | null;
};

/** A stored badge row, with the contract's keys where the server sends them. */
export type CardBadgeRow = ListingFeatureDao & CardBadgeContract;

/**
 * `presentation` as one of the four, or `undefined`.
 *
 * An unrecognised spelling is `undefined` rather than a guess: the whole
 * point of the key is that the SERVER decided, and a client that invented a
 * fifth reading would print one category's rule on another category's card.
 */
export function badgePresentation(row: CardBadgeRow): CardBadgePresentation | undefined {
  const raw = row.presentation;
  if (typeof raw !== "string") return undefined;
  switch (raw) {
    case "value":
    case "value_unit":
    case "name_value":
    case "name":
      return raw;
    default:
      return undefined;
  }
}

/**
 * Does this projection speak the contract at all?
 *
 * ONE row declaring a `presentation` is enough: the server writes the whole
 * list in one pass, so a mixed list means a row the server deliberately left
 * plain, and that row still renders (as its value alone) rather than
 * dragging the other four back to the old path.
 */
export function hasCardBadgeContract(rows: readonly CardBadgeRow[]): boolean {
  return rows.some((row) => badgePresentation(row) !== undefined);
}

/** Trimmed copy, or `""` — `null` is the shape the wire uses for absent. */
function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * How many decimals the wire actually stated.
 *
 * A card badge must not invent precision and must not lose it: the server
 * sends "2.0" for an engine volume and `2` for a number of rooms, and JS
 * cannot tell `2.0` from `2` once it is a number — so a STRING value keeps
 * the decimals it was written with and a number keeps its own.
 */
function statedDecimals(raw: unknown): number {
  const written = typeof raw === "string" ? raw : String(raw);
  const tail = written.split(".")[1];
  return tail === undefined ? 0 : tail.replace(/[^0-9]/g, "").length;
}

/**
 * The element's answer, as a person reads it: the server's `label` when there
 * is one, the value with its digits grouped when it is a number, the value
 * verbatim otherwise.
 */
export function badgeValueText(row: CardBadgeRow, locale?: string): string {
  const label = text(row.label);
  if (label.length > 0) return label;
  const raw = row.value;
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "boolean") return "";
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (typeof raw !== "object" && Number.isFinite(parsed)) {
    const digits = statedDecimals(raw);
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(parsed);
    } catch {
      return parsed.toFixed(digits);
    }
  }
  return typeof raw === "object" ? "" : String(raw);
}

/** Is this element's value the `true` a `name`-presented boolean needs? */
function isTrue(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "true";
}

/**
 * One badge element → the text a card prints, or `undefined` for an element
 * that has nothing to say (a false boolean, a blank value).
 *
 * The one place the four presentations are read. Every card surface calls
 * this and none of them re-derives it, for the same reason `CardTarget`
 * exists: three cards each re-deciding what a badge says is three places for
 * "Brick · 3 · 9" to come back.
 */
export function cardBadgeText(row: CardBadgeRow, locale?: string): string | undefined {
  const presentation = badgePresentation(row);
  const name = text(row.name);
  const unit = text(row.unit);

  if (presentation === "name") {
    // The name IS the badge, and only while the answer is yes.
    return isTrue(row.value) && name.length > 0 ? name : undefined;
  }

  const value = badgeValueText(row, locale);
  if (value.length === 0) return undefined;

  const withUnit = unit.length > 0 ? `${value} ${unit}` : value;

  switch (presentation) {
    case "value_unit":
      return withUnit;
    case "name_value":
      // A SPACE, not a colon. "Floor 3" is a caption; "Floor: 3" is a form
      // field, and a card is neither a form nor a table — the colon is the
      // punctuation the spec list uses because a spec list IS the table.
      // The unit rides along: a named row that dropped it reads "Mileage
      // 20 000", which is the defect this contract exists to close.
      return name.length > 0 ? `${name} ${withUnit}` : withUnit;
    default:
      // `value`, and an element the server left plain in a list that speaks
      // the contract. The value alone, never the unit — the server said so.
      return value;
  }
}

/** Every element that has something to say, in the server's order. */
export function cardBadgeTexts(
  rows: readonly CardBadgeRow[],
  locale?: string
): readonly { readonly slug: string; readonly text: string }[] {
  const out: { slug: string; text: string }[] = [];
  for (const row of rows) {
    const printed = cardBadgeText(row, locale);
    if (printed !== undefined && typeof row.slug === "string" && row.slug.length > 0) {
      out.push({ slug: row.slug, text: printed });
    }
  }
  return out;
}
