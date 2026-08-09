import { useCallback, useMemo, useState } from "react";
import { toStapelApiError, useStapelClient } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { createCdnAvatarApi } from "../api/cdnAvatarApi.js";
import { useUpdateMyProfile } from "../model/mutations.js";

/**
 * Avatar upload — a DOCUMENTED STOPGAP (ironmemo-libgaps.md "settings inventory"
 * §avatar-upload), not a generated pair surface. stapel-profiles' own contract
 * only STORES the reference (`Profile.avatar`, a CDN `<type>/<hash>` string —
 * see `ProfileUpdate.avatar`); turning a picked `File` into that reference is a
 * stapel-cdn concern (`POST /cdn/api/v1/upload/avatar/`, multipart, 200/201 body
 * `{ image: { prefix, original_url, variant_160_url, ... } }`), and no
 * `@stapel/cdn-react` pair exists yet to own that contract's types/hooks the way
 * every other module does (frontend-standard §2/§3). Until one exists, this
 * hook calls the CDN endpoint directly through core's client-injection seam
 * (`useStapelClient("cdn")` — frontend-standard §7.2): a host that registers a
 * `cdn`-keyed client in `<StapelConfigProvider clients={{cdn: ...}}>` gets a
 * dedicated CDN base URL; a host that doesn't falls back to the default
 * client, which is correct whenever the app already fronts every module behind
 * one gateway origin (the common case — mirrors ironmemo's single
 * `API_BASE_URL` for every `*Client`).
 *
 * The response is hand-typed below (NOT generated) for the same reason the
 * request is hand-called — flagged so it is trivial to delete once
 * `@stapel/cdn-react` ships and this pair can depend on its typed client
 * instead.
 *
 * ── WHY `upload()` RESOLVES A PAIR AND NOT A STRING ─────────────────────────
 *
 * It used to resolve the bare ref, and that destroyed the provenance at the
 * exact instant the system knew it for certain. `POST /cdn/api/v1/upload/avatar/`
 * returns — this IS a CDN ref, there is no doubt anywhere in the call stack —
 * and the hook handed back a `string`. The caller then had to remember, out of
 * band, to also write `avatar_source: "cdn"`; the profile model's default is
 * `file`, so forgetting was silent.
 *
 * Nobody remembered. On the meettoday sandbox 2 of 2 profiles that ever had an
 * avatar were stored as a CDN ref tagged `file` — a 100% failure rate of the
 * manual upload path, on two different people. Serializing such a row opened
 * the CDN variant DIRECTORY as a plain file and raised, so `/profiles/api/v1/me`
 * 500'd; the frontend read no `display_name`, concluded the account was
 * unnamed, blocked the meeting door with an "enter your name" dialog, and that
 * dialog's PATCH 500'd on the same avatar. A cosmetic ref locked two people out
 * of the product.
 *
 * An obligation between two libraries that lives in prose is an obligation a
 * caller is required to remember, and one day does not (tracker #266). So the
 * ref now travels WITH its source ({@link AvatarRef}), and {@link useSetAvatar}
 * makes setting an avatar ONE library operation instead of two calls the caller
 * must pair correctly. There is no longer a moment at which a ref exists
 * without the tag that explains it.
 *
 * stapel-profiles >= 0.11 also derives the source server-side from the ref
 * shape. That is the NET, not the mechanism: it protects clients that have not
 * upgraded, but it is inference about a fact that ought to have been
 * transported. This hook transports it.
 */

/**
 * An uploaded avatar and the provenance that must be stored next to it — the
 * two halves of `Profile.avatar` / `Profile.avatar_source`, which are one value
 * in two columns and must never travel apart.
 */
export interface AvatarRef {
  /** `<type>/<hash>` — the value `Profile.avatar` stores. */
  readonly ref: string;
  /** Where `ref` points. Always `"cdn"` here: this hook has exactly one
   * producer, stapel-cdn's upload endpoint. It is a field rather than a
   * constant the caller re-derives precisely so it cannot be forgotten. */
  readonly source: "cdn";
}

/** Render-prop-free bag for {@link useAvatarUpload}. */
export interface AvatarUploadBag {
  /** Upload a picked file; resolves the new avatar reference TOGETHER with its
   * source ({@link AvatarRef}), or `null` on failure (see `error`). Spread it
   * into a profile patch as `{ avatar: ref, avatar_source: source }` — or, far
   * better, use {@link useSetAvatar} and never hold the halves apart. */
  upload(file: File): Promise<AvatarRef | null>;
  /** A local, revocable object URL for the file passed to the last `upload()`
   * call — show this immediately (no network round trip) while the request
   * is in flight, then swap to the server's CDN url once it resolves. Caller
   * owns revocation via {@link reset} or by calling `upload` again. */
  readonly previewUrl: string | null;
  /** The freshly uploaded preview url, once `upload()` resolves. */
  readonly uploadedUrl: string | null;
  readonly isUploading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  /** Revoke the current `previewUrl` (if any) and clear upload state. */
  reset(): void;
}

