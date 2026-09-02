/**
 * The favourite heart, once — the control every card surface in this pair
 * draws and none of them may draw differently.
 *
 * `<ListingCard>` had it inline, and the two phone cards added in the mobile
 * wave (`<ListingSerpCard>`, `<ListingFeedCard>`) need exactly the same thing:
 * the same hook, the same gate, the same `aria-pressed`, the same refusal
 * printed as text rather than as a tooltip. Three copies of that is three
 * places for the anonymous arm to drift apart in, and the anonymous arm is
 * most of a storefront's traffic. So it lives here and the surfaces differ
 * only in WHERE they put it.
 *
 * This module is deliberately NOT re-exported from `src/default/index.ts`: it
 * is how this pair's own cards are built, not a control a host composes with.
 * A host that wants a favourite button outside a card has `useFavoriteToggle`.
 *
 * ── The refusal, and why a grid needs a scope ──────────────────────────────
 *
 * `<GatedControl>` prints the gate's reason beside the control and wires
 * `aria-describedby` to it. That is right for ONE card and wrong for forty:
 * the same sentence forty times is the loudest thing on a results page. The
 * substrate already answers this — `GateReasonScopeContext` (a `<PaneGate>`
 * provides one) pools identical reasons and renders each once, and a
 * `GatedControl` inside a scope renders no text of its own while keeping the
 * `aria-describedby` pointed at the scope's single copy. A container drawing a
 * list or a grid of these cards should wrap it in one.
 */
import type { CSSProperties, ReactElement } from "react";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import { GatedControl } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { useFavoriteToggle } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { HeartIcon } from "./icons.js";

export interface FavoriteHeartProps {
  readonly listingId: number;
  /** `is_favorited` off the row. `null` is the third state — a search hit
   * never says whether you saved it — and reads as "not saved". */
  readonly favorited: boolean | null | undefined;
  /** Test id of the button; the gate wrapper takes `${testId}-gate`. */
  readonly testId: string;
  /** `"inline"` puts the reason beside the heart, `"stack"` (default) under
   * it — the choice belongs to the surface, which knows its own geometry. */
  readonly layout?: "stack" | "inline";
  readonly style?: CSSProperties;
}

/**
 * The heart and its refusal. It is NEVER hidden from a visitor: it is blocked,
 * the reason is on the page as ordinary text, and the container's sign-in door
 * (`signIn`) is the surface's business, not this control's — a disabled antd
 * button fires no pointer events, so a tooltip here would be a reason nobody
 * could read on any device (`stapel/no-tooltip-in-skin`).
 */
export function FavoriteHeart(props: FavoriteHeartProps): ReactElement {
  const t = useT();
  const favorite = useFavoriteToggle(props.listingId, props.favorited);
  const label = t(
    favorite.favorited
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );
  return (
    <GatedControl
      gate={favorite.gate}
      testId={`${props.testId}-gate`}
      {...(props.layout !== undefined ? { layout: props.layout } : {})}
      {...(props.style !== undefined ? { style: props.style } : {})}
    >
      {(bind) => (
        <Button
          shape="circle"
          disabled={bind.disabled}
          data-disabled-reason="the enclosing <GatedControl> renders the gate's reason beside this button"
          {...(bind["aria-describedby"] !== undefined
            ? { "aria-describedby": bind["aria-describedby"] }
            : {})}
          aria-label={label}
          aria-pressed={favorite.favorited}
          data-testid={props.testId}
          data-favorited={String(favorite.favorited)}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
          onClick={favorite.toggle}
          icon={<HeartIcon filled={favorite.favorited} />}
        />
      )}
    </GatedControl>
  );
}
