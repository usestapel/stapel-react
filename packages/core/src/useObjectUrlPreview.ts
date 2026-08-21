/**
 * A local preview of a file the person just picked, with the revoke that
 * always gets forgotten.
 *
 * `URL.createObjectURL` pins the blob in memory until `revokeObjectURL` is
 * called; the browser will not collect it, and there is no warning. Every
 * upload control needs the same three revokes — when the pick is replaced,
 * when it is cleared, when the control unmounts — and `profiles-react`'s
 * `useAvatarUpload` is the copy that shows how easy it is to miss one: two
 * of the three are written by hand there, inside a `setState` updater, and
 * the third (unmount) is not written at all, so navigating away mid-pick
 * leaks the image.
 *
 * The fix is not a rule about remembering. It is a hook whose ONLY job is
 * that lifetime, so there is nothing left to remember.
 *
 * ── Why the URL comes from state and not from `useMemo` ─────────────────────
 *
 * `useMemo(() => createObjectURL(file), [file])` reads better and leaks:
 * React is free to discard a memo and recompute it, and in StrictMode the
 * double render creates two URLs while the effect cleanup only ever revokes
 * the one that survived. Creating the URL inside the effect makes the pairing
 * structural — every URL this hook creates is created by the same effect run
 * that revokes it, so a discarded render, a double-invoked render and an
 * unmount all balance by construction.
 *
 * The cost is one frame with no preview after each pick. That is the honest
 * trade: a frame of nothing, versus a leak that is invisible until a long
 * session with many picks starts swapping.
 */
import { useEffect, useState } from "react";

/**
 * An object URL for `file`, or `null` when there is nothing to preview.
 *
 * Revoked when `file` changes and when the component unmounts. Pass `null`
 * to clear the preview — the host holds the pick, this holds only its URL.
 *
 * ```tsx
 * const [file, setFile] = useState<File | null>(null);
 * const preview = useObjectUrlPreview(file);
 * return preview === null ? <Placeholder /> : <img src={preview} alt="" />;
 * ```
 */
export function useObjectUrlPreview(file: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null || file === undefined) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => {
      URL.revokeObjectURL(created);
      // Clearing here as well as in the next run keeps a stale URL from being
      // rendered for a frame after its blob is gone — a revoked URL loads as
      // a broken image, which reads to the person as "my file was rejected".
      setUrl(null);
    };
  }, [file]);

  return url;
}
