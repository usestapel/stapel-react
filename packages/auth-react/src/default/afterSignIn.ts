import { useEffect, useRef } from "react";
import { safeNextPath } from "../api/urls.js";
import { useAuthSessionState } from "../model/context.js";

/**
 * Leave the sign-in page once a sign-in lands on it.
 *
 * Fires on the TRANSITION to a non-guest `authenticated` session, not on
 * mount: a signed-in person who opens `/login` on purpose is not bounced,
 * and a guest session (`is_anonymous`) is not a sign-in.
 */
export function useAfterSignIn(
  onAuthenticated: (() => void) | undefined,
  afterSignInHref: string | undefined
): void {
  const state = useAuthSessionState();
  const signedIn = state.status === "authenticated" && state.user?.is_anonymous !== true;
  const before = useRef(signedIn);
  useEffect(() => {
    const was = before.current;
    before.current = signedIn;
    if (was || !signedIn) return;
    if (onAuthenticated !== undefined) {
      onAuthenticated();
      return;
    }
    if (typeof window === "undefined") return;
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    window.location.assign(next ?? afterSignInHref ?? "/");
  }, [signedIn, onAuthenticated, afterSignInHref]);
}
