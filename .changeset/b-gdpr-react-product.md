---
"@stapel/gdpr-react": minor
---

The pair gets a face the showcase can photograph, a Spanish locale, an export
that watches itself, and the public intake page it was missing.

**Spanish.** `./i18n/es` (`gdprI18nBundleEs`, `registerGdprI18nEs`) — the
generated backend bundle plus this pair's own ~120 UI keys. A GDPR module that
could not speak a European language whose catalogue it already shipped was a
bad look specifically for this module. `error.409.gdpr.export_cooldown` is now
overridden in EN as well: Russian had a polished sentence English did not,
which is a key that resolves in one locale only, and a new parity test pins
en/ru/es to the same key set.

**The archive stops being a screen that never changes.** `useDataExport` polls
its own status every `EXPORT_POLL_INTERVAL_MS` (15s, exported) while a worker
is building the archive, and stops on every final answer. The bag reports
`building`, which is also what the panel's request gate reads — the refusal is
now known before the duplicate request, not after it.

**Ten demos, nine skins.** Every `src/default` export and every nav-mounted
screen now has a demo that imports the SKIN (not the headless harness), each
with a phone variant and every variant seeded at a named step: the account
group's stories were a debug card with a `state.step` chip while sixteen
designed screens had never been drawn.

**A per-row erasure detail.** `useErasure` shipped in 0.1.0 with no consumer
anywhere. Opening a row in `<PendingDeletions>` now reads that one erasure and
shows the per-owner receipts and the processor windows that push
`fully_erased_by` past `due_at` — the answer to "why is this still here?",
which the row provokes and could not give.

**The public intake page.** `<PrivacyRequestPane>` + the nav entry
`public.privacy-request` (`surface: "public"`, a route, not a menu item). The
anonymous DSAR form was previously an argued omission with no route, no example
and no story; the argument was right about the menu and wrong about the route.
The host's captcha is a declared slot, so an unfilled one is visible in a dev
build instead of silent.

**Breaking (pre-1.0, so minor).** `src/default/theme.tsx` and
`src/default/ErrorAlert.tsx` are deleted and their exports (`GdprSkinTheme`,
`GdprSkinThemeProps`, `ErrorAlert`) are gone: use `SkinTheme` / `ErrorAlert`
from `@stapel/tokens-antd/skin`, which own the ConfigProvider and read the mode
from the live document, so a shell's dark toggle repaints a mounted skin. Peer
floors move to `@stapel/tokens-antd >=0.6.0` and `@stapel/core >=0.18.0`. The
i18n keys `retry` and the five `*Loading` sentences are removed — the substrate
owns those arms and their copy is core's floor. Also new: the `./nav-manifest`
export alias other pairs already ship.
