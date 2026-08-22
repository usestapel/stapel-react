/**
 * `@stapel/cdn-react/default` — the opt-in antd skin for this pair (mirrors
 * auth-react's `/default` split, §54): a separate entry point so consumers who
 * bring their own visuals never pull `antd` into their bundle; importing this
 * subpath is the opt-in.
 *
 * ```tsx
 * import { ImageUploadField, MediaGalleryField } from "@stapel/cdn-react/default";
 * ```
 */
export { ImageUploadField } from "./ImageUploadField.js";
export type { ImageUploadFieldProps } from "./ImageUploadField.js";
export { MediaGalleryField } from "./MediaGalleryField.js";
export type { MediaGalleryFieldProps } from "./MediaGalleryField.js";
