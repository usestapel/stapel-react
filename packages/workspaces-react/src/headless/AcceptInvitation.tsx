import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Member } from "../api/types.js";
import { useAcceptInvitation } from "../model/mutations.js";

/** Render-prop bag for {@link AcceptInvitation}. */
export interface AcceptInvitationBag {
  /** Accept the invitation identified by `token`. */
  accept(token: string): void;
  /** An accept call is in flight. */
  readonly isAccepting: boolean;
  /** The accept succeeded — the caller's new membership. */
  readonly isAccepted: boolean;
  /** The membership created on success, else null. */
  readonly member: Member | null;
  /** The accept failed. */
  readonly isError: boolean;
  /**
   * The error, when `isError`. A dead token surfaces a localizable
   * `StapelApiError` — `error.400.invitation_expired` /
   * `error.400.invitation_revoked` / `error.400.invitation_already_used` /
   * `error.404.invitation_not_found` — each carrying its backend remediation.
   */
  readonly error: StapelApiError | null;
}

/**
 * Headless invitation-accept control — a renderless "join by token" action.
 * Wires {@link useAcceptInvitation} and hands an {@link AcceptInvitationBag} to
 * `children`; bring your own accept button / status. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <AcceptInvitation>
 *   {({ accept, isAccepted, error }) => ( ... )}
 * </AcceptInvitation>
 * ```
 */
export function AcceptInvitation(props: {
  children: (bag: AcceptInvitationBag) => ReactNode;
}): ReactNode {
  const mutation = useAcceptInvitation();
  return props.children({
    accept: (token) => {
      mutation.mutate({ token });
    },
    isAccepting: mutation.isPending,
    isAccepted: mutation.isSuccess,
    member: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
  });
}
