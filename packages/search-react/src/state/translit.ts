/**
 * Matching a typed prefix against a dictionary value ACROSS ALPHABETS.
 *
 * A vocabulary of car makes holds `Toyota`, `Land Rover`, `Timberland` — Latin
 * words, in a catalogue read by people typing Cyrillic. "toyota" spelled in
 * Cyrillic and `Toyota` are the same word said in two scripts, and a
 * `String.includes` over the caption answers "no" to every one of them. The
 * autocatalog has 418 makes: without this, the search box in a dictionary
 * facet is a box that works only for the half of the buyers whose keyboard
 * matches the catalogue's.
 *
 * ── Two keys per word, and why the second one exists ──────────────────────
 *
 * The first key is a plain transliteration: Cyrillic → Latin through the table
 * below, lowercased, everything but letters and digits dropped. That alone
 * gets the Cyrillic spelling of "toyota" to `toiota` and `Toyota` to `toyota`
 * — still not equal, and this is the general case rather than a bad table.
 * Vowels are exactly where two scripts disagree: `i` against `y`, `e` against
 * `a` in a borrowed word, `timberlend` against `timberland`. A vowel-perfect
 * table does not exist, because the disagreement is in the borrowing, not in
 * the letters.
 *
 * So the second key is the CONSONANT SKELETON: the first key with its vowels
 * removed. `timberlend` and `timberland` are both `tmbrlnd`; `toiota` and
 * `toyota` are both `tt`. Digits stay — a skeleton is about letters people
 * disagree on, and `5` is not one.
 *
 * A candidate matches when either key of any of its WORDS starts with the
 * corresponding key of the needle: a typed "rover" in either script finds
 * `Land Rover`, and typing into the box narrows as you go, which is the whole
 * point of a prefix rule. The skeleton arm is skipped for a needle that has no
 * consonants at all — an empty skeleton is a prefix of everything, and a box
 * that matches all 418 makes after one vowel is a box that has stopped
 * answering.
 *
 * Table-driven and dependency-free on purpose: this is 40 pairs of characters,
 * and a transliteration library is a page-weight decision made for a lookup
 * table.
 */

/**
 * Cyrillic → Latin, chosen for how the two scripts spell the SAME borrowed
 * name rather than for a standard's fidelity: `kha` is `h` (Honda, not
 * Khonda), `tse` is `c`, the two signs are nothing. Any letter absent here is
 * kept as it is, so a Latin caption passes through untouched. Keys are
 * quoted — the fleet's source is English, and a Cyrillic identifier is not.
 */
const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
  "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "",
  "ы": "y", "ь": "", "э": "e", "ю": "u", "я": "a",
  // Ukrainian/Belarusian letters a shared vocabulary can carry.
  "і": "i", "ї": "i", "є": "e", "ґ": "g", "ў": "u",
};

/** Vowels of the transliterated form — `y` included, because it stands for a
 * Cyrillic semi-vowel as often as it stands for a consonant. */
const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/**
 * One word, transliterated and folded to `[a-z0-9]`.
 *
 * `NFKD` + combining-mark strip first, so `Škoda` and `Skoda` are one word
 * before anything else looks at them.
 */
export function translitKey(text: string): string {
  const folded = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let out = "";
  for (const char of folded) {
    const mapped = CYRILLIC_TO_LATIN[char];
    if (mapped !== undefined) out += mapped;
    else if (/[a-z0-9]/.test(char)) out += char;
  }
  return out;
}

/** {@link translitKey} without its vowels — the key two spellings of one
 * borrowed name agree on. */
export function consonantKey(text: string): string {
  let out = "";
  for (const char of translitKey(text)) if (!VOWELS.has(char)) out += char;
  return out;
}

/** The words of a caption, split on everything that is not a letter or a
 * digit — so `Land Rover` is reachable by "rover" in either script. */
function words(text: string): readonly string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

/**
 * Does `candidate` answer the typed `needle`?
 *
 * Prefix, not substring: a dictionary of makes searched by substring puts
 * `Great Wall` under `all`. Every word of the candidate is a starting point,
 * and both keys are tried — see the module note.
 */
export function translitPrefixMatch(needle: string, candidate: string): boolean {
  const key = translitKey(needle);
  if (key.length === 0) return true;
  const skeleton = consonantKey(needle);
  for (const word of [candidate, ...words(candidate)]) {
    const wordKey = translitKey(word);
    if (wordKey.startsWith(key)) return true;
    if (skeleton.length > 0 && consonantKey(word).startsWith(skeleton)) return true;
  }
  return false;
}
