/**
 * REPORT AND BLOCK, from inside the conversation.
 *
 * Until now there was no way to do either from a thread: a person being
 * harassed had to leave the conversation, find the other party's profile and
 * hope the product had a control there. The two verbs exist in the fleet —
 * `@stapel/moderation-react` ships `ReportButton`/`ReportSheet`,
 * `@stapel/profiles-react` ships `useBlock`/`useUnblock`/`useRelationship` —
 * and both are PEERS of this pair, which may not import either. So they
 * arrive as host-supplied slots on the runtime (`model/slots.ts`) and this
 * component is the place they are offered from.
 *
 * WHAT HAPPENS AFTER A BLOCK, so the thread does not look broken: stapel-chat
 * 0.6.1 refuses to CREATE a thread for a blocked pair and refuses a send with
 * `error.403.chat_send_refused`, while still serving the history. The
 * correspondence therefore stays exactly where it was and the composer
 * answers with that code's own sentence through the ordinary error fold —
 * nothing here has to fake a "you blocked this person" state, and nothing
 * here may, because the same code is deliberately returned in both directions
 * so a block cannot be detected from the outside.
 *
 * NEITHER SLOT WIRED = NO CONTROL. An overflow button that opens a menu with
 * nothing in it is worse than no button: it promises an action the deployment
 * does not have.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex } from "antd";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { useChatRuntime } from "../model/context.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** Three dots in `currentColor` — the house icon convention (no icon dep). */
function OverflowGlyph(): ReactElement {
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
}

export function ThreadActionsMenu(
  props: ThreadActionsMenuProps
): ReactElement | null {
  const t = useT();
  const runtime = useChatRuntime();
  const [open, setOpen] = useState(false);
  const Report = runtime.slots.report;
  const Block = runtime.slots.block;
  if (Report === undefined && Block === undefined) return null;

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
        </Flex>
      </SkinDialog>
    </>
  );
}
