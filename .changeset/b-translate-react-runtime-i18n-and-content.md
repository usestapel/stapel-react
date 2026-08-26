---
"@stapel/translate-react": minor
---

First release — the fleet's runtime i18n source, and content translation.

`@stapel/core`'s `createI18n` has taken a `LocaleLoader` since the beginning and
nothing in the fleet ever fed it one: every pair shipped en/ru/es inside its
bundle, and a deployment that wanted a fourth language — or one changed sentence
— needed a frontend release. stapel-translate has served every `t()` key over an
anonymous, revisioned, month-cacheable read API the whole time. This pair is the
wire between them, plus the control a person uses.

**The loader.** `createRemoteLocaleLoader(api)` → revision, then the bundle keyed
by it: a warm start costs one small request and no download. It never returns
nothing — three rungs (`network` / `cache` / `fallback`), each PUBLISHED rather
than silently taken, because a blank UI is the one failure a translation loader
must not produce. `useRemoteLocale` subscribes to what the loader did, so the
status chip costs no second request and cannot disagree with the copy on screen.

**The skin.** `<LanguageSwitcher/>` — a searchable `Select` on desktop, a
`SkinDialog` bottom sheet at 390px, `compact` for `AppShell`'s `headerExtra`
slot; options are ENDONYMS (a person looking for Russian scans for `Русский`
whatever language the interface is in), so the twenty names are identical in all
three bundles. When the download failed, the switch still applies AND the control
says some texts will read in English — beside itself, never in a tooltip a phone
cannot open. `<TranslationStatus/>` names the rung and the revision.
`<LanguageSettingsPane/>` is the `account.language` screen; the switcher itself
gets no nav entry, because chrome on every page is not a destination.

**Content translation** (stapel-translate 0.7.0's `POST text/`, which is why the
pair could not ship before). `useTranslateText` / `<TranslatedText/>` go through
a batcher: everything asked for in one tick is ONE request per (target, source,
context), identical strings collapse to one wire slot, batches are split below
`TEXT_BATCH_MAX_ITEMS`/`TEXT_BATCH_MAX_CHARS` so `batch_too_large` is an error a
correct client never provokes, and a text over `TEXT_MAX_CHARS` is refused
locally with the limit IN the sentence instead of spending a call to be told. A
misaligned answer rejects every waiter rather than handing one listing another
listing's description. Refusals fold by CODE (429 waits with no pointless retry,
502 offers one), and `cached` is surfaced as visible copy — a machine
translation is an estimate, and one served from a cache was not even produced
for this reader.

`contentTranslate` is a capability, not a constant: where a deployment has not
enabled it, `api.text` is absent, the batcher is `null`, and `<TranslateButton/>`
renders nothing. A translate button that cannot translate is a dead control.

Generated against stapel-translate 0.7.0's own contract triad —
`src/api/generated/schema.ts` from its `docs/schema.json`, and en/ru/es error
bundles from its `docs/errors.json` + `translations/errors.{ru,es}.json`, the
module's first localized refusals.

90 tests: contract from the generated schema, the batch fold and every ceiling,
the loader's three rungs, preference scope, and the skin in phone + desktop,
light + dark.
