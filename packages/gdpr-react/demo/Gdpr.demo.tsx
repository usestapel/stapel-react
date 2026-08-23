/** The closure read, in the three states an account can actually be in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { GdprProvider, useAccountClosure, useMyErasures } from "../src/index.js";
import { DemoCard, GdprDemoHarness, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

/**
 * The state almost every account is in — and the module says so with a **404**
 * (`error.404.gdpr.no_active_closure`). The hook folds it to `null`, so the
 * demo shows `ready` with no closure rather than a failure.
 */
const NOT_CLOSING: DemoHandlers = {
  "/user/account/close/status": [
    404,
    { localizable_error: "error.404.gdpr.no_active_closure" },
  ],
  "/me/erasures": [],
};

/** A closure in its cancellable grace, plus the entity erasures beside it. */
const IN_GRACE: DemoHandlers = {
  "/user/account/close/status": {
    status: "grace",
    grace_ends_at: "2026-09-23T09:00:00Z",
    can_cancel: true,
  },
  "/me/erasures": [
    {
      request_id: 17,
      subject_type: "recording",
      subject_key: "9f1c2d3e",
      workspace_id: "ws-42",
      state: "erasing",
      origin: "user",
      requested_at: "2026-08-24T09:00:00Z",
      due_at: "2026-09-23T09:00:00Z",
      // Later than `due_at`: our systems finish first, the last subprocessor's
      // contractual window closes weeks after.
      fully_erased_by: "2026-10-18T09:00:00Z",
      completed_at: null,
      grace_ends_at: null,
      parts: [],
      obligations: [],
      unreceipted_owners: ["media"],
    },
  ],
};

/** Grace is over: the erasure is running and cannot be recalled. */
const ERASING: DemoHandlers = {
  "/user/account/close/status": {
    status: "deleting",
    grace_ends_at: "2026-08-24T09:00:00Z",
    can_cancel: false,
  },
  "/me/erasures": [],
};

function Closure(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <GdprDemoHarness handlers={props.handlers}>
      <DemoCard heading="useAccountClosure">
        <ClosureBody />
      </DemoCard>
    </GdprDemoHarness>
  );
}

function ClosureBody(): ReactElement {
  const closure = useAccountClosure();
  const erasures = useMyErasures();
  return (
    <>
      <StepBadge step={closure.state.status} />
      <StepBadge step={`closure: ${closure.status ?? "—"}`} />
      <StepBadge step={`grace_ends_at: ${closure.graceEndsAt ?? "—"}`} />
      <StepBadge step={`can_cancel: ${String(closure.canCancel)}`} />
      {erasures.rows.status === "ready" &&
        erasures.rows.data.map((row) => (
          <StepBadge
            key={row.request_id}
            step={`${row.subject_type} · ${row.state} · due ${row.due_at} · all ${row.fully_erased_by}`}
          />
        ))}
    </>
  );
}

export default defineDemo({
  id: "gdpr.closure",
  title: "Account closure",
  description:
    "GET /gdpr/api/v1/user/account/close/status — is this account being deleted? The module answers 404 error.404.gdpr.no_active_closure for the state almost every account is in, so useAccountClosure folds that ONE code (never the status) into a null answer: the ready arm has two shapes and the failed arm keeps meaning 'we could not ask'. The grace variant shows the date the sweep task will act on, straight off the wire, and the pending erasure beside it carries BOTH clocks — due_at is when our systems are done, fully_erased_by is when the last subprocessor's window closes.",
  component: GdprProvider,
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Closure handlers={NOT_CLOSING} /> },
    grace: { render: () => <Closure handlers={IN_GRACE} /> },
    erasing: { render: () => <Closure handlers={ERASING} /> },
  },
});
