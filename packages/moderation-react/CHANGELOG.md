# @stapel/moderation-react

## 0.1.2

### Patch Changes

- f79bdc3: tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

  `GatedControl` handed callers `bind.disabled` and its own JSDoc told them to spread it straight onto the control. That produced an html-`disabled` element, which fires no events in any browser: it cannot be clicked, cannot take focus, cannot be described to a screen reader that never reaches it, and cannot carry the one gesture that mattered — the tap that should open the sign-in door standing behind the gate. Every gated control across the ~20 pairs using it was inert, and the wrong instruction was half the defect: the docs taught the shape that broke it.

  Measured on a live deployment: an anonymous visitor taps the favourite heart and nothing happens at all — no sentence, no tooltip, no door (walker defects D45/D72).

  **The corrected contract.** While the gate is shut a control is now `aria-disabled="true"` and NOT html-disabled, so it stays focusable and keeps receiving events. The ACTION is suppressed by `GatedControl` itself, in a capture-phase wrapper (`display: contents`, so no pair's layout moves by a pixel): the caller's `onClick`, keyboard activation, typing, IME input, paste and drop are swallowed before the control sees them. Callers write their handlers exactly as if the gate did not exist. The activation comes back as the new `onBlockedActivate`, which is where a pair opens its door. The reason stays where it was — visible text wired by `aria-describedby` — and where a `PaneGate` pools it into one footnote, the gesture now brings a `role="status"` copy of the sentence back to the control it belongs to. A blocked `GatedButton` keeps antd's exact disabled paint (its own `-disabled` class, which sets no `pointer-events`), so nothing about any screen looks different.

  `GatedControlProps.whenBlocked` holds the two deliberate opt-outs, neither of them the default:

  - `"inert"` — html `disabled`, for the rare control that must be switched off at the browser level. `attributes-react`'s catalogue lock is the one place in the fleet that asks for it, and now says so.
  - `"annotate"` — the control stays fully usable and only gains the sentence, for a gate that judges the VALUE rather than refusing the person: `calendar-react`'s slot-length field must stay editable, because editing it is how the reason goes away, and `search-react`'s sort must still pick the options that are not the blocked one.

  `useBlockedButtonClassName()` is exported for render-prop call sites that paint their own button and want the same unavailable look rather than a second grey.

  **⚠️ The readiness-signal hazard, and its cure.** `element.disabled` is now permanently `false` on every gated control in the fleet. Any test using it as a readiness signal — `await waitFor(() => expect(save.disabled).toBe(false))`, meaning "wait until this is allowed" — returns instantly and mis-times SILENTLY: every assertion after it reads an unseeded component, and the failure looks like broken product logic rather than a gate that had not opened. One pair's suite went green → 21 failures across unrelated files on exactly this. Wait on the stamp instead, which is what such a wait was always asking:

  ```ts
  await waitFor(() =>
    expect(
      screen.getByTestId("save-gate").getAttribute("data-stapel-gated")
    ).toBe("available")
  );
  ```

  `data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

  **ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

  **The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.

## 0.1.1

### Patch Changes

- f9d8b66: Console fits a phone: the state `Segmented` scrolls inside its own box instead of dragging the page to 668px in a 390px viewport, the five filter fields collapse behind one "Filters" control below the table breakpoint, and the appeals filter leaves the card header (which never shrinks). The case card leads with the reported item's own title and keeps the lease acts pinned to the top of the sheet's scroll box; the lease is a sentence rather than a mislabelled field, an unresolvable holder is named as "another moderator" instead of a raw id, and report counts go through ICU plurals.

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
