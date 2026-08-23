import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { GdprRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link GdprRuntime} to every gdpr hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own. (Core's `createModuleContext` provider, bound to this
 * pair — slim wave §21/S2.)
 *
 * ```tsx
 * const runtime = createGdprRuntime({ baseUrl: "/gdpr/api/v1/" });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <GdprProvider runtime={runtime}>{app}</GdprProvider>
 * ```
 *
 * The anonymous DSAR form is mounted under this provider too: the module's
 * `POST /dsar` is `AllowAny`, so a public /privacy page gets a runtime with no
 * token seam wired and everything else on the pair stays out of that page.
 */
export const GdprProvider: (props: {
  runtime: GdprRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
