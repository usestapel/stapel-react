import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { DocShareLevel, SharedDocument } from "../api/types.js";
import {
  useSharedDocument,
  useSharedDocumentContent,
} from "../model/queries.js";
import type { DocumentText } from "../model/queries.js";
import { useSharedDownloadUrl } from "../model/mutations.js";

/** Render-prop bag for {@link SharedDocumentView}. */
export interface SharedDocumentViewBag {
  readonly token: string;
  /**
   * The bearer's STRIPPED envelope as a state a skin cannot flatten: title,
   * type, size, mime, the registry hints and the level — and nothing around
   * the document. No workspace, no folder, no owner, no star, no revisions
   * (axis §6): a link grants a document, not a seat, and history is withheld
   * besides because an old revision can hold text deleted on purpose since.
   */
  readonly state: LoadState<SharedDocument>;
  /** The body decoded as text, for a type that has one. `null` when the
   * content read was not asked for (see the `withContent` prop). */
  readonly content: LoadState<DocumentText> | null;
  /** What the link lets its holder do. Present so a bearer surface renders
   * read-only from the ENVELOPE instead of guessing from a 403 it has not hit. */
  readonly level: DocShareLevel | null;
  /**
   * True while this surface must not offer a write.
   *
   * Always true here, and deliberately not a guess: the token path has no
   * PUT at all, and an anonymous presenter never authors a write whatever
   * level the link carries (the journal and the revision history are
   * attributed by design). A holder at `edit` writes by opening the document
   * in the workspace, signed in — which is a host route, not this one.
   */
  readonly readOnly: true;
  /**
   * The link does not open anything: expired, revoked, or never existed.
   *
   * All three answer 404 ON PURPOSE — a bearer endpoint that distinguished
   * them would be an oracle for guessing tokens — so this is the only honest
   * sentence a surface can say, and inventing a more specific one would be
   * inventing it.
   */
  readonly notFound: boolean;
  /**
   * The deployment does not admit anonymous bearers
   * (`error.401.docs_share_auth_required`): the holder must sign in first, and
   * then this same URL works. A different remedy from {@link notFound}.
   *
   * Keyed on the CODE, never on the bare status: a plain 401 is the session
   * layer's business and core's client already owns it (refresh once, then
   * `sessionLost()`). Branching on `401` here would be a second, weaker copy
   * of that machinery — and it would also mislabel an expired session as
   * "this share needs a sign-in".
   */
  readonly authRequired: boolean;
  /** Mint a presigned download URL and hand it back (opaque, expiring). */
  download(): void;
  readonly downloadUrl: string | null;
  readonly isMintingDownload: boolean;
  readonly downloadError: StapelApiError | null;
  refetch(): void;
}

/** `error.401.docs_share_auth_required` — the one refusal on the bearer path
 * that is not a 404, because it names a remedy the holder can act on. */
const AUTH_REQUIRED_CODE = "error.401.docs_share_auth_required";

/**
 * Headless bearer view — everything a "somebody shared this with you" page
 * needs, and nothing that would leak the workspace behind it.
 *
 * This is the SEAM for the shared-link route, not the route: the page itself
 * (its URL shape, its chrome, whether it sits behind the host's shell) is
 * host composition, and a pair that shipped one would be deciding a customer's
 * routing for them. `@stapel/drive-react` deliberately does not build one
 * either.
 *
 * ```tsx
 * <SharedDocumentView token={params.token}>
 *   {({ state, notFound, download }) =>
 *     notFound ? <LinkDead/> : matchLoad(state, { … })}
 * </SharedDocumentView>
 * ```
 */
export function SharedDocumentView(props: {
  token: string;
  /**
   * Also read the BODY as text. Default: only for a type the registry says
   * has an editor (`editor_hint !== ""`) — a bearer page must not download
   * 40 MB of video to draw a filename, and "download-only" is a state, not a
   * failure.
   */
  withContent?: boolean;
  children: (bag: SharedDocumentViewBag) => ReactNode;
}): ReactNode {
  const query = useSharedDocument(props.token);
  const document = query.data ?? null;
  const wantsContent =
    props.withContent ??
    (document !== null && document.editor_hint.length > 0);
  const contentQuery = useSharedDocumentContent(props.token, {
    enabled: wantsContent,
  });
  const downloadMutation = useSharedDownloadUrl();

  const status = query.error?.status ?? null;

  return props.children({
    token: props.token,
    state: loadStateFromQuery(query),
    content: wantsContent ? loadStateFromQuery(contentQuery) : null,
    level: document?.level ?? null,
    readOnly: true,
    notFound: status === 404,
    authRequired: query.error?.code === AUTH_REQUIRED_CODE,
    download: () => {
      downloadMutation.mutate({ token: props.token });
    },
    downloadUrl: downloadMutation.data ?? null,
    isMintingDownload: downloadMutation.isPending,
    downloadError: downloadMutation.error ?? null,
    refetch: () => {
      void query.refetch();
      if (wantsContent) void contentQuery.refetch();
    },
  });
}
