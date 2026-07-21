---
"@stapel/profiles-react": minor
---

Avatar now renders through `<Image>` from `@stapel/image`, driven by the backend's `avatar_image` descriptor.

`ProfileSettings` reads the source-agnostic `StapelImage` that stapel-profiles ≥0.6.0 denormalizes onto `/me` (`avatar_image`), and renders it with `<Image>` — the right ladder tier picked from the measured slot × DPR × aspect, plus blur-up — for a CDN / plain-file / external-link avatar alike. A fresh upload still shows its local preview immediately; the `avatarUrlFor` host hook stays as a deprecated fallback for hosts that haven't upgraded the backend. Adds `@stapel/image` as a peer dependency. Pin bumped to stapel-profiles v0.6.0 with the API client regenerated in the same change.
