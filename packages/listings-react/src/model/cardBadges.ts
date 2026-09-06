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
 *
 * ── A CHIP IS NOT A LINE (D421) ───────────────────────────────────────────
 *
 * The four presentations produce a piece of text; where that text is PUT
 * decides how it is read, and the two places this pair puts it are not the
 * same place:
 *
 *   a badge strip   each element is a `<Tag>`, and the chip's own border says
 *                   where one fact ends and the next begins;
 *   a spec line     the elements are joined with " · ", so the only thing
 *                   separating two facts is punctuation, and a SPACE inside
 *                   one of them is not punctuation.
 *
 * Measured on a live feed, translated: "HONOR · Model 90 · 256 GB" — three
 * facts, and the middle one reads as a value that begins with the word
 * "Model", because in a run of values a caption joined by a space is
 * indistinguishable from a two-word answer. So {@link CardBadgeStyle}
 * `"line"` writes the same pair with a COLON, which is the punctuation that
 * says "what follows is the answer to this". The chip keeps its space: "Floor 3" inside a border needs
 * no help, and a colon there is the form-field look the 0.22 contract
 * deliberately refused.
 *
 * ── …AND TWO AXES MUST NOT WEAR ONE CAPTION ───────────────────────────────
 *
 * The same feed: "5 fl. · 9 fl. · 54 m²" — the floor a flat is on and the
 * number of floors in the building, printed as one number and its unit each,
 * twice, with nothing saying which is which. The server presented both as
 * `value_unit` and it was right about each of them ALONE; what it cannot see
 * is that they are on one line together.
 *
 * That collision is a property of the SET, so it is resolved once, here, in
 * {@link cardBadgeTexts}: elements printed without a caption that share a unit
 * (or that print identical text) get their catalogue names back — the
 * `name_value` shape the contract already defines, so a disambiguated element
 * is spelled exactly as a server-captioned one. The rule refuses to act where
 * it would not help: a group whose names are missing or not distinct is left
 * alone rather than captioned with the same word twice, because a caption
 * that does not tell two things apart is noise the reader still has to read.
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
 * WHERE the text is going to be put — see the module header.
 *
 * `"badge"` is a chip in a strip and is the default, so every existing call
 * site keeps the bytes it had. `"line"` is one item in a " · "-separated run,
 * where a caption needs punctuation to be read as one.
 */
export type CardBadgeStyle = "badge" | "line";

/**
 * A CAPTION AS THIS PAIR WILL PUNCTUATE IT — the catalogue's own trailing
 * colon stripped (D455).
 *
 * Measured on a live feed, translated: one card in twenty-four read
 * "HONOR · **Model:: 90** · 256 GB". The catalogue row for that leaf spells
 * the feature's name "Model:" — with the colon IN the name — and presents it
 * `name_value`, while the neighbouring listing's row for the same slug spells
 * it "Model" and presents it `value`. So the content is inconsistent and only
 * one half of that is ours; what is ours is that {@link caption} then adds a
 * second colon to a name that already ended in one.
 *
 * Punctuation between a caption and its answer is the SURFACE's decision (see
 * the module header) — which means it is not the catalogue's, and a name that
 * arrives carrying its own is a name with a separator baked into it. It is
 * taken off here, once, so both styles are unaffected by which of the two
 * spellings a row happens to use: the chip draws "Model 90" and the line
 * "Model: 90" either way.
 *
 * Only a TRAILING colon, and only the colon: a name is otherwise printed
 * exactly as the catalogue wrote it. "Model: year:" is not a shape anybody
 * sends, and a rule that chewed punctuation off the end of every caption
 * would eventually eat a name that meant it.
 */
export function captionName(name: string): string {
  return name.replace(/\s*:+$/u, "");
}

