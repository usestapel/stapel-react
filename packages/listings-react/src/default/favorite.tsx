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
import { theme as antdTheme } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import { ErrorAlert, GatedControl } from "@stapel/tokens-antd/skin";
import type { SignInCta } from "@stapel/core";
import { useActionGate, useT } from "@stapel/core";
import { useFavoriteToggle } from "../headless/Favorites.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { GateReasonPopover } from "./GateReasonPopover.js";
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
  /**
   * How loudly the refusal is stated on THIS surface (D45).
   *
   * `"text"` (default) keeps the standing sentence beside the heart — what
   * this control has always done, and the right answer where one card is the
   * screen. `"popover"` moves it onto the gesture: a signed-out phone SERP
   * printed "sign in to do this" once under every one of fourteen cards, in
   * the line where a price belongs, and fourteen copies of one sentence is
   * not fourteen pieces of help. The reason never leaves the accessibility
   * tree either way — see {@link GateReasonPopover}.
   */
  readonly blockedReason?: "text" | "popover";
  /** The surface's sign-in door, rendered INSIDE the disclosure. Absent: the
   * disclosure holds the reason alone. Only read in the `"popover"` arm; the
   * standing arm's door is the container's, as it always was. */
  readonly signIn?: SignInCta;
  readonly style?: CSSProperties;
}

/**
 * The heart and its refusal. It is NEVER hidden from a visitor: it is blocked,
 * the reason is on the page as ordinary text, and the container's sign-in door
 * (`signIn`) is the surface's business, not this control's — a disabled antd
 * button fires no pointer events, so a tooltip here would be a reason nobody
 * could read on any device (`stapel/no-tooltip-in-skin`).
 *
 * ── It is never html-`disabled`, in either volume ─────────────────────────
 *
 * `aria-disabled` plus a live handler, always. The refusal happens on
 * ACTIVATION — `useFavoriteToggle().toggle` is a no-op while the gate is
 * blocked, so the click cannot write anything — and that is the only shape of
 * refusal a person can interrogate. A `disabled` DOM button is inert: it
 * takes no focus, receives no pointer events, and swallows the very tap that
 * was supposed to explain it. Measured on a phone: a signed-out visitor's
 * heart produced no toast, no reason and no navigation, and on a touch device
 * there is no hover to fall back on.
 */
export function FavoriteHeart(props: FavoriteHeartProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const favorite = useFavoriteToggle(props.listingId, props.favorited);
  const label = t(
    favorite.favorited
      ? LISTINGS_I18N_KEYS.cardFavoriteRemove
      : LISTINGS_I18N_KEYS.cardFavoriteAdd
  );
  // Saved is a SOLID accent shape, not-saved is the outline. `is_favorited:
  // null` — an anonymous read's "nobody asked" — resolves to not-saved in the
  // bag, so it draws the outline and never a third look of its own.
  const icon = (
    <HeartIcon
      filled={favorite.favorited}
      {...(favorite.favorited ? { color: token.colorPrimary } : {})}
    />
  );
  // The RESOLVED sentence, not the gate's key — `useActionGate` is the one
  // place a blocked reason becomes words in this fleet.
  const reason = useActionGate(favorite.gate).reason;
  // A failed save, stated where the heart is. The rollback already put the
  // icon back; this says why it went back.
  const failure = (
    <ErrorAlert
      testId={`${props.testId}-error`}
      thrown={favorite.error}
      variant="inline"
    />
  );
  if (props.blockedReason === "popover" && reason !== undefined) {
    return (
      <GateReasonPopover
        reason={reason}
        cta={props.signIn}
        testId={`${props.testId}-reason`}
        signInTestId={`${props.testId}-sign-in`}
      >
        {(bind) => (
          <Button
            shape="circle"
            aria-disabled
            {...bind}
            aria-label={label}
            aria-pressed={favorite.favorited}
            data-testid={props.testId}
            data-favorited={String(favorite.favorited)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={favorite.toggle}
            icon={icon}
            {...(props.style !== undefined ? { style: props.style } : {})}
          />
        )}
      </GateReasonPopover>
    );
  }
  return (
    <GatedControl
      gate={favorite.gate}
      testId={`${props.testId}-gate`}
      {...(props.layout !== undefined ? { layout: props.layout } : {})}
      {...(props.style !== undefined ? { style: props.style } : {})}
    >
      {(bind) => (
        <>
          <Button
            shape="circle"
            // See `<ListingCard>`: the substrate's binding, spread whole.
            {...bind}
            aria-label={label}
            aria-pressed={favorite.favorited}
            data-testid={props.testId}
            data-favorited={String(favorite.favorited)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={favorite.toggle}
            icon={icon}
          />
          {failure}
        </>
      )}
    </GatedControl>
  );
}
