/**
 * `@stapel/recordings-react/default` — the SHIPPED recordings screens (§54:
 * headless AND a default skin for every primitive; §83: the default skin is
 * the product).
 *
 * Opt-in on its own subpath so the headless entry stays free of antd: a host
 * that brings its own design system never loads a byte of this.
 *
 * There is no local `theme.tsx` and no local `ErrorAlert` here on purpose —
 * both come from `@stapel/tokens-antd/skin`, which is where the fleet's
 * theming, dialog-surface, state-arm and gate rules are stated once. A dialog
 * in this package is a bottom sheet on a phone because `SkinConfirm` says so,
 * not because this package decided it again.
 */
export { RecordingsList } from "./RecordingsList.js";
export { RecordingStatusChip } from "./RecordingStatusChip.js";
export { RecordingUploader } from "./RecordingUploader.js";
export { RecordingDetailPane } from "./RecordingDetailPane.js";
export { RecordingPlayer } from "./RecordingPlayer.js";
export { TranscriptPane } from "./TranscriptPane.js";
export { SummaryPane } from "./SummaryPane.js";
export { ResummarizeAction } from "./ResummarizeAction.js";
export { ReprocessAction } from "./ReprocessAction.js";
export { PaymentRequiredNotice } from "./PaymentRequiredNotice.js";
export { SharedRecordingView } from "./SharedRecordingView.js";
export { ShareUnlockGate } from "./ShareUnlockGate.js";
export { SharedMedia } from "./SharedMedia.js";
export { useMediaSync } from "./useMediaSync.js";
export type { MediaSync } from "./useMediaSync.js";
export { PAGE_MEASURE } from "./layout.js";
