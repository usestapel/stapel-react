---
"@stapel/eslint-plugin": minor
---

Doctrine tier: nine new rules, one extended, and a `strict` preset.

The design rulings the fleet kept re-taking by hand are now stated mechanically.
New rules: `no-tooltip-in-skin` (touch has no hover, and a disabled antd Button
never fires the events a tooltip needs), `icon-button-needs-label` (its other
half — removing the hover without adding a name leaves the control unnamed),
`no-hardcoded-theme-mode` and `no-local-skin-theme` (CF-1: three `mode = "light"`
defaults rendered light inputs under `data-theme="dark"`, and nine pairs carry a
copy of the same `theme.tsx`, so the fix has to land nine times),
`no-raw-dimensions` (**autofixable** — `padding: 16` → `spacing[4]`, import
written too — the px twin of `no-raw-colors`), `i18n-locale-parity` (missing
locale files and untranslated copies, anchored on each pair's `src/i18n/keys.ts`
so it runs with zero per-pair wiring), `no-adhoc-socket` (one socket client for
the fleet; the TS twin of core's RT001-RT003), `no-silent-slot` (an unfilled slot
renders a hole, and a hole looks like a finished page), and `no-boolean-disabled`
(a grey button with no reason — heuristic, with its limits documented in the
rule header). `no-bare-dialog` gains the confirm surface (`Popconfirm` →
`SkinConfirm`).

Wiring: the tier ships at **`warn`** in `recommended` — a worklist, so `eslint .`
stays green while the pairs migrate — and at **`error`** in the new
`strict` preset, which a pair opts into once its migration has landed. `strict`
is built by appending to `recommended`, so the two cannot disagree about a
carve-out. Two lines marked `← WAVE-B SWITCH` in `index.js` flip the tier to
`error` and enable the confirm surface when the wave is done.
