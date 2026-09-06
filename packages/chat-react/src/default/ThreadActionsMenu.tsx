/**
 * THE THREAD'S OVERFLOW MENU — leaving, reporting and blocking.
 *
 * ── Leaving is this pair's own verb, and the reason the menu always exists ─
 *
 * Until stapel-chat 0.8.5 `DELETE /conversations/{id}` answered 405: there was
 * no way off a thread at all, so the only entries this menu could ever hold
 * came from somewhere else, and with neither wired it drew nothing. Leaving is
 * @stapel/chat-react's own — one endpoint, in the module this package pairs
 * with — so the control is always here and the menu is never empty.
 *
 * ── Report and block still arrive as host slots ───────────────────────────
 *
 * A person being harassed used to have to leave the conversation, find the
 * other party's profile and hope the product had a control there. Both verbs
 * exist in the fleet — `@stapel/moderation-react` ships
 * `ReportButton`/`ReportSheet`, `@stapel/profiles-react` ships
 * `useBlock`/`useUnblock`/`useRelationship` — and both are PEERS of this pair,
 * which may not import either. So they arrive as host-supplied slots on the
 * runtime (`model/slots.ts`) and this component is where they are offered
 * from. Unwired = absent: a menu entry that is visibly offered and does
 * nothing is worse than one that is not there.
 *
 * WHAT HAPPENS AFTER A BLOCK, so the thread does not look broken: stapel-chat
 * 0.6.1 refuses to CREATE a thread for a blocked pair and refuses a send with
 * `error.403.chat_send_refused`, while still serving the history. The
 * correspondence therefore stays exactly where it was and the composer
 * answers with that code's own sentence through the ordinary error fold —
 * nothing here has to fake a "you blocked this person" state, and nothing
 * here may, because the same code is deliberately returned in both directions
 * so a block cannot be detected from the outside.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex } from "antd";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { useChatRuntime } from "../model/context.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import {
  LeaveConversationDialog,
  LeaveConversationTrigger,
} from "./LeaveConversation.js";

/**
 * Three dots in `currentColor` — the house icon convention (no icon dep).
 *
 * Exported (module-locally; NOT from the `/default` barrel) because the inbox
 * row's menu is the same affordance on another screen, and two hand-drawn
 * copies of one glyph drift.
 */
export function OverflowGlyph(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export interface ThreadActionsMenuProps {
  readonly conversationId: string;
  /** The other person, or `null` for a group / support thread. */
  readonly counterpartyId: string | null;
  readonly viewerId: string | null;
  /**
   * The caller left, and the `204` has landed. The thread screen closes
   * itself here — what it is showing is no longer on this person's list.
   */
  readonly onLeft?: (conversationId: string) => void;
}

export function ThreadActionsMenu(props: ThreadActionsMenuProps): ReactElement {
  const t = useT();
  const runtime = useChatRuntime();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const Report = runtime.slots.report;
  const Block = runtime.slots.block;

  const close = (): void => {
    setOpen(false);
  };
  const slotProps = {
    conversationId: props.conversationId,
    counterpartyId: props.counterpartyId,
    viewerId: props.viewerId,
    close,
  };

  return (
    <>
      <Button
        type="text"
        icon={<OverflowGlyph />}
        // An icon-only control carries its name, and the name is the one the
        // dialog it opens is titled with.
        aria-label={t(CHAT_I18N_KEYS.threadMenu)}
        onClick={() => setOpen(true)}
        data-testid="chat-thread-menu-open"
        data-analytics="none"
        data-analytics-reason="opens a menu of host-supplied actions; the host app wraps its own controls with tracked()"
      />
      {/* A bottom sheet on a phone, a modal above it — the fleet dialog rule,
          stated once in the token bridge and never re-decided here. */}
      <SkinDialog
        open={open}
        onClose={close}
        title={t(CHAT_I18N_KEYS.threadMenu)}
        dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
        data-testid="chat-thread-menu"
      >
        <Flex vertical gap={spacing[3]} style={{ width: "100%" }}>
          {Report !== undefined ? <Report {...slotProps} /> : null}
          {Block !== undefined ? <Block {...slotProps} /> : null}
          {/* Last: it is the exit, not the first thing to try. */}
          <LeaveConversationTrigger
            onPress={() => {
              // The menu steps out of the way BEFORE the confirmation opens —
              // and the confirmation is a sibling of this sheet, not a child,
              // so closing does not unmount it (`LeaveConversation.tsx`).
              close();
              setLeaving(true);
            }}
          />
        </Flex>
      </SkinDialog>
      <LeaveConversationDialog
        conversationId={props.conversationId}
        open={leaving}
        onClose={() => setLeaving(false)}
        {...(props.onLeft !== undefined ? { onLeft: props.onLeft } : {})}
      />
    </>
  );
}
