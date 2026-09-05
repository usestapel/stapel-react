/**
 * The ring, as a sound — best-effort by design.
 *
 * ── Autoplay refusal is a NORMAL state, not an error ──────────────────────
 *
 * Every browser refuses to play audio on a page the person has never
 * interacted with, and a ringtone is the one sound that has no preceding
 * gesture by definition: the whole point is that it arrives unannounced. So
 * this hook treats a refused `play()` as ordinary and silent. The OVERLAY is
 * the signal; the sound is an enhancement.
 *
 * meettoday has nothing to copy here — it has no `startAudio` path at all,
 * because its audio always follows a "Join" click. That click is the gesture
 * this path does not have.
 *
 * ── Why the asset is a prop ───────────────────────────────────────────────
 *
 * A ringtone is brand, like a colour. Baking a sound into a library means
 * every product on the shelf rings identically, and shipping bytes into a
 * bundle that most hosts would replace. So the URL comes from the host (a
 * design token, a CDN path, whatever it owns) and no sound is the honest
 * default rather than a placeholder beep.
 */
import { useEffect, useRef } from "react";
import { playQuietly } from "./callHooks.js";

export interface RingtoneOptions {
  /** The audio file. Absent = no sound, which is a working ring. */
  readonly src?: string;
  /** Volume, 0..1. */
  readonly volume?: number;
}

/**
 * Play `src` on a loop while `active`, if the browser lets us.
 *
 * Returns nothing: there is no "it failed" for a caller to render, because
 * there is nothing a person could do about it and nothing they need told. A
 * silent ring with a visible overlay is a ring.
 */
export function useRingtone(active: boolean, options?: RingtoneOptions): void {
  const src = options?.src;
  const volume = options?.volume ?? 1;
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!active || src === undefined || src.length === 0) return undefined;
    const Ctor = (globalThis as { Audio?: typeof Audio }).Audio;
    if (typeof Ctor !== "function") return undefined;

    const element = new Ctor(src);
    element.loop = true;
    element.volume = Math.min(1, Math.max(0, volume));
    audio.current = element;
    // `playQuietly` and not `element.play().catch(…)`: an autoplay refusal
    // REJECTS rather than throwing, and an unhandled rejection in a ring is a
    // console full of noise about a thing behaving correctly — but `play()`
    // also returns `undefined` on the older engines this whole file is for,
    // where `.catch` would throw instead.
    void playQuietly(element);

    return () => {
      audio.current = null;
      element.pause();
      element.src = "";
    };
  }, [active, src, volume]);
}

/**
 * Arm audio playback from a real user gesture.
 *
 * Call this from the accept handler. The gesture that answers a call is the
 * first one this page may have had, and playing (then immediately pausing) a
 * silent element inside it is what unlocks the audio context for everything
 * that follows — including the call's own remote track on the strictest
 * engines. Harmless where it was never locked.
 */
export function armAudioPlayback(): void {
  const Ctor = (globalThis as { Audio?: typeof Audio }).Audio;
  if (typeof Ctor !== "function") return;
  try {
    const element = new Ctor();
    element.muted = true;
    void playQuietly(element).then(() => {
      element.pause();
    });
  } catch {
    /* an engine that will not construct one is an engine that never locked */
  }
}
