import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { WebhooksRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link WebhooksRuntime} to every webhooks hook and
 * headless component below it. Bring your own visual shell — this component
 * renders nothing of its own. (Core's `createModuleContext` provider, bound
 * to this pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createWebhooksRuntime({ baseUrl: "/webhooks/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <WebhooksProvider runtime={runtime}>{app}</WebhooksProvider>
 * ```
 */
export const WebhooksProvider: (props: {
  runtime: WebhooksRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
