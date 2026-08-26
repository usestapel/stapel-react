/**
 * Renders its children in a window with no WebAuthn API.
 *
 * `isWebauthnSupported()` asks the real `navigator`, which is the right thing
 * for a product and the wrong thing for a showcase: the browser looking at the
 * story usually HAS WebAuthn, so the "this browser cannot create passkeys"
 * state — the one the blocked-with-a-reason control exists for — could never
 * be photographed. This removes the API for the lifetime of the mount and puts
 * it back on unmount, so the story documents a real state instead of a mocked
 * screenshot of one.
 *
 * Demo-only: nothing in `src/` reaches for this.
 */
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export function NoWebauthn(props: { children: ReactNode }): ReactElement | null {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const creds = (navigator as { credentials?: unknown }).credentials;
    // `credentials` is a getter on the prototype; deleting the own property
    // does nothing, so it is shadowed and the shadow removed on cleanup.
    Object.defineProperty(navigator, "credentials", {
      value: undefined,
      configurable: true,
    });
    setReady(true);
    return () => {
      Object.defineProperty(navigator, "credentials", {
        value: creds,
        configurable: true,
      });
    };
  }, []);
  // Mounting the children only once the API is gone: a first render WITH
  // WebAuthn would resolve the gate to "available" and the story would open on
  // the state it is supposed to be documenting the absence of.
  return ready ? <>{props.children}</> : null;
}
