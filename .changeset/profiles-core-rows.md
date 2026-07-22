---
"@stapel/profiles-react": minor
---

`<ProfileSettings/>`: render the hard-core `display_name` + `theme` rows itself (stapel-profiles ≥0.7.0 moved them back into `ProfileCore`, so they never appear in `GET /field-manifest`). Both rows follow the settings-interaction canon (editable-text dialog for the name, reactive `Segmented` for the theme) with new pair-owned i18n keys (`profiles.settings.field.*`, `profiles.settings.theme.*`, en+ru). Owner canon "даже в дефолт скине должна быть возможность их кастомизировать или отключить": new props `showDisplayName`/`showTheme` (default `true`) turn a row off, `displayNameRow`/`themeRow` replace it with a host node. Manifest entries named `display_name`/`theme` from a pre-0.7.0 backend are deduped so a stale registry never renders a second row.
