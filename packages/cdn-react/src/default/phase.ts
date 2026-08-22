/**
 * The phase → i18n key table, in one place so both skins say the same thing
 * about the same step, and so a new phase cannot be added without a sentence
 * (the record is exhaustive over `UploadPhase`; a missing arm does not
 * compile).
 */
import type { CSSProperties } from "react";
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
 * The tile geometry, shared by both skins. Fixed box + `object-fit: cover`,
 * because a grid whose rows resize as each thumbnail decodes is the layout
 * shift `@stapel/image` exists to prevent — and here there is no aspect ratio
 * to work from until the row comes back.
 */
export const PREVIEW_BOX: CSSProperties = {
  width: 96,
  height: 96,
  objectFit: "cover",
  borderRadius: 4,
  display: "block",
};
