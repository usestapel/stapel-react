import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
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
  /** Called with the persisted message after a successful send. */
  onSent?: (seq: number) => void;
  children: (bag: MessageComposerBag) => ReactNode;
}): ReactNode {
  const [value, setValue] = useState("");
  // Typed in, or pressed send — either is a person addressing this field.
  const [interacted, setInteracted] = useState(false);
  const send = useSendMessage(props.conversationId);
  const maxLength = props.maxLength ?? CHAT_DEFAULT_MAX_BODY_LENGTH;
  const length = [...value].length;
  const trimmed = value.trim();

  const availability: ActionAvailability = firstBlock(
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
    isSending: isPending,
    error,
    send: doSend,
    maxLength,
    length,
  });
}
