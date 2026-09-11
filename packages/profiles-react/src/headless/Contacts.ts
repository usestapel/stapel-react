/**
 * The seller's phone numbers — the owner's half and the viewer's half, kept
 * apart on purpose (stapel-profiles ≥0.20.0, `contacts`).
 *
 * ── THE OWNER'S HALF: {@link useContacts} ───────────────────────────────────
 *
 * A person publishes numbers, proves each one by SMS, says who may read it,
 * switches it off without deleting it, and sees how often it was handed over.
 * All of that is ONE screen's worth of state, so it is one hook: the list read
 * (with the deployment's policy vocabulary riding along), the five writes, and
 * the per-number hand-over counters.
 *
 * The counters are a query PER CONTACT (`useQueries`), not a field on the
 * list: `ContactResponse.reveal_count` is the all-time total and the screen
 * also states the last 24 hours and the last 7 days, which only
 * `…/reveals/summary` answers.
 *
 * ── THE VIEWER'S HALF: {@link useRevealContacts} ────────────────────────────
 *
 * A reveal is not a read. Every call hands a number over, is journalled for
 * the owner, and is counted against the viewer's hourly budget; the wire sends
 * the answer with `Cache-Control: no-store`. So this is a MUTATION, and the
 * numbers it answers with live in the mutation object for as long as the
 * component that asked is on screen — and nowhere else:
 *
 *  - nothing is written to the query cache (no `setQueryData`, no query key —
 *    see `queryKeys.ts`), so nothing is persisted by a host that wires core's
 *    query persister, and nothing survives a route change;
 *  - `gcTime: 0` drops the mutation the moment its observer unmounts, so the
 *    number does not sit in the mutation cache behind a screen nobody is
 *    looking at any more;
 *  - the pair never puts a number in storage or in a URL. A revealed number is
 *    somebody's phone number, not application state.
 */
import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type {
  Contact,
  ContactAction,
  ContactCreate,
  ContactList,
  ContactReveal,
  ContactRevealRequest,
  ContactRevealSummary,
  ContactUpdate,
  ContactVerifyRequest,
} from "../api/types.js";
import { useProfilesApi } from "../model/context.js";
import { profilesQueryKeys } from "../model/queryKeys.js";

/** The argument of {@link ContactsBag.updateContact}. */
export interface ContactUpdateVars {
  readonly contactId: number;
  readonly patch: ContactUpdate;
}

/** The argument of {@link ContactsBag.confirmCode}. */
export interface ContactConfirmVars {
  readonly contactId: number;
  /** The code from the SMS, as the person typed it. */
  readonly code: string;
}

/** The argument of {@link useRevealContacts}'s mutation. */
export interface RevealVars {
  /** User UUID of the seller whose numbers are asked for. */
  readonly ownerKey: string;
  /** Where the viewer was standing, for the OWNER's journal. Opaque to this
   * module — a listing id, a thread id, whatever the host calls the place. */
  readonly listingId?: string | undefined;
}

/** Everything the owner's contacts screen is made of. */
export interface ContactsBag {
  /** The caller's own contacts, oldest first. Empty before the read lands —
   * render through {@link ContactsBag.state}, never off this array's length. */
  readonly contacts: readonly Contact[];
  /**
   * The policy values THIS deployment accepts, in picker order; the first is
   * the default for a new contact. A picker built from three hardcoded strings
   * offers options a narrowed deployment's API refuses, which is why the
   * server sends its own vocabulary.
   */
  readonly policies: readonly string[];
  /** The read's three answers, kept three (`@stapel/core`'s `LoadState`). */
  readonly state: LoadState<ContactList>;
  /** Re-run the list read — the `failed` arm's retry affordance. */
  refetch(): void;
  readonly isLoading: boolean;
  /** Add a number. It arrives UNVERIFIED and is revealed to nobody until the
   * code is confirmed. */
  readonly addContact: UseMutationResult<Contact, StapelApiError, ContactCreate>;
  /** Change a label, a policy or the on/off switch. */
  readonly updateContact: UseMutationResult<
    Contact,
    StapelApiError,
    ContactUpdateVars
  >;
  /** Delete a number and its journal. */
  readonly removeContact: UseMutationResult<ContactAction, StapelApiError, number>;
  /** Send a code to the number. */
  readonly requestCode: UseMutationResult<
    ContactVerifyRequest,
    StapelApiError,
    number
  >;
  /** Confirm the code — the moment the number becomes revealable. */
  readonly confirmCode: UseMutationResult<
    Contact,
    StapelApiError,
    ContactConfirmVars
  >;
  /**
   * Hand-over counters for one contact (total / 24h / 7d / last), or
   * `undefined` while that contact's summary has not landed. `undefined` is
   * "not known yet", never "zero" — a screen that printed 0 for a number
   * handed out 128 times would be stating the opposite of the truth.
   */
  summaryFor(contactId: number): ContactRevealSummary | undefined;
}

