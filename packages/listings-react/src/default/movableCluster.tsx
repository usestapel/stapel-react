/**
 * ONE CLUSTER, TWO PLACES ON THE PAGE — the same instance, moved.
 *
 * ── The ask this answers, and why the obvious shape does not ──────────────
 *
 * A listing page wants the reader's two verbs beside the title AND in the
 * condensed bar that arrives when the title scrolls away (reference §24). A
 * host cannot do that today: `<ListingDetailPane>` mounts its cluster at
 * exactly one `actionsPlacement`, so a container that wants the second one
 * mounts a `<ListingActions>` of its own — which is a SECOND
 * `useFavoriteToggle` on one page, two hearts that agree only after a refetch,
 * and two copies of a control whose geometry this pair exists to rule once.
 *
 * The shapes that do NOT close it, stated because each looks like it would:
 *
 *   a render prop handed the cluster ELEMENT
 *       A React element is a description, not an instance. Rendered in two
 *       places it mounts twice — exactly the defect, now with the pair's name
 *       on it.
 *
 *   the host moving one element between two parents
 *       React unmounts and remounts across a parent change: the hook state
 *       goes, the DOM node is a different node, and an optimistic favourite
 *       in flight is lost mid-write.
 *
 *   two mounts kept in step by lifting the state
 *       Two controls, one state — and then the page has two `aria-pressed`
 *       hearts, two focus targets and two things for a probe to count.
 *
 * ── What this does ────────────────────────────────────────────────────────
 *
 * The cluster is rendered ONCE, through a portal, into a `<div>` this hook
 * owns. The page draws SLOTS — empty `display: contents` divs — wherever the
 * cluster may sit, and the container element is `appendChild`-ed into whichever
 * slot is currently on screen with the highest priority. Moving a DOM node
 * between parents is not a React tree change, so:
 *
 *   - `<ListingActions>` (and everything under it) mounts exactly once;
 *   - the favourite button is literally the SAME `HTMLElement` in both
 *     placements — `test/detailActionsPlacements.test.tsx` holds the node
 *     across the move and asserts identity, which is the only assertion that
 *     can tell this apart from a well-behaved remount;
 *   - a slot that unmounts hands the cluster back to the next one down,
 *     rather than taking it off the page.
 *
 * `display: contents` on both the slot and the container is load-bearing: the
 * cluster must remain a direct flex item of the heading row (it is laid out by
 * `justify="space-between"`) and must stay absolutely positionable against the
 * gallery's containing block in the overlay arm. A wrapper that generated a
 * box would change both.
 */
import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

/** Neither slot nor container may generate a box — see the file header. */
const CONTENTS: CSSProperties = { display: "contents" };

export interface MovableCluster {
  /**
   * True when there is a document to portal into. `false` under SSR, where
   * the caller renders the cluster inline at its primary placement instead —
   * a server render has no scrolling and therefore no second placement.
   */
  readonly portable: boolean;
  /** Render the cluster ONCE, anywhere in the tree. Returns the portal. */
  render(cluster: ReactNode): ReactNode;
  /**
   * A mount point. The highest `priority` currently on screen holds the
   * cluster; when it goes, the next one down gets it back.
   */
  slot(priority: number, name: string): ReactElement;
}

export function useMovableCluster(enabled: boolean): MovableCluster {
  const container = useRef<HTMLElement | null>(null);
  if (enabled && container.current === null && typeof document !== "undefined") {
    const host = document.createElement("div");
    host.style.display = "contents";
    host.setAttribute("data-listings-cluster-portal", "");
    container.current = host;
  }
  const slots = useRef(new Map<number, HTMLElement>());
  const refs = useRef(new Map<number, (node: HTMLElement | null) => void>());

  /** Put the container in the highest-priority slot that is on the page. */
  const settle = useCallback((): void => {
    const host = container.current;
    if (host === null) return;
    let best: HTMLElement | undefined;
    let bestPriority = -1;
    for (const [priority, node] of slots.current) {
      // `isConnected` matters during a commit that removes a slot: React may
      // hand back a node it is about to drop, and appending into it would take
      // the cluster off the page with it.
      if (node.isConnected && priority > bestPriority) {
        bestPriority = priority;
        best = node;
      }
    }
    if (best !== undefined && host.parentNode !== best) best.appendChild(host);
  }, []);

  // The belt. A slot's ref cleanup is what normally moves the cluster, but a
  // subtree removed around it would leave the container detached with nothing
  // to notice; this runs after every commit and repairs that in one comparison.
  useEffect(settle);

  const refFor = useCallback(
    (priority: number): ((node: HTMLElement | null) => void) => {
      let ref = refs.current.get(priority);
      if (ref === undefined) {
        ref = (node: HTMLElement | null): void => {
          if (node === null) slots.current.delete(priority);
          else slots.current.set(priority, node);
          settle();
        };
        refs.current.set(priority, ref);
      }
      return ref;
    },
    [settle]
  );

  return {
    portable: container.current !== null,
    render: (cluster: ReactNode): ReactNode =>
      container.current === null ? null : createPortal(cluster, container.current),
    slot: (priority: number, name: string): ReactElement => (
      <div
        ref={refFor(priority)}
        style={CONTENTS}
        data-listings-cluster-slot={name}
      />
    ),
  };
}
