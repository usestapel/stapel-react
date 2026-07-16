import type { StapelClient } from "@stapel/core";

/**
 * A documented stopgap (see `../headless/AvatarUpload.js`'s module doc): the
 * ONE named operation this pair needs from stapel-cdn, hand-authored here
 * (this pair's `api/` layer — the one legal home of a path string,
 * `stapel/no-string-paths` §2.3) because no `@stapel/cdn-react` pair exists
 * yet to generate it from stapel-cdn's OWN `docs/schema.json` the way every
 * other cross-module call in this codebase is generated. Delete this file (and
 * point `useAvatarUpload` at the real generated client) once one ships.
 */

/** The one field of stapel-cdn's `ImageUploadResponse` this pair needs. */
export interface CdnAvatarUploadResponse {
  readonly image: {
    /** `<type>/<hash>` — this IS the value `Profile.avatar` stores.
     * Content-addressed, so a NEW upload always yields a NEW path — no manual
     * cache-busting query param is needed the way a user-keyed CDN path would
     * require (cf. settings-inventory-compare.md's marketplace `?v=`
     * refresh-key pattern; not needed here by construction). */
    readonly prefix: string;
    /** A ready-to-display preview variant (240px would read nicer on a
     * settings page, but the backend only guarantees this ladder rung —
     * 160px is the closest to an avatar). */
    readonly variant_160_url: string;
  };
}

export interface CdnAvatarApi {
  uploadAvatar(file: File): Promise<CdnAvatarUploadResponse>;
}

export function createCdnAvatarApi(client: StapelClient): CdnAvatarApi {
  return {
    uploadAvatar: (file) => {
      const form = new FormData();
      form.append("file", file);
      return client.post("/cdn/api/v1/upload/avatar/", form);
    },
  };
}
