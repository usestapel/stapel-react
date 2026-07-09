---
"@stapel/profiles-react": patch
"@stapel/notifications-react": patch
"@stapel/billing-react": patch
"@stapel/workspaces-react": patch
"@stapel/calendar-react": patch
"@stapel/recordings-react": patch
---

Zero-flow scaffolding removed (slim wave §21/S3). These six backends annotate
no `@flow_step`, so `gen:flows` now skips emission for them and the pair's
`src/flows/generated/` files are gone. The public flow surface is preserved
exactly by a tiny hand-written shim (`src/flows/registry.ts`): `<MOD>_FLOWS`
(still `{}`), `<Mod>FlowId`/`<Mod>FlowSpec` (still `never`), `FlowEndpoint`,
and `flowEndpoints` keep their names, types, and behavior. `toFlowError` and
the core flow-machine re-exports are untouched. No public-surface delta; the
generated registry returns automatically once the backend documents its first
flow.
