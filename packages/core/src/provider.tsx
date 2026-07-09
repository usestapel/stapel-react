/**
 * `<StapelProvider>` — the one-provider setup (slim wave §21/S4). Composes
 * the three core providers every host previously nested by hand:
 *
 *   StapelConfigProvider (client injection + analytics context)
 *   → QueryClientProvider (TanStack Query, via createStapelQueryClient)
 *   → I18nProvider (via createI18n)
 *
 * Ceremony target: install → `create<Mod>Runtime` per pair → ONE
 * `<StapelProvider>` + per-pair `<ModProvider>`. The individual providers
 * remain exported and composable — this is composition, not deprecation;
 * hosts with bespoke wiring keep using them directly.
 */
import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createStapelClient } from "./client.js";
import type { StapelClient } from "./client.js";
import { StapelConfigProvider } from "./config.js";
import type { StapelConfig } from "./config.js";
import { createStapelQueryClient } from "./query.js";
import type { StapelQueryRuntime } from "./query.js";
import { createI18n, I18nProvider } from "./i18n.js";
import type { I18nEngine } from "./i18n.js";
import type { Analytics } from "./analytics/types.js";

export interface StapelProviderProps {
  /**
   * Base URL for a default {@link StapelClient} (e.g. `"/api"`). Ignored when
   * `client` is given. One of `baseUrl` / `client` is required — pass the
   * client from your auth runtime (`runtime.client`) so token refresh and the
   * verification-403 seam are wired.
   */
  readonly baseUrl?: string;
  /** Bring your own client (typically `createAuthRuntime(...).client`). */
  readonly client?: StapelClient;
  /** Per-module client overrides (the client-injection fork seam, §7.2). */
  readonly clients?: Readonly<Record<string, StapelClient>>;
  /** Initial locale for the built-in i18n engine. Default `"en"`. */
  readonly locale?: string;
  /**
   * Query-persistence cache buster (convention: your app version). Forwarded
   * to {@link createStapelQueryClient}.
   */
  readonly cacheVersion?: string;
  /** Analytics facade (`@stapel/analytics` or your own impl of the seam). */
  readonly analytics?: Analytics;
  /**
   * Escape hatch: bring your own TanStack `QueryClient`; it is still wrapped
   * with Stapel persistence (per-user namespaces, purge).
   */
  readonly queryClient?: QueryClient;
  /**
   * Escape hatch: bring the full {@link StapelQueryRuntime} (from
   * `createStapelQueryClient`) when the host needs `setPersistUser` /
   * `purgePersistedCache` outside the tree (e.g. auth teardown). Wins over
   * `queryClient`/`cacheVersion`.
   */
  readonly queryRuntime?: StapelQueryRuntime;
  /**
   * Escape hatch: bring your own {@link I18nEngine} (from `createI18n`) when
   * you register pair bundles / locale loaders at module scope. Wins over
   * `locale`.
   */
  readonly i18n?: I18nEngine;
  readonly children: ReactNode;
}

/**
 * One provider for the whole Stapel frontend runtime. Defaults are created
 * once on mount and are deliberately NOT rebuilt when `baseUrl` /
 * `cacheVersion` / `locale` change afterwards — pass `client` /
 * `queryRuntime` / `i18n` if you need to control their lifecycle.
 */
export function StapelProvider(props: StapelProviderProps): ReactElement {
  const { baseUrl, client, queryRuntime, queryClient, cacheVersion, i18n, locale } =
    props;
  const [defaults] = useState(() => {
    const resolvedClient =
      client ?? (baseUrl !== undefined ? createStapelClient({ baseUrl }) : null);
    if (resolvedClient === null) {
      throw new Error(
        "<StapelProvider> needs a `baseUrl` or a `client` — pass your auth runtime's client to wire token refresh and verification."
      );
    }
    const resolvedQuery =
      queryRuntime ??
      createStapelQueryClient({
        ...(cacheVersion !== undefined ? { cacheVersion } : {}),
        ...(queryClient !== undefined ? { queryClient } : {}),
      });
    const resolvedI18n = i18n ?? createI18n({ locale: locale ?? "en" });
    return {
      client: resolvedClient,
      query: resolvedQuery,
      i18n: resolvedI18n,
    };
  });

  const config = useMemo<StapelConfig>(
    () => ({
      client: defaults.client,
      ...(props.clients !== undefined ? { clients: props.clients } : {}),
    }),
    [defaults.client, props.clients]
  );

  return (
    <StapelConfigProvider
      config={config}
      {...(props.analytics !== undefined ? { analytics: props.analytics } : {})}
    >
      <QueryClientProvider client={defaults.query.queryClient}>
        <I18nProvider i18n={defaults.i18n}>{props.children}</I18nProvider>
      </QueryClientProvider>
    </StapelConfigProvider>
  );
}
