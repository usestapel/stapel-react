/**
 * The query's LANGUAGE — a filter, not a display preference.
 *
 * `lang` picks the analyzer AND narrows the corpus to documents indexed in
 * that language, so getting it wrong changes which results EXIST. That is why
 * the control lives in the filter panel beside the facets rather than in a
 * settings menu.
 *
 * Which languages a deployment has is not this pair's fact — the index has no
 * endpoint that lists them — so the host names them and the labels come from
 * `Intl.DisplayNames` in the reader's own locale.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LanguageSelect } from "../src/default/LanguageSelect.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_TYPE } from "./fixtures.js";

const LANGUAGES: readonly string[] = ["ru", "en", "es"];
const NOTHING_APPLIED = `type=${DEMO_TYPE}&q=bosch`;
const FROM_A_LINK = `type=${DEMO_TYPE}&q=bosch&lang=ru`;

function Language(props: {
  phone?: boolean;
  search: string;
  offered?: boolean;
}): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <LanguageSelect {...(props.offered === true ? { languages: LANGUAGES } : {})} />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.language-select",
  title: "Language filter",
  description:
    "The languages a deployment indexes, each named the way THIS reader would name it. With nothing offered and nothing applied the control does not render at all: a select whose only option is 'any' is a dead control, and the panel is thinner without it.",
  component: LanguageSelect,
  tokens: ["surface-raised"],
  variants: {
    offered: {
      description:
        "The three languages this deployment indexes, plus the 'any' option that widens the search back out.",
      viewport: "desktop",
      step: "offered",
      render: () => <Language offered search={NOTHING_APPLIED} />,
    },
    "from-a-link": {
      description:
        "The host named no languages, but a shared link narrows to one: the control appears anyway, at 390px, purely so the constraint can be removed. A link that narrows must always leave a door out.",
      viewport: "phone",
      step: "from-a-link",
      render: () => <Language phone search={FROM_A_LINK} />,
    },
  },
});
