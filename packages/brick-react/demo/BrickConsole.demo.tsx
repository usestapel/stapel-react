/**
 * Six games, one console — and the keypad the console grows on a phone.
 *
 * Every variant PINS ITS SEED, which is the one thing a showcase needs and a
 * player must never have: on the stand each run deals itself a new game, and
 * here the same one every time, so a shot of Tetris' opening piece is a shot of
 * the same piece tomorrow.
 */
import { defineDemo } from "@stapel/showcase";
import { BrickConsole, Keypad, useBrickT } from "../src/default/index.js";
import { ConsoleFrame, DEMO_SEED, demoHighScores } from "./_harness.js";
import type { BrickGameId } from "../src/index.js";

/** The keypad on its own, with the copy a host's engine gives it. */
function PhoneKeypad() {
  const t = useBrickT();
  return (
    <Keypad
      t={t}
      onPress={() => undefined}
      onStart={() => undefined}
      onReset={() => undefined}
    />
  );
}

function Console(props: {
  readonly game: BrickGameId;
  readonly games?: readonly BrickGameId[];
  readonly size?: "sm" | "md" | "lg";
}) {
  return (
    <BrickConsole
      game={props.game}
      seed={DEMO_SEED}
      size={props.size ?? "md"}
      highScores={demoHighScores}
      {...(props.games === undefined ? {} : { games: props.games })}
    />
  );
}

export default defineDemo({
  id: "brick.console",
  title: "The console, and its six games",
  description:
    "A 4-bit LCD drawn with the token palette: four shades from the unlit segment ghost up to the lit pixel, a side panel with score, best, level and (for Tetris) the next piece, and — on a coarse pointer only — the keypad the original handheld had. Each variant is one game at its opening frame, dealt from a fixed seed.",
  component: BrickConsole,
  covers: ["Keypad"],
  tokens: [
    "surface",
    "surface-raised",
    "surface-sunken",
    "border",
    "border-subtle",
    "text",
    "text-muted",
    "text-subtle",
    "brand",
    "brand-subtle",
  ],
  variants: {
    default: {
      description: "Tetris on its 10x20 panel: the piece, its landing shadow, the next box.",
      viewport: "desktop",
      step: "tetris",
      render: () => (
        <ConsoleFrame>
          <Console game="tetris" />
        </ConsoleFrame>
      ),
    },
    snake: {
      description: "Snake on 20x20 — three segments, one pellet, no next box at all.",
      viewport: "desktop",
      step: "snake",
      render: () => (
        <ConsoleFrame>
          <Console game="snake" />
        </ConsoleFrame>
      ),
    },
    arkanoid: {
      description: "Arkanoid: four rows of two-wide bricks, a paddle, one ball.",
      viewport: "desktop",
      step: "arkanoid",
      render: () => (
        <ConsoleFrame>
          <Console game="arkanoid" />
        </ConsoleFrame>
      ),
    },
    racing: {
      description:
        "Racing: two lanes between two dashed verges, the car drawn as the handheld drew it — and its wheels blinking as the road runs.",
      viewport: "desktop",
      step: "racing",
      render: () => (
        <ConsoleFrame>
          <Console game="racing" />
        </ConsoleFrame>
      ),
    },
    tanks: {
      description:
        "Tanks: the player's tank in the middle band with its barrel up, the tanks it has left marked above it, and enemies that come in at the corners.",
      viewport: "desktop",
      step: "tanks",
      render: () => (
        <ConsoleFrame>
          <Console game="tanks" />
        </ConsoleFrame>
      ),
    },
    memory: {
      description:
        "Memory: four 2x2 pads in a d-pad, waiting to light one at a time for the player to repeat.",
      viewport: "desktop",
      step: "memory",
      render: () => (
        <ConsoleFrame>
          <Console game="memory" />
        </ConsoleFrame>
      ),
    },
    menu: {
      description:
        "Three games allowed: the console draws a menu, and the current one is pressed.",
      viewport: "desktop",
      step: "menu",
      render: () => (
        <ConsoleFrame>
          <Console game="snake" games={["tetris", "snake", "memory"]} />
        </ConsoleFrame>
      ),
    },
    level: {
      description:
        "The starting level, picked before play with the minus and the plus — the board is dealt again at whatever the person chose.",
      viewport: "desktop",
      step: "level-3",
      render: () => (
        <ConsoleFrame>
          <Console game="tetris" />
        </ConsoleFrame>
      ),
      play: async ({ click }) => {
        await click('[data-testid="brick-level-up"]');
        await click('[data-testid="brick-level-up"]');
      },
    },
    paused: {
      description:
        "The paused field wears a clickable veil — and it offers Enter only where Enter actually reaches the console.",
      viewport: "desktop",
      step: "paused",
      render: () => (
        <ConsoleFrame>
          <Console game="tetris" />
        </ConsoleFrame>
      ),
      play: async ({ click }) => {
        await click('[data-testid="brick-button-start"]');
        await click('[data-testid="brick-button-start"]');
      },
    },
    phone: {
      description:
        "The keypad a coarse pointer gets: a four-way pad and OK / Start / Reset, every target at the phone control height, every button carrying its own accessible name.",
      viewport: "phone",
      step: "keypad",
      render: () => (
        <ConsoleFrame>
          <PhoneKeypad />
        </ConsoleFrame>
      ),
    },
  },
});
