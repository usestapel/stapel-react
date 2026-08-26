---
"@stapel/eslint-plugin": patch
---

New autofixable rule `stapel/antd-alert-title`: antd 6 renamed `<Alert message>` to `<Alert title>`

A prop a major version stops reading does not fail loudly — it renders an alert
with no heading, on the one component whose entire job is to be read. Every site
is a rename, so the rule ships autofixable and at `error` in `recommended`: it
states no doctrine and has no migration to sequence, which is why it does not
join the warn-level worklist tier.

It fires only on an `Alert` imported from antd in the same file (named, aliased,
or through a namespace import), so a local or design-system `Alert` that still
takes `message` is untouched. An element that already passes `title` is reported
WITHOUT a fix — renaming would pass the same prop twice and let source order
pick the heading.
