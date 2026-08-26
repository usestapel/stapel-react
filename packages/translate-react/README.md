# @stapel/translate-react

The React pair for **stapel-translate**: the fleet's runtime i18n source, plus
content translation for text that has no key and never will.

Two halves of one idea — *copy comes from the server, not from a release*:

1. **The runtime i18n source.** `@stapel/core`'s `createI18n({ loadLocale })`
   has always taken a loader; nothing in the fleet fed it. `runtime.localeLoader`
   is the wire to stapel-translate's revisioned, month-cacheable bundle API, and
   `<LanguageSwitcher/>` is the control. A deployment that wants Spanish copy, or
   one changed sentence, no longer needs a frontend release.
2. **Content translation** (`POST text/`, stapel-translate ≥ 0.7.0). A listing
   description has no `t()` key, so `useTranslateText` / `<TranslatedText/>` ask
   the module's LLM seam directly — **batched**, so a screen's worth of copy is
   one provider call, and **bounded**, because every cache miss spends money.

## Install

```
pnpm add @stapel/translate-react @stapel/core @tanstack/react-query react
```

## Wire the app once

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import {
  createTranslateRuntime,
  TranslateProvider,
  registerTranslateI18n,
  translateI18nBundleEn,
} from "@stapel/translate-react";
import { translateI18nBundleRu } from "@stapel/translate-react/i18n/ru";

// The languages come from the HOST: no anonymous endpoint lists them
// (BACKEND-GAP TR-6), and the scaffold knows STAPEL_TRANSLATE["LANGUAGES"].
const runtime = createTranslateRuntime({
  baseUrl: "/translate/",
  languages: ["en", "ru", "es"],
  // The loader's last rung: what a person reads when the server is unreachable.
  fallbackBundles: { en: translateI18nBundleEn, ru: translateI18nBundleRu },
});

const i18n = createI18n({ locale: "en", loadLocale: runtime.localeLoader });
registerTranslateI18n(i18n);

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <TranslateProvider runtime={runtime}>{children}</TranslateProvider>
    </StapelProvider>
  );
}
```

`baseUrl` is the module's MOUNT (`/translate/`); the `api/v1/` prefix belongs to
the module and is spelled inside the api layer.

## The default skin (`@stapel/translate-react/default`)

| Component | Where it goes |
| --- | --- |
| `<LanguageSwitcher compact/>` | `AppShell`'s `headerExtra` slot — chrome, on every page |
| `<LanguageSettingsPane/>` | the `account.language` route (this pair's one nav entry) |
| `<TranslationStatus/>` | under the switcher, or a dev/ops footer |
| `<TranslatedText text=… sourceLang=…/>` | beside somebody else's writing |
| `<TranslateButton bag=…/>` | the control alone, for a host that lays out its own text |

A `Select` on desktop, a `SkinDialog` bottom sheet at 390px, the endonym as the
option label (a person looking for Russian scans for `Русский`, whatever
language the rest of the interface is in), and `aria-label` on the icon-only
form.

## The loader never returns nothing

Three rungs, each REPORTED through `useRemoteLocale()` rather than silently
taken — a blank UI is the one failure a translation loader must not produce:

| rung | when | what `<TranslationStatus/>` says |
| --- | --- | --- |
| `network` | the bundle was downloaded | revision + key count |
| `cache` | the stored bundle answered (offline, or same revision) | "saved on this device" when it is degraded |
| `fallback` | nothing downloaded, nothing stored | the in-package bundle is in effect |

## Content translation is a capability, not a constant

`POST text/`'s guard is a per-deployment setting and its misses cost money. A
host that has not enabled it passes `capabilities: { contentTranslate: false }`:
`api.text` is then absent, the batcher is `null`, and `<TranslateButton/>`
renders **nothing** — a translate button that cannot translate is a dead
control, not a disabled one.

Where it IS available, everything asked for in one tick is folded into one
request per (target, source, context), identical strings collapse to one wire
slot, batches are split below the server's ceilings, and a text over the
per-text ceiling is refused locally with the limit in the sentence.

```tsx
// six of these on a results page = ONE POST with six strings in it
<TranslatedText text={listing.title} sourceLang={listing.language} auto />
```

See `MODULE.md` for the layer map and extension seams, and `llms.txt` for the
machine-readable surface.
