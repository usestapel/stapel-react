/**
 * THE ONE QUESTION THIS PRODUCT ASKS BEFORE A DESTRUCTIVE-LOOKING PRESS — and
 * the reason the frames below are worth photographing.
 *
 * `DELETE /conversations/{id}` (stapel-chat 0.8.5) is the caller LEAVING. It
 * deletes nothing: every message stays, the other party keeps the thread
 * exactly as it was, the leaver still reaches their own history by id, and the
 * next authored reply brings the thread back. Two people press this control
 * meaning two different things — "tidy my inbox" and "destroy this for both of
 * us" — and only one of them is what happens.
 *
 * So the catalogue photographs the SENTENCE, not the button: the confirmation
 * is the only place the product ever says which of the two this is, and the
 * shot is the artefact a reviewer can read it in.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { Flex, Typography } from "antd";
import {
  LeaveConversationDialog,
  LeaveConversationTrigger,
} from "../src/default/LeaveConversation.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import { ChatDemoHarness, DEMO_THREAD_ID } from "./_harness.js";

/**
 * Demo CONTENT, not copy: the sheet the trigger is offered from is a HOST's
 * menu of slots plus this pair's own exit, and the catalogue needs a line of
 * chrome around the button so the frame reads as a menu rather than as a lone
 * red button on a page.
 */
const DEMO_MENU_TITLE = "Conversation options";
const DEMO_ASIDE =
  "Nothing has been sent yet - the question is asked before the request.";

/** The trigger as it sits in the overflow sheet, with nothing else wired. */
function Menu(): ReactElement {
  return (
    <ChatDemoHarness socket="off">
      <ChatSkinTheme surface="raised">
        <Flex vertical gap={spacing[3]} style={{ padding: spacing[4], minWidth: 0 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {DEMO_MENU_TITLE}
          </Typography.Title>
          <LeaveConversationTrigger onPress={() => undefined} />
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {DEMO_ASIDE}
          </Typography.Paragraph>
        </Flex>
      </ChatSkinTheme>
    </ChatDemoHarness>
  );
}

/**
 * The confirmation, photographed OPEN — a state reached only by a click is a
 * state the catalogue never sees, and this one is the whole subject.
 *
 * It opens on a TICK rather than on the first frame because a dialog is a
 * portal and portals cannot be server-rendered; the catalogue's static pass
 * renders the closed frame (which is nothing) and the mounted screen a person
 * or a shot runner looks at is the open one.
 */
function Question(): ReactElement {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handle = setTimeout(() => {
      setOpen(true);
    }, 0);
    return () => {
      clearTimeout(handle);
    };
  }, []);
  return (
    <ChatDemoHarness socket="off">
      <div style={{ minHeight: 320 }}>
        <LeaveConversationDialog
          conversationId={DEMO_THREAD_ID}
          open={open}
          onClose={() => undefined}
        />
      </div>
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.leave",
  title: "Leaving a conversation (default skin)",
  description:
    "The way off a thread, and the sentence that says what that is. The verb on the wire is DELETE and the act is not a delete — the conversation leaves ONE person's list while every message, the other party's copy and the leaver's own access by id stay untouched, and a reply from the other side brings it back. The confirmation is the only place that difference is ever stated, so it is the frame worth having.",
  component: LeaveConversationDialog,
  covers: ["LeaveConversationTrigger"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    default: {
      description:
        "Phone. The confirmation is a bottom sheet — the fleet dialog rule — and it says both halves in one sentence: what happens to your list, and what the other person keeps. 'Leave' is the affirmative, never 'Delete', because the module deletes nothing and copy that said so would be inviting a press for the wrong reason.",
      viewport: "phone",
      step: "asked",
      render: () => <Question />,
    },
    "in-the-menu": {
      description:
        "Where the control is offered from — the thread's overflow sheet and, identically, an inbox row's menu — at desk width. It is last in that list because it is the exit and not the first thing to try, and it opens the question rather than acting: the trigger holds no state of its own, so the menu can close before the confirmation appears without taking the confirmation down with it.",
      viewport: "desktop",
      step: "offered",
      render: () => <Menu />,
    },
  },
});
