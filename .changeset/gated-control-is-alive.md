---
"@stapel/tokens-antd": minor
"@stapel/attributes-react": patch
"@stapel/billing-react": patch
"@stapel/calendar-react": patch
"@stapel/moderation-react": patch
"@stapel/notifications-react": patch
"@stapel/search-react": patch
"@stapel/tasks-react": patch
"@stapel/workspaces-react": patch
---

tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

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
  expect(screen.getByTestId("save-gate").getAttribute("data-stapel-gated")).toBe("available")
);
```

`data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

**ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

**The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.
