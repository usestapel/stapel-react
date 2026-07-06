---
"@stapel/auth-react": patch
---

Harden the shared codegen drivers so a pair with **no** annotated flows
scaffolds and builds (arch-npm-pairs prep) — auth output stays equivalent.

- **`scripts/gen-flows.mjs`** — the emitted `flowEndpoints` now guards the
  empty-registry case. For a module the backend has not yet annotated with
  `@flow_step`, `<Module>FlowId` is `never` and `<MODULE>_FLOWS` is `{}`, so the
  old `REGISTRY[id].steps.flatMap(...)` body did not type-check and reddened a
  fresh pair's build. The body now widens to an optional spec
  (`REGISTRY[id] as {…} | undefined`) and returns `[]` when absent — valid for a
  zero-flow scaffold and unchanged in behavior once the registry fills in. Auth's
  `flows.gen.ts` is regenerated; only this function body changes (equivalent).
- **`scripts/gen-manifest.mjs`** — the `llms.txt` prose and the i18n-key scan are
  no longer hardcoded to auth. The narrative's entry-point names
  (`<XProvider>`, `explainXError`, `xQueryKeys`, `registerXI18n`), the flow
  snippet, and the `x.` i18n namespace now derive from the react module slug and
  are each overridable via `MANIFEST_*` knobs (phase-1 style). The Machines
  section and the flow snippet are emitted only when the pair has flow
  factories. Auth defaults reproduce its surface: `manifest.json` is byte-identical
  and `llms.txt` differs only in the illustrative snippet (a real auth flow,
  generic comment).
