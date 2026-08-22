import type { ReactNode } from "react";
import type { CdnUploadTarget } from "../model/upload.js";
import { useUploadImage } from "./useUploadImage.js";
import type { UploadImageBag } from "./useUploadImage.js";

/**
 * Headless single-image upload — the avatar/cover shape, where a new pick
 * replaces the previous one.
 *
 * ```tsx
 * <ImageUpload target={{ kind: "avatar" }}>
 *   {({ upload, previewUrl, phase, error }) => <YourPicker … />}
 * </ImageUpload>
 * ```
 */
export function ImageUpload(props: {
  target?: CdnUploadTarget;
  children: (bag: UploadImageBag) => ReactNode;
}): ReactNode {
  const bag = useUploadImage(
    props.target !== undefined ? { target: props.target } : {}
  );
  return props.children(bag);
}
