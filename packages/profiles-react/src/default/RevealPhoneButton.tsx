/**
 * `<RevealPhoneButton/>` — "Show phone number", and what happens next.
 *
 * The viewer's half of the contacts feature. A listing card, a seller row and
 * a seller page all want the same control, and all three want it to behave the
 * same way in the four answers the wire can give.
 *
 * ── THE BUTTON BECOMES THE NUMBERS ─────────────────────────────────────────
 *
 * On a 200 the button is REPLACED, in place, by the numbers it asked for —
 * as `tel:` links, each with a copy control. Not a dialog, not a toast, not a
 * second screen: the person pressed a button to read a number, and the number
 * appears where the button was. A number that arrives in a modal has to be
 * transcribed before the modal is closed.
 *
 * An empty list is a normal 200 (the seller has no number, or none this
 * viewer may be handed — the wire deliberately does not say which), and it
 * gets its own sentence rather than a silent no-op.
 *
 * ── THE NUMBER GOES NOWHERE ELSE ───────────────────────────────────────────
 *
 * Not to the query cache (`useRevealContacts` holds it on the mutation object
 * and drops it on unmount), not to `localStorage`, not to the URL, not to a
 * `data-` attribute. It is on screen for as long as this component is, and
 * then it is gone. Every hand-over is journalled for the owner and counted
 * against the viewer's hourly budget, so a cached copy would be a hand-over
 * nobody recorded.
 *
 * ── THE DOOR IS THE HOST'S ─────────────────────────────────────────────────
 *
 * 403 `error.403.contacts_registration_required` is not "sign in" — the
 * backend refuses guests AND signed-out visitors alike, and the answer is FULL
 * REGISTRATION. It is also the ONLY refusal of that kind: since
 * stapel-profiles 0.20.2 no contacts route answers 401 at all, and the code
 * arrives at the top level of the envelope for both audiences, so there is one
 * branch here and not two (a 401 arm would be an arm that can never run).
 * Which door it is belongs to the host (it is `auth-react`'s
 * `<AuthPanel mode="register"/>` in this fleet, a route in another), so this
 * component states the reason and renders `renderDoor()` beside it. An
 * unfilled slot renders `SlotPlaceholder` in development rather than a
 * sentence with no way out of it.
 *
 * ── 429 IS SPOKEN IN MINUTES ───────────────────────────────────────────────
 *
 * The wire says `retry_after` in seconds because that is what a budget is
 * counted in. A person waiting is told minutes.
 *
 * ── THE SECOND BUTTON IN A ROW MAY NOT BE A SECOND PRIMARY ─────────────────
 *
 * This control stands beside "message the seller" on nearly every surface that
 * mounts it, and a row with two filled primaries is one decision drawn twice.
 * Which of the two carries the brand's solid fill is the CONTAINER's call, so
 * {@link RevealPhoneButtonProps.emphasis} says it at the call site — antd's own
 * `type="primary"` against its own `color="default" variant="filled"` pair, so
 * the tinted arm is the theme's answer at the same control height and radius
 * rather than a fill of anybody's invention. `"primary"` is the default, so a
 * host that never asks keeps what it had. The pair renders no door of its own
 * (the host's `renderDoor()` is the door), so there is no second arm here to
 * follow the emphasis — a host draws its door in the same emphasis it asked
 * this control for.
 *
 * (A host used to have exactly one way to say this: registering a `Button` in
 * `@stapel/tokens-antd`'s component registry around this control alone.
 * A client fleet's storefront carried that workaround in a container of its
 * own, and asked for this prop.)
 *
 * ── THE REVEALED ROW STAYS ONE LINE ────────────────────────────────────────
 *
 * The number replaces the button IN THE BUTTON'S OWN BOX, and that box is
 * routinely a phone's contact dock or a ~300px buy column. Three words, a
 * number and a control do not fit such a box on one line, and a row that wraps
 * makes the dock taller the moment the number arrives — the page moves under
 * the person who just pressed the button.
 *
 * So the row never wraps, the copy control is icon-only, and the number's
 * LABEL (the seller's own word for the number — "Mobile", "Work") is dropped
 * from the visible line below
 * {@link CONTACT_REVEAL_LABEL_MIN_WIDTH} — it survives on the `tel:` link's
 * `aria-label` and `title`, where a screen reader and a hover still read it.
 * The width is the ROW's own (`useElementWidth`), never the viewport's: the
 * desktop's buy column is narrower than the phone's dock.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import {
  SlotPlaceholder,
  actionAvailable,
  actionBlocked,
  hasErrorCode,
  useT,
  useTPlural,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useRevealContacts } from "../headless/Contacts.js";
import type { RevealedPhone } from "../api/types.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { toFlowError } from "../flows/errors.js";
import { useElementWidth } from "./elementWidth.js";
import { CheckIcon, CopyIcon } from "./icons.js";

/** The backend's word for "you have no account" — signed out OR a guest. */
const REGISTRATION_REQUIRED = "error.403.contacts_registration_required";
/** The backend's word for "too many hand-overs this hour". */
const REVEAL_BUDGET = "error.429.contacts_reveal_budget";

