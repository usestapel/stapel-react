import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Wallet as WalletData, WalletUpdate } from "../api/types.js";
import { useWallet } from "../model/queries.js";
import { useUpdateWallet } from "../model/mutations.js";

/** Render-prop bag for {@link Wallet}. */
export interface WalletBag {
  /** The caller's wallet once loaded, else null. */
  readonly wallet: WalletData | null;
  /** Credit balance (integer credits), or null before load. */
  readonly balance: number | null;
  /** ISO 4217 currency code, or null before load. */
  readonly currency: string | null;
  /** Whether auto-recharge is enabled (false before load). */
  readonly autoRechargeEnabled: boolean;
  /** The initial load is in flight (no data yet). */
  readonly isLoading: boolean;
  /** Either the read or the settings save failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Persist a partial auto-recharge / alert settings update. */
  save(patch: WalletUpdate): void;
  /** A save call is in flight. */
  readonly isSaving: boolean;
  /** The last save succeeded (cleared by the next `save`). */
  readonly isSaved: boolean;
  /** Refetch the wallet from the server. */
  refetch(): void;
}

/**
 * Headless wallet — a renderless view + auto-recharge settings editor over the
 * caller's wallet. Wires {@link useWallet} + {@link useUpdateWallet} and hands a
 * {@link WalletBag} to `children`; bring your own balance chip / settings form.
 * Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <Wallet>
 *   {({ balance, currency, save }) => ( ... )}
 * </Wallet>
 * ```
 */
export function Wallet(props: {
  children: (bag: WalletBag) => ReactNode;
}): ReactNode {
  const query = useWallet();
  const mutation = useUpdateWallet();
  const wallet = query.data ?? null;
  return props.children({
    wallet,
    balance: wallet?.balance ?? null,
    currency: wallet?.currency ?? null,
    autoRechargeEnabled: wallet?.auto_recharge_enabled ?? false,
    isLoading: query.isLoading,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    save: (patch) => {
      mutation.mutate(patch);
    },
    isSaving: mutation.isPending,
    isSaved: mutation.isSuccess,
    refetch: () => {
      void query.refetch();
    },
  });
}