/**
 * The owner's contacts screen, headless.
 *
 * ```tsx
 * const contacts = useContacts();
 * contacts.addContact.mutate({ value: "+15550100", label: "Work" });
 * ```
 *
 * Session-gated like every other "the caller's own …" read in this pair (see
 * `useMyProfile`): a fetch that raced a still-bootstrapping session reads a
 * live session as signed-out.
 */
export function useContacts(): ContactsBag {
  const api = useProfilesApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();

  const query: UseQueryResult<ContactList, StapelApiError> = useQuery({
    queryKey: profilesQueryKeys.contacts(),
    queryFn: () => api.listContacts(),
    enabled: sessionReady,
  });

  /**
   * After any write: the list, and the caller's own profile — `contacts.phone`
   * on a profile flips the instant the first number is confirmed (or the last
   * one is deleted, switched off, or given the `nobody` policy), and that bit
   * is what a storefront draws the "Show phone" button from.
   */
  const invalidate = useCallback((): void => {
    void queryClient.invalidateQueries({
      queryKey: profilesQueryKeys.contacts(),
    });
    void queryClient.invalidateQueries({ queryKey: profilesQueryKeys.me() });
  }, [queryClient]);

  const addOptions: UseMutationOptions<Contact, StapelApiError, ContactCreate> = {
    mutationFn: (body) => api.addContact(body),
    onSuccess: invalidate,
  };
  const addContact = useMutation(addOptions);

  const updateOptions: UseMutationOptions<
    Contact,
    StapelApiError,
    ContactUpdateVars
  > = {
    mutationFn: (vars) => api.updateContact(vars.contactId, vars.patch),
    onSuccess: invalidate,
  };
  const updateContact = useMutation(updateOptions);

  const removeOptions: UseMutationOptions<ContactAction, StapelApiError, number> =
    {
      mutationFn: (contactId) => api.removeContact(contactId),
      onSuccess: invalidate,
    };
  const removeContact = useMutation(removeOptions);

  const requestOptions: UseMutationOptions<
    ContactVerifyRequest,
    StapelApiError,
    number
  > = {
    mutationFn: (contactId) => api.requestContactCode(contactId),
    // Nothing server-side moved: the code went to a phone, not to this cache.
  };
  const requestCode = useMutation(requestOptions);

  const confirmOptions: UseMutationOptions<
    Contact,
    StapelApiError,
    ContactConfirmVars
  > = {
    mutationFn: (vars) => api.confirmContactCode(vars.contactId, vars.code),
    onSuccess: invalidate,
  };
  const confirmCode = useMutation(confirmOptions);

  const list = query.data;
  // Keyed on the ids, not on the array identity: the list read re-resolves on
  // every invalidation and a new array each time would rebuild every summary
  // query object.
  const idKey = (list?.contacts ?? []).map((contact) => contact.id).join(" ");
  const ids = useMemo(
    () => (idKey === "" ? [] : idKey.split(" ").map(Number)),
    [idKey]
  );

  const summaries = useQueries({
    queries: ids.map((contactId) => ({
      queryKey: profilesQueryKeys.contactRevealSummary(contactId),
      queryFn: (): Promise<ContactRevealSummary> =>
        api.getContactRevealSummary(contactId),
      enabled: sessionReady,
    })),
  });

  const byContact = new Map<number, ContactRevealSummary>();
  for (const result of summaries) {
    const summary = result.data;
    if (summary !== undefined) byContact.set(summary.contact_id, summary);
  }

  return {
    contacts: list?.contacts ?? [],
    policies: list?.policies ?? [],
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
    isLoading: query.isLoading,
    addContact,
    updateContact,
    removeContact,
    requestCode,
    confirmCode,
    summaryFor: (contactId) => byContact.get(contactId),
  };
}

/**
 * Ask a seller for their numbers — one mutation, one hand-over.
 *
 * The answer is NOT cached: no query key, no `setQueryData`, `gcTime: 0`. It
 * lives on the returned mutation object, which belongs to the component that
 * called this hook and dies with it. See this module's header for why a number
 * is not application state.
 *
 * ```tsx
 * const reveal = useRevealContacts();
 * reveal.mutate({ ownerKey, listingId });
 * reveal.data?.phones.map((phone) => phone.value);
 * ```
 *
 * The three answers a caller must handle are the wire's own: 200 with a
 * possibly EMPTY `phones` (the seller has no number for this viewer — and
 * "none published" is deliberately indistinguishable from "none for you"),
 * 403 `error.403.contacts_registration_required` (no account: signed out OR a
 * guest — the storefront opens full registration), and 429
 * `error.429.contacts_reveal_budget` with `retry_after` in seconds.
 */
export function useRevealContacts(): UseMutationResult<
  ContactReveal,
  StapelApiError,
  RevealVars
> {
  const api = useProfilesApi();
  const options: UseMutationOptions<ContactReveal, StapelApiError, RevealVars> = {
    mutationFn: (vars) => {
      const body: ContactRevealRequest = {
        owner_key: vars.ownerKey,
        ...(vars.listingId !== undefined ? { listing_id: vars.listingId } : {}),
      };
      return api.revealContacts(body);
    },
    // The numbers leave with the component that asked for them.
    gcTime: 0,
  };
  return useMutation(options);
}
