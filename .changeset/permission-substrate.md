---
"@stapel/core": minor
"@stapel/tokens-antd": minor
---

**A browser permission is now asked for once, in one place, by the substrate.** `usePermission(kind)` in `@stapel/core`; `PermissionSheet` and `PermissionGate` in `@stapel/tokens-antd/skin`.

A permission prompt is a single line the product cannot write, fired once, with no second chance: *"example.com wants to use your location"*, Allow / Block. Everything that makes it answerable — why we are asking, what happens if you say no, and where the switch is once you have — has to be said BEFORE it, by us. Fire it cold on page load and it is refused by reflex, and a refusal is **permanent**: the browser will not ask again, however many times the button is pressed.

Nothing in the fleet held any of that. The only permission-aware code that existed was geo-react's `useBrowserPosition`, which owned one kind and one of its four refusals; a chat pair wanting `notifications`, a composer wanting `camera`, a recorder wanting `microphone` each had a `try { … } catch { }` and its own guess about what the catch meant.

**`usePermission(kind)` — `@stapel/core`, headless.** `geolocation` / `camera` / `microphone` / `notifications`, as five states rather than a boolean:

- `granted` — use it.
- `prompt` — not asked yet. Explain first. **Not a refusal**; a product that renders it as one shows an error to somebody who has simply never been asked.
- `denied` — refused, and terminal. Say where the switch is; offer the way that does not need the capability.
- `unknown` — the browser will not say in advance (Safari answers `navigator.permissions.query({name: "camera"})` with a `TypeError`; Firefox knows `geolocation` and `notifications` and not the media pair). Ask and find out — a different state from `prompt`, because it cannot be pre-flighted.
- `unsupported` — no such capability here (old browser, insecure context, no camera on the device), or the DEPLOYMENT turned the offer off with `offered: false`. Render the fallback, not a disabled control: there is nothing the person can do about it.

Three details the four ad-hoc copies each got differently. `request()` **resolves** with the resulting status and never rejects, because every caller of it is inside a click handler. Notifications are read off `Notification.permission` rather than the Permissions API — synchronous, older, and the one kind whose answer is reliably available everywhere. And there is no "request permission" API for geolocation or media: the prompt appears because you asked for a position or a stream, so `options.requester` lets a caller that already makes that call pass its own, and the browser is asked **once** instead of twice. Without one, the hook makes the smallest call that provokes the prompt — and stops the media tracks afterwards, because the prompt was the point and a live track leaves the recording indicator on.

**`PermissionSheet` / `PermissionGate` — `@stapel/tokens-antd/skin`.** The pre-prompt is a `SkinDialog`, so it is a bottom sheet on a phone and a modal above it without this file choosing. The way out says "Not now", not "Deny" — the browser has not been asked yet and the button must not read like an answer to it.

The refusal is handled in the same surface: on `denied` the sheet does **not** close onto a dead end. It swaps to the guidance for turning the capability back on and renders the `fallback` — the way forward that does not need it (a search field where the position would have been, an upload button where the camera would have been). The Allow button is **gone** rather than disabled: `GatedControl`'s rule about showing a blocked control's reason is for gates the person can open, and this one they cannot, from here.

`PermissionGate` is the whole ask as one element — trigger, pre-prompt, granted content, fallback — and `askOnMount` is **off** by default, because a question nobody invited is the thing this component exists to stop.

Copy: core's UI floor gains `PERMISSION_COPY_KEYS` — a title, a why and a denied-guidance sentence per kind, in en/ru/es, seeded under every locale by `createI18n`. A pair gets an answerable question with zero wiring; a product with a better sentence passes a prop or registers the same key. The token bridge still invents no English of its own.

Both size budgets moved deliberately and the reason is recorded in `package.json`: core 12 → 13.5 KB (12.6 KB actual), and the skin subpath stays under its 16 KB at 9.1 KB.

Exported for the chat wave: `usePermission`, `PERMISSION_KINDS`, `permissionSupported`, `PERMISSION_COPY_KEYS` from `@stapel/core`; `PermissionSheet`, `PermissionGate`, `permissionIsBlocked`, `PERMISSION_ALLOW_TESTID`, `PERMISSION_DISMISS_TESTID` from `@stapel/tokens-antd/skin`.
