/**
 * Who `u-1` is.
 *
 * stapel-calendar stores participation as user IDS and nothing else:
 * `EventResponse.owner_id` and `ParticipantResponse.user_id` are opaque
 * strings, and the module has no name, avatar or profile endpoint — identity
 * lives in stapel-profiles / stapel-auth, which this pair must not reach into
 * (a pair talks to ONE module). So the pair cannot resolve a name on its own,
 * and the visual pass caught what that meant on screen: "Organizer: u-1", and
 * three invitee rows reading `u-2` / `u-3` / `u-4`.
 *
 * The answer is a SEAM, not a lookup: the host — which already knows who its
 * users are — registers one resolver, and every surface in the pair that
 * prints a person reads it. Registered once, it applies to the detail sheet,
 * the invitee editor and anything a host composes itself.
 *
 * ```tsx
 * <CalendarPeopleProvider resolveUserName={(id) => directory.get(id)?.name}>
 *   <Calendar />
 * </CalendarPeopleProvider>
 * ```
 *
 * With no provider (or for an id the host does not know) the id is still
 * shown — it is the only truth the pair has, and hiding it would leave a row
 * naming nobody at all. What changes is that it is no longer the DEFAULT: a
 * host that knows names never has to fork a skin to show them.
 */
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

/** A host's answer to "what is this user's display name?". `undefined` for an
 * id it does not know — the caller then falls back to the id itself. */
export type UserNameResolver = (userId: string) => string | undefined;

const PeopleContext = createContext<UserNameResolver | null>(null);

export interface CalendarPeopleProviderProps {
  readonly resolveUserName: UserNameResolver;
  readonly children: ReactNode;
}

/** Register the host's name resolver for every calendar surface below. */
export function CalendarPeopleProvider(
  props: CalendarPeopleProviderProps
): ReactElement {
  const { resolveUserName, children } = props;
  const value = useMemo(() => resolveUserName, [resolveUserName]);
  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>;
}

/**
 * A person's display name: the host's answer, or the id when there is none.
 * Never empty — a row that names nobody is worse than a row naming an id.
 */
export function useUserName(): (userId: string) => string {
  const resolve = useContext(PeopleContext);
  return useCallback(
    (userId: string): string => {
      const name = resolve?.(userId);
      return name !== undefined && name.length > 0 ? name : userId;
    },
    [resolve]
  );
}

/**
 * The one or two characters an avatar shows for a name — the first letter of
 * the first two words, upper-cased in the reader's locale. `"u-2"` gives
 * `"U"`, `"Dana Reyes"` gives `"DR"`.
 */
export function nameInitials(name: string, locale: string): string {
  const words = name.split(/[\s_-]+/u).filter((word) => word.length > 0);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
  const initials = letters.join("");
  try {
    return initials.toLocaleUpperCase(locale);
  } catch {
    return initials.toUpperCase();
  }
}
