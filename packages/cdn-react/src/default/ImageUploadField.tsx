/**
 * `<ImageUploadField/>` — one image slot, skinned. The avatar/cover control.
 *
 * The picker is a plain `<input type="file">` behind a drop target rather than
 * antd's `<Upload>`: `Upload` owns the request, and the request is the whole
 * point of this pair (hash, pre-check, dedup short-circuit, cancel, variant
 * wait). Handing it to a widget would mean either re-implementing the flow
 * inside `customRequest` or losing it.
 *
 * ── What changed in the wave-D pass ────────────────────────────────────────
 *
 * The control used to be a bare button over a `display: none` input — an
 * image-upload widget with no visible place to put an image, which is what the
 * visual review photographed. It is now a {@link DropZone}: a bordered region
 * that takes a drag, a `<label>` that makes the whole region open the picker
 * (and gives the hidden input the association it never had), and a focusable
 * button beside it for the keyboard. The picked or stored image is drawn INSIDE
 * the frame, so the slot is a slot whether or not it is filled.
 *
 * The step is also announced now (`aria-live="polite"`): a screen-reader user
 * was previously never told that an upload finished.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens";
import { ImageUpload } from "../headless/ImageUpload.js";
import type { UploadImageBag } from "../headless/useUploadImage.js";
import { CdnThumbnail } from "./CdnThumbnail.js";
import { useCdnRuntime } from "../model/context.js";
import { acceptAttribute } from "../model/limits.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { DropZone } from "./DropZone.js";
import { PHASE_KEYS, PREVIEW_BOX } from "./phase.js";

export interface ImageUploadFieldProps {
  /** Where the bytes go. Default: the general image intake. */
  target?: CdnUploadTarget;
  /** Called with `<type>/<hash>` once the CDN holds the bytes. */
  onUploaded?: (ref: string) => void;
  /** A reference already stored, rendered until a new pick replaces it. */
  currentUrl?: string | null;
  /** Absent means "whatever the host document declares", never a hardcoded side. */
  mode?: ThemeMode;
}

function ImageUploadFieldBody(props: {
  bag: UploadImageBag;
  onUploaded: ((ref: string) => void) | undefined;
  currentUrl: string | null | undefined;
}): ReactElement {
  const t = useT();
  const runtime = useCdnRuntime();
  const { bag } = props;

  const onFiles = (files: readonly File[]): void => {
    const file = files[0];
    if (file === undefined) return;
    void bag.upload(file).then((ref) => {
      if (ref !== null) props.onUploaded?.(ref);
    });
  };

  // The tier is picked from the BOX, not from the ladder: `<CdnThumbnail>`
  // measures this tile and asks for what fits it at the live device pixel
  // ratio, where this used to hardcode the smallest variant the CDN made.
  const localUrl = bag.previewUrl ?? props.currentUrl ?? null;
  const hasPixels = localUrl !== null || bag.image !== null;

  // Blocked while a file is in flight, WITH the reason: a second pick would
  // abandon the first upload without saying so.
  const gate: ActionAvailability = bag.isPending
    ? actionBlocked(CDN_I18N_KEYS.blockedPending)
    : actionAvailable();

  return (
    <Flex vertical gap={spacing[3]} data-testid="cdn-image-field">
      <DropZone
        accept={acceptAttribute(runtime.limits.image)}
        buttonLabel={
          hasPixels ? t(CDN_I18N_KEYS.pickReplace) : t(CDN_I18N_KEYS.pickImage)
        }
        gate={gate}
        onFiles={onFiles}
        testId="cdn-image"
      >
        {hasPixels ? (
          <CdnThumbnail
            localUrl={localUrl}
            image={bag.image}
            box={PREVIEW_BOX}
            alt={t(CDN_I18N_KEYS.itemAlt)}
            data-testid="cdn-image-preview"
          />
        ) : null}
      </DropZone>
      {bag.isPending ? (
        <Flex>
          <Button
            onClick={bag.cancel}
            data-testid="cdn-image-cancel"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CDN_I18N_KEYS.itemCancel)}
          </Button>
        </Flex>
      ) : null}
      {/* The phase line only appears once something is happening. "Waiting its
          turn" printed under an untouched slot described a queue position for
          something that was never queued — the drop hint is what an idle slot
          has to say. */}
      {bag.phase === "idle" ? null : (
        <Typography.Text
          type="secondary"
          aria-live="polite"
          data-testid="cdn-image-phase"
        >
          {t(PHASE_KEYS[bag.phase])}
        </Typography.Text>
      )}
      {bag.deduped ? (
        <Typography.Text type="secondary" data-testid="cdn-image-deduped">
          {t(CDN_I18N_KEYS.deduped)}
        </Typography.Text>
      ) : null}
      {/* `variants_status` is the field the contract says to read before
          rendering a variant URL — the row publishes it, so the row's own word
          is what gets shown, rather than an inference off `is_processed`. */}
      {bag.variantsStatus === "pending" ? (
        <Typography.Text
          type="secondary"
          data-testid="cdn-image-variants-pending"
        >
          {t(CDN_I18N_KEYS.variantsPending)}
        </Typography.Text>
      ) : null}
      <ErrorAlert
        {...(bag.error === null ? {} : { thrown: bag.error })}
        testId="cdn-image-error"
      />
    </Flex>
  );
}

export function ImageUploadField(props: ImageUploadFieldProps): ReactElement {
  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <ImageUpload {...(props.target !== undefined ? { target: props.target } : {})}>
        {(bag) => (
          <ImageUploadFieldBody
            bag={bag}
            onUploaded={props.onUploaded}
            currentUrl={props.currentUrl}
          />
        )}
      </ImageUpload>
    </SkinTheme>
  );
}
