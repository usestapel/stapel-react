/**
 * The mandate axis, provided rather than computed — the seam that lets a
 * surface READ the axis without importing whatever module happens to derive
 * it.
 *
 * `mandate.ts` holds the vocabulary (`MandateState`, `matchMandate`, the
 * discipline that `"unresolved"` is never a verdict). Deriving a value in
 * that vocabulary is a different job, and until now only one implementation
 * existed: `useMandateState()` in `@stapel/workspaces-react`, which reads the
 * session status and the workspace list's `is_guest`.
 *
 * That is the right derivation for a tenant product and the wrong dependency
 * for a public one. A storefront is anonymous by construction: it has no
 * workspaces, no membership list, no tenant switcher — and pulling
 * `workspaces-react` in so that a header can ask "is this person a member?"
 * would mount the multi-tenant metaphor inside a marketplace, plus its
 * queries, its i18n bundle and its wire types, to answer one boolean.
 *
 * So core takes the PROVIDER of the axis, not its computation:
 *
 *  - {@link MandateSource} — one property, `state`. Anything that can answer
 *    the question implements it: `workspaces-react` by asking the workspace
 *    list, a storefront by looking at whether there is a session at all.
 *  - {@link MandateProvider} — puts one source in context.
 *  - {@link useMandate} — reads it, ALWAYS defined (see below).
 *  - {@link useMandatePrincipal} — the same read, narrowed, `null` when the
 *    mandate is not known.
 *
 * Core stays free of the derivation: it never learns what a workspace is,
 * and the storefront never learns either.
 *
 * ── Why this file is not `mandate.tsx` ──────────────────────────────────────
 *
 * It would compile to the same `dist/mandate.js` as `mandate.ts`, which tsc
 * refuses ("would be overwritten by multiple input files"), and `./mandate.js`
 * would resolve to the `.ts` anyway. The seam's own name is a better one.
 *
 * ── No provider is an outage, not a refusal ─────────────────────────────────
 *
 * {@link useMandate} outside a provider returns `unresolved/unavailable`,
 * carrying an error that names the missing wiring. The two alternatives are
 * both worse, and both have precedent in this repo:
 *
 *  - Throwing (`useStapelConfig`'s answer to a missing config) blanks the
 *    subtree. A nav item or an account slot is the last thing that should be
 *    able to take a page down — the same reasoning that made
 *    `useOptionalCdnClient` swallow that throw in `profiles-react`.
 *  - Defaulting to a principal would invent a verdict out of a wiring bug.
 *    `"anonymous"` would silently hide a member's own surfaces; `"member"`
 *    would draw doors that answer 403. There is no honest default, which is
 *    exactly why `MandateState` has an arm for "we could not ask".
 */
import { createContext, createElement, useContext, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { StapelApiError } from "./errors.js";
import { mandateUnavailable } from "./mandate.js";
import type { MandatePrincipal, MandateState } from "./mandate.js";

/**
 * Something that can answer "does this person hold a mandate?".
 *
 * Deliberately one property and not a function: the answer is a rendered
 * value that a React implementation already recomputes when its inputs
 * change (`useMandateState` memoises it), so a source is what a host HAS in
 * hand at render time, not something the reader may call at will.
 */
export interface MandateSource {
  readonly state: MandateState;
}

const MandateContext = createContext<MandateState | null>(null);

/**
 * The error a mandate-less subtree reports. A `StapelApiError` so it travels
 * the one dialect every host already renders (`useErrorText` /
 * `toStapelApiError`), with a code that HAS a sentence in core's error floor
 * — an unknown code renders as a raw key, which is the failure mode
 * `i18n/coreErrors.ts` exists to prevent. The developer-facing detail lives
 * in `message`, where a stack trace shows it.
 */
const NO_MANDATE_SOURCE = new StapelApiError({
  code: "stapel.error.unknown",
  message:
    "useMandate() was called outside a <MandateProvider>. Wrap the app in " +
    "<MandateProvider source={…}> — `useMandateSource()` from " +
    "@stapel/workspaces-react in a tenant app, or a hand-written source in a " +
    "public one.",
  status: 0,
});

/** One frozen instance, so a mandate-less subtree does not hand out a fresh
 * object on every render — an unstable state would re-fire every effect that
 * depends on the axis, turning a wiring bug into a render loop. */
const NO_SOURCE_STATE: MandateState = mandateUnavailable(NO_MANDATE_SOURCE);

/**
 * Are these the same answer? The union is three fields wide, so the whole
 * value can be compared without a deep walk — and the thrown value is
 * compared by identity, which is right: two 502s are two outages.
 */
function sameMandate(a: MandateState, b: MandateState): boolean {
  if (a.mandate !== b.mandate) return false;
  if (a.mandate !== "unresolved" || b.mandate !== "unresolved") return true;
  if (a.reason !== b.reason) return false;
  return a.reason === "unavailable" && b.reason === "unavailable"
    ? a.error === b.error
    : true;
}

/**
 * Provide one {@link MandateSource} to everything below.
 *
 * The published value is stabilised against a source that rebuilds its state
 * on every render — which the real ones do: `useMandateSource()` in
 * `@stapel/workspaces-react` derives from a TanStack query result, and that
 * result is a fresh object each time. Without this, every parent render
 * would republish context and re-run every effect keyed on the axis, for an
 * answer that never changed. Doing it HERE rather than asking each source to
 * memoise is the point of having a seam: the guarantee is the reader's, so
 * it cannot be lost by an implementation that forgets.
 */
export function MandateProvider(props: {
  source: MandateSource;
  children: ReactNode;
}): ReactElement {
  // A pure cache of the latest distinct answer: same input, same output, no
  // effect outside this component. (A `useMemo` cannot express it — the
  // comparison is against the previous value, not against a dependency.)
  const held = useRef<MandateState>(props.source.state);
  if (!sameMandate(held.current, props.source.state)) {
    held.current = props.source.state;
  }
  return createElement(MandateContext.Provider, { value: held.current }, props.children);
}

/**
 * The caller's mandate. Always defined: with no provider above, the
 * `unavailable` arm carrying {@link NO_MANDATE_SOURCE} — a wait or an
 * explained error, never a hide and never a refusal.
 *
 * Render it with `matchMandate`, whose five required arms keep "we could not
 * ask" out of "you may not".
 */
export function useMandate(): MandateState {
  const state = useContext(MandateContext);
  return state ?? NO_SOURCE_STATE;
}

/**
 * The caller's principal, or `null` when the mandate is not known.
 *
 * For the callers that take a {@link MandatePrincipal} and nothing else —
 * `resolveNav`'s `audience` in `@stapel/shell-react` is the one that exists
 * today. `null` is deliberately not a principal to fall back from: a caller
 * that hands it on has to say, in its own code, what an unknown mandate
 * means for its surface.
 */
export function useMandatePrincipal(): MandatePrincipal | null {
  const state = useMandate();
  return state.mandate === "unresolved" ? null : state.mandate;
}
