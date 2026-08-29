/**
 * `PermissionSheet` / `PermissionGate` — the one place the fleet asks for a
 * browser capability, and the one place it handles being told no.
 *
 * A browser permission prompt is a single line the product cannot write,
 * fired once, with no second chance: *"example.com wants to use your
 * location"*, Allow / Block. Everything that makes it answerable — why we are
 * asking, what happens if you say no, and where the switch is once you have —
 * has to be said BEFORE it, by us. A product that fires the browser prompt
 * cold on page load gets refused by reflex, and a refusal is permanent: the
 * browser will not ask again, no matter how many times the button is pressed.
 *
 * So this is a two-step surface, and both steps matter:
 *
 *  1. **The pre-prompt.** A sheet on a phone, a modal on tablet/desktop (it is
 *     a {@link SkinDialog}, so that is not a choice this file makes), saying
 *     what the capability is for. Dismissing it costs nothing — the browser
 *     was never asked, which is why the way out says "Not now" and not "Deny".
 *  2. **The refusal, handled in the same surface.** When the answer is no, the
 *     sheet does not close on a dead end: it swaps to the guidance for turning
 *     it back on, and renders the {@link PermissionSheetProps.fallback} — the
 *     way forward that does not need the capability at all. And the Allow
 *     button is GONE rather than disabled, because a control that provably
 *     cannot work is worse than no control: the house rule about showing a
 *     blocked control's reason (`GatedControl`) is for gates the person can
 *     open, and this one they cannot, from here.
 *
 * The copy defaults to core's UI floor, per kind, in every locale core ships
 * (`PERMISSION_COPY_KEYS`) — so a pair gets an answerable question with no
 * wiring, and a product that has a better sentence passes it as a prop or
 * overrides the key. The bridge invents no English of its own.
 *
 * The state itself is `usePermission` in `@stapel/core`: headless, so a pair
 * without antd gets the same five states. Nothing here re-derives it.
 */
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Space, Typography, theme as antdTheme } from "antd";
import { PERMISSION_COPY_KEYS, STAPEL_UI_KEYS } from "@stapel/core";
import type { PermissionBag, PermissionStatus } from "@stapel/core";
import { SkinDialog, useDialogSurface } from "./dialog.js";
import type { DialogSurface } from "./dialog.js";
import { useSubstrateI18n } from "./floor.js";

/** Modal width on tablet/desktop: a question and a paragraph. */
const PERMISSION_MODAL_WIDTH = 420;

/** The affirmative's test id — fixed, so a pair's test finds it. */
export const PERMISSION_ALLOW_TESTID: string = "stapel-permission-allow";
/** The way out's test id. */
export const PERMISSION_DISMISS_TESTID: string = "stapel-permission-dismiss";

/**
 * Whether the browser can still be asked. `denied` and `unsupported` are the
 * two states where pressing anything is theatre.
 */
export function permissionIsBlocked(status: PermissionStatus): boolean {
  return status === "denied" || status === "unsupported";
}

/** Copy overrides. Every field falls back to core's floor for the kind. */
export interface PermissionCopy {
  /** The question: "Use your location?" */
  readonly title?: ReactNode;
  /** Why, in a sentence, before the browser's own prompt. */
  readonly body?: ReactNode;
  /** What to do now that it has been refused, and where the switch is. */
  readonly deniedBody?: ReactNode;
  /** The affirmative's label. Default: the floor's "Allow". */
  readonly allowLabel?: string;
  /** The way out's label. Default: the floor's "Not now" (never "Deny" — the
   * browser has not been asked yet, and this button must not read like an
   * answer to it). */
  readonly dismissLabel?: string;
}

/** The three sentences for one kind, from the floor or the caller. */
function usePermissionCopy(
  kind: string,
  copy: PermissionCopy
): { title: ReactNode; body: ReactNode; deniedBody: ReactNode } {
  const { t } = useSubstrateI18n();
  const keys = PERMISSION_COPY_KEYS[kind];
  return {
    title: copy.title ?? (keys === undefined ? "" : t(keys.title)),
    body: copy.body ?? (keys === undefined ? "" : t(keys.body)),
    deniedBody: copy.deniedBody ?? (keys === undefined ? "" : t(keys.denied)),
  };
}

export interface PermissionSheetProps extends PermissionCopy {
  readonly open: boolean;
  /** The bag from `usePermission(kind)`. This component owns no state of it. */
  readonly permission: PermissionBag;
  /** Dismissal — the button, the mask, Esc, and the swipe all call it. */
  readonly onClose: () => void;
  /**
   * The browser has answered. Fires for every outcome, including `denied`,
   * because the fallback path is a thing the caller starts, not a thing that
   * happens to it.
   */
  readonly onResolved?: (status: PermissionStatus) => void;
  /**
   * What to offer INSTEAD, once the answer is no — a search field where the
   * position would have been, an upload button where the camera would have
   * been. Rendered inside the sheet under the guidance, so the dead end has a
   * door in it.
   */
  readonly fallback?: ReactNode;
  /** Force a surface (tests). See `SkinDialogProps.surface`. */
  readonly surface?: DialogSurface;
  /** Stamped on the body wrapper, beside `data-stapel-permission`. */
  readonly "data-testid"?: string;
}

/**
 * The pre-prompt. Stamped `data-stapel-permission="<status>"` on its body, so
 * a pair's test can prove which arm is on screen without reading copy.
 */
