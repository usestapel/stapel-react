---
"@stapel/gdpr-react": patch
"@stapel/video-react": patch
"@stapel/docs-react": patch
---

Generated artifacts these pairs were entitled to and never asked for.

`gen:errors` pinned `ERRORS_LOCALES=ru` for gdpr-react and video-react while every other
pair on that line used `ru,es`, so no Spanish bundle was ever emitted — even though
`stapel-gdpr/translations/errors.es.json` already carried all 15 module keys and
video's core-owned keys were sitting in stapel-core's catalog. One word per pair;
`src/i18n/generated/errors.es.gen.ts` now exists in both (gdpr: 57 codes, complete over
the registry; video: 51, `Partial` because stapel-video ships no catalog of its own and its
keys stay the pair's to author). Reaching them needs an `./i18n/es` subpath, which is the
pairs' own `package.json` to add.

docs-react is enrolled in the root gen drivers for the first time — `gen:api`,
`gen:errors` (ru+es), `gen:events`, `gen:flows`, `gen:manifest`. It was the only package in
the monorepo that appeared in none of them, so everything the pipeline gives the other 16
pairs was hand-written and ungated, and had drifted: `manifest.json` claimed
`backend.contract ">=0.1 <0.2"` against stapel-docs 0.3.0 and invented two operationIds the
backend has never had. The manifest and llms.txt are generated now (27 operations, 74 error
codes with ru and es texts) and stand under the drift gate. The pair's own source said in
three files that the backend emitted no contract artifacts; it does, and has for a while.
`gen:nav` and `gen:demos` still wait on a `src/nav/manifest.ts` and a `demo/` directory.
