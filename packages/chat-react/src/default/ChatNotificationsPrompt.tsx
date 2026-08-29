/**
 * ASK FOR NOTIFICATIONS AT A MOMENT THAT HAS EARNED THE QUESTION.
 *
 * ── Why not on page load ──────────────────────────────────────────────────
 *
 * A permission prompt on arrival is asked before the person knows what the
 * product is, so the honest answer is "no" — and `denied` is TERMINAL: the
 * browser will not ask again, and no amount of product improvement gets that
 * back. Asking early does not merely annoy; it spends the only chance there
 * is.
 *
 * The moment this component waits for is the first message exchanged in the
 * open thread — sent or received. By then the person has a conversation worth
 * being told about, and the question answers itself before it is asked. The
 * trigger is the thread's own `lastSeq` moving past where it stood at mount,
 * which is true for a send and for an arrival alike and needs no new
 * plumbing.
 *
 * ── Why it is a pre-prompt and not the browser's ──────────────────────────
 *
 * `PermissionSheet` (`@stapel/tokens-antd/skin`) states what the permission
 * is for and offers "Not now" — a dismissal that is NOT a refusal, so the
 * browser is never asked and the one chance is still there tomorrow. Only
 * "Allow" reaches `Notification.requestPermission`. The state machine
 * underneath is core's `usePermission`, shared with the camera, the
 * microphone and the position, so chat has no second answer to "has this been
 * granted".
 *
 * ── What it never does ────────────────────────────────────────────────────
 *
 * Ask twice in one mount, ask when the answer is already `granted`, or ask
 * when it is `denied` / `unsupported` — the two states where every control is
 * theatre (`permissionIsBlocked`). It renders nothing at all in those cases:
 * there is no fallback to offer, because a chat without notifications is the
 * chat, not a degraded one.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useT, usePermission } from "@stapel/core";
import type { PermissionBag } from "@stapel/core";
import { PermissionSheet, permissionIsBlocked } from "@stapel/tokens-antd/skin";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

export interface ChatNotificationsPromptProps {
  /**
   * The thread's high-water `seq`. The prompt opens the first time this moves
   * past the value it had when the thread finished LOADING — the first
   * message exchanged after that, in either direction.
   */
  readonly lastSeq: number;
  /**
   * Whether the thread has finished loading. Load-bearing: `lastSeq` is 0
   * both for "no history yet" and for "still reading", so without this the
   * history landing reads as an arrival and the prompt opens on page load —
   * which is precisely the behaviour this component exists to prevent.
   */
  readonly ready: boolean;
  /**
   * Off entirely. A deployment that does not want the offer says so here
   * rather than by hiding the component somewhere in a skin.
   */
  readonly offered?: boolean;
  /**
   * The permission bag to render against, instead of this browser's own.
   *
   * The same shape `PermissionSheet` takes for the same reason: the ask has
   * five states and a real browser is only ever in one of them, so neither a
   * demo nor a test can photograph the other four. Production passes nothing
   * and the hook answers.
   */
  readonly permission?: PermissionBag;
  readonly onResolved?: (granted: boolean) => void;
}

/**
 * The ask, and nothing else — no content is gated behind it. Renders `null`
 * until the value moment, and `null` forever once the browser has answered.
 */
export function ChatNotificationsPrompt(
  props: ChatNotificationsPromptProps
): ReactElement | null {
  const t = useT();
  const browserPermission = usePermission("notifications", {
    ...(props.offered !== undefined ? { offered: props.offered } : {}),
  });
  const permission = props.permission ?? browserPermission;
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  // The tide mark, taken the moment the thread is LOADED — not at mount. A
  // thread that opens onto fifty existing messages must not read its own
  // first paint as fifty arrivals and ask on sight.
  const baseline = useRef<number | null>(null);

  const { lastSeq, ready } = props;
  const { status } = permission;
  useEffect(() => {
    if (!ready) return;
    if (baseline.current === null) {
      baseline.current = lastSeq;
      return;
    }
    if (asked || lastSeq <= baseline.current) return;
    // `granted` needs nothing; `denied` / `unsupported` can be given nothing.
    if (status === "granted" || permissionIsBlocked(status)) return;
    setAsked(true);
    setOpen(true);
  }, [lastSeq, ready, asked, status]);

  if (!open) return null;

  return (
    <PermissionSheet
      open={open}
      permission={permission}
      title={t(CHAT_I18N_KEYS.notifyTitle)}
      body={t(CHAT_I18N_KEYS.notifyBody)}
      deniedBody={t(CHAT_I18N_KEYS.notifyDenied)}
      onClose={() => {
        setOpen(false);
      }}
      onResolved={(next) => {
        props.onResolved?.(next === "granted");
      }}
      data-testid="chat-notifications-prompt"
    />
  );
}
