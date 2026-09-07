import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, loadStateFromQuery } from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { MediaUrl, Recording } from "../api/types.js";
import { isProcessingStatus } from "../api/types.js";
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
   * Nothing is stored under this recording (`409
   * recording_media_not_stored`) — a DIFFERENT sentence from "delivery is
   * down", and a skin must not collapse the two into one dead player.
   *
   * Read it together with {@link RecordingMediaBag.isConverting}: the same 409
   * covers two very different situations since backend 0.22.0.
   */
  readonly isNotStored: boolean;
  /**
   * The same `409` — but the recording is still mid-pipeline, so what it means
   * is "not yet", not "never".
   *
   * The module keeps AUDIO. A container is transport, deleted as soon as its
   * track is out, and until the convert stage has run there is no stored
   * object to sign — so a recording that is `queued`/`analyzing`/`normalizing`
   * answers its media read `409` on the way to being playable. Surfacing that
   * as "this recording has no media file" tells a person their upload is lost
   * while it is being transcribed; it is a WAIT, and the detail read is
   * already polling towards it.
   */
  readonly isConverting: boolean;
  /** Storage cannot sign right now (`503 recording_media_unavailable`). */
  readonly isUnavailable: boolean;
  /** Mint a fresh URL now (the manual half of the automatic refresh). */
  refresh(): void;
}

/**
 * Headless media source for one recording — renderless wrapper over
 * `GET /recordings/{id}/media`.
 *
 * **This is the only path to the bytes, and the bytes are AUDIO.** The bucket
 * is deliberately not anonymously readable (audit STORE-01), so a player
 * without this component has nothing to play; and what it signs is the
 * extracted mono track, never the container someone uploaded — that is
 * transport and the module deletes it. The URL is short-lived and the expiry
 * travels with it, which is why this is a load state that re-mints itself
 * rather than a string fetched once: a player that caches the first URL dies
 * mid-listen.
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
  const notStored = hasErrorCode(error, "error.409.recording_media_not_stored");
  return props.children({
    state: loadStateFromQuery(query),
    gate,
    isNotStored: notStored,
    isConverting: notStored && isProcessingStatus(recording.status),
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
