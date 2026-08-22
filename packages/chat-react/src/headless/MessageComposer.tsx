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
   */
  readonly availability: ActionAvailability;
  readonly isSending: boolean;
  /** The thrown value from the last failed send, for the error dialect. */
  readonly error: unknown;
  /** Send the current value; clears it on success. No-op while blocked. */
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
 */
export function MessageComposer(props: {
  conversationId: string;
  maxLength?: number;
  /** Called with the persisted message after a successful send. */
  onSent?: (seq: number) => void;
  children: (bag: MessageComposerBag) => ReactNode;
}): ReactNode {
  const [value, setValue] = useState("");
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

  const { mutate, isPending, error } = send;
  const onSent = props.onSent;
  const doSend = useCallback((): void => {
    if (!availability.available || isPending) return;
    mutate(
      { body: trimmed },
      {
        onSuccess: (message) => {
          setValue("");
          onSent?.(message.seq);
        },
      }
    );
  }, [availability.available, isPending, mutate, trimmed, onSent]);

  return props.children({
    value,
    setValue,
    availability,
    isSending: isPending,
    error,
    send: doSend,
    maxLength,
    length,
  });
}