/** The error a host gets when it uses the upload hook with no client wired. */
const NO_CDN_CLIENT: StapelApiError = toStapelApiError(
  new Error(
    "avatar upload needs a StapelClient: render this subtree inside " +
      "<StapelConfigProvider> (optionally with clients={{ cdn: ... }})"
  )
);

/**
 * The CDN client, or `null` when this subtree has no `<StapelConfigProvider>`.
 *
 * `useStapelClient` THROWS in that case, which took down whole tabs that merely
 * rendered a settings route (tracker #24) — an avatar picker is the last thing
 * that should be able to blank a page. The `useContext` call inside runs
 * unconditionally (hook order is preserved; only the throw that follows it is
 * caught), and the missing wiring is reported from `upload()` as an ordinary
 * error instead of as a render crash.
 */
function useOptionalCdnClient() {
  try {
    // Unconditional hook call — only the throw that follows it is caught.
    return useStapelClient("cdn");
  } catch {
    return null;
  }
}

export function useAvatarUpload(): AvatarUploadBag {
  const client = useOptionalCdnClient();
  const api = useMemo(
    () => (client === null ? null : createCdnAvatarApi(client)),
    [client]
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<StapelApiError | null>(null);

  const reset = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setUploadedUrl(null);
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<AvatarRef | null> => {
      if (api === null) {
        setError(NO_CDN_CLIENT);
        return null;
      }
      setError(null);
      setIsUploading(true);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      setUploadedUrl(null);
      try {
        const res = await api.uploadAvatar(file);
        setUploadedUrl(res.image.variant_160_url);
        // The one place in the system that KNOWS this is a CDN ref. Saying so
        // here is the whole fix — see the module doc.
        return { ref: res.image.prefix, source: "cdn" };
      } catch (e) {
        // `e as StapelApiError` was a lie whenever the CDN call failed
        // without a Stapel envelope (network fault, an origin that answers
        // HTML, a second transport rethrowing the raw envelope): the cast
        // silences the compiler, and `error.code`/`error.status` read
        // `undefined` at runtime. `toStapelApiError` folds every shape into
        // the one dialect — see @stapel/core errors.ts "One dialect".
        setError(toStapelApiError(e));
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [api]
  );

  return { upload, previewUrl, uploadedUrl, isUploading, isError: error !== null, error, reset };
}

/** Render-prop-free bag for {@link useSetAvatar}. */
export interface SetAvatarBag {
  /** Upload a picked file AND store it on the caller's own profile — ref and
   * source written together, in one call. Resolves the stored
   * {@link AvatarRef}, or `null` if either leg failed (see `error`). */
  setAvatar(file: File): Promise<AvatarRef | null>;
  /** Local object URL for the file being uploaded — render it immediately. */
  readonly previewUrl: string | null;
  /** The uploaded preview url, once the CDN leg resolves (before the profile
   * round-trip lands and `avatar_image` takes over). */
  readonly uploadedUrl: string | null;
  /** True while EITHER leg is in flight — one operation, one busy flag. */
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  reset(): void;
}

/**
 * Set the caller's avatar: upload, then store the pair — ONE operation.
 *
 * This is the surface product code should use. `useAvatarUpload` remains for a
 * host that must interleave something between the two legs, but the default
 * path no longer asks a caller to remember that a ref needs a source: there is
 * no intermediate state in which it could be forgotten.
 */
export function useSetAvatar(): SetAvatarBag {
  const upload = useAvatarUpload();
  const mutation = useUpdateMyProfile();

  const setAvatar = useCallback(
    async (file: File): Promise<AvatarRef | null> => {
      const uploaded = await upload.upload(file);
      if (uploaded === null) return null;
      // The pair, written together. Never `{ avatar }` alone.
      await mutation.mutateAsync({
        avatar: uploaded.ref,
        avatar_source: uploaded.source,
      });
      return uploaded;
    },
    [upload, mutation]
  );

  const reset = useCallback(() => {
    upload.reset();
    mutation.reset();
  }, [upload, mutation]);

  const error = upload.error ?? mutation.error ?? null;
  return {
    setAvatar,
    previewUrl: upload.previewUrl,
    uploadedUrl: upload.uploadedUrl,
    isPending: upload.isUploading || mutation.isPending,
    isError: error !== null,
    error,
    reset,
  };
}
