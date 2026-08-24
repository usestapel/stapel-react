/**
 * One image, one slot — the avatar/cover shape, where a new pick REPLACES the
 * old one rather than joining a queue.
 *
 * This is the hook `profiles-react`'s `useSetAvatar` is meant to be built on:
 * it owns the upload half (validate → hash → pre-check → POST → variants) and
 * hands back the `<type>/<hash>` reference, leaving the "…and store it on the
 * profile" half where it belongs, in the pair that owns the profile.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toStapelApiError, useObjectUrlPreview } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { CdnImage, CdnRef } from "../api/types.js";
import { useCdnRuntime } from "../model/context.js";
import { isUploadCanceled, runUpload } from "../model/upload.js";
import type { CdnUploadTarget, UploadPhase } from "../model/upload.js";

export interface UploadImageBag {
  /**
   * Upload a pick. Resolves the reference, or `null` when it failed or was
   * canceled — `error` and `phase` say which.
   */
  upload(file: File): Promise<CdnRef | null>;
  /** Abort the upload in flight. */
  cancel(): void;
  /** Forget the pick, its preview and its error. */
  reset(): void;
  /**
   * A local object URL for the file being uploaded — render it the instant the
   * pick happens, long before any server has seen it. Revoked when the pick
   * changes and on unmount, by construction: this is core's
   * `useObjectUrlPreview`, whose whole job is that lifetime.
   */
  readonly previewUrl: string | null;
  readonly phase: UploadPhase;
  readonly isPending: boolean;
  readonly ref: CdnRef | null;
  readonly image: CdnImage | null;
  /** The pre-check hit: nothing was uploaded. */
  readonly deduped: boolean;
  readonly variantsReady: boolean;
  readonly error: StapelApiError | null;
}

export function useUploadImage(options?: {
  readonly target?: CdnUploadTarget;
}): UploadImageBag {
  const runtime = useCdnRuntime();
  const target: CdnUploadTarget = options?.target ?? { kind: "image" };

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [ref, setRef] = useState<CdnRef | null>(null);
  const [image, setImage] = useState<CdnImage | null>(null);
  const [deduped, setDeduped] = useState(false);
  const [variantsReady, setVariantsReady] = useState(false);
  const [error, setError] = useState<StapelApiError | null>(null);
  const previewUrl = useObjectUrlPreview(file);

  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const targetRef = useRef(target);
  targetRef.current = target;

  const upload = useCallback(async (picked: File): Promise<CdnRef | null> => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;

    setFile(picked);
    setRef(null);
    setImage(null);
    setDeduped(false);
    setVariantsReady(false);
    setError(null);
    setPhase("hashing");

    const current = runtimeRef.current;
    try {
      const outcome = await runUpload(current.api, picked, {
        target: targetRef.current,
        limits: current.limits.image,
        signal: own.signal,
        onPhase: (next) => {
          if (!alive.current || own.signal.aborted) return;
          if (next === "done" || next === "failed" || next === "canceled") return;
          setPhase(next);
        },
        ...(current.variants !== undefined ? { variants: current.variants } : {}),
      });
      if (!alive.current) return outcome.ref;
      setRef(outcome.ref);
      // This hook is the IMAGE slot: its three targets all produce image rows,
      // which is why the bag can carry a narrowed `CdnImage` rather than the
      // union. The guard is not defensive noise — it is the type-level
      // statement that a target added later must widen this bag rather than
      // quietly hand a video row to a component that will read `variants_meta`
      // off it.
      setImage(outcome.kind === "image" ? (outcome.row as CdnImage) : null);
      setDeduped(outcome.deduped);
      setVariantsReady(outcome.variantsReady);
      setPhase("done");
      return outcome.ref;
    } catch (failure) {
      if (!alive.current) return null;
      if (isUploadCanceled(failure)) {
        setPhase("canceled");
        return null;
      }
      // `toStapelApiError`, never a cast: a CDN call can fail without a Stapel
      // envelope at all (network fault, an origin that answers HTML), and the
      // cast that silences the compiler leaves `.code` undefined at runtime.
      setError(toStapelApiError(failure));
      setPhase("failed");
      return null;
    }
  }, []);

  const cancel = useCallback((): void => {
    controller.current?.abort();
  }, []);

  const reset = useCallback((): void => {
    controller.current?.abort();
    setFile(null);
    setPhase("idle");
    setRef(null);
    setImage(null);
    setDeduped(false);
    setVariantsReady(false);
    setError(null);
  }, []);

  return {
    upload,
    cancel,
    reset,
    previewUrl,
    phase,
    isPending:
      phase === "hashing" ||
      phase === "checking" ||
      phase === "uploading" ||
      phase === "processing",
    ref,
    image,
    deduped,
    variantsReady,
    error,
  };
}
