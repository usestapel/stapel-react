/**
 * The translate control, in every state it can be in — including the one where
 * it is ABSENT.
 *
 * The bag is handed in as a literal rather than produced by a mocked request:
 * "translated", "throttled" and "over the ceiling" are states reached by a
 * click and a network answer, and a showcase renders once. Seeding them is the
 * only way the gallery shows what it claims to show.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { TranslateButton } from "../src/default/TranslateButton.js";
import { TRANSLATE_I18N_KEYS } from "../src/index.js";
import type { TranslateTextBag } from "../src/index.js";
import { TranslateDemoHarness } from "./_harness.js";

const ORIGINAL = "Se vende bicicleta de carretera, talla 54, poco uso.";
const TRANSLATED = "Road bike for sale, size 54, barely used.";

const NOOP = (): void => undefined;

function bagOf(overrides: Partial<TranslateTextBag>): TranslateTextBag {
  return {
    available: true,
    target: "en",
    setTarget: NOOP,
    status: "idle",
    originals: [ORIGINAL],
    translations: null,
    texts: [ORIGINAL],
    text: ORIGINAL,
    sourceLanguage: null,
    cached: false,
    provider: null,
    refusal: null,
    error: null,
    translate: actionAvailable(),
    run: NOOP,
    showingOriginal: false,
    toggle: NOOP,
    ...overrides,
  };
}

function ButtonDemo(props: {
  bag: TranslateTextBag;
  contentTranslate?: boolean;
}): ReactElement {
  return (
    <TranslateDemoHarness
      locale="en"
      contentTranslate={props.contentTranslate ?? true}
    >
      <TranslateButton bag={props.bag} />
    </TranslateDemoHarness>
  );
}

export default defineDemo({
  id: "translate.translate-button",
  title: "Translate button (default skin)",
  description:
    "Ask for somebody else's writing in your own language. Absent — not greyed — where the deployment offers no content translation; every refusal folded by code into a sentence, with a retry only where retrying can work.",
  component: TranslateButton,
  variants: {
    default: {
      description: "Nothing asked for yet.",
      viewport: "desktop",
      step: "idle",
      render: () => <ButtonDemo bag={bagOf({})} />,
    },
    translated: {
      description:
        "The answer is in hand and came from the cache: the control becomes the way back to the original.",
      viewport: "phone",
      step: "translated",
      render: () => (
        <ButtonDemo
          bag={bagOf({
            status: "translated",
            translations: [TRANSLATED],
            texts: [TRANSLATED],
            text: TRANSLATED,
            sourceLanguage: "es",
            cached: true,
            provider: "AgentProvider",
          })}
        />
      ),
    },
    throttled: {
      description:
        "429: too many translations just now. The sentence says to wait; the retry is offered because a later attempt can succeed.",
      viewport: "phone",
      step: "failed",
      render: () => (
        <ButtonDemo
          bag={bagOf({
            status: "failed",
            error: new Error("429"),
            refusal: {
              key: TRANSLATE_I18N_KEYS.buttonThrottled,
              params: {},
              retryable: true,
              requiresSignIn: false,
            },
          })}
        />
      ),
    },
    blocked: {
      description:
        "Over the per-text ceiling: the button is gated and the limit is IN the reason beside it.",
      viewport: "desktop",
      step: "blocked",
      render: () => (
        <ButtonDemo
          bag={bagOf({
            translate: actionBlocked(TRANSLATE_I18N_KEYS.buttonTooLong, {
              max_chars: 5000,
            }),
          })}
        />
      ),
    },
    unavailable: {
      description:
        "The deployment offers no content translation — the control is ABSENT, not disabled. This shot is meant to be empty.",
      viewport: "phone",
      step: "unavailable",
      render: () => (
        <ButtonDemo contentTranslate={false} bag={bagOf({ available: false })} />
      ),
    },
  },
});
