# @stapel/moderation-react

## 0.1.0

### Minor Changes

- 80617e9: The moderation pair, contract layer AND default skin: a person can report
  content, appeal a decision and read the rules; a moderator can triage, decide
  and sanction — all from screens this package ships.

  **Contract layer.** All eighteen operations of stapel-moderation 0.3.0, with the
  trailing slash the URL conf makes load-bearing (user routes carry one, console
  routes do not — `APPEND_SLASH` only rescues a GET, and only by dropping the
  body); every path string pinned by `test/contract.test.ts`. `content` is typed
  from the contract: 0.3.0 made it a declared `ContentDTO` field of the case card,
  so the hand-written `CaseDetail & { content }` this pair was specced to carry
  never had to exist. The vocabularies (`src/api/enums.ts`) are hand-mirrored from
  `models.py` because DRF types every one of them as a bare `string`, and a test
  re-reads the sibling's source so the mirror cannot drift silently. The keyset
  cursor is derived from the page (`nextBefore`) — core's client cannot expose the
  response header that carries it, and deriving it is strictly better, because the
  backend sets that header on the last page too.

  **Refusals are read by code, never by status.** Four different 403s are four
  different sentences; `case_claimed` and `case_resolved` share a status while
  meaning "wait" and "there is nothing left to do". 0.3.0's three newly reachable
  codes are named: a decided appeal is `409 moderation_appeal_resolved` (not the
  old `400 invalid_outcome`), `moderation_reason_not_applicable` is a stale form
  rather than client nonsense, and `moderation_not_claimant` is somebody else's
  lease.

  **Default skin — `./default`:** `ReportButton` (the embeddable slot other pairs
  mount; no nav entry, because it is a control with a target rather than a
  screen), `ReportSheet` (a bottom sheet on a phone; the description box is always
  visible and only its REQUIREMENT moves with the reason; the Art. 15(1)(e)
  screening notice is rendered from the policy, so a deployment that screens
  nothing does not claim to), `AppealPanel` (whose no-link arm EXPLAINS that an
  appeal needs the reference from the notification — no endpoint lets a subject
  list decisions about themselves — instead of drawing a composer that could never
  submit) and `PolicyDisclosurePane` (Art. 15, computed from the live
  configuration rather than written).

  **Default skin — `./default/admin`** (a new subpath, so a storefront bundle
  never carries the console): `ModerationQueue` (keyset paging, filters, counters;
  a table where there is room and cards where there is not, decided by the
  ELEMENT's width rather than the viewport's; the mandate 403 is NAMED, because
  the nav surface axis has no "staff" value and a container will route an ordinary
  member here), `CaseDetail` (the `ContentDTO` card that draws a failed content
  read as a failed read — a moderator must never be handed an empty box that looks
  like empty content — the reports/verdicts/sanctions/appeals/history trail, and
  claim/extend/release/rescan each gated by the lease the server enforces
  silently) and `AppealsQueue`. Verdict and sanction controls are
  `ActionAvailability` gates with the reason beside the control, and a verdict that
  also sanctions an author goes through `SkinConfirm` whose button names what it
  does.

  **Also:** five headless bags (`useReport`, `useReportPolicy`, `useAppeal`,
  `useModerationQueue`, `useCase`, `useAppealsQueue`) that hand out those same
  gates, so a host writing its own skin inherits the reasons and not just the
  booleans; four nav entries (`moderation.policy` public, `account.appeals` under
  `account.root`, `admin.moderation` + `admin.moderation-appeals` under
  `admin.root`); demos for all seven skin components with phone variants; 97 tests
  including every surface rendered at phone and desktop width in light and dark.

  **Breaking (pre-1.0, hence minor):** the scaffold's `ModerationPanel` is gone
  from `./default` — it was a placeholder card, and the screens above replace it.

  **Fixed:** this pair's `toFlowError` is now idempotent. A flow machine's
  `refused` state carries a `FlowError`, and core's fold only recognises
  `StapelApiError` — so folding one a second time erased the code and every
  refusal predicate downstream of a machine answered `false`. Filed for core.

  **271 keys in en, ru and es**, plus the generated 70-code backend error
  catalogue in all three.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
