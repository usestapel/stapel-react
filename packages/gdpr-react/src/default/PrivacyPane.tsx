/**
 * `<PrivacyPane>` — the prop-free account screen the nav manifest's
 * `account.privacy` entry mounts. Four surfaces in the order a person needs
 * them:
 *
 *   1. what is already on its way out  (`<PendingDeletions/>`)
 *   2. a copy of your data             (`<DataExportPanel/>`)
 *   3. ask us something formally       (`<DsarForm variant="app"/>`)
 *   4. delete the account itself       (`<AccountClosurePanel/>`)
 *
 * The destructive control is LAST, and it is last on purpose: the two things
 * that solve most people's actual problem — "what is happening to my data" and
 * "give me a copy" — come before the irreversible one, so nobody deletes an
 * account to answer a question an export would have answered.
 *
 * Every panel is independent: each runs its own read, each renders its own
 * three or four arms, and one failing read never blanks the others. That is
 * why there is no combined "privacy" query — a screen that waited for all four
 * would be dark until the slowest of them answered, and would fail entirely
 * because one of them did.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { AccountClosurePanel } from "./AccountClosurePanel.js";
import { DataExportPanel } from "./DataExportPanel.js";
import { DsarForm } from "./DsarForm.js";
import { PendingDeletions } from "./PendingDeletions.js";
import type { ThemeModeProp } from "./types.js";

export interface PrivacyPaneProps extends ThemeModeProp {
  /** Passed through to `<PendingDeletions/>` — see its `labelFor`. */
  readonly labelFor?: (subjectType: string, subjectKey: string) => string;
  /** Passed through to `<DataExportPanel/>` — the emailed download token. */
  readonly token?: string;
  /** Passed through to `<AccountClosurePanel/>`. */
  readonly onClosureStarted?: () => void;
}

export function PrivacyPane(props: PrivacyPaneProps): ReactElement {
  const { mode, labelFor, token, onClosureStarted } = props;
  const modeProp = mode !== undefined ? { mode } : {};
  return (
    <SkinTheme {...modeProp} surface="base">
      <Flex vertical gap={spacing[4]} data-testid="gdpr-privacy">
        <PendingDeletions
          {...modeProp}
          {...(labelFor !== undefined ? { labelFor } : {})}
        />
        <DataExportPanel
          {...modeProp}
          {...(token !== undefined ? { token } : {})}
        />
        <DsarForm variant="app" {...modeProp} />
        <AccountClosurePanel
          {...modeProp}
          {...(onClosureStarted !== undefined ? { onClosureStarted } : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
