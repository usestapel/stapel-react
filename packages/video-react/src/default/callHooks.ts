/**
 * The three hooks a call on a phone does not survive without.
 *
 * Every one of these is a fix for an observed production failure in the
 * meettoday conference client, not a nicety, and each fails in a way that
 * looks like something else — which is why they are ported verbatim in
 * BEHAVIOUR rather than reinvented from the platform docs.
 *
 * They live in `/default` and not in the headless entry because all three
 * touch the DOM and one of them mounts a `<video>` element. A host drawing its
 * own call UI is welcome to import them; nothing here is antd.
 */
import { useEffect, useRef } from "react";

/**
 * `play()` does not always return a promise.
 *
 * It was a `void` method before the Promise-returning version was specified,
 * and the old shape survives in older Safari — the very engine the wake-lock
 * fallback below exists for — as well as in jsdom. Calling `.catch()` on the
 * result therefore throws `undefined is not an object` on exactly the
 * platforms these hooks were written to support, which is a spectacular way
 * to fail: the fallback for old browsers, crashing on old browsers.
 */
export function playQuietly(element: HTMLMediaElement): Promise<void> {
  try {
    return Promise.resolve(element.play()).then(
      () => undefined,
      () => undefined
    );
  } catch {
    return Promise.resolve();
  }
}

/**
 * Stop Android from disconnecting the call when the screen locks.
 *
 * The failure: on Android, locking the screen or backgrounding Chrome mid-call
 * silently killed audio and mic — the room was actually DISCONNECTED, not
 * muted. iOS was fine, which is what made it read as an Android quirk rather
 * than as a bug with a cause.
 *
 * The cause, read out of `livekit-client`'s own source: `Room.connect()` adds
 * a `freeze` listener UNCONDITIONALLY. `pagehide` and `beforeunload` sit behind
 * the `disconnectOnPageLeave` option; `freeze` does not, and its handler calls
 * `disconnect()`. `freeze` is the Page Lifecycle event Chrome fires when it
 * suspends a backgrounded tab, and a locked screen counts.
 *
 * The lever: Chrome's freeze policy EXEMPTS a page it believes is actively
 * playing media, and the Media Session API is exactly how a page makes that
 * claim. So registering metadata and setting `playbackState = "playing"` — with
 * no-op action handlers, because the platform wants them — keeps the tab out
 * of the freeze path entirely.
 *
 * There is no feature test that would tell you any of this, which is why the
 * explanation is here rather than a link.
 */
export function useMediaSession(active: boolean, title: string, artist: string): void {
  useEffect(() => {
    if (!active) return undefined;
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    const session = (nav as unknown as { mediaSession?: MediaSession } | undefined)
      ?.mediaSession;
    if (session === undefined) return undefined;

    const MD = (globalThis as { MediaMetadata?: typeof MediaMetadata })
      .MediaMetadata;
    const previous = session.metadata;
    try {
      if (typeof MD === "function") {
        session.metadata = new MD({ title, artist });
      }
      session.playbackState = "playing";
      // Chrome wants handlers to treat the page as a media surface at all; a
      // no-op is the correct body, because pausing a call is not a thing.
      session.setActionHandler("play", () => undefined);
      session.setActionHandler("pause", () => undefined);
    } catch {
      /* an engine that has the object and refuses the writes is a phone that
       * keeps its old behaviour, not a broken call */
    }

    return () => {
      try {
        session.playbackState = "none";
        session.metadata = previous;
        session.setActionHandler("play", null);
        session.setActionHandler("pause", null);
      } catch {
        /* leaving a stale metadata entry behind is harmless */
      }
    };
  }, [active, title, artist]);
}

