---
"@stapel/profiles-react": patch
"@stapel/notifications-react": patch
"@stapel/billing-react": patch
"@stapel/workspaces-react": patch
"@stapel/calendar-react": patch
"@stapel/recordings-react": patch
---

Internal plumbing swap (slim wave §21/S2) — the pair's stamped
`model/runtime.ts` / `model/context.tsx` / `headless/<Mod>Provider.tsx`
boilerplate (byte-identical across the six standard pairs) now binds
`@stapel/core`'s `createModuleRuntime` / `createModuleContext` factories
instead of carrying its own copy. Public API preserved exactly: same exported
names and signatures (`create<Mod>Runtime`, `<Mod>Runtime`,
`Create<Mod>RuntimeOptions`, `<Mod>RuntimeContext`, `use<Mod>Runtime`,
`use<Mod>Api`, `use<Mod>Analytics`, `<Mod>Provider>`), same guard-hook error
messages. No behavior change.
