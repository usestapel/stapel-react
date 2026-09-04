---
"@stapel/core": minor
---

New `slugify(text, { maxLength? })`: a URL-safe slug for a listing or
catalogue title. Per-word transliteration of Cyrillic — Russian plus the
Ukrainian/Belarusian/Kazakh letters `ё`/`є`/`і`/`ї`/`ґ`/`ў`/`ә`/`ғ`/`қ`/`ң`/`ө`/`ұ`/`ү`/`һ`
— lowercase, digits kept, everything else dropped, words joined with `-`,
no leading, trailing or doubled hyphens. `maxLength` (default 60) cuts on a
word boundary rather than mid-token.

The Cyrillic table is chosen for a slug a person can read aloud (`ё` reads
"yo", `й`/`ы` both read "y") — a different job from the fuzzy prefix-match
table in `search-react`'s `translit.ts`, so the two intentionally disagree
on the same letters.

Size budget raised 14 -> 14.5 KB for the transliteration table (rationale
in the `size-limit` entry name in `package.json`).