/**
 * Keep the screen awake for the length of the call.
 *
 * LiveKit playing remote media does NOT keep a screen on by itself, and once
 * the screen sleeps the audio drops with it — verified on a real phone, which
 * is the only way this is ever verified.
 *
 * Two tiers, because the good API is not everywhere:
 *
 * 1. `navigator.wakeLock.request("screen")`, re-acquired on `visibilitychange`
 *    — the browser RELEASES the lock whenever the page is hidden, so a hook
 *    that acquires once and trusts it loses the lock the first time somebody
 *    peeks at a notification.
 * 2. Where that does not exist (older iOS Safari), a hidden muted looping
 *    inline `<video>` — the NoSleep.js trick. It is ugly and it works, and the
 *    alternative is a call that dies when a person stops touching the phone.
 */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    const doc = (globalThis as { document?: Document }).document;
    if (doc === undefined) return undefined;

    const lock = nav as unknown as
      | { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } }
      | undefined;
    let released = false;

    const acquire = async (): Promise<void> => {
      if (released || lock?.wakeLock === undefined) return;
      try {
        sentinel.current = await lock.wakeLock.request("screen");
      } catch {
        /* denied by policy, or the document was not visible — the
         * visibilitychange handler tries again when it is */
      }
    };

    const onVisible = (): void => {
      if (doc.visibilityState === "visible") void acquire();
    };

    if (lock?.wakeLock !== undefined) {
      void acquire();
      doc.addEventListener("visibilitychange", onVisible);
    } else {
      // The fallback. Muted + playsInline + loop is what makes it legal to
      // autoplay; `display:none` would make some engines drop it, so it is
      // one transparent pixel instead.
      const element = doc.createElement("video");
      element.setAttribute("playsinline", "");
      element.setAttribute("muted", "");
      element.setAttribute("loop", "");
      element.muted = true;
      element.style.position = "fixed";
      element.style.width = "1px";
      element.style.height = "1px";
      element.style.opacity = "0";
      element.style.pointerEvents = "none";
      doc.body.appendChild(element);
      video.current = element;
      void playQuietly(element);
    }

    return () => {
      released = true;
      doc.removeEventListener("visibilitychange", onVisible);
      const held = sentinel.current;
      sentinel.current = null;
      void held?.release().catch(() => undefined);
      const held2 = video.current;
      video.current = null;
      if (held2 !== null) {
        held2.pause();
        held2.remove();
      }
    };
  }, [active]);
}

/**
 * Keep a backgrounded Android tab out of the timer throttle.
 *
 * The second half of the screen-lock fix, and the reason the first one alone
 * was not enough: preventing `freeze` keeps the tab ALIVE, but Chrome still
 * throttles a background tab's timers and sockets hard, which starves WebRTC's
 * own keepalives until ICE times out around thirty seconds in. The symptom is
 * identical to the freeze bug — a call that dies in a pocket — with a
 * completely different cause.
 *
 * The lever is Chrome's "tab is audible" classification, which is throttled
 * far less. So: one continuous oscillator at a gain of 0.0001. Inaudible, and
 * NOT zero — a literal zero may not count as audible playback, which would
 * make the whole thing a no-op that looks like it is working.
 *
 * Autoplay policy can leave the context suspended; the next real gesture
 * resumes it, which is why the listeners are here rather than a one-shot try.
 */
export function useAudioKeepAlive(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (typeof Ctor !== "function") return undefined;

    let context: AudioContext;
    try {
      context = new Ctor();
    } catch {
      return undefined;
    }
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 20;
    oscillator.connect(gain);
    gain.connect(context.destination);
    try {
      oscillator.start();
    } catch {
      /* already started is not a failure worth a broken call */
    }

    const resume = (): void => {
      void context.resume().catch(() => undefined);
    };
    const doc = (globalThis as { document?: Document }).document;
    if (context.state === "suspended" && doc !== undefined) {
      doc.addEventListener("pointerdown", resume, { once: true });
      doc.addEventListener("touchstart", resume, { once: true });
      doc.addEventListener("keydown", resume, { once: true });
    }

    return () => {
      doc?.removeEventListener("pointerdown", resume);
      doc?.removeEventListener("touchstart", resume);
      doc?.removeEventListener("keydown", resume);
      try {
        oscillator.stop();
      } catch {
        /* stopping a stopped oscillator */
      }
      oscillator.disconnect();
      gain.disconnect();
      void context.close().catch(() => undefined);
    };
  }, [active]);
}
