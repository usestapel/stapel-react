/**
 * A browser notification for a message that arrived while nobody was looking.
 *
 * ── The three rules, and why each is a rule ───────────────────────────────
 *
 * 1. **Only while the tab is hidden.** A notification for a message that is
 *    already on screen is a second copy of something the person is reading.
 *    `document.visibilityState` is the whole test, checked at the moment the
 *    message lands rather than remembered from a subscription.
 *
 * 2. **Never for your own message.** The sender knows. A frame comes back to
 *    its author too (the fan-out has no echo to keep in step), so the
 *    viewer's own id is the first thing filtered.
 *
 * 3. **Never a tombstone or a system line.** An edit and a delete arrive as
 *    frames like any other change — that is what `rev_seq` is for — and
 *    "somebody deleted a message" is not news worth a chime.
 *
 * ── What this does NOT do ─────────────────────────────────────────────────
 *
 * It does not ask for permission. Asking is a decision about WHEN, it belongs
 * to a moment in the product rather than to a subscription, and it lives in
 * `default/ChatNotificationsPrompt.tsx` on the shared substrate
 * (`usePermission` + `PermissionSheet`). This hook only spends a permission
 * somebody already granted: `status !== "granted"` and it does nothing at
 * all, silently, because a person who said no must not be asked again by a
 * side effect.
 *
 * It also does not reach the person when the app is closed. That is a service
 * worker and a push subscription, and pretending otherwise with a
 * foreground-only API would be the kind of half-answer that reads as done.
 */
import { useCallback, useRef } from "react";
import type { ChatSignal } from "../flows/freshness.js";

/** What a notification says. The caller owns the words; this owns the rules. */
export interface ChatNotificationCopy {
  /** Title line — a name where the host can resolve one, else a fallback. */
  readonly title: string;
  /** Body — the message text, already trimmed to something readable. */
  readonly body: string;
}

export interface UseChatNotificationsOptions {
  /** The reader. Their own messages never notify them. */
  readonly viewerId: string | null;
  /**
   * The DEPLOYMENT's opt-in. `false` and nothing is ever shown, whatever the
   * browser says. It is NOT "the permission was granted" — that is the
   * browser's own answer, read at the moment a message lands, so this hook
   * and the prompt cannot hold two different opinions of it.
   */
  readonly enabled: boolean;
  /**
   * The words for one message. Return `null` to say nothing — a host that
   * cannot name the sender yet may prefer silence to "someone".
   */
  readonly copy: (signal: ChatSignal & { kind: "message" }) => ChatNotificationCopy | null;
  /**
   * Bring the tab forward when the notification is clicked. Default: focus
   * the window. A host with routing may navigate to the thread instead.
   */
  readonly onActivate?: () => void;
}

/** Longest body a notification carries before it is cut. */
const BODY_LIMIT = 140;

function tabIsHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function notificationsUsable(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    window.Notification.permission === "granted"
  );
}

/**
 * Returns an `onSignal` handler for `useChatFreshness` / `<ConversationThread
 * onSignal>`. Stable across renders, so passing it inline does not tear the
 * subscription down.
 */
export function useChatNotifications(
  options: UseChatNotificationsOptions
): (signal: ChatSignal) => void {
  const ref = useRef(options);
  ref.current = options;

  return useCallback((signal: ChatSignal): void => {
    const { viewerId, enabled, copy, onActivate } = ref.current;
    if (!enabled || signal.kind !== "message") return;
    const message = signal.message;
    // Rules 2 and 3, in the order that costs least.
    if (viewerId !== null && message.sender_id === viewerId) return;
    if (message.deleted || message.kind === "system") return;
    // Rule 1 — read now, not remembered: a tab hidden when the socket opened
    // may be in front of the person by the time a message lands.
    if (!tabIsHidden() || !notificationsUsable()) return;

    const words = copy(signal as ChatSignal & { kind: "message" });
    if (words === null) return;
    try {
      const notification = new window.Notification(words.title, {
        body: words.body.slice(0, BODY_LIMIT),
        // One notification per thread, replaced rather than stacked: twenty
        // messages in a burst is one line of news, not twenty alerts.
        tag: `chat:${message.conversation_id}`,
        renotify: false,
      } as NotificationOptions);
      notification.onclick = () => {
        notification.close();
        if (onActivate !== undefined) {
          onActivate();
          return;
        }
        if (typeof window.focus === "function") window.focus();
      };
    } catch {
      // A browser that refuses the constructor (an insecure context, a
      // policy) is not a reason for the thread to stop working.
    }
  }, []);
}
