/**
 * `<PrivacyAdminPane>` — the prop-free operations screen the nav manifest's
 * `admin.privacy` entry mounts: the DSAR queue over the owner-health table.
 *
 * The order is the order of urgency. A DSAR has a statutory clock on it and a
 * named person waiting; a silent data owner is a slower fault that turns into
 * missed erasure deadlines later. Both are on one screen because they are the
 * same job — being able to prove, afterwards, that the deletions happened.
 *
 * Both surfaces answer `error.403.forbidden` to a signed-in non-staff person
 * and both say so by name (`isStaffOnly`). The nav axis has two values
 * (`public` | `member`) and cannot express "staff", so the door is visible and
 * the screen does the explaining — a hidden control teaches nobody that they
 * are signed in with the wrong account.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "../types.js";
import { DsarQueue } from "./DsarQueue.js";
import { OwnersHealth } from "./OwnersHealth.js";

export type PrivacyAdminPaneProps = ThemeModeProp;

export function PrivacyAdminPane(props: PrivacyAdminPaneProps): ReactElement {
  const modeProp = props.mode !== undefined ? { mode: props.mode } : {};
  return (
    <SkinTheme {...modeProp} surface="base">
      <Flex vertical gap={spacing[4]} data-testid="gdpr-privacy-admin">
        <DsarQueue {...modeProp} />
        <OwnersHealth {...modeProp} />
      </Flex>
    </SkinTheme>
  );
}
