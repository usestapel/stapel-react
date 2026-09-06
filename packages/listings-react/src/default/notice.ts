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
 */
import { useCallback } from "react";
import { App, message as staticMessage } from "antd";

/** Say one short sentence. Resolved copy — this is the skin, not a bag. */
export type Notice = (text: string) => void;

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
  return useCallback(
    (text: string): void => {
      if (typeof contextual === "function") {
        contextual(text, NOTICE_SECONDS);
        return;
      }
      // No `<App>` above us. antd's static entry renders its own holder into
      // the document, which is exactly right for a host that never opted in,
      // and is a no-op on a server where there is no document to render into.
      if (typeof document === "undefined") return;
      staticMessage.success(text, NOTICE_SECONDS);
    },
    [contextual]
  );
}
