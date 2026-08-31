---
"@stapel/currencies-react": minor
---

A whole amount prints no fraction: `42 000 ₽`, not `42 000,00 ₽`.

`formatMoney` pinned both ends of the fraction to the currency's ISO 4217
minor units, so every price tag on a classified carried a trailing `,00` that
a person reads past on every card of every page. No marketplace prints it.

The new `FormatMoneyOptions.fraction` policy states the rule in one sentence —
**the fraction is printed when the amount HAS one**:

- `"auto"` (the default): `42000.00 RUB` → `42 000 ₽`, `42000.50 RUB` →
  `42 000,50 ₽`. The AMOUNT decides the minimum, the CURRENCY still decides
  the maximum, so `1234.567 USD` is still `$1,234.57`.
- `"minor-units"`: the previous behaviour, which is what a ledger, an invoice
  line or a settlement report wants — a column whose decimal points line up,
  where a missing `,00` would read as a different precision.

Neither arm is a rounding policy: both print the same value. An explicit
`minimumFractionDigits`/`maximumFractionDigits` overrides both, so a rate
table showing four places is unchanged. `useMoney()` forwards the option.

The default changes what an existing caller renders, which is the point: the
`,00` was the defect.
