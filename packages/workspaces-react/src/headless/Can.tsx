import type { ReactNode } from "react";
import { useCapabilities } from "../model/queries.js";

/** Render-prop bag for {@link Can}'s function-children variant. */
export interface CanBag {
  /** The wildcard-aware verdict for `capability` in `workspaceId`. */
  readonly allowed: boolean;
  /** The underlying read is still in flight (verdict is `false` meanwhile —
   * deny-by-default; render a skeleton off this if flicker matters). */
  readonly isLoading: boolean;
}

/**
 * Capability gate (org-program §A2) — the mandate model's UI affordance:
 *
 * ```tsx
 * <Can capability="meetings.spotlight" workspaceId={wsId}>
 *   <SpotlightButton />
 * </Can>
 * // or the render-prop variant, when "disabled" beats "hidden":
 * <Can capability="members.invite" workspaceId={wsId}>
 *   {({ allowed }) => <Button disabled={!allowed}>…</Button>}
 * </Can>
 * ```
 *
 * Reads the caller's `my_capabilities` from the workspace detail
 * ({@link useCapabilities}) and matches with the backend's ported wildcard
 * matcher (`*` / `prefix.*`). Deny-by-default: nothing renders (or
 * `allowed: false`) while loading, on error, for a non-member, or against a
 * pre-0.6 backend. UI convenience ONLY — the backend re-checks every
 * capability on every operation; hiding a button is not access control.
 */
export function Can(props: {
  /** Namespaced capability string, e.g. `"meetings.spotlight"`. */
  capability: string;
  workspaceId: string;
  /** Static children render when allowed; function children always render,
   * receiving the {@link CanBag}. */
  children: ReactNode | ((bag: CanBag) => ReactNode);
  /** Rendered when the verdict is a definite "no" (static children only). */
  fallback?: ReactNode;
}): ReactNode {
  const caps = useCapabilities(props.workspaceId);
  const allowed = caps.can(props.capability);
  if (typeof props.children === "function") {
    return props.children({ allowed, isLoading: caps.isLoading });
  }
  return allowed ? props.children : (props.fallback ?? null);
}