/**
 * The narrowest a revealed number's row may be and still spell its label
 * ("Mobile", "Work") as a visible word beside the number. Below it the
 * label is the `tel:` link's `aria-label`/`title` and nothing else — see the
 * file header.
 *
 * 26rem at a 16px root, in the CSS pixels the row is MEASURED in (the sibling
 * of `CONTACT_POLICY_MIN_WIDTH`, which is a `min-width` a grid reads and so is
 * written as a length). A label, a number and a control need about 20rem
 * between them; the extra six keep a phone's dock — 390px of viewport, less
 * its gutters — on the short answer, because that is the box where a second
 * line moves the page.
 */
export const CONTACT_REVEAL_LABEL_MIN_WIDTH = 416;

/**
 * How loud this control is in the row it stands in. `"primary"` is the
 * brand's solid fill, `"secondary"` antd's tinted pair — see the file header.
 */
export type RevealEmphasis = "primary" | "secondary";

/** The emphasis in antd's own dialect, handed to the pair's `GatedButton`. */
function emphasisPaint(
  emphasis: RevealEmphasis
):
  | { readonly type: "primary" }
  | { readonly color: "default"; readonly variant: "filled" } {
  return emphasis === "secondary"
    ? { color: "default", variant: "filled" }
    : { type: "primary" };
}

/** Seconds from the wire → whole minutes a person waits (at least one). */
export function retryAfterMinutes(retryAfter: unknown): number {
  const seconds = typeof retryAfter === "number" ? retryAfter : Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil(seconds / 60));
}

export interface RevealPhoneButtonProps {
  /** The SELLER's user id — whose numbers are being asked for. */
  readonly ownerKey: string;
  /**
   * Where the viewer was standing, for the owner's journal ("this number was
   * asked for from this listing"). Opaque to stapel-profiles.
   */
  readonly listingId?: string;
  /**
   * Is there a number worth asking for? Read it off the seller's public
   * profile with `hasPhone(profile)` — the one bit a public profile carries.
   * `false` switches the control off WITH its reason beside it; it is not a
   * promise that a number will arrive, only that asking is worth a round trip.
   */
  readonly available?: boolean;
  /**
   * The host's registration door, rendered beside the 403 sentence. Full
   * registration, not a sign-in link: the backend refuses guest sessions too.
   */
  readonly renderDoor?: () => ReactNode;
  /**
   * How loud the control is in the row it stands in. Default `"primary"` —
   * the brand's solid fill, which is what this control has always drawn.
   * `"secondary"` is antd's tinted pair, for the row that already carries a
   * primary (a "message the seller" beside it). See the file header.
   */
  readonly emphasis?: RevealEmphasis;
  /** Light or dark. Omitted, the skin follows the host's live theme. */
  readonly mode?: ThemeMode;
  /** What the theme root paints. Default `"bare"` — this control is placed
   * inside somebody else's card. */
  readonly surface?: SkinSurface;
}

/**
 * One revealed number: a `tel:` link and a copy control, on ONE line.
 *
 * `labelInWords` is the row's measured answer to "is there room for the
 * label's word beside the number" — see {@link CONTACT_REVEAL_LABEL_MIN_WIDTH}.
 * When there is not, the word is not shortened or hidden with CSS, it is
 * simply not drawn, and the link carries it for a screen reader and a hover.
 */
