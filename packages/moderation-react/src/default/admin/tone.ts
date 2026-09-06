/**
 * The one mapping from a case state to an antd semantic preset.
 *
 * It lives in its own module because two screens read it — the queue and the
 * dead-letter park — and a second copy is how `dlq` ends up wearing the
 * queue's warning colour on one of them. antd presets only: a queue state is
 * operational, not decorative.
 */
import type { CaseState } from "../../api/enums.js";

export const STATE_TONE: Readonly<Record<CaseState, string>> = {
  open: "processing",
  screening: "processing",
  queued: "warning",
  claimed: "default",
  // Not `warning`: a dead letter is not a heavier queue item, it is a broken
  // seam, and the console must not let the two read as the same severity.
  dlq: "error",
  resolved: "success",
};
