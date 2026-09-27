---
"@stapel/cdn-react": minor
"@stapel/chat-react": minor
---

cdn-react: an image upload target names its asset type (`{ kind: "image", assetType }`), and every upload hook and component takes its target explicitly. The generic intake used to store an untyped image under whatever type came first, so gallery photos could land as avatars and miss the per-type policies (sizes, watermark). Contract moves to stapel-cdn >=0.28, which refuses an untyped image with `error.400.image_type_required` (localized in ru/es).

chat-react: `useCdnAttachmentUpload({ imageAssetType })` stores pictures and GIFs as `chat` by default (`DEFAULT_CHAT_IMAGE_ASSET_TYPE`); the type must be in the deployment's `ASSET_TYPES`. Requires @stapel/cdn-react >=0.8.0.
