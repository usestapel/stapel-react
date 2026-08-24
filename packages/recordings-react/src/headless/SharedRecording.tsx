import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type {
  MediaUrl,
  SharePermission,
  SharedRecording as SharedRecordingDto,
} from "../api/types.js";
import { shareGrants } from "../api/types.js";
import { useSharedMedia, useSharedRecording } from "../model/queries.js";
import { useUnlockShare } from "../model/mutations.js";
import { hasErrorCode } from "../flows/errors.js";

/** The media half of {@link SharedRecordingBag} — the share's own short-TTL URL. */
export interface SharedMediaBag {
  readonly state: LoadState<MediaUrl>;
  /** The share grants `media`; without it there is nothing to render. */
  readonly granted: boolean;
  refresh(): void;
}

/** Render-prop bag for {@link SharedRecording}. */
export interface SharedRecordingBag {
  /** The share's projection. Ready only once any passcode has been passed. */
  readonly state: LoadState<SharedRecordingDto>;
  /**
   * The link needs a passcode and we do not hold a verified token yet
   * (`401 share_passcode_required`). This is the gate's cue — a state of the
   * page, not an error to show as one.
   */
  readonly locked: boolean;
  /** Too many passcode attempts (`429 share_unlock_throttled`) — a named
   * lockout, not a generic failure. */
  readonly throttled: boolean;
  /** The link opens nothing: revoked, expired, or never existed. */
  readonly notFound: boolean;
  /** Present the passcode. */
  unlock(passcode: string): void;
  readonly isUnlocking: boolean;
  /** The unlock attempt's own failure (a wrong passcode, a lockout). */
  readonly unlockError: unknown;
  /**
   * What this link grants. Empty until the projection is readable — a viewer
   * branches on the GRANT, never on what it would like to show.
   */
  readonly permissions: readonly string[];
  /** `permissions.includes(p)`, spelled so a skin reads as the rule. */
  grants(permission: SharePermission): boolean;
  /** The share's media, when it grants `media`. */
  readonly media: SharedMediaBag;
  refetch(): void;
}

/**
 * Headless public share viewer — `GET /shares/{token}` plus its passcode gate
 * and its media.
 *
 * **Anonymous by design.** The link token in the path IS the credential: there
 * is no `stapel_jwt`, no session to wait for, and the surface must work for a
 * visitor who has never signed in. The passcode exchange
 * (`POST /shares/{token}/unlock`) hands back a short-lived token that then
 * travels as `X-Share-Unlock-Token` on this read and on the media read; it is
 * held in component state, not persisted, because it is a capability with an
 * expiry rather than a session.
 *
 * ```tsx
 * <SharedRecording linkToken={token}>
 *   {({ locked, unlock, state, grants }) => …}
 * </SharedRecording>
 * ```
 */
export function SharedRecording(props: {
  linkToken: string;
  children: (bag: SharedRecordingBag) => ReactNode;
}): ReactNode {
  const { linkToken } = props;
  const [unlockToken, setUnlockToken] = useState<string | undefined>(undefined);
  const unlockMutation = useUnlockShare();
  const query = useSharedRecording(
    linkToken,
    unlockToken !== undefined ? { unlockToken } : undefined
  );
  const error: unknown = query.error;
  const locked = hasErrorCode(error, "error.401.share_passcode_required");
  const shared = query.data;
  const granted =
    shared !== undefined ? shareGrants(shared, "media") : false;
  const mediaQuery = useSharedMedia(linkToken, {
    ...(unlockToken !== undefined ? { unlockToken } : {}),
    enabled: granted,
  });

  const unlock = useCallback(
    (passcode: string): void => {
      unlockMutation.mutate(
        { linkToken, passcode },
        {
          onSuccess: (result) => {
            setUnlockToken(result.unlock_token);
          },
        }
      );
    },
    [linkToken, unlockMutation]
  );

  const unlockError: unknown = unlockMutation.error;
  return props.children({
    state: loadStateFromQuery(query),
    locked,
    throttled: hasErrorCode(unlockError, "error.429.share_unlock_throttled"),
    notFound: hasErrorCode(error, "error.404.share_not_found"),
    unlock,
    isUnlocking: unlockMutation.isPending,
    unlockError,
    permissions: shared?.permissions ?? [],
    grants: (permission) =>
      shared !== undefined && shareGrants(shared, permission),
    media: {
      state: loadStateFromQuery(mediaQuery),
      granted,
      refresh: () => {
        void mediaQuery.refetch();
      },
    },
    refetch: () => {
      void query.refetch();
    },
  });
}
