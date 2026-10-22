---
"@stapel/auth-react": minor
---

`<AccountMenu/>` in `/default`: the top-bar account control (signed-in identity, "Account" when `onOpen` is given, sign-out). Offered as the `auth.account_menu` embed on `topbar.end` (member, order 90, opens `account.root`), so a scaffolded shell places it from the manifest. Renders nothing signed out; `onSignedOut` fires after the logout settles even though the menu unmounts with the session.

The `@stapel/core` peer floor rises to `>=0.30.0` (the manifest imports `NavEmbed`).
