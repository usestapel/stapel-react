---
"@stapel/workspaces-react": minor
---

`<WorkspaceSwitcher/>` in `/default`: the top-bar select over `WorkspaceSelection` (the one selection the workspace screens read). Offered as the `workspaces.switcher` embed on `topbar.start` (member, order 10). Loading is a disabled select, a failed list is a retry (never an empty select), and with no workspace or no selection provider it renders nothing.

The `@stapel/core` peer floor rises to `>=0.30.0` (the manifest imports `NavEmbed`).
