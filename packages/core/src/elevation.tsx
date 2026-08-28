/**
 * Elevation — the third answer a gated control can give an anonymous visitor.
 *
 * `mandate.ts` gives a control two useful answers for somebody with no
 * identity: refuse with a reason, or (once they sign in) allow. A marketplace
 * needs a third. Saving a listing and writing to a seller are the acts the
 * product exists for, and refusing them until a stranger has filled in a
 * registration form is friction with nothing on the other side of it — the
 * account can be minted silently, at the moment of the act, and upgraded into
 * a real one later when the person has a reason to care.
 *
 * Leaving a review and publishing a listing are NOT that. A review from an
 * account nobody can trace is worthless as social proof and is an abuse
 * surface; a seller who cannot be reached again is not a seller. Both keep
 * the wall.
 *
 * So the interesting part is not "mint an account", it is WHICH ACTIONS may.
 * That judgement is a product decision and it differs per deployment, which
 * is why it arrives as data — {@link ElevationSource.actions}, a list of
 * action names — rather than being welded into whichever component happened
 * to be written first.
 *
 * ── The three rules the shape enforces ────────────────────────────────────
 *
 *  1. **Never on render.** {@link Elevation.run} is the only way to elevate
 *     and it takes the work to do afterwards, so elevation is reachable only
 *     from something a person did. A hook that minted on mount would fill
 *     the user table with every crawler that ever loaded a page and skew
 *     every metric derived from it.
 *  2. **Once per visitor, not once per click.** The source is responsible for
 *     collapsing concurrent and repeat calls onto a single mint (see
 *     `@stapel/auth-react`'s `createAnonymousElevation`). Two rapid clicks
 *     must not become two accounts.
 *  3. **Per action, not per session.** {@link useElevation} answers for ONE
 *     named action. A control that is not on the list gets `covers: false`
 *     and keeps its refusal, even though the visitor sitting in front of it
 *     may already have been elevated by a different control.
 *
 * ── Why elevation does not change the mandate ─────────────────────────────
 *
 * A minted guest is still `"anonymous"` on the mandate axis — an anonymous
 * session and no session at all open the same doors, which is exactly what
 * `MandatePrincipal` says. If elevation flipped the axis to `"member"` it
 * would unblock the review form and the listing composer too, and the whole
 * per-action judgement above would be decoration. The axis stays put; only
 * the named actions read past it.
 */
import { createContext, createElement, useCallback, useContext, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Something that can mint an identity for an anonymous visitor.
 *
 * Implemented by `@stapel/auth-react` against `POST /anonymous/`; a host can
 * implement it against anything. Deliberately NOT a React hook: the mint is
 * an imperative act with a promise, not a rendered value.
 */
export interface ElevationSource {
  /**
   * The action names this deployment permits an automatic mint for. Anything
   * absent from the list keeps its refusal. Compared by exact string, and the
   * names are owned by the pairs that gate the actions (e.g.
   * `LISTINGS_ELEVATION_ACTIONS.favorite`) so a host cannot mistype one into
   * silence.
   */
  readonly actions: readonly string[];
  /**
   * Mint the identity, or resolve immediately if there already is one.
   * MUST be idempotent and MUST collapse concurrent calls onto one flight —
   * the reader calls it from a click handler and clicks arrive in pairs.
   */
  elevate(): Promise<void>;
  /**
   * Does this visitor ALREADY hold an identity? A plain read, called during
   * render, so it must be cheap and free of side effects — and it must never
   * mint.
   *
   * It exists for the READ side. A control that writes can call
   * {@link Elevation.run} and let the mint happen; a surface that only shows
   * what the person already made — their saved listings, their threads —
   * has nothing to press and must not mint just to render. It needs the
   * different question "is there an account behind this yet?", and
   * `covers` alone cannot answer it: a deployment that permits minting for
   * an action says nothing about whether this particular visitor has done it.
   *
   * Optional. A source that omits it reports `identified: false`, so a
   * read surface stays closed — the conservative answer for somebody's own
   * data.
   */
  hasIdentity?(): boolean;
}

/** What a gated control gets back from {@link useElevation}. */
export interface Elevation {
  /**
   * May this action mint instead of refusing? Bind the gate's `anonymous`
   * arm to it: `covers ? actionAvailable() : actionBlocked(signInKey)`.
   */
  readonly covers: boolean;
  /**
   * This action may mint AND the visitor already holds an identity — so a
   * surface showing what they made can open. `false` before the first mint,
   * which is why it is not the flag a WRITE gate reads: a write is what
   * causes the mint, and gating the write on this would refuse the press
   * that was supposed to create the account.
   */
  readonly identified: boolean;
  /** A mint is in flight. Fold it into the control's blocked reason. */
  readonly pending: boolean;
  /** The mint failed. `undefined` until it does. */
  readonly error: unknown;
  /**
   * Elevate if needed, then do the work. Fire-and-forget: the promise is
   * consumed here so a failed mint lands in {@link error} rather than in an
   * unhandled rejection, and `perform` is not reached at all if the mint
   * failed — a write that would only have bought a 401.
   *
   * With `covers: false` this still runs `perform` without minting. The gate
   * is what refuses; `run` is not a second gate, because two places that can
   * both say no is how a control ends up refusing for a reason no one shows.
   */
  run(perform: () => void): void;
}

const ElevationContext = createContext<ElevationSource | null>(null);

/**
 * Put one {@link ElevationSource} in context.
 *
 * `source={null}` is a first-class answer and the default everywhere else:
 * a deployment that does not do silent minting wires nothing, every
 * `covers` is `false`, and every gated control refuses exactly as it did
 * before this module existed.
 */
export function ElevationProvider(props: {
  source: ElevationSource | null;
  children: ReactNode;
}): ReactElement {
  return createElement(
    ElevationContext.Provider,
    { value: props.source },
    props.children
  );
}

/** The raw source, for a host that needs to drive a mint outside a gate. */
export function useElevationSource(): ElevationSource | null {
  return useContext(ElevationContext);
}

/**
 * Elevation for ONE named action.
 *
 * Outside a provider, or for an action the deployment did not list, every
 * field is inert and `run` simply performs — so a pair can call this
 * unconditionally and a host that never wired the seam sees no change.
 *
 * ```ts
 * const elevation = useElevation(LISTINGS_ELEVATION_ACTIONS.favorite);
 * const gate = matchMandate(mandate, {
 *   anonymous: () =>
 *     elevation.covers ? actionAvailable() : actionBlocked(SIGN_IN_KEY),
 *   ...
 * });
 * const toggle = () => elevation.run(() => mutation.mutate(input));
 * ```
 */
export function useElevation(action: string | null | undefined): Elevation {
  const source = useContext(ElevationContext);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const covers =
    source !== null &&
    action !== null &&
    action !== undefined &&
    source.actions.includes(action);
  const identified = covers && source?.hasIdentity?.() === true;

  const run = useCallback(
    (perform: () => void): void => {
      if (!covers || source === null) {
        perform();
        return;
      }
      setError(undefined);
      setPending(true);
      source.elevate().then(
        () => {
          setPending(false);
          perform();
        },
        (failure: unknown) => {
          setPending(false);
          setError(failure);
        }
      );
    },
    [covers, source]
  );

  return useMemo(
    () => ({ covers, identified, pending, error, run }),
    [covers, identified, pending, error, run]
  );
}
