---
"@stapel/recordings-react": patch
---

Nav manifest: `recordings.detail` mounts at `:recordingId` relative to its parent (was `recordings/:recordingId`, which composed to an unreachable `recordings/recordings/:recordingId`).
