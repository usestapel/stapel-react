import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchMandate,
  useElevation,
  useMandate,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Conversation, SubjectRef } from "../api/types.js";
import { useStartDirectChat } from "../model/mutations.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * The names this pair's gated writes use when asking core's elevation seam
 * whether an anonymous visitor may be given an identity instead of a
 * refusal. A host lists the ones it permits; anything it leaves out keeps
 * its wall.
 *
 * Writing to a seller is the marketplace's core act, so it is named here.
 * What the host must ALSO do, if it lists this one, is let the elevated
 * visitor back in to READ the reply — an account that can send and cannot
 * receive is worse than the refusal it replaced.
 */
export const CHAT_ELEVATION_ACTIONS = {
  startDirect: "chat.start_direct",
} as const;

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
 * WHAT IT IS ABOUT. Pass `subjectType`/`subjectKey` and the thread is opened
 * about that thing: stapel-chat hashes the pair into `direct_key`, so the
 * same buyer and seller get one thread per listing instead of one thread for
 * everything, and the thread carries the listing's card at its top. Omit them
 * and the behaviour is exactly what it was — one pair, one thread. (The field
 * that LOOKS like the place for a listing id, `scope_key`, is ignored by the
 * server; see `api/extensions.ts`.)
 */
export function StartDirectChat(props: {
  /** The other person. `null`/`undefined` blocks the control with a reason. */
  sellerId: string | null | undefined;
  /** The viewer, when known — writing to yourself is blocked with a reason. */
  viewerId?: string | null;
  /**
   * What the thread is about, by REGISTERED type — `listing` in a classified
   * marketplace (`STAPEL_CHAT["SUBJECT_TYPES"]`). Both halves or neither: an
   * unpaired half is refused upstream, so a lone `subjectType` is dropped
   * here rather than sent.
   */
  subjectType?: string | null;
  /** The opaque key within that type — a listing id. Never parsed by chat. */
  subjectKey?: string | number | null;
  /** Navigate to the thread. Called once, with the opened conversation. */
  onOpened?: (conversation: Conversation) => void;
  children: (bag: StartDirectChatBag) => ReactNode;
}): ReactNode {
  const start = useStartDirectChat();
  const { sellerId, viewerId, onOpened } = props;
  const subjectType = props.subjectType ?? "";
  const subjectKey =
    props.subjectKey === null || props.subjectKey === undefined
      ? ""
      : String(props.subjectKey);
  // Memoised on the two STRINGS: a fresh object per render would re-arm the
  // start callback on every keystroke of the page around it.
  const subject: SubjectRef | undefined = useMemo(
    () =>
      subjectType.length > 0 && subjectKey.length > 0
        ? { type: subjectType, key: subjectKey }
        : undefined,
    [subjectType, subjectKey]
  );

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
  const elevation = useElevation(CHAT_ELEVATION_ACTIONS.startDirect);
  const mandateGate = matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionBlocked(CHAT_I18N_KEYS.startBlockedSignIn),
    // The one arm elevation changes: where the host permits it, the press
    // mints an identity and opens the thread instead of refusing. The
    // mandate axis is untouched, so the visitor is still anonymous
    // everywhere else.
    anonymous: () =>
      elevation.covers
        ? actionAvailable()
        : actionBlocked(CHAT_I18N_KEYS.startBlockedSignIn),
    asking: () => actionBlocked(CHAT_I18N_KEYS.startBlockedMandateUnknown),
    unavailable: () => actionAvailable(),
  });

  const availability: ActionAvailability = firstBlock(
    mandateGate,
    elevation.pending
      ? actionBlocked(CHAT_I18N_KEYS.startBlockedMandateUnknown)
      : actionAvailable(),
    sellerId === null || sellerId === undefined || sellerId.length === 0
      ? actionBlocked(CHAT_I18N_KEYS.startBlockedUnknownSeller)
      : actionAvailable(),
    viewerId != null && viewerId === sellerId
      ? actionBlocked(CHAT_I18N_KEYS.startBlockedSelf)
      : actionAvailable()
  );

  const { mutate, isPending, data, error } = start;
  const { run: elevateThen } = elevation;
  const doStart = useCallback((): void => {
    if (!availability.available || isPending) return;
    if (sellerId === null || sellerId === undefined) return;
    // Mints the anonymous account first where the host permits it for this
    // action; a direct call everywhere else.
    elevateThen(() =>
      mutate(
        { userId: sellerId, ...(subject !== undefined ? { subject } : {}) },
        { onSuccess: (conversation) => onOpened?.(conversation) }
      )
    );
  }, [
    availability.available,
    isPending,
    mutate,
    sellerId,
    onOpened,
    elevateThen,
    subject,
  ]);

  return props.children({
    availability,
    isStarting: isPending || elevation.pending,
    conversation: data,
    error: error ?? elevation.error,
    start: doStart,
  });
}
