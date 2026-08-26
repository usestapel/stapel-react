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
 */
export { ModerationQueue } from "./ModerationQueue.js";
export type { ModerationQueueProps } from "./ModerationQueue.js";
export { CaseDetail } from "./CaseDetail.js";
export type { CaseDetailProps } from "./CaseDetail.js";
export { AppealsQueue } from "./AppealsQueue.js";
export type { AppealsQueueProps } from "./AppealsQueue.js";
