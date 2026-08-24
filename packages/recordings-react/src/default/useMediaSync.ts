import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * The two-way link between the player and the transcript.
 *
 * A transcript synced to playback is not a list: the position moves four times
 * a second while the person is reading, and clicking a line moves the audio.
 * Both directions need the SAME media element, so the element's ref and the
 * current position live here — in the pane that owns both — rather than each
 * component keeping its own idea of where playback is.
 *
 * The position is rounded to whole seconds before it is stored. `timeupdate`
 * fires roughly every 250 ms, and re-rendering a thousand-segment transcript
 * four times a second to move a highlight that only changes every few seconds
 * is the difference between a smooth pane and a hot laptop.
 */
export interface MediaSync {
  /** Bind to the `<audio>`/`<video>` element. */
  readonly mediaRef: RefObject<HTMLMediaElement | null>;
  /** Whole seconds into the recording. */
  readonly currentTime: number;
  /** Wire to the element's `onTimeUpdate`. */
  handleTimeUpdate(): void;
  /** Move playback (a transcript click). Keeps playing if it was playing. */
  seek(seconds: number): void;
}

export function useMediaSync(): MediaSync {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handleTimeUpdate = useCallback((): void => {
    const element = mediaRef.current;
    if (element === null) return;
    setCurrentTime((previous) => {
      const next = Math.floor(element.currentTime);
      return next === previous ? previous : next;
    });
  }, []);

  const seek = useCallback((seconds: number): void => {
    const element = mediaRef.current;
    if (element === null) return;
    element.currentTime = seconds;
    setCurrentTime(Math.floor(seconds));
  }, []);

  return { mediaRef, currentTime, handleTimeUpdate, seek };
}
