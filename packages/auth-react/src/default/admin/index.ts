/**
 * `@stapel/auth-react/default/admin` — the operator console: five staff-only
 * screens over the admin half of the stapel-auth contract.
 *
 * A SEPARATE subpath from `./default` on purpose. Every endpoint behind these
 * screens answers 403 for an ordinary caller, and a consumer shipping only
 * the end-user surface (sign-in, security settings) must not pay for the
 * operator one in its bundle. The nav manifest mounts them under the shell's
 * `admin.root` container, so an ordinary user never reaches a route that can
 * only refuse them.
 *
 * ```tsx
 * import { SsoOrgsPanel } from "@stapel/auth-react/default/admin";
 * ```
 */
export { AdminAuditPanel } from "./AdminAuditPanel.js";
export { AdminUsersPanel } from "./AdminUsersPanel.js";
export { ServiceKeysPanel } from "./ServiceKeysPanel.js";
export { SsoOrgsPanel } from "./SsoOrgsPanel.js";
export { StaffRolesPanel } from "./StaffRolesPanel.js";
