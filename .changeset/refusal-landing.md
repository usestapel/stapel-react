---
"@stapel/core": minor
"@stapel/forms-react": patch
---

`useRevealOnRefusal` (`@stapel/core/reveal`): when a field is newly refused — a submit the server answered with field errors, or the client's own blank-mandatory refusal — the first refused field is revealed (scrolled clear of bars, focused, announced). Clearing errors while typing never moves the caret. `<StapelForm>` lands on the first refused field through it.
