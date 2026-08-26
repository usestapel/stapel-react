/**
 * `<MediaUploadField/>` — one video, or one document, skinned.
 *
 * D-3, the other half. `POST /upload/video/` and `POST /upload/file/` have been
 * typed and callable in this pair since it was written, and documented in
 * `api/cdnApi.ts` as endpoints with "no hook and no widget over it". The model
 * layer grew both targets in wave B; this is the control. Two shipped backend
 * endpoints with no UI is the §83 class, and it is also where `duration_ms`,
 * `poster_url` and the waveform half of §83.2 had no possible consumer — a
 * fleet cannot render what nobody can upload.
 *
 * ── Why one component and not two ─────────────────────────────────────────
 *
 * A video and a document differ in exactly three places — the ceilings they are
 * validated against, the `accept` string, and what the result looks like when it
 * lands — and every one of those is already data (`runtime.limits[kind]`,
 * `acceptAttribute`, `render_meta.kind`). Two components would have been the
 * same file twice with a different noun, and the second copy is where the drift
 * starts.
 *
 * ── What the result shows, and why it is the attachment renderer ───────────
 *
 * The upload response carries `render_meta`, so the moment the row lands this
 * control knows the poster, the waveform, the duration and how complete the
 * snapshot is — the same snapshot `describe` would answer with. So the result is
 * drawn by {@link MediaAttachment} with the snapshot handed straight in, and NO
 * describe request is made: the pair has the answer already. A different
 * renderer here would be a second opinion about the same bytes.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import {
  actionAvailable,
  actionBlocked,
  toStapelApiError,
  useT,
} from "@stapel/core";
import type { ActionAvailability, StapelApiError } from "@stapel/core";
import { ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens";
import { useCdnRuntime } from "../model/context.js";
import { acceptAttribute } from "../model/limits.js";
import { isUploadCanceled, runUpload } from "../model/upload.js";
import type { CdnUploadTarget, UploadPhase } from "../model/upload.js";
import type { CdnRef, CdnRenderMeta, CdnVariantsStatus } from "../api/types.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { DropZone } from "./DropZone.js";
import { MediaAttachment } from "./MediaAttachment.js";
import { PHASE_KEYS } from "./phase.js";

/** Which of the two non-image intakes this field drives. */
export type MediaUploadKind = "video" | "file";

export interface MediaUploadFieldProps {
  /** `"video"` → `POST /upload/video/`; `"file"` → `POST /upload/file/`. */
  readonly kind: MediaUploadKind;
  /** Called with `<kind>/<hash>` once the CDN holds the bytes. */
  readonly onUploaded?: (ref: CdnRef) => void;
  /** Absent means "whatever the host document declares", never a hardcoded side. */
  readonly mode?: ThemeMode;
  readonly testId?: string;
}

const PICK_KEY: Readonly<Record<MediaUploadKind, string>> = {
  video: CDN_I18N_KEYS.pickVideo,
  file: CDN_I18N_KEYS.pickFile,
};

interface Landed {
  readonly ref: CdnRef;
  readonly meta: CdnRenderMeta | null;
  /**
   * The row's own `variants_status`. `null` for both of these kinds today —
   * neither model publishes a ladder — and shown when it is `"pending"`,
   * because that is the contract's instruction ("read it before you render a
   * variant URL") rather than an inference off `is_processed`.
   */
  readonly variantsStatus: CdnVariantsStatus | null;
}

export function MediaUploadField(props: MediaUploadFieldProps): ReactElement {
  const t = useT();
  const runtime = useCdnRuntime();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [landed, setLanded] = useState<Landed | null>(null);
  const [error, setError] = useState<StapelApiError | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const target: CdnUploadTarget = { kind: props.kind };
  const limits = runtime.limits[props.kind];
  const busy = controller !== null;

  // The zone is switched off WHILE A FILE IS IN FLIGHT and says so, rather than
  // going grey: a second pick would abandon the first upload silently.
  const gate: ActionAvailability = busy
    ? actionBlocked(CDN_I18N_KEYS.blockedPending)
    : actionAvailable();

  const start = (files: readonly File[]): void => {
    const file = files[0];
    if (file === undefined || busy) return;
    const own = new AbortController();
    setController(own);
    setError(null);
    setLanded(null);
    setPhase("hashing");
    void runUpload(runtime.api, file, {
      target,
      limits,
      signal: own.signal,
      onPhase: (next) => {
        if (own.signal.aborted) return;
        if (next === "done" || next === "failed" || next === "canceled") return;
        setPhase(next);
      },
      ...(runtime.variants !== undefined ? { variants: runtime.variants } : {}),
    }).then(
      (outcome) => {
        setController(null);
        setLanded({
          ref: outcome.ref,
          meta: outcome.row.render_meta ?? null,
          variantsStatus: outcome.variantsStatus,
        });
        setPhase("done");
        props.onUploaded?.(outcome.ref);
      },
      (failure: unknown) => {
        setController(null);
        if (isUploadCanceled(failure)) {
          setPhase("canceled");
          return;
        }
        setError(toStapelApiError(failure));
        setPhase("failed");
      }
    );
  };

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid={props.testId ?? `cdn-${props.kind}-field`}
    >
      <Flex vertical gap={spacing[3]}>
        <DropZone
          accept={acceptAttribute(limits)}
          buttonLabel={t(PICK_KEY[props.kind])}
          gate={gate}
          onFiles={start}
          testId={`cdn-${props.kind}-drop`}
        >
          {landed === null ? null : (
            <MediaAttachment
              mediaRef={landed.ref}
              meta={landed.meta}
              testId={`cdn-${props.kind}-result`}
            />
          )}
        </DropZone>
        {/* The step is announced, not just painted: without a live region a
            screen-reader user is never told that an upload finished (D-9). */}
        <Typography.Text
          type="secondary"
          aria-live="polite"
          data-testid={`cdn-${props.kind}-phase`}
        >
          {t(PHASE_KEYS[phase])}
        </Typography.Text>
        {landed?.variantsStatus === "pending" ? (
          <Typography.Text
            type="secondary"
            data-testid={`cdn-${props.kind}-variants-status`}
          >
            {t(CDN_I18N_KEYS.variantsPending)}
          </Typography.Text>
        ) : null}
        {busy ? (
          <Flex>
            <Button
              onClick={() => controller?.abort()}
              data-testid={`cdn-${props.kind}-cancel`}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked()"
            >
              {t(CDN_I18N_KEYS.itemCancel)}
            </Button>
          </Flex>
        ) : null}
        <ErrorAlert
          {...(error === null ? {} : { thrown: error })}
          testId={`cdn-${props.kind}-error`}
        />
      </Flex>
    </SkinTheme>
  );
}
