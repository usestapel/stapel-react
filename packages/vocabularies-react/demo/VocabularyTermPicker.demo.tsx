/**
 * The FIELD form of a vocabulary level: a trigger that says what is chosen,
 * and a bottom sheet that owns the search box.
 *
 * The select's demo cannot photograph an open list at all (antd's dropdown is
 * a portal opened on a pointer event), which is why every one of its variants
 * is a closed control with a seeded answer. This one can: the sheet's open
 * state is a prop, so the states that decide whether somebody picks the right
 * code — history on top, a skeleton while the answer is in flight, a list
 * dimmed because it no longer answers the box, a multi commit carrying its
 * count — are all real frames here rather than claims in a paragraph.
 *
 * The two hanging variants use a client whose `search` never settles and whose
 * `resolve` answers normally. That is not a mock of the thing under test: it
 * is the shape of a slow network, and it is the only way to hold the two
 * in-flight states still long enough to be photographed.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { memoryStorage, recentsStorageKey } from "@stapel/core";
import type { PersistStorage } from "@stapel/core";
import {
  VocabularyTermPicker,
  termRecentsScope,
} from "../src/default/VocabularyTermPicker.js";
import type { VocabularyClient } from "../src/client.js";
import { VocabulariesDemoHarness, DemoCard } from "./_harness.js";
import { demoVocabularyClient } from "./vocabularyFixture.js";

const VOCABULARY = "phone-models";
const LEVEL = "Vendor";

const client = demoVocabularyClient();

/** A slow network: the level's page never arrives, the labels still do. */
const hangingSearch: VocabularyClient = {
  search: () => new Promise<never>(() => undefined),
  resolve: (vocabulary, level, codes) => client.resolve(vocabulary, level, codes),
};

/** Recents, seeded through the same storage seam a host would redirect. */
function seeded(codes: readonly string[]): PersistStorage {
  const storage = memoryStorage();
  void storage.set(recentsStorageKey(termRecentsScope(VOCABULARY, LEVEL)), [
    ...codes,
  ]);
  return storage;
}

const WITH_RECENTS = seeded(["samsung", "google"]);
const WITH_RECENTS_STALE = seeded(["samsung", "google"]);
const NO_RECENTS = memoryStorage();

function PickerDemo(props: {
  heading: string;
  seededValue?: readonly string[];
  multiple?: boolean;
  open?: boolean;
  unavailable?: boolean;
  slow?: boolean;
  recents?: PersistStorage;
}): ReactElement {
  const [codes, setCodes] = useState<readonly string[]>(props.seededValue ?? []);
  return (
    <VocabulariesDemoHarness>
      <DemoCard heading={props.heading}>
        <VocabularyTermPicker
          client={
            props.unavailable === true
              ? null
              : props.slow === true
                ? hangingSearch
                : client
          }
          vocabulary={VOCABULARY}
          level={LEVEL}
          value={codes}
          onChange={setCodes}
          multiple={props.multiple}
          recentsStorage={props.recents ?? NO_RECENTS}
          surface="sheet"
          {...(props.open === true
            ? { open: true, onOpenChange: () => undefined }
            : {})}
        />
      </DemoCard>
    </VocabulariesDemoHarness>
  );
}

export default defineDemo({
  id: "vocabularies.term-picker",
  title: "Vocabulary term picker (default skin)",
  description:
    "One vocabulary level as a form field: the trigger says what is chosen — the resolved LABEL for one term, the count for several — and opens a bottom sheet with the search box, the codes picked most recently on top, and a commit button carrying its count. The list is the answer to the query in the box or it is nothing: while a newer query is in flight the rows dim and stop responding, so a fast tap cannot write the previous query's code.",
  component: VocabularyTermPicker,
  variants: {
    closed: {
      description:
        "The field as a reopened form shows it: one chosen term, resolved through the seam to the word the person actually picked, never the stored slug.",
      viewport: "phone",
      step: "chosen",
      render: () => <PickerDemo heading="Vendor" seededValue={["apple"]} />,
    },
    open: {
      description:
        "The sheet, with two remembered codes above the level's first page. The section is drawn only while the box is empty and only when it has something in it — and a remembered code whose label the vocabulary no longer knows is dropped rather than shown as a slug.",
      viewport: "phone",
      step: "browsing",
      render: () => (
        <PickerDemo heading="Vendor" open recents={WITH_RECENTS} />
      ),
    },
    loading: {
      description:
        "The answer to the box is in flight and there is nothing else on screen: a skeleton where the rows will be. The commit is not blocked — what is already chosen is still chosen.",
      viewport: "phone",
      step: "loading",
      render: () => <PickerDemo heading="Vendor" open slow />,
    },
    stale: {
      description:
        "The same wait, with history on screen. The rows dim and stop responding instead of being replaced by a skeleton: a person's own recents should not flash away four times a word, and nothing that is not the answer to the box may be tappable.",
      viewport: "phone",
      step: "stale",
      render: () => (
        <PickerDemo heading="Vendor" open slow recents={WITH_RECENTS_STALE} />
      ),
    },
    multiple: {
      description:
        "Several terms at once — the shape a facet filter uses. The checkmarks are the draft and the footer says what pressing it keeps; dismissing the sheet discards it, which is why the count is on the button and not in the title.",
      viewport: "phone",
      step: "multi",
      render: () => (
        <PickerDemo
          heading="Vendors"
          multiple
          open
          seededValue={["apple", "samsung", "google"]}
        />
      ),
    },
    unavailable: {
      description:
        "No client: the loud notice, not a field that opens an empty sheet. A control that cannot reach its terms and looks like one that found none is how a person is left unable to answer a question nobody told them was broken.",
      viewport: "phone",
      step: "unavailable",
      render: () => <PickerDemo heading="Vendor" unavailable />,
    },
  },
});
