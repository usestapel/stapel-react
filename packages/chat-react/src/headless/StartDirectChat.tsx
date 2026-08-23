import { useCallback } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchMandate,
  useMandate,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Conversation } from "../api/types.js";
import { useStartDirectChat } from "../model/mutations.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link StartDirectChat}. */
export interface StartDirectChatBag {
  /** Blocked reasons: no seller on the listing, or the viewer IS the seller. */
  readonly availability: ActionAvailability;
  readonly isStarting: boolean;
  /** The thread, once opened. */
  readonly conversation: Conversation | undefined;
  readonly error: unknown;
  start(): void;
}

/**
 * "Message the seller" — the buyer's entry into chat, headless.
 *
 * One press, one durable outcome: the direct thread with that person, created
 * if it does not exist and returned if it does. The idempotency is the
 * module's own (`direct_key` over the participant pair, under a unique
 * constraint), so a double click, two tabs, or a second listing by the same
 * seller all land in the same conversation rather than fanning out into
 * near-duplicate threads.
 *
 * WHO MAY PRESS IT. The write is `IsAuthenticated`, so the first gate is the
 * mandate axis: a visitor is told to sign in BEFORE the click rather than
 * being handed a 401 after it. `<StartChatButton signIn={…}>` puts the door
 * next to that sentence.
 *
 * WHAT THIS BUTTON CANNOT DO, AND WHY IT SAYS SO HERE. It cannot open a
 * thread ABOUT a listing. The thread is keyed by the pair of people, and
 * `CreateConversationRequest.scope_key` — which looks like the place to put a
 * listing id — is ignored by the server (`api/extensions.ts`). A host that
 * wants the listing named does it in the first message, via
 * `<MessageComposer>`'s initial value.
 */
export function StartDirectChat(props: {
  /** The other person. `null`/`undefined` blocks the control with a reason. */
  sellerId: string | null | undefined;
  /** The viewer, when known — writing to yourself is blocked with a reason. */
  viewerId?: string | null;
  /** Navigate to the thread. Called once, with the opened conversation. */
  onOpened?: (conversation: Conversation) => void;
  children: (bag: StartDirectChatBag) => ReactNode;
}): ReactNode {
  const start = useStartDirectChat();
  const { sellerId, viewerId, onOpened } = props;

  /**
   * May this person write at all? `POST /conversations/` is
   * `IsAuthenticated`, so a visitor pressing this bought a 401 — a refusal
   * delivered after the click, which is the one moment it is useless. The
   * axis is read through core's `MandateSource` seam, never derived here: a
   * storefront's derivation is "is there a session?", a tenant app's is
   * `@stapel/workspaces-react`'s.
   *
   * `unavailable` stays AVAILABLE, unlike the other four arms. Outside a
   * `<MandateProvider>` core answers `unresolved/unavailable`, and a host that
   * never wired the axis must not lose its button — "we could not ask" is not
   * "you may not" (the storefront spec's own §7.4 negative leg), and if the
   * guess is wrong the module answers 401 exactly as it did before.
   */
  const mandate = useMandate();
  const mandateGate = matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionBlocked(CHAT_I18N_KEYS.startBlockedSignIn),
    anonymous: () => actionBlocked(CHAT_I18N_KEYS.startBlockedSignIn),
    asking: () => actionBlocked(CHAT_I18N_KEYS.startBlockedMandateUnknown),
    unavailable: () => actionAvailable(),
  });

  const availability: ActionAvailability = firstBlock(
    mandateGate,
    sellerId === null || sellerId === undefined || sellerId.length === 0
      ? actionBlocked(CHAT_I18N_KEYS.startBlockedUnknownSeller)
      : actionAvailable(),
    viewerId != null && viewerId === sellerId
      ? actionBlocked(CHAT_I18N_KEYS.startBlockedSelf)
      : actionAvailable()
  );

  const { mutate, isPending, data, error } = start;
  const doStart = useCallback((): void => {
    if (!availability.available || isPending) return;
    if (sellerId === null || sellerId === undefined) return;
    mutate(
      { userId: sellerId },
      { onSuccess: (conversation) => onOpened?.(conversation) }
    );
  }, [availability.available, isPending, mutate, sellerId, onOpened]);

  return props.children({
    availability,
    isStarting: isPending,
    conversation: data,
    error,
    start: doStart,
  });
}
