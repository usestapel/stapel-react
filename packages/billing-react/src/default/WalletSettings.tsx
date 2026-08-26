/**
 * `<WalletSettings/>` — automatic top-up and the low-balance warning.
 *
 * ── The §54 hole this fills ───────────────────────────────────────────────
 *
 * `PATCH /wallet` had a hook (`useUpdateWallet`), a headless bag (`Wallet`)
 * and four translated i18n keys — `walletAutoRecharge`, `walletSave`,
 * `walletSaving`, `walletSaved` — that nothing on the glass rendered. Four
 * keys written, translated into Russian, and referenced by zero components is
 * the signature of a screen that was designed and never built; this is that
 * screen.
 *
 * ── Two switched-off controls, each with its reason beside it ─────────────
 *
 * Auto-recharge buys a PACKAGE, so it cannot be switched on in a shop that
 * sells none, and it cannot be saved on without one chosen. Both are real
 * conditions, and both are stated as text next to the control through
 * `GatedControl`/`GatedButton` rather than as a grey rectangle (core's
 * `actionGate`: there is no way to spell "blocked, reason unknown"). The
 * catalogue read failing is deliberately NOT a block — the alert threshold
 * has nothing to do with the shop, and taking the whole form down because a
 * price list is unavailable is the failure mode the wallet/catalogue split
 * exists to prevent.
 *
 * When the shop DID answer and sells nothing, the block reaches the whole
 * top-up group — switch, trigger and package — and the reason is printed
 * once, in place of the description of what the feature would do. The card
 * used to leave all three live beside an empty select and say both sentences
 * at once: "there is nothing to buy automatically" directly above "we buy
 * this package for you automatically".
 *
 * ── The form is re-seeded by the server, not by the user's last keystroke ──
 *
 * The fields are local state seeded from the wallet, keyed on the wallet's
 * own `updated_at`: when a save answers, the key changes and the form
 * re-mounts on the SERVER's values. A form that kept its own state after a
 * successful write would keep showing what the user typed even where the
 * backend clamped it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Form, InputNumber, Select, Switch, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  GatedControl,
  LoadBoundary,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  mapLoad,
  matchLoad,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { BILLING_I18N_KEYS } from "../i18n/keys.js";
import type { CreditPackage, Wallet as WalletData } from "../api/types.js";
import { useCatalog, useWallet } from "../model/queries.js";
import { useUpdateWallet } from "../model/mutations.js";
import type { ThemeModeProp } from "./types.js";

export type WalletSettingsProps = ThemeModeProp;

/** The shop sells no packages → there is nothing auto-recharge could buy. */
function packagesGate(
  packages: readonly CreditPackage[],
  answered: boolean
): ActionAvailability {
  if (answered && packages.length === 0) {
    return actionBlocked(BILLING_I18N_KEYS.walletSettingsNoPackages);
  }
  return actionAvailable();
}

