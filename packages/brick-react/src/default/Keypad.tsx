/**
 * The on-screen keypad — the original handheld's buttons, for the device that
 * has no arrow keys.
 *
 * Three decisions worth stating:
 *
 *  - It appears on a COARSE POINTER, not on a narrow window. A phone-sized
 *    browser window on a laptop has a keyboard; a 1024px tablet does not. The
 *    question the keypad answers is "can this person press an arrow key", and
 *    `(pointer: coarse)` is the only thing that asks it.
 *  - Every target is at least the phone control height (44px, from the token
 *    scale — the same number every other phone control in the fleet uses).
 *  - Every button is icon-only and therefore CARRIES ITS NAME: an unlabelled
 *    glyph is announced as "button" and is unaddressable by voice control
 *    (stapel/icon-button-needs-label).
 */
import { useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { controls, cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { BRICK_I18N_KEYS } from "../i18n/keys.js";
import type { BrickInput } from "../headless/types.js";
import type { BrickTranslate } from "./hooks.js";

/** The minimum touch target, from the token scale. */
const TARGET = controls["height-phone"];
/** The action button is the one a thumb hammers: visibly larger than a d-pad key. */
const ACTION = Math.round(TARGET * 1.4);

const padStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[5],
  paddingBlockStart: spacing[3],
};

const dpadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(3, ${String(TARGET)}px)`,
  gridTemplateRows: `repeat(3, ${String(TARGET)}px)`,
  gap: spacing[1],
};

const actionsStyle: CSSProperties = {
  display: "grid",
  gap: spacing[2],
  justifyItems: "center",
};

const buttonStyle: CSSProperties = {
  minWidth: TARGET,
  minHeight: TARGET,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.md,
  background: cssVar("surface-raised"),
  color: cssVar("text"),
  fontSize: fontSize.sm.fontSize,
  fontWeight: 600,
  cursor: "pointer",
  touchAction: "manipulation",
  userSelect: "none",
};

const roundStyle: CSSProperties = { ...buttonStyle, borderRadius: radii.full };
const actionStyle: CSSProperties = { ...roundStyle, minWidth: ACTION, minHeight: ACTION };

/** A chevron pointing whichever way the button moves things. */
function Arrow(props: { readonly rotate: number }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${String(props.rotate)}deg)` }}
    >
      <path d="M8 3 3 9h10z" fill="currentColor" />
    </svg>
  );
}

/** A dot, for the buttons that are not directions. */
function Dot(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="5" fill="currentColor" />
    </svg>
  );
}

export interface KeypadProps {
  /** Apply a press. */
  readonly onPress: (action: BrickInput) => void;
  /** A d-pad or OK button went down or came up — a held soft drop, a held direction. */
  readonly onHold?: (action: BrickInput, held: boolean) => void;
  /** Start / pause / resume — the same button the handheld had. */
  readonly onStart: () => void;
  readonly onReset: () => void;
  /** The console's translator (so the keypad needs no provider of its own). */
  readonly t: BrickTranslate;
}

interface PadButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly onHold?: (held: boolean) => void;
  readonly area: string;
  readonly children: ReactElement;
  readonly style?: CSSProperties;
  readonly testId: string;
}

/**
 * A pad button presses on pointer-down (a game button acts when the thumb
 * lands, not when it lifts) and reports the hold until the pointer lifts or
 * leaves. A click that no pointer-down preceded — a screen reader's
 * activation, a keyboard on a focused button — still presses once.
 */
function PadButton(props: PadButtonProps): ReactElement {
  const viaPointer = useRef(false);
  const down = (): void => {
    viaPointer.current = true;
    props.onPress();
    props.onHold?.(true);
  };
  const up = (): void => {
    props.onHold?.(false);
  };
  const gone = (): void => {
    viaPointer.current = false;
    props.onHold?.(false);
  };
  const click = (): void => {
    if (viaPointer.current) {
      viaPointer.current = false;
      return;
    }
    props.onPress();
  };
  return (
    <button
      type="button"
      aria-label={props.label}
      data-testid={props.testId}
      // A game input is not a product interaction: nothing downstream wants a
      // funnel of how many times someone pressed left while waiting for a room.
      data-analytics="none"
      data-analytics-reason="game input, not a product interaction"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={gone}
      onPointerLeave={gone}
      onClick={click}
      style={{ ...(props.style ?? buttonStyle), gridArea: props.area }}
    >
      {props.children}
    </button>
  );
}

/** The keypad: a four-way pad, OK, Start, Reset. */
export function Keypad(props: KeypadProps): ReactElement {
  const { onPress, onHold, onStart, onReset, t } = props;
  const dir = (
    action: BrickInput,
    area: string,
    labelKey: string,
    rotate: number
  ): ReactElement => (
    <PadButton
      area={area}
      testId={`brick-pad-${action}`}
      label={t(labelKey)}
      onPress={() => {
        onPress(action);
      }}
      onHold={(held) => onHold?.(action, held)}
    >
      <Arrow rotate={rotate} />
    </PadButton>
  );
  return (
    <div style={padStyle} role="group" aria-label={t(BRICK_I18N_KEYS.padLabel)}>
      <div style={dpadStyle}>
        {dir("up", "1 / 2 / 2 / 3", BRICK_I18N_KEYS.padUp, 0)}
        {dir("left", "2 / 1 / 3 / 2", BRICK_I18N_KEYS.padLeft, -90)}
        {dir("right", "2 / 3 / 3 / 4", BRICK_I18N_KEYS.padRight, 90)}
        {dir("down", "3 / 2 / 4 / 3", BRICK_I18N_KEYS.padDown, 180)}
      </div>
      <div style={actionsStyle}>
        <PadButton
          area="auto"
          style={actionStyle}
          testId="brick-pad-ok"
          label={t(BRICK_I18N_KEYS.padOk)}
          onPress={() => {
            onPress("ok");
          }}
          onHold={(held) => onHold?.("ok", held)}
        >
          <Dot />
        </PadButton>
        <PadButton
          area="auto"
          style={roundStyle}
          testId="brick-pad-start"
          label={t(BRICK_I18N_KEYS.padStart)}
          onPress={onStart}
        >
          <Arrow rotate={90} />
        </PadButton>
        <PadButton
          area="auto"
          style={roundStyle}
          testId="brick-pad-reset"
          label={t(BRICK_I18N_KEYS.padReset)}
          onPress={onReset}
        >
          <Dot />
        </PadButton>
      </div>
    </div>
  );
}
