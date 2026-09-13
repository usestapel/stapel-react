/**
 * THE PENDING LIST — what a person has attached but not yet sent.
 *
 * A composer with attachments is two different clocks running at once: the
 * bytes go to the CDN on their own schedule, and the message goes to stapel-chat
 * when the person presses send. This hook is the join, and it owns exactly the
 * state that join needs — the per-file phase, what came back, what failed, and
 * the `{key, type}` list `SendMessageRequest.attachments[]` wants.
 *
 * ── The upload is a SEAM, not an import ───────────────────────────────────
 *
 * Nothing here knows stapel-cdn exists. {@link AttachmentUpload} is a function
 * the caller supplies, and the reason is bundle purity plus honesty: uploading
 * needs a `CdnProvider` and upload rights, which are a HOST's wiring, and this
 * pair's main entry must not pull another pair's client into a bundle that only
 * wanted to read a thread. The `/default` skin wires `@stapel/cdn-react`'s
 * `useMediaUpload` into it, which is where that dependency belongs.
 *
 * That is also what makes this testable without a network: `test/attachments`
 * drives the whole composer flow with a fake uploader and asserts what reaches
 * the send.
 *
 * ── Two gates, and neither is "disabled, reason unknown" ──────────────────
 *
 * `canAdd` says whether another file may join (the deployment's
 * `MAX_ATTACHMENTS`). `settled` says whether the message may GO — blocked while
 * anything is still uploading, and blocked differently while anything has
 * failed, because "wait" and "remove or retry it" are two different next
 * actions. Both are `ActionAvailability`, so a switched-off control always
 * carries its sentence.
 *
 * ── What is NOT here ──────────────────────────────────────────────────────
 *
 * No percentage. The uploader reports which STEP it is on, for the reason
 * `@stapel/cdn-react`'s own flow states at length: there is no honest
 * byte-percentage behind `fetch`, and a bar that is animated rather than
 * measured is a lie with a progress indicator on it. A chip names the step.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Attachment } from "../api/types.js";
import type { AttachmentMedium } from "../model/attachments.js";
import { attachmentMedium } from "../model/attachments.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";
import { CHAT_DEFAULT_MAX_ATTACHMENTS } from "../model/limits.js";

/** What the host's uploader is asked for, and what it must come back with. */
export interface AttachmentUploadRequest {
  readonly file: File;
  /** The registry type this will be SENT as — `image` / `gif` / `video` / … */
  readonly type: string;
  /** Fires when the upload is abandoned; an uploader must honour it. */
  readonly signal: AbortSignal;
  /**
   * The step the upload is on, in the uploader's own vocabulary. Passed
   * straight through to the chip as an i18n key, so an uploader that says
   * nothing leaves the chip on its generic "uploading".
   */
  readonly onPhase: (phase: string) => void;
}

export interface AttachmentUploadResult {
  /** The opaque `<type>/<hash>` the message stores. */
  readonly key: string;
  /**
   * What the uploader already knows about the stored asset, if anything — the
   * render snapshot that came back INLINE on the upload response. It is what
   * lets the chip show a real thumbnail and the sent bubble paint without a
   * round trip; `null` costs nothing but a plainer chip.
   */
  readonly descriptor?: Partial<Attachment> | null;
}

export type AttachmentUpload = (
  request: AttachmentUploadRequest
) => Promise<AttachmentUploadResult>;

/** Which step a pending attachment is on. */
export type AttachmentDraftPhase =
  | "uploading"
  | "ready"
  | "failed"
  /** Removed while in flight. Kept out of the list; named for the tests. */
  | "canceled";

export interface AttachmentDraftItem {
  /** Local and stable for the life of the chip — never the CDN key, which
   * does not exist yet when the chip is first drawn. */
  readonly id: string;
  readonly name: string;
  readonly bytes: number;
  /** The registry type it will be sent as. */
  readonly type: string;
  /** Which arm a chip draws it with. */
  readonly medium: AttachmentMedium;
  readonly phase: AttachmentDraftPhase;
  /** The uploader's own word for the step, while {@link phase} is uploading. */
  readonly step: string | null;
  /** `null` until the bytes are stored. */
  readonly key: string | null;
  /** What the uploader learned about the stored asset, when it learned any. */
  readonly descriptor: Partial<Attachment> | null;
  /** A local object URL for a picture, so the chip is not blank while it goes. */
  readonly previewUrl: string | null;
  readonly error: unknown;
}