function SettingsForm(props: {
  wallet: WalletData;
  packages: readonly CreditPackage[];
  catalogAnswered: boolean;
}): ReactElement {
  const t = useT();
  const { wallet, packages } = props;
  const save = useUpdateWallet();
  const [enabled, setEnabled] = useState(wallet.auto_recharge_enabled);
  const [threshold, setThreshold] = useState<number>(
    wallet.auto_recharge_threshold
  );
  const [packageSlug, setPackageSlug] = useState<string | null>(
    wallet.auto_recharge_package
  );
  const [alertAt, setAlertAt] = useState<number>(wallet.low_balance_alert);

  const shopGate = packagesGate(packages, props.catalogAnswered);
  // A shop with nothing to sell has nothing to sell to a SCHEDULE either, so
  // the trigger and the package are off with it. The low-balance warning is
  // deliberately still live: it is a fact about the wallet, it has nothing to
  // do with the catalogue, and taking it away would leave a card whose only
  // remaining control is a Save that saves nothing.
  const shopBlocked = !shopGate.available;
  const saveGate =
    enabled && packageSlug === null
      ? actionBlocked(BILLING_I18N_KEYS.walletSettingsNeedsPackage)
      : actionAvailable();

  return (
    <Flex vertical gap={spacing[3]}>
      <Form layout="vertical" component="div">
        <Form.Item
          label={t(BILLING_I18N_KEYS.walletAutoRecharge)}
          // The reason a control is OFF replaces the description of what it
          // would do when on — printing both left the card saying "there is
          // nothing to buy automatically" directly above "we buy this package
          // for you automatically" (visual class VC-B1).
          {...(shopBlocked
            ? {}
            : { help: t(BILLING_I18N_KEYS.walletAutoRechargeHint) })}
        >
          <GatedControl gate={shopGate} layout="stack">
            {(bind) => (
              <Switch
                checked={enabled}
                disabled={bind.disabled}
                aria-describedby={bind["aria-describedby"]}
                aria-label={t(BILLING_I18N_KEYS.walletAutoRecharge)}
                data-testid="billing-wallet-auto-recharge"
                data-analytics="none"
                data-analytics-reason="local form state; the tracked point is the save"
                onChange={setEnabled}
              />
            )}
          </GatedControl>
        </Form.Item>

        <Form.Item label={t(BILLING_I18N_KEYS.walletThreshold)}>
          <InputNumber
            min={0}
            precision={0}
            value={threshold}
            disabled={shopBlocked}
            data-testid="billing-wallet-threshold"
            aria-label={t(BILLING_I18N_KEYS.walletThreshold)}
            onChange={(value) => {
              setThreshold(value ?? 0);
            }}
          />
        </Form.Item>

        <Form.Item label={t(BILLING_I18N_KEYS.walletPackage)}>
          <Select
            value={packageSlug}
            disabled={shopBlocked}
            placeholder={t(
              shopBlocked
                ? BILLING_I18N_KEYS.walletPackageNone
                : BILLING_I18N_KEYS.walletPackagePlaceholder
            )}
            data-testid="billing-wallet-package"
            aria-label={t(BILLING_I18N_KEYS.walletPackage)}
            options={packages.map((pack) => ({
              value: pack.slug,
              label: pack.name,
            }))}
            onChange={(value: string | null) => {
              setPackageSlug(value);
            }}
          />
        </Form.Item>

        <Form.Item label={t(BILLING_I18N_KEYS.walletLowBalanceAlert)}>
          <InputNumber
            min={0}
            precision={0}
            value={alertAt}
            data-testid="billing-wallet-alert"
            aria-label={t(BILLING_I18N_KEYS.walletLowBalanceAlert)}
            onChange={(value) => {
              setAlertAt(value ?? 0);
            }}
          />
        </Form.Item>
      </Form>

      {save.isError ? (
        <ErrorAlert thrown={save.error} testId="billing-wallet-save-failed" />
      ) : null}
      {save.isSuccess ? (
        <Typography.Text type="success" data-testid="billing-wallet-saved">
          {t(BILLING_I18N_KEYS.walletSaved)}
        </Typography.Text>
      ) : null}

      <Flex align="flex-start">
        <GatedButton
          gate={saveGate}
          type="primary"
          loading={save.isPending}
          testId="billing-wallet-save"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          onClick={() => {
            save.mutate({
              auto_recharge_enabled: enabled,
              auto_recharge_threshold: threshold,
              auto_recharge_package: packageSlug,
              low_balance_alert: alertAt,
            });
          }}
        >
          {t(
            save.isPending
              ? BILLING_I18N_KEYS.walletSaving
              : BILLING_I18N_KEYS.walletSave
          )}
        </GatedButton>
      </Flex>
    </Flex>
  );
}

/**
 * The auto-recharge settings surface — the default skin over the `Wallet`
 * headless bag's write half (`useUpdateWallet`). Composed into
 * `<WalletPanel/>`; mountable on its own.
 */
export function WalletSettings(props: WalletSettingsProps = {}): ReactElement {
  const t = useT();
  const { mode } = props;
  const wallet = useWallet();
  const catalog = useCatalog();
  const state = loadStateFromQuery(wallet);
  // "The shop answered and sells nothing" and "we could not read the shop"
  // are different facts, and only the first may switch a control off. Folding
  // the catalogue through matchLoad keeps them apart; `data ?? []` would not.
  const shop = matchLoad(
    // See SubscriptionCard: this is the body of a SUCCEEDED read, where an
    // absent `packages` means the shop sells none — the three answers are
    // kept apart by the matchLoad around it, not collapsed by this `??`.
    mapLoad(loadStateFromQuery(catalog), (answered) => answered.packages ?? []),
    {
      loading: () => ({ packages: [] as readonly CreditPackage[], answered: false }),
      failed: () => ({ packages: [] as readonly CreditPackage[], answered: false }),
      ready: (packages) => ({ packages, answered: true }),
    }
  );

  return (
    <SkinTheme
      surface="bare"
      {...(mode !== undefined ? { mode } : {})}
      data-testid="billing-wallet-settings"
    >
      <Card size="small" title={t(BILLING_I18N_KEYS.walletSettingsHeading)}>
        <LoadBoundary
          state={state}
          testId="billing-wallet-settings"
          onRetry={() => {
            void wallet.refetch();
          }}
        >
          {(data) => (
            // Keyed on the server's own version of this wallet: a successful
            // save re-mounts the form on what the backend stored.
            <SettingsForm
              key={data.updated_at}
              wallet={data}
              packages={shop.packages}
              catalogAnswered={shop.answered}
            />
          )}
        </LoadBoundary>
      </Card>
    </SkinTheme>
  );
}
