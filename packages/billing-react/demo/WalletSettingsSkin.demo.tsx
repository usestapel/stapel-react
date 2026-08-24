/**
 * Automatic top-up — the form four translated i18n keys were waiting for.
 *
 * `walletAutoRecharge`, `walletSave`, `walletSaving` and `walletSaved` were
 * written, translated into Russian, and rendered by nothing: the signature of
 * a screen that was designed and never built.
 *
 * The `no-packages` variant is the one to look at. The shop sells only plans,
 * so auto-recharge — which buys a PACKAGE — has nothing to buy, and the
 * switch is off with that sentence beside it instead of being a grey
 * rectangle a person has to guess about.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { WalletSettings } from "../src/default/WalletSettings.js";
import { BillingDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  SETTINGS_HANDLERS,
  SETTINGS_NO_PACKAGES_HANDLERS,
} from "./fixtures.js";

function Settings(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <BillingDemoHarness handlers={props.handlers}>
      <WalletSettings />
    </BillingDemoHarness>
  );
}

export default defineDemo({
  id: "billing.wallet-settings",
  title: "Automatic top-up (default skin)",
  description:
    "The auto-recharge and low-balance settings over PATCH /wallet: a trigger balance, the package bought when it is crossed, and an alert threshold — with both switched-off states explained in words beside the control.",
  component: WalletSettings,
  variants: {
    "auto-on": {
      description:
        "Auto-recharge already on and pointed at a package the shop sells.",
      step: "enabled",
      viewport: "phone",
      render: () => <Settings handlers={SETTINGS_HANDLERS} />,
    },
    "no-packages": {
      description:
        "The shop sells only plans, so there is nothing to buy automatically — and the switch says so.",
      step: "blocked",
      render: () => <Settings handlers={SETTINGS_NO_PACKAGES_HANDLERS} />,
    },
  },
});
