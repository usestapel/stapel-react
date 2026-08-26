# @stapel/translate-react — module guide

The React pair for **stapel-translate**. Human companion to the generated
`llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createTranslateApi(client, capabilities)`. Three operations:
  `languagesRevision()`, `languageData(lang, revision)` and — only when the
  deployment offers content translation — `text(input)`. Types are aliases over
  the package-LOCAL generated `components["schemas"]`
  (`src/api/generated/schema.ts`, `pnpm gen:api` from stapel-translate's own
  `docs/schema.json`, emitted by the module since 0.7.0). A bare 404 on the
  bundle route is re-keyed to `error.400.translate.unsupported_language`, the
  condition's real name.
- **model/**
  - `localeLoader.ts` — `createRemoteLocaleLoader(api)`: the `LocaleLoader`
    core's `createI18n({ loadLocale })` takes. Revision → cache → download,
    with a three-rung fallback ladder (`network` / `cache` / `fallback`) that
    is PUBLISHED, so the status chip needs no second request.
  - `textBatch.ts` — the text batcher: one call per (target, source, context)
    per tick, identical strings collapsed, batches split below
    `TEXT_BATCH_MAX_ITEMS` / `TEXT_BATCH_MAX_CHARS`, a text over
    `TEXT_MAX_CHARS` refused locally with the limit in its params, a misaligned
    answer rejected rather than zipped. `null` when the capability is off.
  - `preference.ts` — the remembered language: `scope: "user"` when a session
    is active (wiped on logout), `scope: "app"` for a visitor. Through
    `createRepository`, never raw storage.
  - `refusals.ts` — `foldTranslateRefusal(error)`: code → sentence key +
    whether a retry is honest.
  - `runtime.ts` / `context.tsx` / `queryKeys.ts` — the usual pair plumbing,
    plus `languages`, `capabilities`, `limits`, `localeLoader`, `textBatcher`.
- **flows/** — `toFlowError` + the zero-flow registry shim (this module
  annotates no `@flow_step`; its `docs/flows.json` is `[]`).
- **headless/** — `useLanguage`, `useRemoteLocale` / `useLocaleStatus`,
  `useTranslateText`, `useCurrentLocale`, and `<TranslateProvider>`.
- **default/** — the AntD skin: `LanguageSwitcher`, `LanguageSettingsPane`,
  `TranslationStatus`, `TranslateButton`, `TranslatedText`. Sheet on a phone
  through `SkinDialog`; reasons beside controls through `GatedButton`; no
  `@ant-design/icons` dependency (two `currentColor` SVGs in `icons.tsx`).
- **i18n/** — `TRANSLATE_I18N_KEYS` + en/ru/es bundles, and `languages.ts`: the
  twenty endonyms, IDENTICAL in every locale (a language picker is used by
  someone who cannot read the rest of the interface).
- **nav/** — one entry, `account.language`, a submenu of the container-owned
  `account.root`. The switcher itself is header chrome and deliberately has no
  entry.
- **demo/** — first-class demos; skin variants SEED their state (a literal bag,
  a published loader status) so a static shot photographs the state it claims.

## Extension seams (frontend-standard §7)

- Client is injected via `<TranslateProvider>` / core's `StapelConfigProvider`.
- `languages`, `fallbackBundles`, `bundleCache`, `preferenceStore`, `limits`
  and `capabilities` are all runtime options: a host with a server-side
  language preference, tuned ceilings or its own storage passes its own.
- `batchSchedule` is the batcher's flush seam (tests flush on demand).
- The headless layer is fully replaceable (copy-and-own); the skin is opt-in on
  its own subpath.

## Backend gaps this pair works around

- **TR-6** — no anonymous endpoint lists a deployment's configured languages,
  so the host passes `languages`.
- **TR-4** — `translations/revision/` and `languages/revision/` return the same
  number; only the latter is used.
- The translator console (`dashboard/*`, `figma/*`, `bulk_update`) is server-
  rendered today and is deliberately NOT on this pair's surface (TR-5).
