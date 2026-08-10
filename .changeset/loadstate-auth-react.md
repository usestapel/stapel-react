---
"@stapel/auth-react": minor
---

Security skins no longer render a failed read as an empty one: the sessions,
passkeys, connected-accounts, password-methods and audit-log surfaces render
through `matchList`, so "there is nothing here" is reachable only from a load
that actually succeeded, and a failure states itself with a retry. A failed
capabilities read also keeps the "Connected accounts" section instead of
deleting it, and OAuth "Connect" now prints its blocked reason as visible text
(`useActionGate`) rather than a tooltip on a disabled button.
