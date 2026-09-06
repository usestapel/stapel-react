/**
 * The reason this package exists: the console, inside the card someone is
 * actually looking at while they wait — and the same card once the wait is
 * over, with the game gone.
 */
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import { WaitingGame } from "../src/default/index.js";
import {
  ConsoleFrame,
  DEMO_KEYS,
  DEMO_SEED,
  WaitingCard,
  demoHighScores,
} from "./_harness.js";

/** The meeting-admission case: the room exists, the host has not let you in yet. */
function Admission(props: { readonly active: boolean }) {
  const t = useT();
  return (
    <WaitingCard title={t(DEMO_KEYS.roomTitle)} lead={t(DEMO_KEYS.roomLead)}>
      <WaitingGame
        reason="admission"
        active={props.active}
        game="tetris"
        size="sm"
        seed={DEMO_SEED}
        autoStart={false}
        highScores={demoHighScores}
      />
      {!props.active && (
        <span style={{ color: cssVar("success"), fontSize: fontSize.sm.fontSize }}>
          {t(DEMO_KEYS.roomAdmitted)}
        </span>
      )}
    </WaitingCard>
  );
}

/** The recording-processing case: the upload landed, the analysis has not. */
function Processing() {
  const t = useT();
  return (
    <WaitingCard title={t(DEMO_KEYS.uploadTitle)} lead={t(DEMO_KEYS.uploadLead)}>
      <div style={{ display: "grid", gap: spacing[3], justifyItems: "center" }}>
        <WaitingGame
          reason="processing"
          game="snake"
          games={["snake", "tetris", "memory"]}
          size="sm"
          seed={DEMO_SEED}
          autoStart={false}
          highScores={demoHighScores}
        />
      </div>
    </WaitingCard>
  );
}

export default defineDemo({
  id: "brick.waiting",
  title: "Something to do while you wait",
  description:
    "<WaitingGame> is one caption and one console. It is controlled by the host's own `active` flag: while the wait is on it plays, and on the edge where the wait ends it unmounts itself — loop, key listener and frames all gone — and calls `onDone` exactly once.",
  component: WaitingGame,
  tokens: ["surface", "surface-raised", "border-subtle", "text", "text-muted", "success"],
  variants: {
    default: {
      description: "Waiting to be admitted to a room, on a phone.",
      viewport: "phone",
      step: "waiting",
      render: () => (
        <ConsoleFrame>
          <Admission active />
        </ConsoleFrame>
      ),
    },
    processing: {
      description:
        "Waiting for an analysis, with three games allowed — the menu is the console's, the caption is the wait's.",
      viewport: "desktop",
      step: "processing",
      render: () => (
        <ConsoleFrame>
          <Processing />
        </ConsoleFrame>
      ),
    },
    done: {
      description:
        "The wait ended: `active={false}`, the console is gone, and the card the host owns is all that is left.",
      viewport: "phone",
      step: "done",
      render: () => (
        <ConsoleFrame>
          <Admission active={false} />
        </ConsoleFrame>
      ),
    },
  },
});
