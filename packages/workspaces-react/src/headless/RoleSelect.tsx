import type { ReactNode } from "react";
import { useI18n } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { RoleInfo } from "../api/types.js";
import { useRoles } from "../model/queries.js";

/** Render-prop bag for {@link RoleSelect}. */
export interface RoleSelectBag {
  /** The effective registry (GET /roles): builtin four + the deployment's
   * overlay, rank-descending. Empty while loading. */
  readonly roles: readonly RoleInfo[];
  /**
   * Display label for a role key: the i18n key `workspaces.role.<key>` when
   * the current locale's merged bundle carries it (the pair ships the builtin
   * four; a client bundle merges its own — e.g. `workspaces.role.secretary`),
   * else the RAW role key. The raw-name fallback is deliberate: a
   * deployment-defined role without a translation must still be pickable,
   * never render as a dotted i18n key.
   */
  labelFor(role: string): string;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * Headless role picker over the effective role registry (org-program §A2) —
 * the component that lets role UI stop hardcoding the builtin four. Bring
 * your own `<Select>`:
 *
 * ```tsx
 * <RoleSelect>
 *   {({ roles, labelFor }) => (
 *     <Select options={roles.map((r) => ({ value: r.role, label: labelFor(r.role) }))} />
 *   )}
 * </RoleSelect>
 * ```
 *
 * `owner` is in the registry too — filter it out where "only an owner grants
 * owner" applies (the backend enforces regardless).
 */
export function RoleSelect(props: {
  children: (bag: RoleSelectBag) => ReactNode;
}): ReactNode {
  const query = useRoles();
  const i18n = useI18n();
  // Raw bundle lookup, NOT `t()`: `t` falls back to the key itself, which is
  // exactly the wrong fallback here (a deployment role without a translation
  // must show its raw name, not `workspaces.role.secretary`).
  const bundle = i18n.getBundle();
  return props.children({
    roles: query.data ?? [],
    labelFor: (role) => bundle[`workspaces.role.${role}`] ?? role,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  });
}
