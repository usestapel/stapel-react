/**
 * `SkinConfirm` — the confirmation that is a bottom sheet on a phone and a
 * small centred modal on tablet/desktop. It replaces antd's `Popconfirm`
 * under `src/default/**` (nine sites in five pairs when this was written).
 *
 * A `Popconfirm` is an anchored popover with two buttons — a desktop surface
 * that, on a 390px phone, opens against the edge of the screen, clips its
 * text, and puts two 22px buttons under a thumb. The rule that took the
 * eight centred modals off the phone (`SkinDialog`) applies to it exactly:
 * a confirmation is a dialog, and on a phone a dialog is a sheet. Rendering
 * through {@link SkinDialog} also gives it what a popover never had — focus
 * trap and restore, Esc, a swipe with a keyboard equivalent, safe-area
 * padding — for free.
 *
 * Controlled, not trigger-wrapping: `Popconfirm` owned its `open` state and
 * hid the trigger inside its children, which is why every site had to
 * re-derive "is the destructive action in flight" outside it. Here the
 * caller holds one boolean and one pending flag, and both arms are plain
 * props.
 *
 * Copy: `confirmLabel`/`cancelLabel` default to core's UI floor ("Confirm" /
 * "Cancel" in the host's locale). A destructive question names its action —
 * "Remove", "Delete forever" — because "Confirm" under "Delete forever?" is
 * the one place a generic label costs somebody data.
 */
import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Space, Typography, theme as antdTheme } from "antd";
import { SkinButton as Button } from "./components.js";
import { STAPEL_UI_KEYS } from "@stapel/core";
import { SkinDialog, useDialogSurface } from "./dialog.js";
import type { DialogSurface } from "./dialog.js";
import { useSubstrateI18n } from "./floor.js";

/** Modal width on tablet/desktop: a question, not a form. */
const CONFIRM_MODAL_WIDTH = 420;

export interface SkinConfirmProps {
  readonly open: boolean;
  /** The affirmative. The caller owns what it does and whether it tracks. */
  readonly onConfirm: () => void;
  /** The way out — cancel button, close control, mask, Esc, swipe. */
  readonly onCancel: () => void;
  /** The question, as a sentence: "Remove this member?" */
  readonly title: ReactNode;
  /** What happens if they say yes, when the title alone does not say it;
   * or the thing in question ("MacBook Touch ID"). */
  readonly body?: ReactNode;
  /** Default: the floor's "Confirm". A destructive action names itself. */
  readonly confirmLabel?: string;
  /** Default: the floor's "Cancel". */
  readonly cancelLabel?: string;
  /**
   * Accessible name of the sheet's grab handle / the modal's close control.
   * Defaults to `cancelLabel`: the ✕ and the button say the same thing, which
   * is better than saying two different things.
   */
  readonly dismissLabel?: string;
  /**
   * A destructive confirmation: red primary, the CANCEL button takes initial
   * focus so Enter does not destroy by reflex, and a tap on the backdrop does
   * NOT answer — on a phone the backdrop is most of the screen.
   */
  readonly danger?: boolean;
  /** The action is in flight: the confirm button spins and refuses a second
   * click, the cancel is held, and the dialog cannot be dismissed until it
   * settles. */
  readonly confirming?: boolean;
  /** Force a surface (tests). See `SkinDialogProps.surface`. */
  readonly surface?: DialogSurface;
  /** Stamped on the dialog body wrapper (with `data-stapel-dialog-surface`). */
  readonly "data-testid"?: string;
}

/** The confirm button's test id — fixed, so a pair's test finds it. */
export const CONFIRM_OK_TESTID: string = "stapel-confirm-ok";
/** The cancel button's test id. */
export const CONFIRM_CANCEL_TESTID: string = "stapel-confirm-cancel";

/**
 * The confirmation surface. Stamped `data-stapel-dialog-surface` by the
 * underlying {@link SkinDialog}, and `data-stapel-confirm="danger|default"`
 * on its body, so a package's test can prove both the shape and the tone.
 */
export function SkinConfirm(props: SkinConfirmProps): ReactElement {
  const { t } = useSubstrateI18n();
  const { token } = antdTheme.useToken();
  const auto = useDialogSurface();
  const surface = props.surface ?? auto;
  const confirming = props.confirming === true;
  const danger = props.danger === true;
  const confirmLabel = props.confirmLabel ?? t(STAPEL_UI_KEYS.confirm);
  const cancelLabel = props.cancelLabel ?? t(STAPEL_UI_KEYS.cancel);
  const dismissLabel = props.dismissLabel ?? cancelLabel;
  const initialFocus = useRef<HTMLButtonElement>(null);

  // Initial focus: the affirmative for an ordinary question, the way OUT for
  // a destructive one. Set after the portal is attached (a `focus()` on a
  // detached node is a no-op); antd's own focus management leaves focus
  // alone once it is already inside the dialog.
  useEffect(() => {
    if (!props.open) return;
    const id = setTimeout(() => initialFocus.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [props.open, danger]);

  const confirmButton = (
    <Button
      type="primary"
      danger={danger}
      loading={confirming}
      onClick={props.onConfirm}
      block={surface === "sheet"}
      data-testid={CONFIRM_OK_TESTID}
      data-analytics="none"
      data-analytics-reason="passthrough — the caller's onConfirm carries the tracked action"
      {...(danger ? {} : { ref: initialFocus })}
    >
      {confirmLabel}
    </Button>
  );
  const cancelButton = (
    <Button
      disabled={confirming}
      onClick={props.onCancel}
      block={surface === "sheet"}
      data-testid={CONFIRM_CANCEL_TESTID}
      data-analytics="none"
      data-analytics-reason="local-ui-dismiss-confirm"
      {...(danger ? { ref: initialFocus } : {})}
    >
      {cancelLabel}
    </Button>
  );

  // Sheet: stacked, full width, the affirmative on top where the thumb is.
  // Modal: a right-aligned row, cancel first, the affirmative last.
  const footer =
    surface === "sheet" ? (
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        {confirmButton}
        {cancelButton}
      </Space>
    ) : (
      <Space size="small" style={{ width: "100%", justifyContent: "flex-end" }}>
        {cancelButton}
        {confirmButton}
      </Space>
    );

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onCancel}
      title={props.title}
      dismissLabel={dismissLabel}
      dismissible={!confirming}
      surface={surface}
      width={CONFIRM_MODAL_WIDTH}
      footer={footer}
      {...(danger ? { maskClosable: false } : {})}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
    >
      <div data-stapel-confirm={danger ? "danger" : "default"}>
        {props.body !== undefined && (
          <Typography.Paragraph style={{ marginBottom: token.paddingSM }}>
            {props.body}
          </Typography.Paragraph>
        )}
      </div>
    </SkinDialog>
  );
}
