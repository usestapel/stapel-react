---
"@stapel/auth-react": patch
---

**Manifest `hooks` section** (frontend-core-architecture §2.4 — the manifest
promised a query-hook catalog; now it ships one). `gen:manifest` statically
projects the model layer's exported `use*` hooks into `manifest.hooks`: each
entry carries its `kind` (`query`/`mutation`), the operation(s) it calls
(`api.*`/`session.*`), and — resolved against the key factory — the literal
`queryKey` for queries (e.g. `useCapabilities → ["auth","capabilities"]`) or the
key arrays a mutation `invalidates`. So an agent finds "the hook to read this
resource" and "what a write refreshes" without reading the source, and review
can confirm the SDK's hooks were used, not a hand-rolled `useQuery`. llms.txt
gains a compact hooks list (still within the ≤4000-token budget, ~3510). Extraction
knobs mirror the existing `MANIFEST_*` family (`MANIFEST_MODEL_DIR`,
`MANIFEST_QUERYKEYS_FILE`); a pair without a model dir degrades to an empty
section. Drift-gated like every other manifest section (`pnpm gen:manifest:check`).
