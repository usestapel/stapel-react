---
"@stapel/billing-react": minor
---

The wallet stops being a number: lots, holds, the next deadline, and both ways to buy on one screen

stapel-billing 0.8.1 turned a balance into a set of credit lots with expiry
dates, and `GET /wallet` now carries `lots[]`, `holds[]` and `expiring_soon`
beside the scalar. The pair catches up:

- `useWallet` exposes `lots`, `holds` and `expiringSoon` as `LoadState`s, so a
  wallet read that FAILED can never be drawn as a wallet with no credits.
  Everything is the server's: the lots keep the spend order the backend debits
  in (`expires_at ASC NULLS LAST`) and `expiringSoon` is the server's own
  `expiring_soon` — no client-side re-sort, no second implementation of a rule
  that already has one. The three wire fields are optional, so a host still on
  a 0.7.x server reads an answered, empty structure rather than a broken one.
  Additive: the hook still returns the query result every existing call site
  reads.
- New `@stapel/billing-react/default` subpath: `<WalletPanel/>` — the balance,
  "N credits expire on &lt;date&gt;" when something does, the reserved credits
  stated separately (`balance` already excludes them), and the two ways to buy
  side by side. Both columns print the same derived number — price per credit —
  and the plan's is the lower one, said out loud as "save N% per credit"
  against the best package. Loading, empty and failed are three different
  screens on both reads, and a wallet outage does not take the way to buy
  credits down with it. `antd` and `@stapel/tokens-antd` are OPTIONAL peers;
  the main entry stays visual-opinion-free and antd-free.
- `packageOffer` / `planOffer` / `bestPerCredit` / `perCreditSavingsPercent`
  and the `Intl` formatters are exported from the main entry, for a host that
  draws its own shop: the comparison is business logic, not styling. It refuses
  to divide by zero credits and refuses to compare across currencies.
- New wire types `CreditLot`, `CreditHold`, `ExpiringCredits` (+ the
  `CreditLotSource` / `CreditHoldStatus` narrowings), and ru/en copy for every
  new key.
