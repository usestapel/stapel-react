---
"@stapel/core": minor
---

`LinkComponentProps` takes `aria-hidden` and `tabIndex`.

A skin sometimes renders a SECOND link to a destination the surface already names — a card whose picture and whose title both open the same listing. That is one target to a person using a mouse and two announcements to a person using a screen reader, and a grid of twenty-four cards grows twenty-four extra tab stops for nothing. Both properties are how a host's `<Link>` is told which of the two it is; the contract could not express either.
