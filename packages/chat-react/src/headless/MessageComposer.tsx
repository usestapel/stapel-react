import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchMandate,
  useMandate,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { useSendMessage } from "../model/mutations.js";
import { CHAT_DEFAULT_MAX_BODY_LENGTH } from "../model/limits.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link MessageComposer}. */
export interface MessageComposerBag {
  readonly value: string;
  setValue(next: string): void;
  /**
   * Whether the message can be sent, and — when it cannot — why, as an i18n
   * key a skin renders as TEXT beside the control (`useActionGate`). There is
   * no way to spell "disabled, reason unknown".
   *
   * This is the ENFORCEMENT gate: what `send()` obeys and what a send control
   * switches off by. It is not what a skin prints — see
   * {@link MessageComposerBag.visibleAvailability}.
   */
  readonly availability: ActionAvailability;
  /**
   * The refusal a person has earned the right to READ: `actionAvailable()`
   * while the composer is {@link MessageComposerBag.pristine}, and
   * {@link MessageComposerBag.availability} once they have typed in it or
   * pressed send.
   *
   * A box nobody has touched is not a box that has failed anything. Deriving
   * the caption from "the value is empty" put a validation refusal under an
   * untouched field the instant it was drawn — and again after every
   * successful send, which is the same empty box one tick later.
   */
  readonly visibleAvailability: ActionAvailability;
  /** Nothing has been typed and no send has been attempted since the last
   * reset — the state a freshly drawn and a just-sent composer are both in. */
  readonly pristine: boolean;
  /**
   * THE SENTENCE A COMPOSER THAT WORKS STILL OWES A GUEST — an i18n key, or
   * `null` when there is nothing to say.
   *
   * Not an {@link ActionAvailability}, and that is the whole point of it
   * being a separate field: a guest CAN send. `POST
   * /conversations/{id}/messages/` is `IsAuthenticated` and an issued
   * anonymous identity satisfies that, so blocking the control would refuse
   * something the server accepts — and on a host that mints a guest to open
   * the thread in the first place, it would leave the person in a room they
   * were deliberately let into and cannot speak in.
   *
   * What is true instead is that the identity is a browser-local one. The
   * conversation is reachable from this device and no other until they sign
   * in, and nothing on the screen said so: a walk of a listing page found the
   * CALL control beside this composer stating its refusal in a sentence while
   * the composer — live, enabled, one gesture from a first message — carried
   * none.
   *
   * `member` and `unavailable` answer `null`: the first has an account, and
   * the second is core's "we could not ask", which is not a fact about the
   * person and must not be narrated as one.
   */
  readonly signInHint: string | null;
  readonly isSending: boolean;
  /** The thrown value from the last failed send, for the error dialect. */
  readonly error: unknown;
  /**
   * Send the current value; clears it on success and returns the composer to
   * pristine. While blocked it sends nothing — but the press is an
   * interaction, so the reason becomes visible.
   */
  send(): void;
  readonly maxLength: number;
  /**
   * The length the SERVER counts. Python's `len()` over a `str` counts code
   * points, and JavaScript's `String.length` counts UTF-16 code units — so a
   * single emoji is 1 there and 2 here. Counting code points is what keeps
   * the mirror from refusing a message the backend would have accepted.
   */
  readonly length: number;
}

/**
 * Headless composer over `POST /chat/api/v1/conversations/{id}/messages`.
 * REST, always — the socket's `send` frame refuses with codes that carry no
 * i18n key (`realtime/frames.ts`).
 *
 * ── Two gates, one verdict ────────────────────────────────────────────────
 *
 * `availability` says whether the message can go. `visibleAvailability` says
 * whether a person has done anything that entitles them to be told why it
 * cannot. They carry the SAME block — the visible one simply waits for an
 * interaction — so a skin can never print a reason the send control is not
 * actually obeying.
 */
