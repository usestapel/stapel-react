/**
 * `@stapel/cdn-react/default` — the opt-in antd skin for this pair (mirrors
 * auth-react's `/default` split, §54): a separate entry point so consumers who
 * bring their own visuals never pull `antd` into their bundle; importing this
 * subpath is the opt-in.
 *
 * ```tsx
 * import { ImageUploadField, MediaGalleryField } from "@stapel/cdn-react/default";
 * ```
 *
 * Four surfaces, and they divide by what a person is doing rather than by which
 * endpoint is behind them: {@link ImageUploadField} is one image slot,
 * {@link MediaGalleryField} is an ordered set of them, {@link MediaUploadField}
 * is the video/document intake, and {@link MediaAttachment} is the READ side —
 * what a `<type>/<hash>` looks like to somebody who did not upload it, which is
 * what `chat-react` and `listings-react` mount.
 */
export { ImageUploadField } from "./ImageUploadField.js";
export type { ImageUploadFieldProps } from "./ImageUploadField.js";
export { MediaGalleryField } from "./MediaGalleryField.js";
export type {
  MediaGalleryFieldProps,
  MediaGalleryFieldBagProps,
  MediaGalleryFieldOwnProps,
} from "./MediaGalleryField.js";
export { CdnThumbnail } from "./CdnThumbnail.js";
export type { CdnThumbnailProps } from "./CdnThumbnail.js";
export {
  ATTACHMENT_MAX_WIDTH_PX,
  MediaAttachment,
  RESERVED_ASPECT,
} from "./MediaAttachment.js";
export type { MediaAttachmentProps } from "./MediaAttachment.js";
export { MediaUploadField } from "./MediaUploadField.js";
export type {
  MediaUploadFieldProps,
  MediaUploadKind,
} from "./MediaUploadField.js";
