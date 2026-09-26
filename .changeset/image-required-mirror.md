---
"@stapel/listings-react": patch
---

The mirror states the deployment's photo requirement (`requireImageOnPublish`, default on) under `images`: the server's refusal of a photo-less publish is a flat `publish_validation_failed` with no field, which left the composer saying "check the highlighted fields" with nothing highlighted. The gate now names the gallery, and a host's reveal can land on it.