/** A caption and its answer, joined the way this surface separates them. */
function caption(name: string, body: string, style: CardBadgeStyle): string {
  // A SPACE in a chip and a COLON in a line. "Floor 3" is a caption inside a
  // border; "Floor: 3" is what the same pair has to become when the border is
  // gone and the neighbours are a dot away.
  const head = captionName(name);
  return style === "line" ? `${head}: ${body}` : `${head} ${body}`;
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
export function cardBadgeText(
  row: CardBadgeRow,
  locale?: string,
  style: CardBadgeStyle = "badge"
): string | undefined {
  const presentation = badgePresentation(row);
  // Normalised ONCE, here (D455): every arm below asks "is there a name to
  // print", and the answer has to be about the name this pair will actually
  // draw — a row whose whole name is ":" has none.
  const name = captionName(text(row.name));
  const unit = text(row.unit);

  if (presentation === "name") {
    // The name IS the badge, and only while the answer is yes. Normalised by
    // the same rule as a caption: a lone "Brick:" is a colon with nothing
    // after it, which is the defect in its plainest form.
    return isTrue(row.value) && name.length > 0 ? name : undefined;
  }

  const value = badgeValueText(row, locale);
  if (value.length === 0) return undefined;

  const withUnit = unit.length > 0 ? `${value} ${unit}` : value;

  switch (presentation) {
    case "value_unit":
      return withUnit;
    case "name_value":
      // Joined by the SURFACE's own punctuation (D421): a space inside a
      // chip, a colon inside a line. The unit rides along either way — a
      // named row that dropped it reads "Mileage 20 000", which is the defect
      // this contract exists to close.
      return name.length > 0 ? caption(name, withUnit, style) : withUnit;
    default:
      // `value`, and an element the server left plain in a list that speaks
      // the contract. The value alone, never the unit — the server said so.
      return value;
  }
}

/**
 * Does this element already print its own caption?
 *
 * `name` IS the caption, and a `name_value` with a name to print carries one.
 * Everything else is a bare answer, and two bare answers are what can collide.
 */
function alreadyCaptioned(row: CardBadgeRow): boolean {
  const presentation = badgePresentation(row);
  if (presentation === "name") return true;
  return presentation === "name_value" && captionName(text(row.name)).length > 0;
}

/**
 * How a bare answer could be MISTAKEN for its neighbour: by measuring the
 * same thing (one unit, two axes) or by reading identically.
 */
function ambiguityKey(row: CardBadgeRow, printed: string): string {
  const unit = text(row.unit);
  return unit.length > 0 ? `unit:${unit}` : `text:${printed}`;
}

/**
 * Every element that has something to say, in the server's order, with two
 * axes that would read alike told apart — see the module header (D421).
 */
export function cardBadgeTexts(
  rows: readonly CardBadgeRow[],
  locale?: string,
  style: CardBadgeStyle = "badge"
): readonly { readonly slug: string; readonly text: string }[] {
  const out: { slug: string; text: string }[] = [];
  const printedRows: CardBadgeRow[] = [];
  /** Ambiguity key → the positions in `out` that could be confused. */
  const groups = new Map<string, number[]>();

  for (const row of rows) {
    const printed = cardBadgeText(row, locale, style);
    if (printed === undefined || typeof row.slug !== "string" || row.slug.length === 0) {
      continue;
    }
    const at = out.length;
    out.push({ slug: row.slug, text: printed });
    printedRows.push(row);
    if (alreadyCaptioned(row)) continue;
    const key = ambiguityKey(row, printed);
    const seen = groups.get(key);
    if (seen === undefined) groups.set(key, [at]);
    else seen.push(at);
  }

  for (const positions of groups.values()) {
    if (positions.length < 2) continue;
    // The names as they will be DRAWN (D455) — so a catalogue row spelling
    // one axis "Floor:" and the other "Floor" is two spellings of one word
    // here rather than two distinct captions that tell a reader nothing apart.
    const names = positions.map((at) => captionName(text(printedRows[at]?.name)));
    // Nothing to caption with, or one word for both axes: leave the line as
    // the server wrote it rather than adding a caption that tells a reader
    // nothing they did not already have.
    if (names.some((name) => name.length === 0)) continue;
    if (new Set(names).size !== names.length) continue;
    positions.forEach((at, index) => {
      const entry = out[at];
      const name = names[index];
      if (entry === undefined || name === undefined) return;
      out[at] = { slug: entry.slug, text: caption(name, entry.text, style) };
    });
  }

  return out;
}
