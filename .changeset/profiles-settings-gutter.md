---
"@stapel/profiles-react": patch
---

**`gutter` on the settings sections, so a shell's page edge is not paid twice.** Every section here is an antd `Card` — `paddingLG` (24) plus a 1px border — which is the page's own frame on a bare route and a second one inside a shell that already pads its content box with `--stapel-page-gutter`: on a phone the rows sat ~29px in under a header sitting at 4.

`<ProfileSettings gutter="shell">` drops the inline padding and the border and keeps every vertical measure (the rhythm between sections is this screen's own business), and hands the same word to the two sections it composes. `<LanguageSettings>` and `<NotificationPreferences>` take it on their own too, since both are also routes. Default `"own"` — byte-compatible.
