/**
 * `<ImageUploadField/>` — one image slot, skinned. The avatar/cover control.
 *
 * The picker is a plain `<input type="file">` behind a button rather than
 * antd's `<Upload>`: `Upload` owns the request, and the request is the whole
 * point of this pair (hash, pre-check, dedup short-circuit, cancel, variant
 * wait). Handing it to a widget would mean either re-implementing the flow
 * inside `customRequest` or losing it.
 */
import { useId, useRef } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useErrorDisplay, useT } from "@stapel/core";
import { ImageUpload } from "../headless/ImageUpload.js";
import type { UploadImageBag } from "../headless/useUploadImage.js";
import { smallestVariantUrl } from "../headless/useUploadPreview.js";
import { useCdnRuntime } from "../model/context.js";
import { acceptAttribute } from "../model/limits.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { PHASE_KEYS, PREVIEW_BOX } from "./phase.js";

export interface ImageUploadFieldProps {
  /** Where the bytes go. Default: the general image intake. */
  target?: CdnUploadTarget;
  /** Called with `<type>/<hash>` once the CDN holds the bytes. */
  onUploaded?: (ref: string) => void;
  /** A reference already stored, rendered until a new pick replaces it. */
  currentUrl?: string | null;
}

function ImageUploadFieldBody(props: {
  bag: UploadImageBag;
  onUploaded: ((ref: string) => void) | undefined;
  currentUrl: string | null | undefined;
}): ReactElement {
  const t = useT();
  const runtime = useCdnRuntime();
  const errorDisplay = useErrorDisplay(CDN_I18N_KEYS.unknownError);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const { bag } = props;

  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Reset the input so picking the SAME file again still fires `change` —
    // the classic reason a retry after a failure appears to do nothing.
    event.target.value = "";
    if (file === undefined) return;
    void bag.upload(file).then((ref) => {
      if (ref !== null) props.onUploaded?.(ref);
    });
  };

  const shown =
    bag.previewUrl ?? smallestVariantUrl(bag.image) ?? props.currentUrl ?? null;

  return (
    <Space direction="vertical" data-testid="cdn-image-field">
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={acceptAttribute(runtime.limits.image)}
        onChange={onPick}
        style={{ display: "none" }}
        data-testid="cdn-image-input"
      />
      {shown === null ? null : (
        <img
          src={shown}
          alt={t(CDN_I18N_KEYS.itemAlt)}
          style={PREVIEW_BOX}
          data-testid="cdn-image-preview"
        />
      )}
      <Space>
        <Button
          onClick={() => input.current?.click()}
          disabled={bag.isPending}
          data-testid="cdn-image-pick"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {shown === null
            ? t(CDN_I18N_KEYS.pickImage)
            : t(CDN_I18N_KEYS.pickReplace)}
        </Button>
        {bag.isPending ? (
          <Button
            onClick={bag.cancel}
            data-testid="cdn-image-cancel"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CDN_I18N_KEYS.itemCancel)}
          </Button>
        ) : null}
      </Space>
      <Typography.Text type="secondary" data-testid="cdn-image-phase">
        {t(PHASE_KEYS[bag.phase])}
      </Typography.Text>
      {bag.deduped ? (
        <Typography.Text type="secondary" data-testid="cdn-image-deduped">
          {t(CDN_I18N_KEYS.deduped)}
        </Typography.Text>
      ) : null}
      {bag.phase === "done" && !bag.variantsReady ? (
        <Typography.Text type="secondary" data-testid="cdn-image-variants-pending">
          {t(CDN_I18N_KEYS.variantsPending)}
        </Typography.Text>
      ) : null}
      <ErrorAlert error={errorDisplay(bag.error)} testId="cdn-image-error" />
    </Space>
  );
}

export function ImageUploadField(props: ImageUploadFieldProps): ReactElement {
  return (
    <ImageUpload {...(props.target !== undefined ? { target: props.target } : {})}>
      {(bag) => (
        <ImageUploadFieldBody
          bag={bag}
          onUploaded={props.onUploaded}
          currentUrl={props.currentUrl}
        />
      )}
    </ImageUpload>
  );
}
