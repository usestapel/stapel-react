/** The three small dialogs, each a bottom sheet on a phone. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MoveDialog, NameDialog, NewDocumentDialog } from "../src/default/index.js";
import { DOCS_I18N_KEYS } from "../src/index.js";
import { DocsDemoHarness } from "./_harness.js";
import { FOLDER_DRAFTS, FOLDER_SPECS } from "./fixtures.js";

function Name(props: { initialValue: string }): ReactElement {
  return (
    <DocsDemoHarness>
      <NameDialog
        open
        titleKey={DOCS_I18N_KEYS.dialogRenameTitle}
        initialValue={props.initialValue}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />
    </DocsDemoHarness>
  );
}

function Move(props: { currentParentId: string | null }): ReactElement {
  return (
    <DocsDemoHarness>
      <MoveDialog
        open
        folders={[FOLDER_SPECS, FOLDER_DRAFTS]}
        currentParentId={props.currentParentId}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />
    </DocsDemoHarness>
  );
}

function NewDocument(): ReactElement {
  return (
    <DocsDemoHarness>
      <NewDocumentDialog open onConfirm={() => undefined} onClose={() => undefined} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.dialogs",
  title: "Dialogs",
  description:
    "Rename, move and New document. Their affirmative is a GatedButton, not a boolean disabled: an empty name and a destination that is where the item already is each say so in a sentence the button's aria-describedby points at, instead of leaving a grey rectangle a person has to guess about.",
  component: NameDialog,
  covers: ["MoveDialog", "NewDocumentDialog"],
  variants: {
    default: {
      viewport: "phone",
      step: "rename-prefilled",
      description: "Rename, prefilled with the current name — the confirm is live.",
      render: () => <Name initialValue="Release notes" />,
    },
    "name-empty": {
      viewport: "phone",
      step: "rename-empty",
      description: "Nothing typed: the confirm is off WITH the reason.",
      render: () => <Name initialValue="" />,
    },
    "move-unchanged": {
      viewport: "phone",
      step: "move-unchanged",
      description: "Opened on the folder the document is already in — off, and it says why.",
      render: () => <Move currentParentId={FOLDER_SPECS.id} />,
    },
    "new-document": {
      viewport: "phone",
      step: "create",
      description: "The primary action of a documents product: a title and a type.",
      render: () => <NewDocument />,
    },
  },
});
