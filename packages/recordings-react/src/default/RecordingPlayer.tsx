import type { CSSProperties, ReactElement } from "react";
import { Button, Skeleton, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, GatedButton } from "@stapel/tokens-antd/skin";
import { cssVar, radii } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { RecordingMedia } from "../headless/RecordingMedia.js";
import type { RecordingMediaBag } from "../headless/RecordingMedia.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { RefreshIcon } from "./icons.js";
import { rowStyle, stackStyle } from "./layout.js";
import type { MediaSync } from "./useMediaSync.js";

const playerStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: radii.md,
  background: cssVar("surface-sunken"),
};

/**
 * Playback for one recording.
 *
 * There is no waveform, and that is a decision rather than an omission: a real
 * waveform means decoding the whole media file in the browser (Web Audio) or a
 * peaks endpoint the backend does not serve, and a fake one — a row of random
 * bars — is a lie about the audio. The native transport is what a person can
 * already use, it is keyboard-accessible for free, and it is what a phone
 * hands to the lock screen.
 *
 * What this component DOES own is the part a bare `<audio src>` cannot do: the
 * URL is short-lived and minted on request (the bucket is not anonymously
 * readable — audit STORE-01), so it re-mints before expiry, and it renders the
 * three refusals as three different sentences. "Nothing was stored", "delivery
 * is down" and "there is nothing to play yet" are not the same event, and a
 * player that shows one dead transport for all of them tells the person
 * nothing.
 *
 * `sync` is optional: pass it and the transcript pane follows playback and can
 * seek it; omit it and this is a standalone player.
 */
export function RecordingPlayer(props: {
  recording: Pick<Recording, "id" | "status" | "title">;
  /** Shared playback position — see {@link useMediaSync}. */
  sync?: MediaSync;
  "data-testid"?: string;
}): ReactElement {
  const testId = props["data-testid"] ?? "recording-player";
  return (
    <RecordingMedia recording={props.recording}>
      {(bag) => <PlayerBody bag={bag} testId={testId} sync={props.sync} />}
    </RecordingMedia>
  );
}

function PlayerBody(props: {
  bag: RecordingMediaBag;
  testId: string;
  sync: MediaSync | undefined;
}): ReactElement {
  const t = useT();
  const { bag, sync, testId } = props;

  if (!bag.gate.available) {
    return (
      <section style={stackStyle} data-testid={testId}>
        <Typography.Text strong>
          {t(RECORDINGS_I18N_KEYS.playerHeading)}
        </Typography.Text>
        <GatedButton
          gate={bag.gate}
          testId={`${testId}-gate`}
          data-analytics="none"
          data-analytics-reason="blocked control; the reason is rendered beside it"
        >
          {t(RECORDINGS_I18N_KEYS.playerHeading)}
        </GatedButton>
      </section>
    );
  }

  const arm = bag.state;
  return (
    <section style={stackStyle} data-testid={testId}>
      <div style={{ ...rowStyle, justifyContent: "space-between" }}>
        <Typography.Text strong>
          {t(RECORDINGS_I18N_KEYS.playerHeading)}
        </Typography.Text>
        <Button
          size="small"
          icon={<RefreshIcon />}
          aria-label={t(RECORDINGS_I18N_KEYS.playerRefresh)}
          onClick={bag.refresh}
          data-analytics="none"
          data-analytics-reason="re-minting a short-lived URL is plumbing"
        />
      </div>
      {arm.status === "loading" ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t(RECORDINGS_I18N_KEYS.playerPreparing)}
          data-testid={`${testId}-loading`}
        >
          <Skeleton.Input active block />
        </div>
      ) : null}
      {arm.status === "failed" ? (
        <ErrorAlert
          message={
            bag.isNotStored
              ? t(RECORDINGS_I18N_KEYS.playerNotStored)
              : bag.isUnavailable
                ? t(RECORDINGS_I18N_KEYS.playerUnavailable)
                : undefined
          }
          {...(bag.isNotStored || bag.isUnavailable
            ? {}
            : { thrown: arm.error })}
          onRetry={bag.refresh}
          testId={`${testId}-failed`}
        />
      ) : null}
      {arm.status === "ready" ? (
        // The transcript pane beside this element IS the caption surface: it
        // carries the same text, follows playback, and seeks it back.
        <audio
          ref={sync?.mediaRef}
          src={arm.data.url}
          controls
          preload="metadata"
          style={playerStyle}
          aria-label={t(RECORDINGS_I18N_KEYS.playerLabel)}
          onTimeUpdate={sync?.handleTimeUpdate}
          data-testid={`${testId}-audio`}
        />
      ) : null}
    </section>
  );
}
