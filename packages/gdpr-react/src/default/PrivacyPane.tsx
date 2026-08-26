/**
 * `<PrivacyPane>` — the prop-free account screen the nav manifest's
 * `account.privacy` entry mounts. A page heading, then four surfaces in the
 * order a person needs them:
 *
 *   1. a copy of your data             (`<DataExportPanel/>`)
 *   2. what is already on its way out  (`<PendingDeletions/>`)
 *   3. ask us something formally       (`<DsarForm variant="app"/>`)
 *   4. delete the account itself       (`<AccountClosurePanel/>`)
 *
 * The destructive control is LAST, and it is last on purpose: the two things
 * that solve most people's actual problem — "give me a copy" and "what is
 * happening to my data" — come before the irreversible one, so nobody deletes
 * an account to answer a question an export would have answered.
 *
 * The export comes first of the two because the deletions list is EMPTY for
 * almost every account: a page whose own name is missing and whose first card
 * says "nothing of yours is waiting to be deleted" opens by answering a
 * question the reader did not ask. The heading names the page, and the first
 * card is the one that always has something on it.
 *
 * Every panel is independent: each runs its own read, each renders its own
 * three or four arms, and one failing read never blanks the others. That is
 * why there is no combined "privacy" query — a screen that waited for all four
 * would be dark until the slowest of them answered, and would fail entirely
 * because one of them did.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { GDPR_I18N_KEYS } from "../i18n/keys.js";
import { AccountClosurePanel } from "./AccountClosurePanel.js";
import { DataExportPanel } from "./DataExportPanel.js";
import { DsarForm } from "./DsarForm.js";
import { PendingDeletions } from "./PendingDeletions.js";
import type { ThemeModeProp } from "./types.js";

export interface PrivacyPaneProps extends ThemeModeProp {
  /** Passed through to `<PendingDeletions/>` — see its `labelFor`. */
  readonly labelFor?: (
    subjectType: string,
    subjectKey: string
  ) => string | undefined;
  /** Passed through to `<DataExportPanel/>` — the emailed download token. */
  readonly token?: string;
  /** Passed through to `<AccountClosurePanel/>`. */
  readonly onClosureStarted?: () => void;
}

export function PrivacyPane(props: PrivacyPaneProps): ReactElement {
  const t = useT();
  const { mode, labelFor, token, onClosureStarted } = props;
  const modeProp = mode !== undefined ? { mode } : {};
  return (
    <SkinTheme {...modeProp} surface="base">
      <Flex vertical gap={spacing[4]} data-testid="gdpr-privacy">
        <Flex vertical gap={spacing[1]}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.privacyHeading)}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t(GDPR_I18N_KEYS.privacyExplain)}
          </Typography.Paragraph>
        </Flex>
        <DataExportPanel
          {...modeProp}
          {...(token !== undefined ? { token } : {})}
        />
        <PendingDeletions
          {...modeProp}
          {...(labelFor !== undefined ? { labelFor } : {})}
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
