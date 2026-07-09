---
"@stapel/recordings-react": minor
---

Track stapel-recordings 0.2.x (scheme B — the pair's minor follows the backend
minor). Regenerated from the `v0.2.1` contract and surfaced the workspace list
filter:

- **`useRecordings(params?)`** now accepts an optional `RecordingListParams`
  (`{ workspaceId }`). With no params it lists the caller's own recordings; with
  `workspaceId` it lists every recording in a workspace the caller is a member
  of (a non-member read fails `error.403.recording_workspace_forbidden`). Backed
  by `RecordingsApi.listRecordings(params?)` sending `?workspace_id=`, and the
  list query key now carries its params so own vs per-workspace views cache
  distinctly. `<RecordingList>` gained a matching optional `workspaceId` prop.

The regenerated schema also carries the new `resource_key` field on a recording
and the optional `filename` on an upload session. `source_type` stays an opaque
`string` — the new `SOURCE_TYPES` backend merge-registry is deploy-configurable,
so the client does not narrow it. Two new error codes are mapped
(`recording_workspace_forbidden` 403, `recording_unsupported_media` 415).
`backend.contract` is now `>=0.2 <0.3`.
