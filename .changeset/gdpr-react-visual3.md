---
"@stapel/gdpr-react": minor
---

Make the privacy and staff screens survive a 390px phone, and delete the legacy harness demo.

- **A responsive table** (`DataTable`, internal): a real `<table>` above the tablet breakpoint
  of its own element width, a stacked definition card per row below it. This closes the three
  blockers where a desktop table at 390px broke words one to three characters per line —
  `waiting-to-be-deleted` (`Stan/d-/up,/12/Augu/st`), `data-owners` (the "Holds" column over
  eleven lines) and `data-protection-requests` (subject emails clipped mid-address).
- **Machine values are captions, never titles.** An erasure row is titled by what the thing IS
  ("Workspace") with the host's opaque key as `Ref ws-42` underneath; a DSAR row is titled by
  what it asks for with `Ref 6` underneath. The per-row expander's accessible name replaced
  "Show which systems have confirmed" as a column header.
- **The disabled-reason wall is gone** from both tables: the overdue explanation is stated once
  above the deletions table instead of under every affected row, and the triage note rule is
  stated once under the queue with `aria-describedby` wiring every switched-off save to it.
- **Non-events are no longer banners.** "You have not requested a data export yet" and "Your
  account is not scheduled for deletion" are quiet body text.
- **The privacy page has a name.** `PrivacyPane` renders a heading and a lead sentence, and the
  export panel leads (the deletions list is empty for almost every account).
- **The archive's loud button is the one that hands it over.** "Download archive" is the primary
  when the server says the token is unspent; the progress bar and "4 of 5 sections" no longer
  contradict the word "Ready" on a finished archive.
- **The public intake page ships no dev scaffolding.** An unfilled captcha slot renders nothing
  instead of a dashed "your captcha widget renders here" box.
- **The grace period has a clock.** `daysUntil` renders "23 days left" beside — never instead of
  — the server's date, as an ICU plural family in all three locales.
- Owner-health mismatches name the DELTA ("Not answering for meeting") rather than reprinting
  both subject lists; counts are number-neutral or plural families, never `n item(s)`.
- **Removed:** the `gdpr.closure` demo (story ids `account-closure--default|grace|erasing`), the
  legacy harness stories that printed `useAccountClosure` as a heading, `state.step` four times
  and `grace_ends_at: 2026-09-23T09:00:00Z`. `GdprProvider` is covered by `gdpr.privacy-pane`.
  The `gdpr.queue.column.reference` i18n key is removed; `gdpr.privacy.explain`,
  `gdpr.closure.grace_left.*`, `gdpr.deletions.overdue_count`, `gdpr.deletions.reference`,
  `gdpr.queue.reference`, `gdpr.queue.ack_overdue_count`, `gdpr.queue.ack_automated` and
  `gdpr.owners.subject_undeclared` are added in en, ru and es.
