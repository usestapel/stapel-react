import { useCallback, useMemo, useState } from "react";
import { useStapelClient } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import { createCdnAvatarApi } from "../api/cdnAvatarApi.js";

/**
 * Avatar upload — a DOCUMENTED STOPGAP (ironmemo-libgaps.md "Settings-инвентарь"
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
 */

/** Render-prop-free bag for {@link useAvatarUpload}. */
export interface AvatarUploadBag {
  /** Upload a picked file; resolves the new `avatar` reference (a CDN
   * `<type>/<hash>` string, ready to pass straight to `useUpdateMyProfile`),
   * or `null` on failure (see `error`). */
  upload(file: File): Promise<string | null>;
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

export function useAvatarUpload(): AvatarUploadBag {
  const client = useStapelClient("cdn");
  const api = useMemo(() => createCdnAvatarApi(client), [client]);
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
    async (file: File): Promise<string | null> => {
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
        return res.image.prefix;
      } catch (e) {
        setError(e as StapelApiError);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [api]
  );

  return { upload, previewUrl, uploadedUrl, isUploading, isError: error !== null, error, reset };
}
