/**
 * Cyrillic -> Latin for slug text: Russian plus the Ukrainian/Belarusian/
 * Kazakh letters a marketplace title can carry. Chosen for a word-for-word
 * URL transliteration, not for the search facet's fuzzy-match table in
 * `packages/search-react/src/state/translit.ts` — that table folds the
 * "yo" and "soft i" letters to the plain vowel a fuzzy prefix match wants;
 * a slug instead reads them out loud, so a human can pronounce the URL.
 */
const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
  "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
  "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  // Ukrainian / Belarusian
  "і": "i", "ї": "i", "є": "e", "ґ": "g", "ў": "u",
  // Kazakh
  "ә": "a", "ғ": "g", "қ": "q", "ң": "n", "ө": "o", "ұ": "u", "ү": "u", "һ": "h",
};

const DEFAULT_MAX_LENGTH = 60;

/** Combining marks (NFKD decomposition) — stripped so an accented Latin
 * letter (e.g. `é`) folds to its plain form. A Unicode property escape, so
 * the source file has no raw combining characters sitting in it. */
const COMBINING_MARKS = /\p{Mn}/gu;

const ASCII_ALNUM = /^[a-z0-9]$/;

/**
 * One word, transliterated and folded to `[a-z0-9]` — everything else
 * (punctuation, marks, scripts with no entry above) is dropped.
 *
 * Looked up character-by-character on the LOWERCASED word, before any NFKD
 * folding: several Cyrillic letters this table maps (U+0451 "yo", U+0439
 * "short i") are themselves precomposed, and NFKD decomposes each into a
 * plain base letter plus a combining mark — folding first would erase
 * exactly the letters this table exists to tell apart. NFKD is applied per
 * character, only as a fallback for a Latin letter the table and the ASCII
 * test both miss (e.g. `é` folds to `e`).
 */
function transliterateWord(word: string): string {
  const lowered = word.toLowerCase();
  let out = "";
  for (const char of lowered) {
    const mapped = CYRILLIC_TO_LATIN[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (ASCII_ALNUM.test(char)) {
      out += char;
      continue;
    }
    const folded = char.normalize("NFKD").replace(COMBINING_MARKS, "");
    if (ASCII_ALNUM.test(folded)) out += folded;
  }
  return out;
}

export interface SlugifyOptions {
  /** Hard cap on the result length, cut on a word boundary. Default 60. */
  maxLength?: number;
}

/**
 * A URL-safe slug for a listing/catalogue title: per-word transliteration of
 * Cyrillic (Russian, Ukrainian, Belarusian, Kazakh), lowercase, words joined
 * with `-`, digits kept, everything else dropped. No leading, trailing or
 * doubled hyphens. Cut to `opts.maxLength` (default 60) on a word boundary —
 * a whole trailing word is dropped rather than truncated, unless the very
 * first word alone already overruns the budget.
 */
export function slugify(text: string, opts: SlugifyOptions = {}): string {
  const maxLength = opts.maxLength ?? DEFAULT_MAX_LENGTH;
  const words = text
    .split(/[^\p{L}\p{N}]+/u)
    .map(transliterateWord)
    .filter((word) => word.length > 0);

  let out = "";
  for (const word of words) {
    const next = out.length === 0 ? word : `${out}-${word}`;
    if (next.length > maxLength) {
      if (out.length === 0) return word.slice(0, maxLength);
      break;
    }
    out = next;
  }
  return out;
}
