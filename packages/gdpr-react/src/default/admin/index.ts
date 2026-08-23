/**
 * `@stapel/gdpr-react/default/admin` — the antd skin for the screens an
 * OPERATOR sees.
 *
 * Its own entry point, one subpath past `/default`, for the same reason
 * `/default` is separate from the headless main entry: a page where a person
 * deletes their own account has no business carrying a DSAR queue and an
 * owner-liveness table in its bundle. size-limit gates the three entries
 * separately, so the split cannot quietly stop being true.
 *
 * ```tsx
 * import { PrivacyAdminPane } from "@stapel/gdpr-react/default/admin";
 * ```
 */
export { DsarQueue } from "./DsarQueue.js";
export type { DsarQueueProps } from "./DsarQueue.js";
export { OwnersHealth } from "./OwnersHealth.js";
export type { OwnersHealthProps } from "./OwnersHealth.js";
export { PrivacyAdminPane } from "./PrivacyAdminPane.js";
export type { PrivacyAdminPaneProps } from "./PrivacyAdminPane.js";
