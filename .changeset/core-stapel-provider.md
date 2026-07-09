---
"@stapel/core": minor
---

New `<StapelProvider>` (slim wave §21/S4) — the one-provider setup composing
`StapelConfigProvider` + TanStack's `QueryClientProvider` (via
`createStapelQueryClient`) + `I18nProvider` (via `createI18n`). Props:
`baseUrl` or `client` (+ per-module `clients` overrides), `locale`,
`cacheVersion`, `analytics?`, and the escape hatches `queryClient?`,
`queryRuntime?`, `i18n?`. Ceremony target: install → `create<Mod>Runtime` per
pair → ONE `<StapelProvider>` + per-pair `<ModProvider>`. The individual
providers remain exported — composition, not deprecation.

Also new: `createModuleRuntime` / `createModuleContext` (+ `ModuleRuntime`,
`CreateModuleRuntimeOptions`, `ModuleContextKit` types) — the one reviewed
copy of the runtime/context/provider plumbing the six standard pairs
previously stamped per package (§21/S2).
