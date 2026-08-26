/**
 * The operator console's REFUSAL state — a permission denial, told apart from
 * a fault.
 *
 * The visual pass found all four consoles printing the same generic "You do
 * not have permission to perform this action" inside an error alert with a
 * `Try again` button, while the page's own primary action (`Issue a key`,
 * `Assign a role`) stayed enabled above it. Every part of that is wrong:
 * retrying cannot change a role, an alert is the shape of a fault, and a
 * console offering to create something it may not even read is offering a
 * refusal one click later.
 *
 * So a 403 is its own state here: a stated explanation with no retry, and the
 * page's actions gated by the SAME verdict — through `GatedControl`, which
 * puts the reason beside the control instead of in a tooltip nobody can reach
 * on a disabled button.
 */
import type { ReactElement } from "react";
import { actionAvailable, actionBlocked, toFlowError, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { EmptyState } from "@stapel/tokens-antd/skin";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { ForbiddenIcon } from "../security/icons.js";

/** Is this failure the backend saying "not you", rather than "not now"? */
export function isForbidden(error: unknown): boolean {
  return toFlowError(error).status === 403;
}

/**
 * The gate every action on a console screen shares: blocked, with the reason,
 * exactly when the screen's own read was refused. A read that merely FAILED
 * leaves the actions available — a 500 on the list says nothing about whether
 * this operator may issue a key.
 */
export function forbiddenGate(error: unknown): ActionAvailability {
  return isForbidden(error)
    ? actionBlocked(AUTH_I18N_KEYS.adminForbiddenReason)
    : actionAvailable();
}

/** The body a refused console read renders: what happened, why no retry. */
export function ForbiddenState(props: { testId?: string }): ReactElement {
  const t = useT();
  return (
    <EmptyState
      icon={<ForbiddenIcon />}
      title={t(AUTH_I18N_KEYS.adminForbiddenTitle)}
      hint={t(AUTH_I18N_KEYS.adminForbiddenHint)}
      {...(props.testId !== undefined ? { testId: props.testId } : {})}
    />
  );
}
