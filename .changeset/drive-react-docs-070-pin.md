---
"@stapel/drive-react": patch
---

Regenerated against the stapel-docs v0.7.0 pin (one pin per module):
`socket_path` lands on the generated document schema, the error registry
grows to 85 codes (`error.400.docs_invalid_crdt_payload`), and the manifest
range becomes `>=0.7 <0.8`. No behavior change — the drive product does not
open live documents; its create surface is untouched (there is still no
`/types` listing to drive it from, and the live types exist only where the
backend's `[crdt]` extra is installed).
