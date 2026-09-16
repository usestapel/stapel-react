---
"@stapel/recordings-react": minor
---

Regenerated against **stapel-recordings 0.25.0** ("an empty wallet is a
STATUS, not an error") and consumed the new contract: a recording whose
pipeline ran out of runway now parks in `status: "needs_payment"` instead
of failing with a generic `error`, carrying `needs_payment_reason`
(`insufficient_credits` | `free_minutes_exhausted`, and the vocabulary is
not closed). Before this release, a `needs_payment` recording had no entry
in this pair's status vocabulary at all — it fell through
`isKnownRecordingStatus` and rendered as "Unknown state" on both the list
and detail screens, with nobody ever reading `needs_payment_reason`.

- `RECORDING_STATUSES` gains the twelfth value; `TERMINAL_STATUSES` gains
  it too (`is_processing: false`, `poll_after_seconds` absent — the same
  "stop asking, a person moves it next" shape `error` already has).
- New `NEEDS_PAYMENT_REASONS` / `NeedsPaymentReason` /
  `isKnownNeedsPaymentReason` — the same open-vocabulary pattern
  `isKnownRecordingStatus` already uses, so a reason code this build has
  never seen still renders a sentence, never a raw key.
- `RecordingStatusChip` gets a warning tone and a real label for
  `needs_payment` (same tone `PaymentRequiredNotice` uses for the 402 case,
  so "this needs a top-up" reads as one colour everywhere in this pair).
- New `<RecordingNeedsPaymentNotice>` (default skin) renders a
  reason-specific sentence — "Your balance ran out partway through this
  recording" / "Your free minutes for this period are used up" / a generic
  fallback for an unrecognized code — plus the existing `renderTopUpAction`
  host slot, reusing the exact visual and i18n pattern
  `PaymentRequiredNotice` already established for the 402-refusal case.
  `<RecordingDetailPane>` renders it automatically when
  `recording.status === "needs_payment"`.
- ru/es translations included for every new UI key
  (`recordings.needs_payment.*`, `recordings.status.needs_payment`).

`docs/errors.json` and `docs/flows.json` are byte-identical across
0.24.0..0.25.0; `docs/schema.json` gains exactly the one field.