export interface AttachmentDraftBag {
  readonly items: readonly AttachmentDraftItem[];
  /**
   * Attach files. Each starts uploading immediately — a person who picked a
   * photo has already decided; making them press a second button before the
   * bytes move is a wait they did not ask for.
   *
   * Files beyond `max` are REFUSED rather than silently dropped: `canAdd`
   * carries the reason and this returns the ones it took.
   */
  add(files: readonly File[], options?: AttachmentAddOptions): void;
  /** Drop one, aborting its upload if it is still going. */
  remove(id: string): void;
  /** Try a failed one again, with the same bytes. */
  retry(id: string): void;
  /** Empty the list — what a successful send does. */
  clear(): void;
  /** Whether another file may join, and why not. */
  readonly canAdd: ActionAvailability;
  /** Whether the message may go, and — when it may not — which wait it is. */
  readonly settled: ActionAvailability;
  /** Whether anything is attached at all (an attachment-only message is legal). */
  readonly hasAttachments: boolean;
  /** Exactly what `SendMessageRequest.attachments[]` wants. */
  readonly payload: readonly { readonly key: string; readonly type: string }[];
}

export interface AttachmentAddOptions {
  /** Force the registry type (a recording is `audio`, whatever its MIME). */
  readonly type?: string;
}

export interface UseAttachmentDraftOptions {
  readonly upload: AttachmentUpload;
  /** The deployment's `STAPEL_CHAT["MAX_ATTACHMENTS"]`. Default 10. */
  readonly max?: number;
}

/**
 * The registry type a picked file will be sent as.
 *
 * From the MIME the picker supplied, which is the only thing a browser knows
 * about a file before it is read. It is a GUESS and it is allowed to be: the
 * CDN classifies the stored bytes itself and stapel-chat merges that answer
 * over this one (`ATTACHMENT_METADATA: "cdn"`), so a wrong guess here costs a
 * slightly wrong chip icon for a second and nothing after that.
 *
 * `gif` before `image` on purpose: it is its own registry type precisely so a
 * client can offer a play affordance without sniffing a mime, and collapsing
 * it into `image` at the compose end would throw that away at the only moment
 * it is free to keep.
 */
export function attachmentTypeForFile(file: File): string {
  const mime = file.type.toLowerCase();
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

/** Revoking is paired with creating, so it is guarded the same way. */
function revokeObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // A URL created by an API that is gone cannot be revoked, and there is
    // nothing to report: the goal is that the blob is not held, and a
    // document whose object-URL registry never existed is not holding one.
  }
}

let draftSeq = 0;
function nextDraftId(): string {
  draftSeq += 1;
  return `att-${String(draftSeq)}`;
}

