---
"@stapel/billing-react": minor
---

Billing skin: close the VISUAL3 blockers and delete the legacy harness stories.

**The two blockers.** A `past_due` subscription drew its "Payment overdue" chip
in GREEN — the card asked "is it cancelled?" and painted every other answer as a
success. Tone now comes from the state, in one table beside the label
(`subscriptionStatusTone`), so five statuses have five decided readings and an
unknown one is drawn neutral rather than guessed. And a catalogue 503 the
pair has no key for (`error.503.service_unavailable`) rendered as that raw code,
wrapped mid-token; core's HTTP status floor answers it now, and a regression
test keeps any `error.*` key and any snake_case enum off the rendered page.

**The harness stories are gone**, not supplemented: `billing.provider`,
`billing.wallet`, `billing.pricing_table` and `billing.subscription` — four
`state.step` chips that still printed `1240 USD` beside the real skin — are
deleted, and the surviving default-skin demos declare the headless exports they
cover. The demo harness lost its `DemoCard`/`StepBadge`/`DemoButton` chrome with
them.

**Screen fixes.** The "Best value" badge moves inside the offer card (as a
`Badge.Ribbon` it hung off the card's right edge and a 390px viewport clipped it
away). The debt is stated ONCE above the shop instead of once per offer card,
and each offer now says what it would LEAVE — a different number on every card.
Automatic top-up switches its whole group off when the shop answers with no
packages, states that reason once, and stops contradicting itself in
consecutive sentences. The purchase button is `large` and spans the card on a
phone. The billing page gets a real heading hierarchy (page → section → column
label) and, on a narrow layout, a row of section anchors, so the ledger is one
tap away rather than seven viewports of scroll. A debt row is two lines instead
of a `·`-joined run-on. The demo ledger reconciles: it ran to
"Balance after: −40" beside a stated balance of 1,240.

**i18n.** `billing.pricing.settles_debt` is replaced by
`billing.pricing.debt_note` and `billing.pricing.spendable_after_debt`; new
`billing.wallet.sections_label` and `billing.wallet.package_none`. All in en,
ru and es with their CLDR plural categories.
