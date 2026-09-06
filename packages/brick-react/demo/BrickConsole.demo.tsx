/**
 * Six games, one console — and the keypad the console grows on a phone.
 *
 * Every variant is seeded from the same number, so what you see is what the
 * shot runner sees: Tetris' first piece over its landing shadow, Snake's three
 * segments and its first pellet, Arkanoid's wall, the traffic, the tanks, the
 * memory board face-down under its cursor.
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
      description: "Racing: four lanes between two dashed verges.",
      viewport: "desktop",
      step: "racing",
      render: () => (
        <ConsoleFrame>
          <Console game="racing" />
        </ConsoleFrame>
      ),
    },
    tanks: {
      description: "Tanks: the player's tank in its home band, barrel up.",
      viewport: "desktop",
      step: "tanks",
      render: () => (
        <ConsoleFrame>
          <Console game="tanks" />
        </ConsoleFrame>
      ),
    },
    memory: {
      description: "Memory: sixteen tiles face down, the cursor on the first.",
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
