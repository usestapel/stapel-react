/**
 * A one-line confirmation, spoken once — the message seam this skin uses and
 * the reason it is not a new dependency.
 *
 * ── There is no fleet-wide toast primitive, and this does not invent one ──
 *
 * `@stapel/tokens-antd/skin` carries `ErrorAlert`, `EmptyState`,
 * `GatedControl`, `SkinDialog` and `SkinConfirm` — every way a pair states a
 * REFUSAL or asks a question — and nothing at all for "that worked". So the
 * seam here is antd's own, which this package already renders through:
 *
 *   1. `App.useApp().message` when the host mounts antd's `<App>`, which is
 *      the arrangement antd itself asks for — the notice then inherits the
 *      host's `ConfigProvider` theme, its locale and its container;
 *   2. antd's STATIC `message` otherwise, so a host that never mounted `<App>`
 *      still gets the confirmation instead of silence.
 *
 * Outside an `<App>`, `App.useApp()` returns `{message: {}, …}` — antd's own
 * default context — which is why the arm is chosen by asking whether the
 * function is there rather than by asking whether a provider is. A version
 * that assumed the context would have been a confirmation that worked in
 * every test and on no deployment.
 *
 * ── And a toast is never the ONLY copy of a confirmation ──────────────────
 *
 * A toast is transient by construction: it appears for three seconds
 * somewhere the person may not be looking, and on a phone it can land under a
 * thumb. So every caller here also paints the same sentence where the gesture
 * happened — `<ShareAction>` states "Link copied" inside the open menu, and
 * the heart's state is on the heart. This is the AMPLIFIER, never the record.
 * A future `SkinNotice` in the substrate replaces the body of this function
 * and nothing else; the callers already speak in resolved sentences.
 *
 * ── An amplifier may not outlive what it amplifies ────────────────────────
 *
 * Both arms hand the notice to a holder MOUNTED OUTSIDE this component tree —
 * antd's `<App>` holder in the first arm, and in the second a React root antd
 * renders into the document the first time the static entry is called. Neither
 * is unmounted by unmounting the surface that spoke, and a standing notice is
 * not an idle DOM node: `@rc-component/notification` counts its two seconds
 * down with a `requestAnimationFrame` LOOP (`useNoticeTimer`), which is live
 * work driven from a root nothing in this package owns.
 *
 * So the notices raised here are RETIRED when the surface that raised them
 * goes. Two things follow, and both are the intent:
 *
 *  - a person who presses the heart and immediately navigates away does not
 *    get "Saved" floating over the next page, about a listing they left;
 *  - nothing this pair started keeps running after the tree it started in is
 *    gone. Measured as CI flake: the detail page's heart toast kept stepping
 *    its rAF loop past the end of the test file that raised it, and the frame
 *    that landed after the environment was torn down threw
 *    `ReferenceError: window is not defined` out of react-dom — from a suite
 *    in which every test had passed.
 */
import { useCallback, useEffect, useRef } from "react";
import { App, message as staticMessage } from "antd";

/** Say one short sentence. Resolved copy — this is the skin, not a bag. */
export type Notice = (text: string) => void;

/**
 * What antd hands back for a raised notice: CALL it to close the notice early,
 * `then` it to learn that it closed on its own. Typed structurally rather than
 * imported (`antd/es/message/interface`) so this file keeps to antd's public
 * entry — the shape is antd's documented `MessageType` either way.
 */
type RaisedNotice = (() => void) & PromiseLike<unknown>;

/**
 * How long a confirmation stands, in seconds.
 *
 * Two, not antd's default three. Every notice this package raises confirms
 * something the person can already SEE — a filled heart, a sentence standing
 * in the open share menu — so it is an acknowledgement, not information, and
 * an acknowledgement that outstays the gesture is a strip of chrome sitting
 * over the page a thumb was about to press next.
 */
export const NOTICE_SECONDS = 2;

export function useNotice(): Notice {
  const app = App.useApp();
  const contextual = app.message.success;
  // The notices this surface has raised and that have not closed themselves
  // yet — see the header. A notice retires itself the moment it closes, so
  // this holds at most the handful still on screen.
  const standing = useRef<Set<RaisedNotice>>(new Set());
  useEffect(
    () => () => {
      const open = standing.current;
      standing.current = new Set();
      for (const close of open) close();
    },
    []
  );
  const hold = useCallback((raised: RaisedNotice): void => {
    standing.current.add(raised);
    const retire = (): void => {
      standing.current.delete(raised);
    };
    // Closed by its own timer, by our unmount, or by a host calling
    // `message.destroy()` — every ending resolves this, and a rejection is an
    // ending too. Nothing is awaited: the notice is already on screen.
    raised.then(retire, retire);
  }, []);
  return useCallback(
    (text: string): void => {
      if (typeof contextual === "function") {
        hold(contextual(text, NOTICE_SECONDS) as RaisedNotice);
        return;
      }
      // No `<App>` above us. antd's static entry renders its own holder into
      // the document, which is exactly right for a host that never opted in,
      // and is a no-op on a server where there is no document to render into.
      if (typeof document === "undefined") return;
      hold(staticMessage.success(text, NOTICE_SECONDS) as RaisedNotice);
    },
    [contextual, hold]
  );
}
