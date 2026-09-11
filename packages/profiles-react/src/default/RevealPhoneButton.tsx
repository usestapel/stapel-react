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

/** The backend's word for "you have no account" — signed out OR a guest. */
const REGISTRATION_REQUIRED = "error.403.contacts_registration_required";
/** The backend's word for "too many hand-overs this hour". */
const REVEAL_BUDGET = "error.429.contacts_reveal_budget";

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
  /** Light or dark. Omitted, the skin follows the host's live theme. */
  readonly mode?: ThemeMode;
  /** What the theme root paints. Default `"bare"` — this control is placed
   * inside somebody else's card. */
  readonly surface?: SkinSurface;
}

/** One revealed number: a `tel:` link and a copy control. */
function Phone(props: { phone: RevealedPhone }): ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const { phone } = props;
  const label = phone.label.length > 0 ? phone.label : phone.value;
  return (
    <Flex align="center" gap={spacing[2]} wrap data-testid="revealed-phone">
      {phone.label.length > 0 ? (
        <Typography.Text type="secondary">{phone.label}</Typography.Text>
      ) : null}
      <Typography.Link
        href={`tel:${phone.value}`}
        aria-label={t(PROFILES_I18N_KEYS.contactsRevealCall, { label })}
        strong
      >
        {phone.value}
      </Typography.Link>
      <Button
        size="small"
        data-testid="revealed-phone-copy"
        data-analytics="none"
        data-analytics-reason="local ui state only — nothing leaves this component"
        onClick={() => {
          // A copy the browser refuses (no permission, no clipboard API in a
          // test environment) must not take the number off the screen with it.
          void navigator.clipboard?.writeText(phone.value);
          setCopied(true);
        }}
      >
        {t(
          copied
            ? PROFILES_I18N_KEYS.contactsRevealCopied
            : PROFILES_I18N_KEYS.contactsRevealCopy
        )}
      </Button>
    </Flex>
  );
}

export function RevealPhoneButton(props: RevealPhoneButtonProps): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const reveal = useRevealContacts();
  const phones = reveal.data?.phones;
  const failure = reveal.error;

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
      <Flex vertical gap={spacing[2]} data-testid="reveal-phone">
        {phones === undefined ? (
          <GatedButton
            gate={gate}
            type="primary"
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
          phones.map((phone) => <Phone key={phone.value} phone={phone} />)
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
