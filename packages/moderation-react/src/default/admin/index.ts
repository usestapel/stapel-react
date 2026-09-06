/**
 * `@stapel/moderation-react/default/admin` — the MODERATOR console.
 *
 * A subpath of its own, so a storefront bundle never carries the queue, the
 * case card or the appeal desk. A member-facing app imports `./default` and
 * pays for the report button and the appeal page; only an admin container
 * reaches in here.
 *
 * The one refusal these screens all share is `isStaffOnly`: the nav surface
 * axis has `public | member` and cannot say "staff", so a container may route
 * an ordinary member to them and each screen names the refusal itself.
 *
 * `<DlqQueue>` is exported beside `<ModerationQueue>` — which already mounts
 * it as its second tab — because it is not a moderator's screen at all: a
 * deployment that puts the dead-letter park on an operations dashboard rather
 * than beside the queue should be able to, without dragging the queue along.
 */
export { ModerationQueue } from "./ModerationQueue.js";
export type {
  ModerationQueueProps,
  ModerationQueueTab,
} from "./ModerationQueue.js";
export { DlqQueue } from "./DlqQueue.js";
export type { DlqQueueProps } from "./DlqQueue.js";
export { CaseDetail } from "./CaseDetail.js";
export type { CaseDetailProps } from "./CaseDetail.js";
export { AppealsQueue } from "./AppealsQueue.js";
export type { AppealsQueueProps } from "./AppealsQueue.js";
