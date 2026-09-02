import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type {
  DocShareLevel,
  DocShareSubjectKind,
  DocumentAccessGrant,
  DocumentShareLink,
} from "../api/types.js";
import { DOCS_SHARE_ERROR_CODES } from "../i18n/errorsMap.js";
import { useDocumentAccess, useDocumentLinks } from "../model/queries.js";
import {
  useGrantAccess,
  useMintShareLink,
  useRevokeAccess,
  useRevokeShareLink,
} from "../model/mutations.js";

/** What {@link ShareSheetBag.grant} is asked for — one subject, one level. */
export interface ShareGrantInput {
  readonly subjectKind: DocShareSubjectKind;
  /** For `subjectKind: "user"`. */
  readonly userId?: string;
  /** For `subjectKind: "ref"` — an opaque container reference whose KIND
   * (everything before the last colon) must have a registered resolver. */
  readonly ref?: string;
  /** Defaults to `"view"` — the closed default the backend also assumes. */
  readonly level?: DocShareLevel;
}


/** True when `error` is that code — `null`-safe, so a skin can ask about a
 * write that has not failed. */
function isCode(error: StapelApiError | null, code: string): boolean {
  return error !== null && error.code === code;
}

/** Render-prop bag for {@link ShareSheet}. */
export interface ShareSheetBag {
  readonly documentId: string;

  // ── people (the whitelist half) ────────────────────────────────────────────
  /** The grants as a state a skin cannot flatten (core's `LoadState`) —
   * "nobody has been given access" is only ever said about a load that
   * succeeded. */
  readonly grants: LoadState<readonly DocumentAccessGrant[]>;
  /**
   * Whether this caller may administer the whitelist at all.
   *
   * `GET …/access` is itself gated on `docs.share.whitelist`, so a 403 on the
   * listing IS the capability answer — there is no separate capabilities
   * endpoint and `DocumentPresenterDTO` carries no "can share" flag (checked
   * against the 0.6.1 schema). A sheet hides the people section on `false`
   * rather than offering an add form whose every submit is refused.
   */
  readonly canGrantAccess: boolean;
  /** At least one listed grant is inert because whitelist sharing is switched
   * off for this deployment — the sheet says "paused by configuration" and
   * still SHOWS the rows. */
  readonly whitelistSuspended: boolean;
  grant(input: ShareGrantInput): void;
  readonly isGranting: boolean;
  readonly grantError: StapelApiError | null;
  revokeGrant(accessId: string): void;
  readonly isRevokingGrant: boolean;
  readonly revokeGrantError: StapelApiError | null;

  // ── links (the bearer half) ────────────────────────────────────────────────
  /** The links, tokens included. Never log this. */
  readonly links: LoadState<readonly DocumentShareLink[]>;
  /** Whether this caller may mint/see links — a 403 on `GET …/links` (gated
   * on `docs.share.link`) is the answer, same shape as {@link canGrantAccess}. */
  readonly canMintLinks: boolean;
  /** At least one listed link is inert because link sharing is switched off. */
  readonly linksSuspended: boolean;
  /** Mint one. `level` above the deployment's `LINK.MAX_LEVEL` is REFUSED,
   * not clamped — see {@link levelRefused}. */
  mintLink(level?: DocShareLevel): void;
  readonly isMinting: boolean;
  readonly mintError: StapelApiError | null;
  revokeLink(linkId: string): void;
  readonly isRevokingLink: boolean;
  readonly revokeLinkError: StapelApiError | null;

  // ── the named refusals ─────────────────────────────────────────────────────
  /** The last write was refused because that WAY of sharing is switched off
   * for this deployment (`error.400.docs_share_mode_disabled`). */
  readonly modeDisabled: boolean;
  /**
   * The last mint was refused because the level asked for is above what this
   * deployment (or the granter's own mandate) may hand out
   * (`error.400.docs_share_level`).
   *
   * HONEST GAP: stapel-docs 0.6.1 publishes no endpoint that states
   * `LINK.MAX_LEVEL`, and the document envelope does not carry it either — so
   * the ceiling cannot be known BEFORE a mint, and a sheet learns it from
   * this refusal. Recorded for the backend rather than guessed at here: a
   * client-side cap invented from nothing is the second answer to an
   * authorization question, which is how a share mode ships half-enforced.
   */
  readonly levelRefused: boolean;
  /** The grant named both a user and a ref, or neither
   * (`error.400.docs_share_subject`). */
  readonly subjectRefused: boolean;
  /** No resolver is registered for that reference kind
   * (`error.400.docs_share_ref_kind`) — a host-configuration fact. */
  readonly refKindRefused: boolean;