export function useAttachmentDraft(
  options: UseAttachmentDraftOptions
): AttachmentDraftBag {
  const max = options.max ?? CHAT_DEFAULT_MAX_ATTACHMENTS;
  const [items, setItems] = useState<readonly AttachmentDraftItem[]>([]);

  /** The bytes and the abort handle, kept OUT of state — neither renders. */
  const sources = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>());
  const alive = useRef(true);
  const uploadRef = useRef(options.upload);
  uploadRef.current = options.upload;

  const revoke = useCallback((id: string): void => {
    const url = previews.current.get(id);
    if (url !== undefined) {
      revokeObjectUrl(url);
      previews.current.delete(id);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const inFlight = controllers.current;
    const urls = previews.current;
    return () => {
      alive.current = false;
      // Both halves matter and neither is optional: an upload nobody is
      // waiting for is bytes still leaving a phone, and an object URL nobody
      // revokes is the blob held in memory for the life of the document.
      for (const controller of inFlight.values()) controller.abort();
      inFlight.clear();
      for (const url of urls.values()) revokeObjectUrl(url);
      urls.clear();
    };
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<AttachmentDraftItem>): void => {
      if (!alive.current) return;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item))
      );
    },
    []
  );

  const run = useCallback(
    (id: string, file: File, type: string): void => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      void uploadRef
        .current({
          file,
          type,
          signal: controller.signal,
          onPhase: (step) => {
            if (controller.signal.aborted) return;
            patch(id, { step });
          },
        })
        .then((result) => {
          controllers.current.delete(id);
          if (controller.signal.aborted) return;
          patch(id, {
            phase: "ready",
            step: null,
            key: result.key,
            descriptor: result.descriptor ?? null,
            error: null,
          });
        })
        .catch((error: unknown) => {
          controllers.current.delete(id);
          // An abort is a removal this hook performed, not a failure to show
          // somebody — the chip is already gone.
          if (controller.signal.aborted) return;
          patch(id, { phase: "failed", step: null, error });
        });
    },
    [patch]
  );

  const add = useCallback(
    (files: readonly File[], addOptions?: AttachmentAddOptions): void => {
      if (files.length === 0) return;
      setItems((current) => {
        const room = Math.max(0, max - current.length);
        const taken = files.slice(0, room);
        const admitted = taken.map((file) => {
          const id = nextDraftId();
          const type = addOptions?.type ?? attachmentTypeForFile(file);
          sources.current.set(id, file);
          let previewUrl: string | null = null;
          if (type === "image" || type === "gif") {
            // A picture shows itself the instant it is picked, long before any
            // server has seen it. Revoked on remove, on clear and on unmount.
            //
            // GUARDED, and not because browsers differ — every browser this
            // pair supports has had this since 2019. It is guarded because the
            // preview is an ENHANCEMENT, and an enhancement that can throw
            // takes the operation it was enhancing with it: without this, a
            // page rendered where the object-URL API is absent loses the
            // ATTACHMENT, not the thumbnail. The chip falls back to its medium
            // tag and the upload proceeds untouched.
            try {
              previewUrl = URL.createObjectURL(file);
              previews.current.set(id, previewUrl);
            } catch {
              previewUrl = null;
            }
          }
          const item: AttachmentDraftItem = {
            id,
            name: file.name,
            bytes: file.size,
            type,
            medium: attachmentMedium({ key: "", type } as Attachment),
            phase: "uploading",
            step: null,
            key: null,
            descriptor: null,
            previewUrl,
            error: null,
          };
          return item;
        });
        // Started AFTER the state updater has decided what was admitted, so a
        // file the ceiling refused never starts an upload nobody will send.
        queueMicrotask(() => {
          for (const item of admitted) {
            const file = sources.current.get(item.id);
            if (file !== undefined) run(item.id, file, item.type);
          }
        });
        return [...current, ...admitted];
      });
    },
    [max, run]
  );

  const remove = useCallback(
    (id: string): void => {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
      sources.current.delete(id);
      revoke(id);
      setItems((current) => current.filter((item) => item.id !== id));
    },
    [revoke]
  );

  const retry = useCallback(
    (id: string): void => {
      const file = sources.current.get(id);
      if (file === undefined) return;
      setItems((current) => {
        const item = current.find((entry) => entry.id === id);
        if (item === undefined || item.phase !== "failed") return current;
        queueMicrotask(() => {
          run(id, file, item.type);
        });
        return current.map((entry) =>
          entry.id === id
            ? { ...entry, phase: "uploading", step: null, error: null }
            : entry
        );
      });
    },
    [run]
  );

  const clear = useCallback((): void => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    sources.current.clear();
    for (const url of previews.current.values()) revokeObjectUrl(url);
    previews.current.clear();
    setItems([]);
  }, []);

  const uploading = items.some((item) => item.phase === "uploading");
  const failed = items.some((item) => item.phase === "failed");

  return {
    items,
    add,
    remove,
    retry,
    clear,
    canAdd:
      items.length >= max
        ? actionBlocked(CHAT_I18N_KEYS.attachBlockedFull, { max })
        : actionAvailable(),
    settled: uploading
      ? actionBlocked(CHAT_I18N_KEYS.attachBlockedPending)
      : failed
        ? actionBlocked(CHAT_I18N_KEYS.attachBlockedFailed)
        : actionAvailable(),
    hasAttachments: items.length > 0,
    payload: items
      .filter(
        (item): item is AttachmentDraftItem & { key: string } => item.key !== null
      )
      .map((item) => ({ key: item.key, type: item.type })),
  };
}
