---
"@stapel/profiles-react": patch
---

The tenure line says "since", in Russian too — the month is declined through `Intl`'s own data.

`<MemberSince/>` rendered «Дата регистрации: сентябрь 2026 г.» — a label and a
colon where every other locale gets a preposition. The recorded reason was that
`Intl` writes a bare month-and-year in the NOMINATIVE case, that Russian "since
<month>" governs the GENITIVE, and that a pair cannot hand-keep a twelve-word
declension table for one caption.

The table was never needed. `Intl` knows both cases already; it just does not
offer the genitive for a month-and-year, because in THAT phrase the month is the
subject. Ask the same formatter for a month-day-year and the month becomes a
modifier, so the locale's own CLDR data declines it:

```
{month:"long", year:"numeric"}                        -> "sentyabr 2026 g."  (nominative)
{day:"numeric", month:"long", year:"numeric"}
  .formatToParts()               -> [… {month:"sentyabrya"} …]               (genitive)
```

The day is requested ONLY to put the month in that grammatical position; it is
never printed. So `profiles.public.member_since` is now «На сайте с {date}» in
ru, and a translator writing any future locale can phrase the key the way the
language actually phrases it rather than working around a nominative month.

**It is a REBUILD of the locale's phrase, not a `{month} {year}` of our own,**
and that distinction is the whole safety of it. Reading the two parts out and
joining them with a space is the obvious version and it is wrong in most of the
world: Spanish joins them with a word (`marzo de 2024`), Russian carries a
trailing abbreviation for "year" behind a narrow no-break space, and Japanese
puts the year first with no month NAME at all. What ships renders the NOMINATIVE
phrase's own parts with only the `month` part swapped for the declined word, so
every one of those patterns survives untouched. For a language with no
nominative/genitive split the swap is a no-op by construction — English reads
`September` in both shapes and gets back the identical string.

The locale is the ENGINE's throughout, via `useFormat()`. `toLocaleDateString`
and a bare `new Intl.DateTimeFormat(undefined, …)` read the BROWSER's
preference, which is how a product whose user switched to `ru` in the app keeps
rendering English months beside Russian sentences.

A tag the runtime refuses (`en_US` — an underscore is a `RangeError` to `Intl`,
and tags reach a host from config, a URL segment and a stored preference alike),
or a shape whose parts carry no `month`, falls back to the whole nominative
phrase this component rendered before — never a half sentence with the date
missing out of it. An absent or unreadable `created_at` still renders nothing at
all, and the `testId` contract is unchanged.
