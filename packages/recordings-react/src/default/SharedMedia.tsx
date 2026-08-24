import type { ReactElement } from "react";
import { Skeleton, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import { cssVar, radii } from "@stapel/tokens";
import type { SharedMediaBag } from "../headless/SharedRecording.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { stackStyle } from "./layout.js";
import type { MediaSync } from "./useMediaSync.js";

/**
 * Playback on the public share surface.
 *
 * Separate from {@link RecordingPlayer} for one reason that matters: this URL
 * is minted with a SHORTER time-to-live, deliberately, because it leaves the
 * trust boundary. The refresh cadence follows that shorter `expires_in`, so a
 * visitor listening to a long recording does not lose it halfway through.
 *
 * When the link does not carry the `media` grant this renders the sentence
 * that says so, and no transport — a `view`-only link must never put up a
 * player that cannot play.
 */
export function SharedMedia(props: {
  media: SharedMediaBag;
  /** Shared playback position, so the shared transcript can follow and seek. */
  sync?: MediaSync;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const { media, sync } = props;
  const testId = props["data-testid"] ?? "shared-media";

  if (!media.granted) {
    return (
      <Typography.Text type="secondary" data-testid={`${testId}-blocked`}>
        {t(RECORDINGS_I18N_KEYS.shareMediaBlocked)}
      </Typography.Text>
    );
  }

  const arm = media.state;
  return (
    <section style={stackStyle} data-testid={testId}>
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
          thrown={arm.error}
          onRetry={media.refresh}
          testId={`${testId}-failed`}
        />
      ) : null}
      {arm.status === "ready" ? (
        // The shared transcript beside it is the caption surface.
        <audio
          ref={sync?.mediaRef}
          src={arm.data.url}
          controls
          preload="metadata"
          style={{
            width: "100%",
            minWidth: 0,
            borderRadius: radii.md,
            background: cssVar("surface-sunken"),
          }}
          aria-label={t(RECORDINGS_I18N_KEYS.playerLabel)}
          onTimeUpdate={sync?.handleTimeUpdate}
          data-testid={`${testId}-audio`}
        />
      ) : null}
    </section>
  );
}
