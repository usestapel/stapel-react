---
"@stapel/recordings-react": minor
---

Track stapel-recordings 0.3.x (scheme B — the pair's minor follows the backend
minor; contract pin bumped to the `0.3.1` HEAD). Regenerated from the updated
contract, which adds:

- **`POST /recordings/{id}/reprocess`** — re-runs the whole pipeline for a
  `completed` recording (`pipeline.reprocess_recording`; any other status is a
  no-op `error.409.recording_invalid_state`). Not yet wired to a hook/method in
  this pair (follow-up); the generated schema/error map carry it.
- **`?resource_key=`** on the recordings list — narrows to the single recording
  an opaque resource key references (a missing/forged key yields an empty
  list). Additive to `RecordingListParams`'s existing `workspaceId` filter, not
  yet exposed as a typed param (follow-up).

Both are additive to the wire contract — no existing type or hook signature
changed. `backend.contract` is now `>=0.3 <0.4`.
