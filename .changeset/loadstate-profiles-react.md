---
"@stapel/profiles-react": minor
---

A read that failed no longer renders as a read that came back empty: `ConnectionList`'s bag hands out `state: LoadState<readonly string[]>` (plus a `count` that is `undefined` until the read lands) instead of a pre-flattened `ids`/`isLoading`/`isError`/`error`, and the `LanguageSettings`, `ProfileSettings` and `InitialSetupModal` skins render their catalogue/field-manifest lists through `matchList` — a failed language catalogue now shows the failure and a retry instead of degrading the picker to a single raw language code and deleting the "languages you understand" block.

`InitialSetupModal`'s Save no longer greys out without saying why: the blank-display-name case states its reason as visible text through `useActionGate` (new key `profiles.initialSetup.blocked.name_required`), while the in-flight save keeps its plain spinner-disable.
