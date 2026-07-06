import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { MyProfile as MyProfileData, ProfileUpdate } from "../api/types.js";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";

/** Render-prop bag for {@link MyProfile}. */
export interface MyProfileBag {
  /** The caller's profile once loaded, else null. */
  readonly profile: MyProfileData | null;
  /** The initial load is in flight (no data yet). */
  readonly isLoading: boolean;
  /** Either the read or the save failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Persist a partial update to the caller's profile. */
  save(patch: ProfileUpdate): void;
  /** A save call is in flight. */
  readonly isSaving: boolean;
  /** The last save succeeded (cleared by the next `save`). */
  readonly isSaved: boolean;
  /** Refetch the profile from the server. */
  refetch(): void;
}

/**
 * Headless "my profile" — a renderless view-and-edit wrapper over the caller's
 * own profile. Wires {@link useMyProfile} + {@link useUpdateMyProfile} and hands
 * a {@link MyProfileBag} to `children`; bring your own form / avatar UI. Zero
 * visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <MyProfile>
 *   {({ profile, save, isSaving }) => ( ... )}
 * </MyProfile>
 * ```
 */
export function MyProfile(props: {
  children: (bag: MyProfileBag) => ReactNode;
}): ReactNode {
  const query = useMyProfile();
  const mutation = useUpdateMyProfile();
  return props.children({
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    save: (patch) => {
      mutation.mutate(patch);
    },
    isSaving: mutation.isPending,
    isSaved: mutation.isSuccess,
    refetch: () => {
      void query.refetch();
    },
  });
}
