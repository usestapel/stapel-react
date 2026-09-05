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
  /**
   * The surface's sign-in door.
   *
   * Given, it is where a VISITOR'S PRESS GOES, in both volumes (D431) — the
   * heart stops being a control that refuses and becomes the way in, `?next=`
   * and all. The `"popover"` arm additionally renders it inside the
   * disclosure, as it always did.
   *
   * Absent, nothing changes: the control stays blocked-but-alive and states
   * its reason, which is all a surface with no sign-in route can offer.
   */
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
 *
 * ── And where there is a DOOR, it is not "blocked" at all (D431) ──────────
 *
 * Live-but-refusing was half the answer. On the deployed phone SERP the
 * visitor's heart still carried `aria-disabled="true"`, a tap still produced
 * nothing at all, and the only explanation was a hover disclosure a finger
 * never triggers — the reason had been pooled into the pane's footnote, and
 * neither this control nor `GatedControl` had ever been handed
 * `onBlockedActivate`, so the gesture fell into the same hole `GatedControl`
 * was written to close.
 *
 * The owner's ruling: **the control is never inert for a visitor.** Where the
 * surface hands in a `signIn` door, a press GOES THROUGH IT, and the heart is
 * therefore not announced as disabled either — a control that acts on press
 * and calls itself unavailable is lying to exactly the people who most depend
 * on the announcement. The reason stays where it was (registered with the
 * pane's scope, wired by `aria-describedby`, hover disclosure and all on the
 * surfaces that have one); it is now a HINT beside a live control rather than
 * the only thing behind a dead one.
 *
 * Where the host hands in NO door there is nothing better for a press to do,
 * and the control keeps the gated shape it has always had — blocked, alive,
 * saying why.
 *
 * The `href` arm renders the heart as an anchor, deliberately: the door is a
 * navigation (`/login?next=…`), and an anchor keeps the `next`, the middle
 * click, and the person who is not running our JavaScript. `aria-pressed`
 * comes off in that arm, because a link is not a toggle.
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
  const gate = useActionGate(favorite.gate);
  const reason = gate.reason;
  // D431. A blocked gate plus a door the surface handed in: the press is not
  // refused, it is ROUTED — through the door, keeping whatever `?next=` the
  // container put in the href. With no door there is nothing better for the
  // press to do and the gated shape stands, exactly as before.
  const door = props.signIn;
  const opensDoor = gate.disabled && door !== undefined;
  // Exactly one arm, never both — `SignInCta`'s own rule. The `href` arm
  // makes antd render an anchor, which is the honest element for a door.
  const doorPress =
    !opensDoor || door === undefined
      ? {}
      : door.href !== undefined
        ? { href: door.href }
        : { onClick: door.onSignIn };
  // The heart, as the visitor with a door meets it: live, not announced as
  // unavailable, and not pretending to be a toggle when it is a link.
  const asDoor = opensDoor
    ? {
        ...doorPress,
        ...(door?.href !== undefined ? {} : { "aria-pressed": favorite.favorited }),
      }
    : { "aria-pressed": favorite.favorited, onClick: favorite.toggle };
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
            // Announced unavailable ONLY where a press has nothing to do —
            // see D431 in the header. With a door in hand it is a live
            // control, and the disclosure stays as the hint beside it.
            {...(opensDoor ? {} : { "aria-disabled": true })}
            {...bind}
            aria-label={label}
            data-testid={props.testId}
            data-favorited={String(favorite.favorited)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            {...asDoor}
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
      // With a door in hand the gate no longer REFUSES the person, it
      // annotates the control: the reason is still registered with the pane's
      // scope and still wired by `aria-describedby`, and the press — which is
      // now the way in, not a hole — reaches the handler untouched. Without a
      // door the gate keeps its default "live" refusal.
      {...(opensDoor ? { whenBlocked: "annotate" as const } : {})}
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
            data-testid={props.testId}
            data-favorited={String(favorite.favorited)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            {...asDoor}
            icon={icon}
          />
          {failure}
        </>
      )}
    </GatedControl>
  );
}
