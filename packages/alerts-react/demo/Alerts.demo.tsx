/**
 * The provider — the one thing a host mounts before anything else here works.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { ALERTS_I18N_KEYS, AlertsProvider, useIssues } from "../src/index.js";
import { AlertsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { BUSY_PAGE, STAFF_ONLY } from "./_fixtures.js";

const BUSY: DemoHandlers = { "/issues": BUSY_PAGE };
const REFUSED: DemoHandlers = { "/issues": STAFF_ONLY };

/**
 * The smallest thing a host can build on the headless layer: a count, read
 * through `useIssues`, with no skin anywhere. It is what an operations header
 * would show — and it is why the bag reports `total` separately from the rows,
 * which are one page of fifty.
 */
function OpenCount(): ReactElement {
  const t = useT();
  const bag = useIssues({ open: true });
  return (
    <Flex vertical gap={spacing[2]} data-testid="alerts-count">
      <Typography.Text strong>{t(ALERTS_I18N_KEYS.feedTitle)}</Typography.Text>
      {bag.rows.status === "ready" ? (
        <Typography.Text>{String(bag.total)}</Typography.Text>
      ) : bag.rows.status === "failed" ? (
        <Typography.Text type="warning">
          {t(ALERTS_I18N_KEYS.feedStaffOnly)}
        </Typography.Text>
      ) : (
        <Typography.Text type="secondary">
          {t(ALERTS_I18N_KEYS.feedLoading)}
        </Typography.Text>
      )}
    </Flex>
  );
}

function Mounted(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AlertsDemoHarness handlers={props.handlers}>
      <OpenCount />
    </AlertsDemoHarness>
  );
}

export default defineDemo({
  id: "alerts.provider",
  title: "Alerts provider",
  description:
    "Everything in this pair reads its client, its poll interval and its analytics seam from one runtime handed to <AlertsProvider>. The headless layer has no visual opinion at all: this demo renders a number, because a number is what a host's own operations header would want, and the hook reports the total separately from the fifty rows a page carries. The second variant is the answer most accounts get from this module — a 403, named rather than drawn as a zero.",
  component: AlertsProvider,
  variants: {
    default: {
      description: "A staff session: the tracker answers, and the count is real.",
      viewport: "desktop",
      step: "counted",
      render: () => <Mounted handlers={BUSY} />,
    },
    phone: {
      description: "390px — the same headless read, no layout of its own.",
      viewport: "phone",
      step: "counted-phone",
      render: () => <Mounted handlers={BUSY} />,
    },
    refused: {
      description:
        "Signed in, not staff. The read fails by CODE, and a host that reads the refusal can say so instead of showing a confident zero.",
      viewport: "desktop",
      step: "refused",
      render: () => <Mounted handlers={REFUSED} />,
    },
  },
});
