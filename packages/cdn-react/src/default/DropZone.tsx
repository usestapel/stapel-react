/**
 * The visible target an upload control was missing.
 *
 * Owner sweep 2026-08-26 (VISUAL-media, cdn-react): "an image-upload widget
 * with no visible way to give it an image". Both fields drove a
 * `display: none` file input from a bare antd `<Button>`, so the static shot of
 * an upload control was a button, and the affordance every person alive expects
 * from an upload control — a rectangle you can drag a file onto — did not
 * exist. `cdn.pick.drop_hint` had been translated into all three locales for
 * months with nothing rendering it.
 *
 * ── Two affordances, on purpose, and neither is a fallback ─────────────────
 *
 * The dashed region is a `<label htmlFor>`, which is what makes the whole
 * rectangle activate the input with no click handler at all — and which is also
 * the label association the hidden input never had (D-9: the input set an `id`
 * that nothing pointed at). Drag-and-drop rides on the same element.
 *
 * The BUTTON is not a redundant second way to do the same thing. A `<label>` is
 * not focusable, so a keyboard-only person cannot reach a label-driven picker
 * at all, and a `display: none` input is out of the tab order — which is how a
 * control can be "keyboard reachable" in a review and unusable in practice. The
 * button is the focusable, screen-reader-nameable path, and on a phone it is
 * 44px because `SkinTheme` makes every control 44px there.
 *
 * ── Why not antd's `<Upload.Dragger>` ─────────────────────────────────────
 *
 * The same reason this pair does not use `<Upload>`: `Dragger` owns the
 * request, and the request is the whole point of this package (hash, pre-check,
 * dedup short-circuit, cancel, bounded variant wait). Taking its drop target
 * would mean taking its transport.
 */
import { useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { GatedButton } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { CDN_I18N_KEYS } from "../i18n/keys.js";

export interface DropZoneProps {
  /** `accept`, built from the same allowlist the refusal is built from. */
  readonly accept: string;
  /** A gallery takes many; a single slot takes one. */
  readonly multiple?: boolean;
  /** The picker's own label — "Choose an image", "Add photos", "Choose a video". */
  readonly buttonLabel: string;
  /** Files the person chose or dropped, in the order they were given. */
  readonly onFiles: (files: readonly File[]) => void;
  /**
   * Whether picking is allowed, WITH its reason. An `ActionAvailability` rather
   * than a boolean because "the gallery is full" and "wait for the uploads to
   * finish" are different sentences, and the drop target has to refuse in the
   * same words the button does.
   */
  readonly gate: ActionAvailability;
  /** Rendered inside the frame, above the hint — the preview, when there is one. */
  readonly children?: ReactNode;
  readonly testId?: string;
}

/**
 * The frame is dashed and takes the border ROLE, not `currentColor`.
 *
 * `border: "1px dashed"` with no colour inherits the TEXT colour, so an empty
 * frame drew itself at full text contrast — a placeholder shouting as loudly as
 * the copy beside it. `--stapel-border-subtle` is the role for "the edge of a
 * region", and it follows the document's theme without this file knowing which
 * side it is on.
 */
const FRAME_BASE = {
  border: `1px dashed ${cssVar("border-subtle")}`,
  borderRadius: radii.lg,
  padding: spacing[4],
  display: "block",
  textAlign: "center",
} as const;

const suffix = (testId: string | undefined, part: string): string | undefined =>
  testId === undefined ? undefined : `${testId}-${part}`;

export function DropZone(props: DropZoneProps): ReactElement {
  const t = useT();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const blocked = !props.gate.available;

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const list = event.target.files;
    const files = list === null ? [] : Array.from(list);
    // Reset BEFORE handing the files on, so picking the same file again still
    // fires `change` — the classic reason a retry after a failure appears to do
    // nothing.
    event.target.value = "";
    if (files.length > 0) props.onFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (blocked) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) props.onFiles(files);
  };

  const frame = (
    <Flex vertical align="center" gap={spacing[3]}>
      {props.children}
      <Typography.Text type="secondary">
        {dragging ? t(CDN_I18N_KEYS.pickDropActive) : t(CDN_I18N_KEYS.pickDropHint)}
      </Typography.Text>
    </Flex>
  );

  const frameStyle = {
    ...FRAME_BASE,
    cursor: blocked ? "not-allowed" : "pointer",
    background: dragging ? cssVar("surface-sunken") : "transparent",
  };

  return (
    <div
      data-testid={props.testId}
      data-dragging={dragging ? "true" : "false"}
      onDragOver={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* A blocked zone keeps the frame and loses the `htmlFor`: a label whose
          input is unreachable would still open the picker, which is a control
          that looks off and behaves on. The reason is rendered by the
          GatedButton below, where a person is already looking. */}
      {blocked ? (
        <div style={frameStyle} data-testid={suffix(props.testId, "frame")}>
          {frame}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          style={frameStyle}
          data-testid={suffix(props.testId, "frame")}
        >
          {frame}
        </label>
      )}
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={props.accept}
        {...(props.multiple === true ? { multiple: true } : {})}
        onChange={onChange}
        style={{ display: "none" }}
        data-testid={suffix(props.testId, "input")}
      />
      <Flex justify="center" style={{ marginTop: spacing[3] }}>
        <GatedButton
          gate={props.gate}
          onClick={() => input.current?.click()}
          testId={suffix(props.testId, "pick")}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {props.buttonLabel}
        </GatedButton>
      </Flex>
    </div>
  );
}
