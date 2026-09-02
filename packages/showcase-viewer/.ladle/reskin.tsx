/**
 * The showcase's DEMO HOST for the skin component registry
 * (`docs/skin-component-registry.md`): one `SkinProvider` around every
 * story of every pair, with a deliberately loud replacement button, dialog
 * surface and input — the "override in one place, every standard skin
 * follows" demonstration. Off by default; the stock showcase stays the
 * fleet's antd baseline.
 *
 * Turn it on with `?reskin=1` on the viewer URL, or persistently with
 * `localStorage.setItem("stapel-reskin", "1")` (and off with `?reskin=0` /
 * removing the key). URL wins, so a screenshot run can force either side.
 *
 * The replacements are intentionally NOT antd-looking — a pill button with
 * a hard offset shadow, a framed dialog panel, an underline-only input —
 * so a screenshot proves at a glance which layer drew each control. They
 * honour the slot contracts (focusable button, forwarded data/aria attrs,
 * role="dialog" with the stamped body inside, controlled input with its
 * suffix) because the dev contract probe is watching, exactly as it would
 * watch a real host.
 */
/* eslint-disable stapel/no-raw-colors, stapel/clickable-needs-event, stapel/no-raw-storage --
   this file PLAYS a foreign host. The demonstration is precisely that a
   palette and anatomy which are NOT the fleet's (so: raw colours, on
   purpose) land in every pair from one registration; painting them with our
   tokens would make the proof invisible. The clickables are the fake host's
   own controls inside a dev-only introspection viewer with no analytics
   plane, and the localStorage toggle is a viewer-local convenience — this
   package is never in a prod bundle (see package description). */
import type { ReactElement, ReactNode } from "react";
import type {
  SkinButtonProps,
  SkinComponents,
  SkinDialogSlotProps,
  SkinInputProps,
} from "@stapel/tokens-antd/skin";
import { SkinProvider } from "@stapel/tokens-antd/skin";

export function reskinEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const fromUrl = new URLSearchParams(window.location.search).get("reskin");
  if (fromUrl !== null) return fromUrl !== "0";
  try {
    return window.localStorage.getItem("stapel-reskin") === "1";
  } catch {
    return false;
  }
}

const ACCENT = "#7c3aed";
const ACCENT_DARK = "#5b21b6";

function DemoButton(props: SkinButtonProps): ReactElement {
  const {
    children,
    onClick,
    disabled,
    loading,
    danger,
    type,
    htmlType,
    block,
    ref,
    icon,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-expanded": ariaExpanded,
    "aria-haspopup": ariaHasPopup,
  } = props;
  const testId = props["data-testid"];
  const primary = type === "primary";
  const quiet = type === "text" || type === "link";
  const off = disabled === true || loading === true;
  const paint = danger === true ? "#dc2626" : ACCENT;
  return (
    <button
      type={htmlType ?? "button"}
      onClick={onClick}
      disabled={off}
      ref={ref as React.Ref<HTMLButtonElement>}
      {...(testId !== undefined ? { "data-testid": testId } : {})}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
      {...(ariaDescribedBy !== undefined ? { "aria-describedby": ariaDescribedBy } : {})}
      {...(ariaExpanded !== undefined ? { "aria-expanded": ariaExpanded } : {})}
      {...(ariaHasPopup !== undefined ? { "aria-haspopup": ariaHasPopup } : {})}
      data-reskin-button={type ?? "default"}
      style={{
        display: block === true ? "flex" : "inline-flex",
        width: block === true ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 999,
        border: `2px solid ${paint}`,
        background: primary ? paint : quiet ? "transparent" : "#fff",
        color: primary ? "#fff" : paint,
        padding: quiet ? "4px 10px" : "6px 18px",
        minHeight: 36,
        fontWeight: 700,
        letterSpacing: "0.02em",
        cursor: off ? "not-allowed" : "pointer",
        opacity: off ? 0.5 : 1,
        boxShadow: primary && !off ? `3px 3px 0 ${ACCENT_DARK}` : "none",
      }}
    >
      {icon}
      <span aria-hidden="true">{loading === true ? "…" : "▸"}</span>
      {children}
    </button>
  );
}

function DemoInput(props: SkinInputProps): ReactElement {
  const { value, onChange, onBlur, onPaste, disabled, placeholder, suffix, inputMode, id } = props;
  const testId = props["data-testid"];
  return (
    <span
      data-reskin-input=""
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        borderBottom: `3px solid ${ACCENT}`,
        background: "rgba(124, 58, 237, 0.06)",
        padding: "4px 8px",
      }}
    >
      <input
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={onChange}
        onBlur={onBlur}
        onPaste={onPaste}
        disabled={disabled === true}
        placeholder={placeholder}
        {...(id !== undefined ? { id } : {})}
        {...(inputMode !== undefined ? { inputMode } : {})}
        {...(testId !== undefined ? { "data-testid": testId } : {})}
        {...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {})}
        {...(props["aria-describedby"] !== undefined
          ? { "aria-describedby": props["aria-describedby"] }
          : {})}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "inherit",
        }}
      />
      {suffix !== undefined && <span style={{ color: ACCENT, fontWeight: 700 }}>{suffix}</span>}
    </span>
  );
}

function DemoDialog(props: SkinDialogSlotProps): ReactElement | null {
  if (!props.open) return null;
  const sheet = props.surface === "sheet";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: sheet ? "flex-end" : "center",
        justifyContent: "center",
        background: "rgba(30, 8, 66, 0.55)",
      }}
      onClick={props.dismissible && props.maskClosable !== false ? props.onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-reskin-dialog={props.surface}
        {...(props.ariaLabel !== undefined && props.title === undefined
          ? { "aria-label": props.ariaLabel }
          : {})}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#fff",
          color: "#1f1235",
          border: `3px solid ${ACCENT}`,
          borderRadius: sheet ? "20px 20px 0 0" : 20,
          boxShadow: `6px 6px 0 ${ACCENT_DARK}`,
          width: sheet ? "100%" : (props.width ?? 480),
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `2px dashed ${ACCENT}`,
            fontWeight: 800,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{props.title}</span>
          {props.dismissible && (
            <button
              type="button"
              aria-label={props.dismissLabel}
              onClick={props.onClose}
              style={{
                border: `2px solid ${ACCENT}`,
                borderRadius: 999,
                background: "#fff",
                color: ACCENT,
                width: 28,
                height: 28,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ padding: 16, overflowY: "auto" }}>{props.children}</div>
        {props.footer !== undefined && (
          <div style={{ padding: "12px 16px", borderTop: `2px dashed ${ACCENT}` }}>{props.footer}</div>
        )}
      </div>
    </div>
  );
}

const DEMO_COMPONENTS: SkinComponents = {
  Button: DemoButton,
  Input: DemoInput,
  Dialog: DemoDialog,
};

/** Wraps children in the demo registry when the toggle is on; renders them
 * untouched (no provider at all) when it is off. */
export function MaybeReskin(props: { readonly children: ReactNode }): ReactElement {
  if (!reskinEnabled()) return <>{props.children}</>;
  return <SkinProvider components={DEMO_COMPONENTS}>{props.children}</SkinProvider>;
}
