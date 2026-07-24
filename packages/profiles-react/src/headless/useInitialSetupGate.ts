/**
 * `useInitialSetupGate` — the trigger side of the InitialSetupPrompt canon
 * (workspaces-org-program §B5): decides WHEN a host should surface an
 * initial-setup prompt, while {@link InitialSetupPrompt} /
 * `InitialSetupModal` are the WHAT. Two axes:
 *
 *  - `require` — what counts as "setup missing":
 *      `"displayName"`   → the profile has no non-blank `display_name`
 *                          (meettoday's join-a-call case, ex-`GuestNameModal`);
 *      `"initialSetup"`  → `initial_setup_passed` is not true (the ironmemo
 *                          onboarding case; also the invite-flow basic-data
 *                          step, §B4).
 *  - `mode` — how insistently:
 *      `"always"` → whenever required; no rate limit (the blocking-modal
 *                   case — a call CANNOT start without a display name);
 *      `"daily"`  → at most once per 24 h, measured from when the prompt was
 *                   last SHOWN (or skipped): the gate stamps
 *                   `stapel.profiles.initialSetup.lastPromptAt` (via
 *                   `@stapel/core`'s `createRepository` — see
 *                   `../model/initialSetupStorage.ts`) the moment it decides
 *                   to show, so a reload inside the window stays quiet.
 *
 * Session-readiness: the profile read underneath is {@link useMyProfile},
 * which is already gated on `useActiveSessionReady` (the pair's canon — the
 * 2026-07-17 incident hook shape), so `shouldShow` stays `false` until the
 * session settled AND the profile actually loaded — a gate never fires off a
 * missing profile, a still-bootstrapping session, or a signed-out visitor.
 *
 * ```tsx
 * const gate = useInitialSetupGate({ mode: "daily", require: "initialSetup" });
 * return <InitialSetupModal open={gate.shouldShow} onClose={gate.dismiss} />;
 * ```
 */
import { useCallback, useEffect, useState } from "react";
import { useMyProfile } from "../model/queries.js";
import {
  readInitialSetupLastPromptAt,
  recordInitialSetupPrompt,
} from "../model/initialSetupStorage.js";

/** "At most once per 24 h" (§B5 `mode: "daily"`). */
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InitialSetupGateOptions {
  /** `"always"` — no rate limit (blocking-modal hosts); `"daily"` — at most
   * once per 24 h per browser. */
  readonly mode: "always" | "daily";
  /** What "setup missing" means — a blank `display_name`, or
   * `initial_setup_passed` not yet true. */
  readonly require: "displayName" | "initialSetup";
}

export interface InitialSetupGate {
  /** Render the prompt now. `false` until the profile loaded AND setup is
   * missing AND (for `"daily"`) the 24 h window has passed. */
  readonly shouldShow: boolean;
  /** Hide the prompt for the rest of this mount (e.g. the user closed a
   * skippable modal) and refresh the daily stamp. The requirement itself is
   * untouched — a blocking `"always"` host simply never calls this. */
  dismiss(): void;
}

export function useInitialSetupGate(
  options: InitialSetupGateOptions
): InitialSetupGate {
  const { mode, require } = options;
  const query = useMyProfile();
  const profile = query.data;

  const [dismissed, setDismissed] = useState(false);
  // `"daily"` starts UNRESOLVED (null) — the async stamp read must land
  // before the gate may open, so a rate-limited reload never flashes the
  // prompt. `"always"` has nothing to resolve.
  const [rateLimited, setRateLimited] = useState<boolean | null>(
    mode === "daily" ? null : false
  );

  const displayName = profile?.["display_name"];
  const required =
    profile !== undefined &&
    (require === "displayName"
      ? !(typeof displayName === "string" && displayName.trim().length > 0)
      : profile["initial_setup_passed"] !== true);

  useEffect(() => {
    if (mode !== "daily") {
      setRateLimited(false);
      return;
    }
    // Only resolve (and stamp) once the prompt is actually required — a
    // fully-set-up profile must not burn the daily window.
    if (!required) return;
    let cancelled = false;
    void readInitialSetupLastPromptAt().then((last) => {
      if (cancelled) return;
      const now = Date.now();
      if (last !== undefined && now - last < DAY_MS) {
        setRateLimited(true);
      } else {
        setRateLimited(false);
        // Stamp at SHOW-time: "at most once per 24 h" measures from when the
        // user last saw the prompt, not from when they dismissed it.
        void recordInitialSetupPrompt(now);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, required]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    // Refreshing the stamp on dismiss keeps a "daily" host quiet for a full
    // window after an explicit close; harmless for "always" (no rate limit).
    void recordInitialSetupPrompt();
  }, []);

  return {
    shouldShow: required && !dismissed && rateLimited === false,
    dismiss,
  };
}
