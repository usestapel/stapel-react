/** Wallet — headless balance view + auto-recharge settings save. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { Wallet } from "../src/index.js";
import {
  BillingDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The wallet the canned GET /wallet + PATCH /wallet handler returns. */
const DEMO_WALLET = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  balance: 1240,
  currency: "USD",
  auto_recharge_enabled: false,
  auto_recharge_threshold: 100,
  auto_recharge_package: null,
  low_balance_alert: 50,
  updated_at: "2026-06-01T00:00:00Z",
};

function WalletBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="Wallet">
      <Wallet>
        {({ balance, currency, autoRechargeEnabled, isLoading, isSaving, isSaved, save }) => (
          <>
            <StepBadge
              step={isLoading ? "loading" : `${balance ?? "—"} ${currency ?? ""}`}
            />
            {isSaved ? (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {t("billing.wallet.saved")}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  save({ auto_recharge_enabled: !autoRechargeEnabled });
                }}
                labelKey={
                  isSaving ? "billing.wallet.saving" : "billing.wallet.save"
                }
              />
            </DemoActions>
          </>
        )}
      </Wallet>
    </DemoCard>
  );
}

function WalletDemo(): ReactElement {
  return (
    <BillingDemoHarness handlers={{ "/wallet": DEMO_WALLET }}>
      <WalletBody />
    </BillingDemoHarness>
  );
}

/**
 * Demonstrates the headless wallet: the canned handler returns the caller's
 * wallet for GET /wallet and echoes it for PATCH /wallet, so toggling
 * auto-recharge flips the bag into its `isSaved` state. Bring your own balance
 * chip / settings form — the component is renderless.
 */
export default defineDemo({
  id: "billing.wallet",
  title: "Wallet",
  description:
    "The headless Wallet wraps the read + partial auto-recharge settings update of the caller's wallet and exposes balance / currency / saving / saved / error state. Bring your own UI — the component is renderless.",
  component: Wallet,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <WalletDemo /> },
  },
});