  refetch(): void;
}

/**
 * Headless share sheet — the two halves of stapel-docs' share axis composed
 * into one renderless bag: the whitelist (who has access) and the bearer
 * links (who holds a URL), each with its own capability answer, its own
 * suspended-by-configuration state, and its own writes.
 *
 * Bring your own sheet. The product skin lives in
 * `@stapel/drive-react/default` (`ShareSheet`) — this is the seam it is built
 * on, and the seam a host builds its own on.
 *
 * Two properties worth keeping while re-skinning:
 *
 *  - A SUSPENDED ROW IS SHOWN, never filtered. The kill switch is a display
 *    state: an operator who cannot see an inert grant believes it was
 *    revoked, and re-enabling the mode then restores access nobody expected.
 *  - THE CAPABILITY IS THE 403. Both listings are gated on the sharing
 *    capabilities, so a refusal to list is the honest "you may not administer
 *    this" — the pair does not invent a second source for it.
 *
 * ```tsx
 * <ShareSheet documentId={doc.id}>
 *   {({ links, mintLink, canMintLinks }) => …}
 * </ShareSheet>
 * ```
 */
export function ShareSheet(props: {
  documentId: string;
  /** Mount the sheet's reads without opening it (default `true`). A closed
   * sheet passing `false` costs no request — and the two listings are not
   * free: one of them carries live tokens. */
  enabled?: boolean;
  children: (bag: ShareSheetBag) => ReactNode;
}): ReactNode {
  const enabled = props.enabled ?? true;
  const accessQuery = useDocumentAccess(props.documentId, { enabled });
  const linksQuery = useDocumentLinks(props.documentId, { enabled });
  const grantMutation = useGrantAccess(props.documentId);
  const revokeGrantMutation = useRevokeAccess(props.documentId);
  const mintMutation = useMintShareLink(props.documentId);
  const revokeLinkMutation = useRevokeShareLink(props.documentId);

  const grants = loadStateFromQuery(accessQuery);
  const links = loadStateFromQuery(linksQuery);

  // A 403 on either listing is the capability answer, not a failure to retry:
  // the endpoints ARE the gates (see `useDocumentAccess`).
  const canGrantAccess = accessQuery.error?.status !== 403;
  const canMintLinks = linksQuery.error?.status !== 403;

  const writeError =
    grantMutation.error ??
    mintMutation.error ??
    revokeGrantMutation.error ??
    revokeLinkMutation.error ??
    null;

  return props.children({
    documentId: props.documentId,

    grants,
    canGrantAccess,
    whitelistSuspended:
      grants.status === "ready" &&
      grants.data.some((row) => row.suspended === true),
    grant: (input) => {
      grantMutation.mutate({
        subject_kind: input.subjectKind,
        level: input.level ?? "view",
        ...(input.userId !== undefined ? { user_id: input.userId } : {}),
        ...(input.ref !== undefined ? { ref: input.ref } : {}),
      });
    },
    isGranting: grantMutation.isPending,
    grantError: grantMutation.error ?? null,
    revokeGrant: (accessId) => {
      revokeGrantMutation.mutate(accessId);
    },
    isRevokingGrant: revokeGrantMutation.isPending,
    revokeGrantError: revokeGrantMutation.error ?? null,

    links,
    canMintLinks,
    linksSuspended:
      links.status === "ready" &&
      links.data.some((row) => row.suspended === true),
    mintLink: (level) => {
      mintMutation.mutate(level !== undefined ? { level } : undefined);
    },
    isMinting: mintMutation.isPending,
    mintError: mintMutation.error ?? null,
    revokeLink: (linkId) => {
      revokeLinkMutation.mutate(linkId);
    },
    isRevokingLink: revokeLinkMutation.isPending,
    revokeLinkError: revokeLinkMutation.error ?? null,

    modeDisabled: isCode(writeError, DOCS_SHARE_ERROR_CODES.modeDisabled),
    levelRefused: isCode(mintMutation.error ?? null, DOCS_SHARE_ERROR_CODES.level),
    subjectRefused: isCode(
      grantMutation.error ?? null,
      DOCS_SHARE_ERROR_CODES.subject
    ),
    refKindRefused: isCode(
      grantMutation.error ?? null,
      DOCS_SHARE_ERROR_CODES.refKind
    ),

    refetch: () => {
      void accessQuery.refetch();
      void linksQuery.refetch();
    },
  });
}