export function MessageComposer(props: {
  conversationId: string;
  maxLength?: number;
  /**
   * WHAT THE BOX ALREADY SAYS when it is first drawn — a question somebody
   * pressed on the way here, not a draft of their own.
   *
   * A listing page's canned questions («Is it still available?») carry their
   * text in router state and had nowhere to put it: the thread opened on an
   * empty composer and the person retyped the sentence they had just chosen.
   * This is where it lands.
   *
   * TWO THINGS IT IS NOT.
   *
   * It is not a controlled value: it seeds the state ONCE, at mount, and a
   * later change to it is ignored. A prop that kept writing into the box
   * would overwrite whatever the person had typed since — at the exact moment
   * a parent re-rendered for an unrelated reason, which is the worst kind of
   * data loss because nothing on screen caused it.
   *
   * And it is not an INTERACTION. `pristine` stays true and `interacted`
   * stays false, so a seeded composer is treated exactly like an empty one
   * that nobody has addressed: no refusal is printed under it, and the first
   * thing the person does with the sentence — editing it or pressing send —
   * is still the first thing they have done. Seeding a box is the product
   * speaking, not the reader.
   */
  initialValue?: string;
  /** Called with the persisted message after a successful send. */
  onSent?: (seq: number) => void;
  children: (bag: MessageComposerBag) => ReactNode;
}): ReactNode {
  // ONCE. `useState`'s initial argument is read on the first render and never
  // again, which is the whole of the rule stated in `initialValue` above.
  const [value, setValue] = useState(props.initialValue ?? "");
  // Typed in, or pressed send — either is a person addressing this field.
  const [interacted, setInteracted] = useState(false);
  const send = useSendMessage(props.conversationId);
  const maxLength = props.maxLength ?? CHAT_DEFAULT_MAX_BODY_LENGTH;
  const length = [...value].length;
  const trimmed = value.trim();

  /**
   * WHO IS WRITING — the same axis `<StartDirectChat>` and `<StartCall>` read,
   * split here into the two different things it decides.
   *
   * `anonymous` is a BLOCK, for the reason `<StartDirectChat>` states about
   * the same endpoint family: the POST is `IsAuthenticated`, so a visitor
   * with no identity buys a 401 delivered after the press, which is the one
   * moment a refusal is useless. `guest` is NOT a block — see
   * {@link MessageComposerBag.signInHint} — and neither is `asking`, which is
   * a transient answer about a person who is already standing inside a thread
   * they reached: switching their composer off mid-question would be this
   * component narrating its own network. `unavailable` stays available
   * exactly as it does on every other control here — "we could not ask" is
   * not "you may not", and the server refuses if the guess is wrong.
   */
  const mandate = useMandate();
  const mandateGate = matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionAvailable(),
    anonymous: () => actionBlocked(CHAT_I18N_KEYS.composerBlockedSignIn),
    asking: () => actionAvailable(),
    unavailable: () => actionAvailable(),
  });
  const signInHint = matchMandate<string | null>(mandate, {
    member: () => null,
    guest: () => CHAT_I18N_KEYS.composerSignIn,
    // Already said, and said as a refusal — a control that is switched off
    // with a reason does not also need a warning about the same fact.
    anonymous: () => null,
    asking: () => null,
    unavailable: () => null,
  });

  const availability: ActionAvailability = firstBlock(
    mandateGate,
    trimmed.length === 0
      ? actionBlocked(CHAT_I18N_KEYS.composerBlockedEmpty)
      : actionAvailable(),
    length > maxLength
      ? actionBlocked(CHAT_I18N_KEYS.composerBlockedTooLong, { max: maxLength })
      : actionAvailable()
  );

  const edit = useCallback((next: string): void => {
    setInteracted(true);
    setValue(next);
  }, []);

  const { mutate, isPending, error } = send;
  const onSent = props.onSent;
  const doSend = useCallback((): void => {
    if (!availability.available) {
      // Pressing send with nothing in the box IS the person asking. The
      // refusal was always there; this is what earns it a place on screen.
      setInteracted(true);
      return;
    }
    if (isPending) return;
    mutate(
      { body: trimmed },
      {
        onSuccess: (message) => {
          setValue("");
          // Back to pristine, not to "empty and therefore invalid": the
          // message went, nothing failed, and the next one has not been
          // written yet.
          setInteracted(false);
          onSent?.(message.seq);
        },
      }
    );
  }, [availability.available, isPending, mutate, trimmed, onSent]);

  return props.children({
    value,
    setValue: edit,
    availability,
    visibleAvailability: interacted ? availability : actionAvailable(),
    pristine: !interacted,
    // NOT gated on `interacted`, unlike the refusal above. A reason for a
    // switched-off control is earned by trying it; a warning about what
    // happens if you DO use a control that works has to arrive before the
    // gesture, or it is an explanation of something already done.
    signInHint,
    isSending: isPending,
    error,
    send: doSend,
    maxLength,
    length,
  });
}
