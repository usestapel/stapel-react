---
"@stapel/profiles-react": minor
---

`/default` skin (`InitialSetupModal`, `ProfileSettings`, `LanguageSettings`, `NotificationPreferences`) now self-themes: each takes a `mode?: "light" | "dark"` prop and wraps its output in `<ConfigProvider theme={toAntdThemeConfig(mode)}>`, the same contract `AuthPanel` already ships — a host importing this pair's default skin no longer needs its own `ConfigProvider`/`toAntdThemeConfig` wrapper to get an on-brand result; it was rendering raw antd defaults before. Adds `@stapel/tokens-antd` as an optional peer dependency.
