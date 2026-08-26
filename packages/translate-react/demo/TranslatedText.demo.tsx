/**
 * Somebody else's writing, with the option of reading it in your own language.
 *
 * Six of these on a page produce ONE request — the batcher folds everything
 * asked for in a tick. The `batched` variant renders three of them for exactly
 * that reason: it is what a results page looks like, and it is the shape the
 * fold test exercises.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TranslatedText } from "../src/default/TranslatedText.js";
import { TranslateDemoHarness } from "./_harness.js";

const LISTINGS: readonly string[] = [
  "Se vende bicicleta de carretera, talla 54, poco uso.",
  "Mesa de comedor de roble macizo, seis sillas incluidas.",
  "Cámara réflex con dos objetivos y bolsa de transporte.",
];

const HANDLERS = {
  "api/v1/text/": {
    texts: [
      "Road bike for sale, size 54, barely used.",
      "Solid oak dining table, six chairs included.",
      "SLR camera with two lenses and a carrying bag.",
    ],
    text: "Road bike for sale, size 54, barely used.",
    source_language: "es",
    target_language: "en",
    provider: "AgentProvider",
    cached: false,
  },
} as const;

function OneDemo(props: { text: string; showControl?: boolean }): ReactElement {
  return (
    <TranslateDemoHarness locale="en" handlers={HANDLERS}>
      <TranslatedText
        text={props.text}
        sourceLang="es"
        context="a marketplace listing"
        {...(props.showControl === false ? { showControl: false } : {})}
      />
    </TranslateDemoHarness>
  );
}

function BatchedDemo(): ReactElement {
  return (
    <TranslateDemoHarness locale="en" handlers={HANDLERS}>
      {LISTINGS.map((text) => (
        <TranslatedText key={text} text={text} sourceLang="es" />
      ))}
    </TranslateDemoHarness>
  );
}

export default defineDemo({
  id: "translate.translated-text",
  title: "Translated text (default skin)",
  description:
    "A listing description with a translate control beside it. Once translated, a quiet second line says which language it came from, that a machine produced it, and whether the answer came from a cache — the same honesty a converted price owes with 'approx.'.",
  component: TranslatedText,
  covers: ["TranslateButton"],
  variants: {
    default: {
      description: "One description, not yet translated.",
      viewport: "desktop",
      step: "original",
      render: () => <OneDemo text={LISTINGS[0] as string} />,
    },
    batched: {
      description:
        "Three of them at 390px: one request, one provider call, one consistent tone.",
      viewport: "phone",
      step: "batched",
      render: () => <BatchedDemo />,
    },
    hostControl: {
      description:
        "A host that draws its own control mounts the text without one (`showControl={false}`) and renders `<TranslateButton/>` wherever its layout wants it.",
      viewport: "phone",
      step: "no-control",
      render: () => <OneDemo text={LISTINGS[1] as string} showControl={false} />,
    },
  },
});
