/**
 * The phase → i18n key table, in one place so both skins say the same thing
 * about the same step, and so a new phase cannot be added without a sentence
 * (the record is exhaustive over `UploadPhase`; a missing arm does not
 * compile).
 */
import type { CSSProperties } from "react";
import type { StatusFamily } from "@stapel/tokens-antd/skin";
import type { UploadPhase } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";

export const PHASE_KEYS: Record<UploadPhase, string> = {
  idle: CDN_I18N_KEYS.phaseQueued,
  hashing: CDN_I18N_KEYS.phaseHashing,
  checking: CDN_I18N_KEYS.phaseChecking,
  uploading: CDN_I18N_KEYS.phaseUploading,
  processing: CDN_I18N_KEYS.phaseProcessing,
  done: CDN_I18N_KEYS.phaseDone,
  canceled: CDN_I18N_KEYS.phaseCanceled,
  failed: CDN_I18N_KEYS.phaseFailed,
};

/**
 * The phase → status FAMILY table. A phase badge names the family the step
 * belongs to and lets `StatusTag` pick the colour from the theme's status
 * roles; picking a colour per word here is the fleet-wide defect that
 * component exists to end. Exhaustive over `UploadPhase` for the same reason
 * as {@link PHASE_KEYS} — a new phase cannot arrive without a family.
 */
export const PHASE_FAMILY: Record<UploadPhase, StatusFamily> = {
  idle: "neutral",
  hashing: "info",
  checking: "info",
  uploading: "info",
  processing: "info",
  done: "success",
  canceled: "neutral",
  failed: "error",
};

/**
 * The tile geometry, shared by both skins. Fixed box + `object-fit: cover`,
 * because a grid whose rows resize as each thumbnail decodes is the layout
 * shift `@stapel/image` exists to prevent — and here there is no aspect ratio
 * to work from until the row comes back.
 */
/**
 * The tile side, in CSS pixels. A one-off geometry rather than a spacing step:
 * it is the size of a photograph in a grid, not a gap between two things, and
 * it is named here so the next person changes it in ONE place — which is what
 * the raw-dimension rule asks for when a number is genuinely not on the scale.
 */
export const PREVIEW_TILE_PX = 96;

/** The tile's corner, matching the skin's small radius. */
export const PREVIEW_TILE_RADIUS_PX = 4;

export const PREVIEW_BOX: CSSProperties = {
  width: PREVIEW_TILE_PX,
  height: PREVIEW_TILE_PX,
  objectFit: "cover",
  borderRadius: PREVIEW_TILE_RADIUS_PX,
  display: "block",
};

/**
 * The GALLERY's box, which is the cell rather than a constant.
 *
 * A single-slot field (`<ImageUploadField/>`) has one preview and it is 96px
 * — {@link PREVIEW_BOX} above. A gallery is a GRID, and a grid whose pictures
 * are 96px stamps floating in whatever room the column actually has is what
 * the demo showed: one small thumbnail alone in a full-width dashed box. So
 * the gallery's picture fills its cell and stays square by its own ratio, and
 * {@link PREVIEW_TILE_PX} becomes the cell's FLOOR instead of its size.
 *
 * `object-fit: cover` is what makes the square honest for a photograph of any
 * shape: the frame is the grid's, the crop is the picture's.
 */
export const PREVIEW_CELL_BOX: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: PREVIEW_TILE_RADIUS_PX,
  display: "block",
};