function Phone(props: {
  phone: RevealedPhone;
  labelInWords: boolean;
}): ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const { phone } = props;
  const label = phone.label.length > 0 ? phone.label : phone.value;
  const call = t(PROFILES_I18N_KEYS.contactsRevealCall, { label });
  const copyLabel = t(
    copied
      ? PROFILES_I18N_KEYS.contactsRevealCopied
      : PROFILES_I18N_KEYS.contactsRevealCopy
  );
  const showLabel = props.labelInWords && phone.label.length > 0;
  return (
    <Flex
      align="center"
      gap={spacing[2]}
      data-testid="revealed-phone"
      /* Never a second line: the number arrives in the button's own box, and
         a row that wraps makes that box taller under the person who just
         pressed it. `minWidth: 0` so the line may shrink rather than push its
         container wide. Inline, not antd's `wrap` prop, because this is the
         row's own rule and it is read back by the fleet's probes. */
      style={{ flexWrap: "nowrap", minWidth: 0 }}
    >
      {showLabel ? (
        <Typography.Text
          type="secondary"
          data-testid="revealed-phone-label"
          style={{ whiteSpace: "nowrap" }}
        >
          {phone.label}
        </Typography.Text>
      ) : null}
      <Typography.Link
        href={`tel:${phone.value}`}
        aria-label={call}
        /* The label a narrow row does not have room to print — on the link
           itself, so a hover still says which number this is. */
        {...(showLabel ? {} : { title: call })}
        strong
        style={{ whiteSpace: "nowrap" }}
      >
        {phone.value}
      </Typography.Link>
      <Button
        size="small"
        icon={copied ? <CheckIcon /> : <CopyIcon />}
        /* Icon-only: the words are the accessible NAME, and the glyph is what
           fits beside a number in a dock. No `title` — a browser tooltip on a
           control is the hover-only text the house rule bans
           (`stapel/no-tooltip-in-skin`); the copied state is said by the glyph
           and by the name changing. */
        aria-label={copyLabel}
        data-testid="revealed-phone-copy"
        data-analytics="none"
        data-analytics-reason="local ui state only — nothing leaves this component"
        onClick={() => {
          // A copy the browser refuses (no permission, no clipboard API in a
          // test environment) must not take the number off the screen with it.
          void navigator.clipboard?.writeText(phone.value);
          setCopied(true);
        }}
      />
    </Flex>
  );
}

export function RevealPhoneButton(props: RevealPhoneButtonProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const reveal = useRevealContacts();
  const phones = reveal.data?.phones;
  const failure = reveal.error;
  /* The box this control was given, measured — the desktop's buy column is
     narrower than a phone's dock, so the viewport cannot answer this. */
  const box = useElementWidth<HTMLDivElement>();
  const labelInWords =
    box.width !== undefined && box.width >= CONTACT_REVEAL_LABEL_MIN_WIDTH;

  // "There is nothing to ask for" is a REASON, and it renders beside the
  // control rather than as a grey rectangle with no explanation.
  const gate: ActionAvailability =
    props.available === false
      ? actionBlocked(PROFILES_I18N_KEYS.contactsRevealNone)
      : actionAvailable();

  return (
    <SkinTheme
      surface={props.surface ?? "bare"}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[2]} data-testid="reveal-phone" ref={box.ref}>
        {phones === undefined ? (
          <GatedButton
            gate={gate}
            {...emphasisPaint(props.emphasis ?? "primary")}
            loading={reveal.isPending}
            testId="reveal-phone-button"
            data-analytics="none"
            data-analytics-reason="business action (a plain POST, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
            onClick={() => {
              reveal.mutate({
                ownerKey: props.ownerKey,
                ...(props.listingId !== undefined
                  ? { listingId: props.listingId }
                  : {}),
              });
            }}
          >
            {t(
              reveal.isPending
                ? PROFILES_I18N_KEYS.contactsRevealLoading
                : PROFILES_I18N_KEYS.contactsRevealShow
            )}
          </GatedButton>
        ) : phones.length > 0 ? (
          phones.map((phone) => (
            <Phone key={phone.value} phone={phone} labelInWords={labelInWords} />
          ))
        ) : (
          <Typography.Text type="secondary" data-testid="reveal-phone-none">
            {t(PROFILES_I18N_KEYS.contactsRevealNone)}
          </Typography.Text>
        )}

        {hasErrorCode(failure, REGISTRATION_REQUIRED) ? (
          <Flex vertical gap={spacing[2]} data-testid="reveal-phone-registration">
            <Typography.Text>
              {t(PROFILES_I18N_KEYS.contactsRevealRegister)}
            </Typography.Text>
            {props.renderDoor?.() ?? <SlotPlaceholder name="renderDoor" />}
          </Flex>
        ) : hasErrorCode(failure, REVEAL_BUDGET) ? (
          <Typography.Text type="warning" data-testid="reveal-phone-budget">
            {tPlural(PROFILES_I18N_KEYS.contactsRevealBudget, {
              count: retryAfterMinutes(toFlowError(failure).params["retry_after"]),
            })}
          </Typography.Text>
        ) : (
          <ErrorAlert
            thrown={failure ?? undefined}
            variant="inline"
            testId="reveal-phone-error"
          />
        )}
      </Flex>
    </SkinTheme>
  );
}
