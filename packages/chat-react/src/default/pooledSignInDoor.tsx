/**
 * The door for a POOLED refusal — one per pane, standing in the sentence.
 *
 * `<StartChatButton refusal="pooled">` moved the sentence out of every card
 * and into the enclosing `PaneGate`'s footnote, which is the right answer to
 * fourteen cards printing one sentence fourteen times. It also dropped the
 * thing the inline arm has and this module's own rule requires: the DOOR. A
 * pooled pane said "Sign in to message the seller." and left the visitor to
 * find the header themselves — exactly the half-answer `SignInLink` was
 * written to end (storefront Wave D, G-3).
 *
 * The sentence must carry the link, and there is one sentence, so there is one
 * link. Not one per button: fourteen doors under fourteen cards is the noise
 * pooling just removed, and the pooled sentence is the only place a visitor is
 * already reading.
 *
 * ── Why this is a portal, and not a node in the button's own tree ──────────
 *
 * The pooled sentence is not rendered here. `GatedControl` registers the
 * reason with the `GateReasonScope` a `PaneGate` provides, and the PANE prints
 * it once, under (or over) all its children, with the id every button's
 * `aria-describedby` points at. That element is the sentence. A link rendered
 * anywhere in this control's own subtree would be beside a card, not in the
 * sentence — and there are fourteen such subtrees.
 *
 * So the door is rendered INTO the sentence, through the one address the scope
 * publishes for exactly this purpose: `scope.idFor(reason)`. It becomes the
 * last child of the described element, which is also what makes assistive tech
 * read the reason and its way out together.
 *
 * ── Why one of them is elected ────────────────────────────────────────────
 *
 * Every pooled button can see the scope, so every one of them would portal its
 * own copy. The claim below hands the sentence to exactly one control per
 * (scope, reason) and hands it on when that control unmounts — a card scrolled
 * out of a virtualised list must not take the pane's only door with it.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { GateReasonScope } from "@stapel/tokens-antd/skin";

interface DoorClaim {
  /** The control currently rendering the door, or nobody. */
  holder: object | null;
  /** Everyone who would take it if it were free. */
  readonly contenders: Set<() => void>;
}

/**
 * Keyed by the scope OBJECT — a `PaneGate` memoises one per pane, so two panes
 * on a screen are two claims and each keeps its own door. Weak, so a pane that
 * unmounts takes its claims with it.
 */
const CLAIMS = new WeakMap<GateReasonScope, Map<string, DoorClaim>>();

function claimFor(scope: GateReasonScope, reason: string): DoorClaim {
  let byReason = CLAIMS.get(scope);
  if (byReason === undefined) {
    byReason = new Map();
    CLAIMS.set(scope, byReason);
  }
  let claim = byReason.get(reason);
  if (claim === undefined) {
    claim = { holder: null, contenders: new Set() };
    byReason.set(reason, claim);
  }
  return claim;
}

/**
 * `true` for the ONE control per pooled sentence that renders the door.
 * `false` for every other control sharing it, and for a control that is not
 * inside a scope at all (there the reason — and its door — stand beside the
 * control, as they always did).
 */
function useHoldsTheDoor(scope: GateReasonScope | null, reason: string | undefined): boolean {
  const [holds, setHolds] = useState(false);
  useEffect(() => {
    if (scope === null || reason === undefined) {
      setHolds(false);
      return undefined;
    }
    const claim = claimFor(scope, reason);
    const me = {};
    const take = (): void => {
      if (claim.holder !== null) return;
      claim.holder = me;
      setHolds(true);
    };
    claim.contenders.add(take);
    take();
    return () => {
      claim.contenders.delete(take);
      setHolds(false);
      if (claim.holder !== me) return;
      // Hand it on rather than drop it: the sentence outlives this control.
      claim.holder = null;
      for (const other of claim.contenders) {
        other();
        if (claim.holder !== null) break;
      }
    };
  }, [scope, reason]);
  return holds;
}

/**
 * The element the pooled sentence is rendered in, once this control holds the
 * door — or `null` while it does not, or while the sentence is not on the page
 * yet.
 */
function usePooledSentence(
  scope: GateReasonScope | null,
  reason: string | undefined
): HTMLElement | null {
  const holds = useHoldsTheDoor(scope, reason);
  const [sentence, setSentence] = useState<HTMLElement | null>(null);
  // The lookup is deferred to `holds`, and that is not incidental: the
  // footnote is created by a state update INSIDE `PaneGate`, queued while
  // `GatedControl` registers this control's reason — the same effect flush
  // that settles the claim below. React renders both updates together, so by
  // the time this effect re-runs on `holds` the sentence is in the document.
  // Looking it up any earlier finds nothing.
  useEffect(() => {
    const found =
      holds && scope !== null && reason !== undefined
        ? document.getElementById(scope.idFor(reason))
        : null;
    setSentence((previous) => (previous === found ? previous : found));
  }, [holds, scope, reason]);
  return sentence;
}

/**
 * Render `door` into the pane's pooled copy of `reason`, from exactly one of
 * the controls that share it. Renders nothing outside a scope, before the
 * sentence exists, or from the controls that did not win the claim.
 *
 * The door keeps this control's React context (a portal moves the DOM node,
 * not the tree), so the link is still translated by the host's `I18nProvider`
 * and still themed by the surrounding `ChatSkinTheme`.
 */
export function PooledSignInDoor(props: {
  readonly scope: GateReasonScope | null;
  readonly reason: string | undefined;
  readonly door: ReactNode;
}): ReactNode {
  const sentence = usePooledSentence(props.scope, props.reason);
  if (sentence === null) return null;
  return createPortal(props.door, sentence);
}