export function PermissionSheet(props: PermissionSheetProps): ReactElement {
  const { t } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const auto = useDialogSurface();
  const surface = props.surface ?? auto;
  const status = props.permission.status;
  const blocked = permissionIsBlocked(status);
  const copy = usePermissionCopy(props.permission.kind, props);
  const allowLabel = props.allowLabel ?? t(STAPEL_UI_KEYS.permissionAllow);
  const dismissLabel =
    props.dismissLabel ??
    (blocked ? t(STAPEL_UI_KEYS.dismiss) : t(STAPEL_UI_KEYS.permissionNotNow));

  const ask = (): void => {
    void props.permission.request().then((next) => {
      props.onResolved?.(next);
      // Granted, or the browser answered something we can proceed on: the
      // sheet has done its job. Refused: stay open on the guidance arm, which
      // is the only screen that says where the switch is.
      if (!permissionIsBlocked(next)) props.onClose();
    });
  };

  const dismissButton = (
    <Button
      onClick={props.onClose}
      block={surface === "sheet"}
      data-testid={PERMISSION_DISMISS_TESTID}
      data-analytics="none"
      data-analytics-reason="local-ui-dismiss-permission-prompt"
    >
      {dismissLabel}
    </Button>
  );
  const allowButton = (
    <Button
      type="primary"
      loading={props.permission.asking}
      onClick={ask}
      block={surface === "sheet"}
      data-testid={PERMISSION_ALLOW_TESTID}
      data-analytics="none"
      data-analytics-reason="passthrough — the browser's own prompt is the event"
    >
      {allowLabel}
    </Button>
  );

  const footer = blocked ? (
    dismissButton
  ) : surface === "sheet" ? (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {allowButton}
      {dismissButton}
    </Space>
  ) : (
    <Space size="small" style={{ width: "100%", justifyContent: "flex-end" }}>
      {dismissButton}
      {allowButton}
    </Space>
  );

  const sentence =
    status === "unsupported" && props.deniedBody === undefined
      ? t(STAPEL_UI_KEYS.permissionUnsupported)
      : blocked
        ? copy.deniedBody
        : copy.body;

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={copy.title}
      dismissLabel={dismissLabel}
      surface={surface}
      width={PERMISSION_MODAL_WIDTH}
      footer={footer}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <div data-stapel-permission={status}>
        <Typography.Paragraph style={{ marginBottom: token.paddingSM }}>
          {sentence}
        </Typography.Paragraph>
        {blocked && props.fallback !== undefined ? (
          <div data-stapel-permission-fallback="">{props.fallback}</div>
        ) : null}
      </div>
    </SkinDialog>
  );
}

export interface PermissionGateProps extends PermissionCopy {
  /** The bag from `usePermission(kind)`. */
  readonly permission: PermissionBag;
  /** What the capability is for — rendered only once it is granted. */
  readonly children: ReactNode;
  /**
   * The way forward that does not need the capability. Rendered in place of
   * the trigger once the answer is no, and inside the sheet beside the
   * guidance. Omit it only where there genuinely is no other way.
   */
  readonly fallback?: ReactNode;
  /**
   * The control that opens the pre-prompt. Default: a button labelled with
   * `allowLabel`. Pass one to put the ask on a control the screen already has
   * — a "use my position" link, a camera icon in a composer.
   */
  readonly trigger?: (ask: () => void) => ReactNode;
  /**
   * Open the pre-prompt as soon as the gate mounts, once, if the browser can
   * still be asked. Off by default: a question nobody invited is the thing
   * this component exists to stop.
   */
  readonly askOnMount?: boolean;
  readonly onResolved?: (status: PermissionStatus) => void;
  /** Force a surface (tests). See `SkinDialogProps.surface`. */
  readonly surface?: DialogSurface;
  readonly testId?: string | undefined;
}

/**
 * The whole ask, as one element: the trigger, the pre-prompt, the granted
 * content and the fallback. Stamped `data-stapel-permission-gate="<status>"`.
 */
export function PermissionGate(props: PermissionGateProps): ReactElement {
  const { t } = useSubstrateI18n();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const status = props.permission.status;
  const blocked = permissionIsBlocked(status);
  const allowLabel = props.allowLabel ?? t(STAPEL_UI_KEYS.permissionAllow);

  useEffect(() => {
    if (props.askOnMount !== true || asked || blocked || status === "granted") return;
    setAsked(true);
    setOpen(true);
  }, [props.askOnMount, asked, blocked, status]);

  const body =
    status === "granted" ? (
      props.children
    ) : blocked ? (
      (props.fallback ?? null)
    ) : props.trigger !== undefined ? (
      props.trigger(() => {
        setOpen(true);
      })
    ) : (
      <Button
        onClick={() => {
          setOpen(true);
        }}
        data-testid={
          props.testId !== undefined ? `${props.testId}-ask` : "stapel-permission-ask"
        }
        data-analytics="none"
        data-analytics-reason="local-ui-open-permission-prompt"
      >
        {allowLabel}
      </Button>
    );

  return (
    <div
      data-stapel-permission-gate={status}
      {...(props.testId !== undefined ? { "data-testid": props.testId } : {})}
    >
      {body}
      <PermissionSheet
        open={open}
        permission={props.permission}
        onClose={() => {
          setOpen(false);
        }}
        {...(props.onResolved !== undefined ? { onResolved: props.onResolved } : {})}
        {...(props.fallback !== undefined ? { fallback: props.fallback } : {})}
        {...(props.title !== undefined ? { title: props.title } : {})}
        {...(props.body !== undefined ? { body: props.body } : {})}
        {...(props.deniedBody !== undefined ? { deniedBody: props.deniedBody } : {})}
        {...(props.allowLabel !== undefined ? { allowLabel: props.allowLabel } : {})}
        {...(props.dismissLabel !== undefined ? { dismissLabel: props.dismissLabel } : {})}
        {...(props.surface !== undefined ? { surface: props.surface } : {})}
      />
    </div>
  );
}
