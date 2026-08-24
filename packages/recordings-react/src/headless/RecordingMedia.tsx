import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, loadStateFromQuery } from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { MediaUrl, Recording } from "../api/types.js";
import { useRecordingMedia } from "../model/queries.js";
import { hasErrorCode } from "../flows/errors.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";

/** Render-prop bag for {@link RecordingMedia}. */
export interface RecordingMediaBag {
  /**
   * The minted URL, as a load state. Ready means a URL that is good until
   * `expires_at` — the hook re-mints before then, so a player that binds to
   * `state` follows the refresh without doing anything.
   */
  readonly state: LoadState<MediaUrl>;
  /**
   * Whether asking for media makes sense at all, with the reason when it does
   * not: nothing is stored before the upload finishes, and a deleted recording
   * has no bytes. A gate, not a `disabled` boolean — the reason is rendered
   * beside the control.
   */
  readonly gate: ActionAvailability;
  /**
   * The media object exists but is not stored (`409
   * recording_media_not_stored`) — a DIFFERENT sentence from "delivery is
   * down", and a skin must not collapse the two into one dead player.
   */
  readonly isNotStored: boolean;
  /** Storage cannot sign right now (`503 recording_media_unavailable`). */
  readonly isUnavailable: boolean;
  /** Mint a fresh URL now (the manual half of the automatic refresh). */
  refresh(): void;
}

/**
 * Headless media source for one recording — renderless wrapper over
 * `GET /recordings/{id}/media`.
 *
 * **This is the only path to the bytes.** The bucket is deliberately not
 * anonymously readable (audit STORE-01), so a player without this component
 * has nothing to play. The URL is short-lived and the expiry travels with it,
 * which is why this is a load state that re-mints itself rather than a string
 * fetched once: a player that caches the first URL dies mid-listen.
 *
 * ```tsx
 * <RecordingMedia recording={recording}>
 *   {({ state, gate }) => gate.available
 *     ? <LoadBoundary state={state}>{(media) => <audio src={media.url} controls />}</LoadBoundary>
 *     : <GatedControl gate={gate}>{(bind) => <button {...bind}>Play</button>}</GatedControl>}
 * </RecordingMedia>
 * ```
 */
export function RecordingMedia(props: {
  /** The recording whose media to reach. Its `status` is what decides whether
   * asking is meaningful at all. */
  recording: Pick<Recording, "id" | "status">;
  children: (bag: RecordingMediaBag) => ReactNode;
}): ReactNode {
  const { recording } = props;
  const gate = mediaGate(recording.status);
  const query = useRecordingMedia(recording.id, { enabled: gate.available });
  const error: unknown = query.error;
  return props.children({
    state: loadStateFromQuery(query),
    gate,
    isNotStored: hasErrorCode(error, "error.409.recording_media_not_stored"),
    isUnavailable: hasErrorCode(error, "error.503.recording_media_unavailable"),
    refresh: () => {
      void query.refetch();
    },
  });
}

/**
 * Is asking for a media URL meaningful for a recording in this status?
 *
 * Exported because the same answer decides whether a LIST row offers a play
 * affordance, and two places computing it separately is how they drift.
 */
export function mediaGate(status: string): ActionAvailability {
  if (status === "deleted") {
    return actionBlocked(RECORDINGS_I18N_KEYS.playerBlockedDeleted);
  }
  if (status === "created" || status === "uploading") {
    return actionBlocked(RECORDINGS_I18N_KEYS.playerBlockedNotReady);
  }
  return actionAvailable();
}
