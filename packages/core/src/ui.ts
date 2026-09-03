/**
 * Two seams a skin needs from its host, and neither of them is a router.
 *
 * A pair renders screens; a CONTAINER owns navigation and owns the session.
 * Both facts used to be papered over the same way — the pair wrote a plain
 * `<a href>` and hoped — and both produced the same class of defect on the
 * storefront's first real mount:
 *
 *  - **a full page load inside a SPA.** `categories-react`'s breadcrumbs, tree
 *    and carousel rendered anchors, so every click on category chrome threw
 *    the whole app away and rebuilt it. The pair cannot import a router (there
 *    are several, and a library that picks one picks it for every host), so
 *    the host hands the anchor in: {@link LinkComponent}.
 *  - **a blocked control with no door.** `actionBlocked` made every switched
 *    off control state its reason, which ended the grey-rectangle incident —
 *    but "sign in to add this to favourites" is a reason whose next action is
 *    a LINK, and no pair took one. Three pairs each rendered the sentence and
 *    stopped there, leaving the person to find the header themselves. The
 *    host hands the door in: {@link SignInCta}.
 *
 * Both are declared here rather than five times across the pairs so that a
 * container writes ONE adapter and every pair takes it — which is the only
 * version of this that survives a sixth pair being installed.
 *
 * Neither adds runtime: this module is types plus one i18n key.
 */
import type {
  ComponentType,
  CSSProperties,
  MouseEventHandler,
  ReactNode,
} from "react";

/**
 * What a pair passes to a host's link component. `href` is a plain path — the
 * pair never builds a router descriptor, because it does not know which
 * router it is inside.
 *
 * A react-router host adapts in one line:
 *
 * ```tsx
 * const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
 *   <Link to={href} {...rest}>{children}</Link>
 * );
 * ```
 *
 * The `data-*` index signature is what keeps a pair's own test hooks
 * (`data-testid`, `data-category-slug`) reaching the DOM through a host
 * component that spreads the rest of its props.
 */
export interface LinkComponentProps {
  /** Where the link leads, as a path. */
  readonly href: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onClick?: MouseEventHandler<HTMLElement>;
  readonly "aria-label"?: string;
  /**
   * Hide this link from assistive technology — for a SECOND link to a
   * destination the surface already names.
   *
   * A card whose picture and whose title both open the same listing is one
   * target to a person using a mouse and two announcements to a person using a
   * screen reader; the picture is the one with nothing to say. Pair it with
   * `tabIndex: -1` (both, or neither: a focusable `aria-hidden` element is
   * worse than either alone).
   */
  readonly "aria-hidden"?: boolean | "true" | "false";
  /**
   * Keep this link out of the tab order — see `aria-hidden`. A grid of
   * twenty-four cards that each grow a decorative second stop is a keyboard
   * walk twice as long for nothing.
   */
  readonly tabIndex?: number;
  readonly "data-testid"?: string;
  readonly [dataAttribute: `data-${string}`]: unknown;
}

/**
 * The host's `<Link>`, router-agnostic. A skin that takes one renders every
 * navigation through it and renders a plain anchor when it is absent — so the
 * default stays "works with no wiring" and the SPA case stays possible.
 */
export type LinkComponent = ComponentType<LinkComponentProps>;

/**
 * The door out of a blocked action: where a signed-out visitor goes to sign
 * in. Exactly one of the two arms, because a control cannot both navigate and
 * call back — that is the same "two navigations for one click" defect
 * {@link LinkComponent} exists to end, wearing a different hat.
 *
 * `href` is the container's business (`/login?next=<current>` on the
 * storefront); `onSignIn` is for a host that opens a modal instead of routing.
 *
 * A pair that takes this renders it BESIDE the reason, never instead of it:
 * "sign in to leave a review" and a link to do it are one sentence, and
 * hiding the control from a visitor teaches nobody that the feature exists.
 */
export type SignInCta =
  | { readonly href: string; readonly onSignIn?: undefined }
  | { readonly onSignIn: () => void; readonly href?: undefined };

/**
 * The mixin a pair's props extend, so the prop is spelled the same in every
 * pair that has a sign-in door.
 *
 * The SHAPE is core's; the COPY is not. Each pair ships the link's label in
 * its own bundle (`listings.card.sign_in`, `chat.start.sign_in`,
 * `reviews.form.sign_in`) for the same reason it ships every other sentence:
 * core floors en and ru, and these pairs ship es too — a label defined here
 * would be the one string on the screen that a Spanish visitor reads in
 * English.
 */
export interface SignInCtaProp {
  /** Where a signed-out visitor signs in. Absent: the reason is shown with no
   * link, which is what a host that has no sign-in route wants. */
  readonly signIn?: SignInCta;
}
