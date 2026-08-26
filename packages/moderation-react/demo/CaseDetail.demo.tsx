/**
 * The case card: the content, the trail, and the two acts, each with its gate.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CaseDetail } from "../src/default/admin/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  CASE_DETAIL,
  CASE_DETAIL_CLAIMED,
  CASE_DETAIL_NO_CONTENT,
} from "./_fixtures.js";

/** `/cases/<id>/events` is fetched only once the history tab asks for it. */
const READABLE: DemoHandlers = { "/cases/": CASE_DETAIL };
const UNREADABLE: DemoHandlers = { "/cases/": CASE_DETAIL_NO_CONTENT };
const HELD_BY_COLLEAGUE: DemoHandlers = { "/cases/": CASE_DETAIL_CLAIMED };

function Card(props: {
  handlers: DemoHandlers;
  caseId: string;
  viewerId?: string;
}): ReactElement {
  return (
    <ModerationDemoHarness handlers={props.handlers}>
      <CaseDetail
        open
        caseId={props.caseId}
        onClose={() => {}}
        {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
      />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.case",
  title: "Case card (staff)",
  description:
    "`ContentDTO.available` is explicit on the wire so this card can draw a failed read as a failed read: 'this app serves no content for this kind of item' and 'the post is blank' are different findings that lead to opposite decisions, and a moderator must never be handed an empty box that looks like empty content. Claim, release, rescan and the verdict are all gated by the LEASE the server enforces silently — it takes a case back when `claimed_until` passes — and each shut control states its own reason beside it rather than in a tooltip a disabled button would never fire. A verdict that also sanctions the author goes through a confirmation whose button says what it does.",
  component: CaseDetail,
  tokens: ["surface-raised", "border", "warning", "error"],
  variants: {
    default: {
      description:
        "Content read live, one complaint, and a machine verdict that punted to a person.",
      viewport: "desktop",
      step: "content_available",
      render: () => <Card handlers={READABLE} caseId={CASE_DETAIL.id} />,
    },
    "no-content": {
      description:
        "The host registered this target type without a content function — the card says so instead of showing nothing.",
      viewport: "phone",
      step: "no_content_function",
      render: () => (
        <Card handlers={UNREADABLE} caseId={CASE_DETAIL_NO_CONTENT.id} />
      ),
    },
    "held-by-another": {
      description:
        "A colleague holds the lease: every write is shut and each one says why. An active sanction is already on the author, and lifting it is confirmed with the note that goes on the record.",
      viewport: "phone",
      step: "lease_other",
      render: () => (
        <Card handlers={HELD_BY_COLLEAGUE} caseId={CASE_DETAIL_CLAIMED.id} />
      ),
    },
  },
});
