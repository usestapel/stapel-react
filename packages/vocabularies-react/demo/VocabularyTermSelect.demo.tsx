/**
 * The DEFAULT SKIN in the viewer — because the default skin is what a host
 * actually ships.
 *
 * Four states, and the interesting two are not the happy one. `narrowed` is
 * the whole reason the `parent` prop exists: the same control on the same
 * level offers a different list once a vendor is chosen, and a screenshot of
 * one list cannot show that. `unavailable` is the state a container reaches by
 * forgetting to wire a client — the loud notice, which is a shipped state too
 * and the one most likely to be seen by somebody who cannot fix it.
 *
 * A term SELECT cannot be photographed with its dropdown open (the panel is a
 * portal antd opens on a pointer event), so each variant is seeded with a
 * chosen answer instead: what a reopened form looks like is the frame the
 * label resolution actually shows up in.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { VocabularyTermSelect } from "../src/default/VocabularyTermSelect.js";
import { VocabulariesDemoHarness, DemoCard } from "./_harness.js";
import { demoVocabularyClient } from "./vocabularyFixture.js";

const client = demoVocabularyClient();

function TermSelectDemo(props: {
  level: string;
  parent?: string;
  seeded?: readonly string[];
  multiple?: boolean;
  unavailable?: boolean;
  heading: string;
}): ReactElement {
  const [codes, setCodes] = useState<readonly string[]>(props.seeded ?? []);
  return (
    <VocabulariesDemoHarness>
      <DemoCard heading={props.heading}>
        <VocabularyTermSelect
          client={props.unavailable === true ? null : client}
          vocabulary="avito-phones"
          level={props.level}
          parent={props.parent}
          value={codes}
          onChange={setCodes}
          multiple={props.multiple}
        />
      </DemoCard>
    </VocabulariesDemoHarness>
  );
}

export default defineDemo({
  id: "vocabularies.term-select",
  title: "Vocabulary term select (default skin)",
  description:
    "One vocabulary level as a typeahead: the options are the answer to the current query (debounced, superseding), and a code the control already holds is resolved to its label and kept pickable even when the current page does not contain it.",
  component: VocabularyTermSelect,
  variants: {
    default: {
      description: "The vendor level, with an answer already given.",
      viewport: "desktop",
      step: "chosen",
      render: () => (
        <TermSelectDemo level="Vendor" seeded={["apple"]} heading="Vendor" />
      ),
    },
    phone: {
      description: "The same control at 390px — the design width.",
      viewport: "phone",
      step: "chosen",
      render: () => (
        <TermSelectDemo level="Vendor" seeded={["apple"]} heading="Vendor" />
      ),
    },
    narrowed: {
      description:
        "The model level narrowed by a vendor: the list is that vendor's children, and choosing another vendor is what clears this answer upstream.",
      viewport: "phone",
      step: "narrowed",
      render: () => (
        <TermSelectDemo
          level="Model"
          parent="apple"
          seeded={["iphone-15-pro"]}
          heading="Model (Apple)"
        />
      ),
    },
    multiple: {
      description: "Several terms at once — the shape a facet filter uses.",
      viewport: "phone",
      step: "chosen",
      render: () => (
        <TermSelectDemo
          level="Vendor"
          seeded={["apple", "samsung"]}
          multiple
          heading="Vendors"
        />
      ),
    },
    unavailable: {
      description:
        "No client: the loud notice, not an empty dropdown. A control that cannot reach its terms and looks like one that found none is how a person is left unable to answer a question nobody told them was broken.",
      viewport: "phone",
      step: "unavailable",
      render: () => (
        <TermSelectDemo level="Vendor" unavailable heading="Vendor" />
      ),
    },
  },
});
