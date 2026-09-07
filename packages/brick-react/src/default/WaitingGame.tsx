/**
 * `<WaitingGame/>` — the host helper this whole package exists for.
 *
 * A person is waiting: to be admitted to a room, for an upload to finish, for a
 * recording to be analysed. The wait is not a screen anyone designed; it is a
 * spinner and a sentence. This puts a console under the sentence and takes it
 * away the moment the wait is over.
 *
 * ── `active` is the host's state, not this component's ─────────────────────
 * The host already knows when the room opened; it does not need this component
 * to tell it. So `active` is a controlled prop, and the ONLY thing that happens
 * on its falling edge is that the console unmounts (killing its loop, its key
 * listener and its frames) and `onDone` fires once. Never twice, and never on
 * a re-render that merely passed `active={false}` again — a host that navigates
 * away in `onDone` would otherwise navigate away twice.
 */
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import { BRICK_I18N_KEYS } from "../i18n/keys.js";
import { BrickConsole } from "./BrickConsole.js";
import { useBrickT } from "./hooks.js";
import type { BrickConsoleSizeChoice, BrickKeyCapture } from "./BrickConsole.js";
import type { HighScoreStore } from "../headless/highscores.js";
import type { BrickGameId } from "../headless/types.js";

/** Why the person is waiting — each reason has its own one-line caption. */
export type WaitingReason = "admission" | "processing" | "upload" | "queue";

const CAPTION_KEY: Record<WaitingReason, string> = {
  admission: BRICK_I18N_KEYS.waitAdmission,
  processing: BRICK_I18N_KEYS.waitProcessing,
  upload: BRICK_I18N_KEYS.waitUpload,
  queue: BRICK_I18N_KEYS.waitQueue,
};

const wrapStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: spacing[3],
};

const captionStyle: CSSProperties = {
  color: cssVar("text-muted"),
  fontSize: fontSize.sm.fontSize,
  textAlign: "center",
};

export interface WaitingGameProps {
  readonly reason: WaitingReason;
  /** The wait is still on. Default true; `false` unmounts the console. */
  readonly active?: boolean;
  /** Fired once, on the edge where the wait ends. */
  readonly onDone?: () => void;
  /** The game to open on. Default: the first of `games`, else Tetris. */
  readonly defaultGame?: BrickGameId;
  /** Controlled selection, with `onGameChange`; see `<BrickConsole/>`. */
  readonly game?: BrickGameId;
  readonly games?: readonly BrickGameId[];
  readonly size?: BrickConsoleSizeChoice;
  readonly seed?: number;
  /** Start the game on mount. Default true here: someone who is waiting
   * already agreed to be entertained. */
  readonly autoStart?: boolean;
  readonly onGameOver?: (score: number, game: BrickGameId) => void;
  readonly onGameChange?: (game: BrickGameId) => void;
  readonly highScores?: HighScoreStore;
  /** Hold the game without unmounting it — the board stays, the tick stops. */
  readonly paused?: boolean;
  /** Read the keyboard at all. Default true. */
  readonly enabled?: boolean;
  /** `"focus"` (default) or `"global"` — see `<BrickConsole/>`. */
  readonly captureKeys?: BrickKeyCapture;
  /** Start again on return a run the hidden tab stopped. Default true. */
  readonly resumeOnReturn?: boolean;
  readonly "data-testid"?: string;
}

export function WaitingGame(props: WaitingGameProps): ReactElement | null {
  const active = props.active ?? true;
  const t = useBrickT();
  const doneRef = useRef(false);
  const onDoneRef = useRef(props.onDone);
  onDoneRef.current = props.onDone;

  useEffect(() => {
    if (active) {
      // A wait that starts again (a second room, a retried upload) may end
      // again — so the latch is armed on every rising edge, not once per mount.
      doneRef.current = false;
      return;
    }
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={wrapStyle}
      data-testid={props["data-testid"] ?? "waiting-game"}
      data-reason={props.reason}
    >
      <p style={captionStyle}>{t(CAPTION_KEY[props.reason])}</p>
      <BrickConsole
        autoStart={props.autoStart ?? true}
        {...(props.defaultGame === undefined ? {} : { defaultGame: props.defaultGame })}
        {...(props.game === undefined ? {} : { game: props.game })}
        {...(props.games === undefined ? {} : { games: props.games })}
        {...(props.size === undefined ? {} : { size: props.size })}
        {...(props.seed === undefined ? {} : { seed: props.seed })}
        {...(props.onGameOver === undefined ? {} : { onGameOver: props.onGameOver })}
        {...(props.onGameChange === undefined
          ? {}
          : { onGameChange: props.onGameChange })}
        {...(props.highScores === undefined ? {} : { highScores: props.highScores })}
        {...(props.paused === undefined ? {} : { paused: props.paused })}
        {...(props.enabled === undefined ? {} : { enabled: props.enabled })}
        {...(props.captureKeys === undefined ? {} : { captureKeys: props.captureKeys })}
        {...(props.resumeOnReturn === undefined
          ? {}
          : { resumeOnReturn: props.resumeOnReturn })}
      />
    </div>
  );
}
